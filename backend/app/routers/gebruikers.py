"""Gebruikersbeheer binnen één organisatie (alleen owner/admin).

Alle queries worden automatisch op de organisatie van de ingelogde beheerder
gefilterd (zie tenant.py), zodat een beheerder uitsluitend gebruikers van de
eigen organisatie ziet en beheert."""
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas, auth_service, mail_service
from ..database import get_db

router = APIRouter(prefix="/api/gebruikers", tags=["gebruikers"])

# Rollen die via een uitnodiging/aanpassing toegekend mogen worden.
TOEKENBARE_ROLLEN = {"user", "admin", "owner"}


def _frontend_basis() -> str:
    """Basis-URL van de frontend voor de uitnodigingslink (eerste FRONTEND_URL)."""
    url = os.getenv("FRONTEND_URL", "").strip()
    if url:
        return url.split(",")[0].strip().rstrip("/")
    return "http://localhost:5173"


def _uitnodiging_link(token: str) -> str:
    # HashRouter-link: /#/uitnodiging/<token>
    return f"{_frontend_basis()}/#/uitnodiging/{token}"


@router.get("", response_model=list[schemas.GebruikerOut])
def lijst_gebruikers(
    _beheerder: models.Gebruiker = Depends(auth_service.vereis_beheerder),
    db: Session = Depends(get_db),
):
    """Lijst alle gebruikers van de eigen organisatie."""
    gebruikers = (
        db.query(models.Gebruiker)
        .order_by(models.Gebruiker.aangemaakt_op)
        .all()
    )
    return [auth_service.gebruiker_naar_schema(g) for g in gebruikers]


@router.post("/uitnodigen", response_model=schemas.UitnodigingResultaat)
def uitnodigen(
    gegevens: schemas.UitnodigingRequest,
    beheerder: models.Gebruiker = Depends(auth_service.vereis_beheerder),
    db: Session = Depends(get_db),
):
    """Nodig een nieuw e-mailadres uit voor de eigen organisatie.

    Maakt een gebruiker met een openstaande uitnodiging (48 uur geldig) en stuurt
    een uitnodigingsmail. Bestaat het adres al binnen de organisatie én is de
    uitnodiging nog open, dan wordt een nieuwe link gegenereerd (opnieuw sturen)."""
    email = (gegevens.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Ongeldig e-mailadres")
    rol = gegevens.rol if gegevens.rol in TOEKENBARE_ROLLEN else "user"
    if rol == "owner" and beheerder.rol not in ("owner", "superadmin"):
        raise HTTPException(
            status_code=403, detail="Alleen een owner kan de owner-rol toekennen"
        )

    token = auth_service.genereer_uitnodiging_token()
    verloopt = datetime.utcnow() + timedelta(
        hours=auth_service.UITNODIGING_GELDIGHEID_UREN
    )

    # Bestaat het adres al binnen deze organisatie?
    bestaand = (
        db.query(models.Gebruiker).filter(models.Gebruiker.email == email).first()
    )
    if bestaand:
        if not bestaand.uitnodiging_token and bestaand.wachtwoord_hash:
            raise HTTPException(
                status_code=409, detail="Deze gebruiker bestaat al in de organisatie"
            )
        # Openstaande uitnodiging: opnieuw uitnodigen (nieuwe link).
        bestaand.uitnodiging_token = token
        bestaand.uitnodiging_verloopt = verloopt
        bestaand.rol = rol
        if gegevens.naam:
            bestaand.naam = gegevens.naam.strip()
        gebruiker = bestaand
    else:
        gebruiker = models.Gebruiker(
            organisatie_id=beheerder.organisatie_id,
            email=email,
            wachtwoord_hash="",  # nog geen wachtwoord (openstaande uitnodiging)
            naam=(gegevens.naam or "").strip() or None,
            rol=rol,
            actief=False,
            uitgenodigd_door=beheerder.id,
            uitnodiging_token=token,
            uitnodiging_verloopt=verloopt,
        )
        db.add(gebruiker)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Dit e-mailadres is al in gebruik op het platform",
        )
    db.refresh(gebruiker)

    link = _uitnodiging_link(token)
    organisatie = (
        db.get(models.Organisatie, beheerder.organisatie_id)
        if beheerder.organisatie_id
        else None
    )
    org_naam = organisatie.naam if organisatie else "PowerCompliance"
    tekst = (
        f"Hallo,\n\n"
        f"Je bent uitgenodigd om deel te nemen aan {org_naam} op PowerCompliance.\n\n"
        f"Klik op onderstaande link om je wachtwoord in te stellen en direct in te "
        f"loggen (de link is 48 uur geldig):\n\n{link}\n\n"
        f"Met vriendelijke groet,\nHet PowerCompliance-team"
    )
    mail = mail_service.verstuur_mail(
        onderwerp=f"Uitnodiging voor {org_naam} op PowerCompliance",
        tekst=tekst,
        aan_naam=gebruiker.naam,
        aan_email=gebruiker.email,
    )

    return schemas.UitnodigingResultaat(
        gebruiker=auth_service.gebruiker_naar_schema(gebruiker),
        uitnodiging_link=link,
        mail_verzonden=bool(mail.get("verzonden")),
        mail_info=mail.get("info"),
    )


@router.put("/{gebruiker_id}", response_model=schemas.GebruikerOut)
def wijzig_gebruiker(
    gebruiker_id: int,
    wijziging: schemas.GebruikerUpdate,
    beheerder: models.Gebruiker = Depends(auth_service.vereis_beheerder),
    db: Session = Depends(get_db),
):
    """Wijzig de rol of (de)activeer een gebruiker binnen de eigen organisatie."""
    gebruiker = db.get(models.Gebruiker, gebruiker_id)
    if not gebruiker:  # buiten de eigen org → tenant-filter geeft None
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")
    if gebruiker.id == beheerder.id:
        raise HTTPException(
            status_code=400, detail="Je kunt je eigen account niet aanpassen"
        )

    if wijziging.rol is not None:
        if wijziging.rol not in TOEKENBARE_ROLLEN:
            raise HTTPException(status_code=422, detail="Onbekende rol")
        if wijziging.rol == "owner" and beheerder.rol not in ("owner", "superadmin"):
            raise HTTPException(
                status_code=403, detail="Alleen een owner kan de owner-rol toekennen"
            )
        gebruiker.rol = wijziging.rol
    if wijziging.actief is not None:
        gebruiker.actief = wijziging.actief

    db.commit()
    db.refresh(gebruiker)
    return auth_service.gebruiker_naar_schema(gebruiker)


@router.delete("/{gebruiker_id}", status_code=204)
def verwijder_gebruiker(
    gebruiker_id: int,
    beheerder: models.Gebruiker = Depends(auth_service.vereis_beheerder),
    db: Session = Depends(get_db),
):
    """Verwijder een gebruiker uit de eigen organisatie."""
    gebruiker = db.get(models.Gebruiker, gebruiker_id)
    if not gebruiker:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden")
    if gebruiker.id == beheerder.id:
        raise HTTPException(
            status_code=400, detail="Je kunt je eigen account niet verwijderen"
        )
    db.delete(gebruiker)
    db.commit()
    return None
