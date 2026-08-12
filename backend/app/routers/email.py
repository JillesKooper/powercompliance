from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import (
    models,
    schemas,
    email_generator,
    mail_service,
    compliance_service,
    activiteit_service,
    notificatie_teksten,
)
from ..database import get_db

router = APIRouter(prefix="/api/email", tags=["email"])


def _haal_leverancier(db: Session, leverancier_id: int) -> models.Leverancier:
    lev = db.get(models.Leverancier, leverancier_id)
    if not lev:
        raise HTTPException(status_code=404, detail="Leverancier niet gevonden")
    return lev


def _haal_product(
    db: Session, leverancier: models.Leverancier, product_id: Optional[int]
) -> Optional[models.Product]:
    """Valideer dat het product bestaat én bij deze leverancier hoort."""
    if product_id is None:
        return None
    product = db.get(models.Product, product_id)
    if not product or product.leverancier_id != leverancier.id:
        raise HTTPException(
            status_code=404, detail="Product niet gevonden bij deze leverancier"
        )
    return product


@router.post("/genereer", response_model=schemas.EmailGenereerResponse)
def genereer_email(data: schemas.EmailGenereerRequest, db: Session = Depends(get_db)):
    lev = _haal_leverancier(db, data.leverancier_id)
    taal = "en" if data.taal == "en" else "nl"
    code = data.wetgeving_code or None
    product = _haal_product(db, lev, data.product_id)

    per_product, per_wet = email_generator.verzamel_ontbrekend(
        db, lev, code, data.product_id, taal
    )
    aantal_producten = len(per_product)
    aantal_velden = sum(len(velden) for _, velden in per_product)

    # bepaal de scope (product > wetgeving > leverancier) voor de frontend
    if product is not None:
        scope = "product"
    elif code:
        scope = "wetgeving"
    else:
        scope = "leverancier"

    link = email_generator.portaal_link(lev)
    tekst, ai_gebruikt, ai_fout = email_generator.genereer_tekst(
        lev, per_wet, data.deadline, taal, link, aantal_velden, aantal_producten
    )

    bijlage_url = f"/api/email/bijlage/{lev.id}"
    params = []
    if code:
        params.append(f"wetgeving={code}")
    if product is not None:
        params.append(f"product={product.id}")
    if params:
        bijlage_url += "?" + "&".join(params)

    return schemas.EmailGenereerResponse(
        leverancier_id=lev.id,
        aan_naam=lev.contactpersoon,
        aan_email=lev.email,
        cc=email_generator.CC_ADRES,
        onderwerp=email_generator.maak_onderwerp(
            lev, per_wet, taal, data.deadline, product
        ),
        tekst=tekst,
        portaal_link=link,
        bestandsnaam=email_generator.bijlage_naam(lev, code, product),
        bijlage_url=bijlage_url,
        aantal_velden=aantal_velden,
        aantal_producten=aantal_producten,
        taal=taal,
        ai_gebruikt=ai_gebruikt,
        ai_fout=ai_fout,
        scope=scope,
        product_id=product.id if product else None,
        product_naam=product.naam if product else None,
    )


@router.get("/bijlage/{leverancier_id}")
def download_bijlage(
    leverancier_id: int,
    wetgeving: Optional[str] = None,
    product: Optional[int] = None,
    taal: str = "nl",
    db: Session = Depends(get_db),
):
    taal = "en" if taal == "en" else "nl"
    lev = _haal_leverancier(db, leverancier_id)
    product_obj = _haal_product(db, lev, product)
    buf = email_generator.bouw_excel(db, lev, wetgeving, product, taal)
    naam = email_generator.bijlage_naam(lev, wetgeving, product_obj)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{naam}"'},
    )


@router.post("/verstuur", response_model=schemas.EmailVerstuurResultaat, status_code=201)
def verstuur_email(data: schemas.EmailVerstuurRequest, db: Session = Depends(get_db)):
    """Verstuurt het dataverzoek als echte e-mail via Gmail SMTP en legt het vast.

    Zonder GMAIL_USER / GMAIL_APP_PASSWORD wordt de verzending gesimuleerd, zodat
    de functionaliteit altijd werkt.
    """
    lev = _haal_leverancier(db, data.leverancier_id)
    product = _haal_product(db, lev, data.product_id)
    taal = "en" if data.taal == "en" else "nl"

    # Excel-bijlage met de exacte ontbrekende velden meesturen, in dezelfde scope
    # (1 product / 1 wetgeving / hele leverancier) als de gegenereerde mail, en in
    # dezelfde taal als de mail (Engelse veldnamen bij taal="en").
    bijlage = email_generator.bouw_excel_bytes(
        db, lev, data.wetgeving_code, data.product_id, taal
    )
    bijlage_naam = email_generator.bijlage_naam(lev, data.wetgeving_code, product)

    mail = mail_service.verstuur_mail(
        onderwerp=data.onderwerp,
        tekst=data.tekst or "",
        aan_naam=data.aan_naam or lev.contactpersoon,
        aan_email=data.aan_email or lev.email,
        bijlage=bijlage,
        bijlage_naam=bijlage_naam,
    )

    kanaal_tekst = (
        f"Echt verstuurd via Gmail SMTP naar {mail['ontvanger']}."
        if mail["kanaal"] == "gmail" and mail["verzonden"]
        else f"Verzending gesimuleerd ({mail['info']})."
    )
    verzoek = models.Dataverzoek(
        leverancier_id=lev.id,
        onderwerp=data.onderwerp,
        bericht=f"Dataverzoek-e-mail vanuit PowerCompliance. {kanaal_tekst}",
        verzonden_bericht=data.tekst or "",
        status="verzonden",
        deadline=data.deadline,
        aangemaakt_op=datetime.utcnow(),
    )
    db.add(verzoek)
    db.flush()  # verzoek.id nodig voor de regels

    # Leg vast welke producten/velden zijn uitgevraagd (exact dezelfde scope als de
    # meegestuurde Excel-bijlage), zodat het dataverzoek-detail dit kan tonen.
    per_product, _ = email_generator.verzamel_ontbrekend(
        db, lev, data.wetgeving_code, data.product_id, taal
    )
    for prod, velden in per_product:
        for veld in velden:
            db.add(
                models.DataverzoekRegel(
                    dataverzoek_id=verzoek.id,
                    product_id=prod.id,
                    compliance_veld_id=veld.id,
                )
            )
    db.add(
        notificatie_teksten.maak(
            "dataverzoek_verstuurd",
            {"leverancier": lev.naam, "onderwerp": data.onderwerp, "kanaal": kanaal_tekst},
            type="succes",
            categorie="Dataverzoek verstuurd",
        )
    )
    activiteit_service.log_activiteit(
        db,
        lev.id,
        activiteit_service.MAIL_VERSTUURD,
        f"Dataverzoek verstuurd — {data.onderwerp}",
        detail=(data.tekst or "") + f"\n\n[{kanaal_tekst}]",
    )
    db.commit()
    db.refresh(verzoek)
    compliance_service.invalideer_dashboard()
    return schemas.EmailVerstuurResultaat(
        dataverzoek=schemas.DataverzoekOut.model_validate(verzoek),
        mail=schemas.MailAflevering(**mail),
    )


@router.get(
    "/uitvraag-wetgeving/{wetgeving_code}/leveranciers",
    response_model=list[schemas.WetgevingUitvraagLeverancier],
)
def leveranciers_voor_wetgeving(wetgeving_code: str, db: Session = Depends(get_db)):
    """Leveranciers met ontbrekende data voor deze wetgeving."""
    return email_generator.leveranciers_met_ontbrekend_voor_wetgeving(
        db, wetgeving_code
    )


@router.post(
    "/uitvraag-wetgeving", response_model=schemas.WetgevingUitvraagResultaat
)
def uitvraag_wetgeving(
    data: schemas.WetgevingUitvraagRequest, db: Session = Depends(get_db)
):
    """Stuur in één keer een dataverzoek naar alle (of geselecteerde) leveranciers
    met ontbrekende data voor de opgegeven wetgeving."""
    taal = "en" if data.taal == "en" else "nl"
    betrokken = email_generator.leveranciers_met_ontbrekend_voor_wetgeving(
        db, data.wetgeving_code
    )
    if data.leverancier_ids is not None:
        gekozen = set(data.leverancier_ids)
        betrokken = [b for b in betrokken if b["id"] in gekozen]

    verstuurd = []
    for b in betrokken:
        lev = db.get(models.Leverancier, b["id"])
        if not lev:
            continue
        _, per_wet = email_generator.verzamel_ontbrekend(
            db, lev, data.wetgeving_code, taal=taal
        )
        onderwerp = email_generator.maak_onderwerp(lev, per_wet, taal, data.deadline)
        db.add(
            models.Dataverzoek(
                leverancier_id=lev.id,
                onderwerp=onderwerp,
                bericht=f"Gericht dataverzoek voor {data.wetgeving_code} vanuit PowerCompliance.",
                status="verzonden",
                deadline=data.deadline,
            )
        )
        activiteit_service.log_activiteit(
            db,
            lev.id,
            activiteit_service.MAIL_VERSTUURD,
            f"Dataverzoek verstuurd ({data.wetgeving_code}) — {onderwerp}",
        )
        verstuurd.append({"id": lev.id, "naam": lev.naam, "onderwerp": onderwerp})

    if verstuurd:
        db.add(
            notificatie_teksten.maak(
                "bulk_dataverzoek_wetgeving",
                {
                    "aantal": len(verstuurd),
                    "code": data.wetgeving_code,
                    "namen": ", ".join(v["naam"] for v in verstuurd),
                },
                type="succes",
                categorie="Dataverzoek verstuurd",
            )
        )
    db.commit()
    compliance_service.invalideer_dashboard()

    return schemas.WetgevingUitvraagResultaat(
        wetgeving_code=data.wetgeving_code,
        aantal=len(verstuurd),
        leveranciers=verstuurd,
    )
