"""Authenticatie-endpoints: inloggen en ophalen van de ingelogde gebruiker.

Deze routes zijn (deels) publiek toegankelijk: ``/api/auth/login`` heeft nog
geen token nodig. ``/api/auth/me`` vereist wél een geldige Bearer-token en geeft
de bijbehorende gebruiker terug — handig om na het herladen van de frontend te
controleren of het opgeslagen token nog geldig is."""
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
        db.query(models.Gebruiker)
        .filter(models.Gebruiker.email == email)
        .first()
    )
    if not gebruiker or not auth_service.controleer_wachtwoord(
        gegevens.wachtwoord, gebruiker.wachtwoord_hash
    ):
        # Bewust één generieke melding: verklap niet of het e-mailadres bestaat.
        raise HTTPException(status_code=401, detail="Onjuist e-mailadres of wachtwoord")
    token = auth_service.maak_token(gebruiker)
    return schemas.LoginResultaat(token=token, gebruiker=gebruiker)


@router.post("/me", response_model=schemas.GebruikerOut)
def huidige_gebruiker(
    gebruiker: models.Gebruiker = Depends(auth_service.get_current_user),
):
    """Geef de gebruiker terug die bij de meegestuurde token hoort."""
    return gebruiker
