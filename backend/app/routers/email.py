from datetime import datetime

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

    per_product, per_wet = email_generator.verzamel_ontbrekend(db, lev)
    aantal_producten = len(per_product)
    aantal_velden = sum(len(velden) for _, velden in per_product)

    link = email_generator.portaal_link(lev)
    tekst, ai_gebruikt, ai_fout = email_generator.genereer_tekst(
        lev, per_wet, data.deadline, taal, link, aantal_velden, aantal_producten
    )

    return schemas.EmailGenereerResponse(
        leverancier_id=lev.id,
        aan_naam=lev.contactpersoon,
        aan_email=lev.email,
        cc=email_generator.CC_ADRES,
        onderwerp=email_generator.maak_onderwerp(lev, per_wet, taal),
        tekst=tekst,
        portaal_link=link,
        bestandsnaam=email_generator.bijlage_naam(lev),
        bijlage_url=f"/api/email/bijlage/{lev.id}",
        aantal_velden=aantal_velden,
        aantal_producten=aantal_producten,
        taal=taal,
        ai_gebruikt=ai_gebruikt,
        ai_fout=ai_fout,
    )


@router.get("/bijlage/{leverancier_id}")
def download_bijlage(leverancier_id: int, db: Session = Depends(get_db)):
    lev = _haal_leverancier(db, leverancier_id)
    buf = email_generator.bouw_excel(db, lev)
    naam = email_generator.bijlage_naam(lev)
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
