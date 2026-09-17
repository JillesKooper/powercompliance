"""Authenticatie-endpoints: inloggen, huidige gebruiker en de uitnodigingsflow.

Publiek (geen token nodig): ``/api/auth/login`` en de uitnodigingsroutes
(``/api/auth/uitnodiging/...``). ``/api/auth/me`` vereist een geldige token."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth_service
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=schemas.LoginResultaat)
def login(gegevens: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Valideer e-mail + wachtwoord en geef een JWT-token terug (8 uur geldig)."""
    email = (gegevens.email or "").strip().lower()
    gebruiker = (
        db.query(models.Gebruiker).filter(models.Gebruiker.email == email).first()
    )
    if (
        not gebruiker
        or not gebruiker.wachtwoord_hash
        or not auth_service.controleer_wachtwoord(
            gegevens.wachtwoord, gebruiker.wachtwoord_hash
        )
    ):
        # Bewust één generieke melding: verklap niet of het e-mailadres bestaat.
        raise HTTPException(status_code=401, detail="Onjuist e-mailadres of wachtwoord")
    if not gebruiker.actief:
        raise HTTPException(status_code=403, detail="Account is gedeactiveerd")

    gebruiker.laatste_login = datetime.utcnow()
    db.commit()

    token = auth_service.maak_token(gebruiker)
    return schemas.LoginResultaat(
        token=token, gebruiker=auth_service.gebruiker_naar_schema(gebruiker)
    )


@router.post("/me", response_model=schemas.GebruikerOut)
def huidige_gebruiker(
    gebruiker: models.Gebruiker = Depends(auth_service.get_current_user),
):
    """Geef de gebruiker terug die bij de meegestuurde token hoort."""
    return auth_service.gebruiker_naar_schema(gebruiker)


# ---------- Uitnodigingsflow (publiek) ----------
def _geldige_uitnodiging(db: Session, token: str):
    """Zoek een openstaande, niet-verlopen uitnodiging bij het gegeven token."""
    if not token:
        return None
    gebruiker = (
        db.query(models.Gebruiker)
        .filter(models.Gebruiker.uitnodiging_token == token)
        .first()
    )
    if not gebruiker or not gebruiker.uitnodiging_verloopt:
        return None
    if gebruiker.uitnodiging_verloopt < datetime.utcnow():
        return None
    return gebruiker


@router.get("/uitnodiging/{token}", response_model=schemas.UitnodigingInfo)
def uitnodiging_info(token: str, db: Session = Depends(get_db)):
    """Valideer een uitnodigingslink en geef info voor de wachtwoord-pagina."""
    gebruiker = _geldige_uitnodiging(db, token)
    if not gebruiker:
        return schemas.UitnodigingInfo(email="", geldig=False)
    organisatie = (
        db.get(models.Organisatie, gebruiker.organisatie_id)
        if gebruiker.organisatie_id
        else None
    )
    return schemas.UitnodigingInfo(
        email=gebruiker.email,
        naam=gebruiker.naam,
        organisatie_naam=organisatie.naam if organisatie else None,
        geldig=True,
    )


@router.post("/uitnodiging/accepteer", response_model=schemas.LoginResultaat)
def uitnodiging_accepteren(
    gegevens: schemas.UitnodigingAccepteer, db: Session = Depends(get_db)
):
    """Stel het wachtwoord in via de uitnodiging en log de gebruiker direct in."""
    gebruiker = _geldige_uitnodiging(db, gegevens.token)
    if not gebruiker:
        raise HTTPException(
            status_code=400, detail="Uitnodiging is ongeldig of verlopen"
        )
    if not gegevens.wachtwoord or len(gegevens.wachtwoord) < 8:
        raise HTTPException(
            status_code=422, detail="Wachtwoord moet minstens 8 tekens bevatten"
        )
    gebruiker.wachtwoord_hash = auth_service.hash_wachtwoord(gegevens.wachtwoord)
    if gegevens.naam:
        gebruiker.naam = gegevens.naam.strip()
    gebruiker.actief = True
    gebruiker.uitnodiging_token = None
    gebruiker.uitnodiging_verloopt = None
    gebruiker.laatste_login = datetime.utcnow()
    db.commit()

    token = auth_service.maak_token(gebruiker)
    return schemas.LoginResultaat(
        token=token, gebruiker=auth_service.gebruiker_naar_schema(gebruiker)
    )
