from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import models, schemas, email_generator
from ..database import get_db

router = APIRouter(prefix="/api/email", tags=["email"])


def _haal_leverancier(db: Session, leverancier_id: int) -> models.Leverancier:
    lev = db.get(models.Leverancier, leverancier_id)
    if not lev:
        raise HTTPException(status_code=404, detail="Leverancier niet gevonden")
    return lev


@router.post("/genereer", response_model=schemas.EmailGenereerResponse)
def genereer_email(data: schemas.EmailGenereerRequest, db: Session = Depends(get_db)):
    lev = _haal_leverancier(db, data.leverancier_id)
    taal = "en" if data.taal == "en" else "nl"
    code = data.wetgeving_code or None

    per_product, per_wet = email_generator.verzamel_ontbrekend(db, lev, code)
    aantal_producten = len(per_product)
    aantal_velden = sum(len(velden) for _, velden in per_product)

    link = email_generator.portaal_link(lev)
    tekst, ai_gebruikt, ai_fout = email_generator.genereer_tekst(
        lev, per_wet, data.deadline, taal, link, aantal_velden, aantal_producten
    )

    bijlage_url = f"/api/email/bijlage/{lev.id}"
    if code:
        bijlage_url += f"?wetgeving={code}"

    return schemas.EmailGenereerResponse(
        leverancier_id=lev.id,
        aan_naam=lev.contactpersoon,
        aan_email=lev.email,
        cc=email_generator.CC_ADRES,
        onderwerp=email_generator.maak_onderwerp(lev, per_wet, taal, data.deadline),
        tekst=tekst,
        portaal_link=link,
        bestandsnaam=email_generator.bijlage_naam(lev, code),
        bijlage_url=bijlage_url,
        aantal_velden=aantal_velden,
        aantal_producten=aantal_producten,
        taal=taal,
        ai_gebruikt=ai_gebruikt,
        ai_fout=ai_fout,
    )


@router.get("/bijlage/{leverancier_id}")
def download_bijlage(
    leverancier_id: int, wetgeving: Optional[str] = None, db: Session = Depends(get_db)
):
    lev = _haal_leverancier(db, leverancier_id)
    buf = email_generator.bouw_excel(db, lev, wetgeving)
    naam = email_generator.bijlage_naam(lev, wetgeving)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{naam}"'},
    )


@router.post("/verstuur", response_model=schemas.DataverzoekOut, status_code=201)
def verstuur_email(data: schemas.EmailVerstuurRequest, db: Session = Depends(get_db)):
    """Registreert het verzonden dataverzoek + een notificatie.

    (Er is geen echte SMTP-koppeling; dit legt de verzending vast in het systeem.)
    """
    lev = _haal_leverancier(db, data.leverancier_id)
    verzoek = models.Dataverzoek(
        leverancier_id=lev.id,
        onderwerp=data.onderwerp,
        bericht="Dataverzoek-e-mail gegenereerd en verstuurd vanuit PowerCompliance.",
        status="verzonden",
        deadline=data.deadline,
        aangemaakt_op=datetime.utcnow(),
    )
    db.add(verzoek)
    db.add(
        models.Notificatie(
            titel=f"Dataverzoek verstuurd naar {lev.naam}",
            bericht=data.onderwerp,
            type="succes",
        )
    )
    db.commit()
    db.refresh(verzoek)
    return verzoek


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
        _, per_wet = email_generator.verzamel_ontbrekend(db, lev, data.wetgeving_code)
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
        verstuurd.append({"id": lev.id, "naam": lev.naam, "onderwerp": onderwerp})

    if verstuurd:
        db.add(
            models.Notificatie(
                titel=f"{len(verstuurd)} dataverzoeken verstuurd voor {data.wetgeving_code}",
                bericht="Verzonden naar: "
                + ", ".join(v["naam"] for v in verstuurd),
                type="succes",
            )
        )
    db.commit()

    return schemas.WetgevingUitvraagResultaat(
        wetgeving_code=data.wetgeving_code,
        aantal=len(verstuurd),
        leveranciers=verstuurd,
    )
