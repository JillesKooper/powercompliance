"""Authenticatie: wachtwoord-hashing (bcrypt) en JWT-tokens (python-jose).

- Wachtwoorden worden met bcrypt gehasht; de platte tekst wordt nooit bewaard.
- Een JWT-token bevat het gebruikers-id (``sub``) en verloopt na 8 uur.
- ``get_current_user`` is een FastAPI-dependency die de Bearer-token valideert
  en de bijbehorende ``Gebruiker`` teruggeeft (of 401 werpt).

De onderteken-sleutel komt uit ``JWT_SECRET`` (env). Zonder die variabele valt
hij terug op een vaste dev-sleutel; zet in productie altijd een eigen geheim.
"""
import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from . import models
from .database import get_db

SECRET_KEY = os.getenv("JWT_SECRET", "powercompliance-dev-secret-wijzig-in-productie")
ALGORITHM = "HS256"
TOKEN_GELDIGHEID_UREN = 8

# tokenUrl is puur informatief (Swagger); onze frontend praat direct met /api/auth/login.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


# ---------- Wachtwoorden ----------
def hash_wachtwoord(wachtwoord: str) -> str:
    """Maak een bcrypt-hash van een wachtwoord (opslag als UTF-8 string)."""
    # bcrypt werkt op maximaal 72 bytes; langere wachtwoorden worden afgekapt.
    wachtwoord_bytes = wachtwoord.encode("utf-8")[:72]
    return bcrypt.hashpw(wachtwoord_bytes, bcrypt.gensalt()).decode("utf-8")


def controleer_wachtwoord(wachtwoord: str, hash_str: str) -> bool:
    """Vergelijk een wachtwoord met een opgeslagen bcrypt-hash."""
    try:
        return bcrypt.checkpw(
            wachtwoord.encode("utf-8")[:72], hash_str.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


# ---------- JWT ----------
def maak_token(gebruiker: "models.Gebruiker") -> str:
    """Genereer een JWT dat na 8 uur verloopt (sub = gebruikers-id)."""
    verloopt = datetime.utcnow() + timedelta(hours=TOKEN_GELDIGHEID_UREN)
    payload = {
        "sub": str(gebruiker.id),
        "email": gebruiker.email,
        "rol": gebruiker.rol,
        "exp": verloopt,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decodeer_token(token: str) -> Optional[dict]:
    """Decodeer en valideer een JWT; geeft None bij een ongeldig/verlopen token."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ---------- FastAPI-dependency ----------
def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> "models.Gebruiker":
    """Valideer de Bearer-token en geef de ingelogde gebruiker terug."""
    credential_fout = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Niet geautoriseerd",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credential_fout
    payload = decodeer_token(token)
    if not payload:
        raise credential_fout
    gebruiker_id = payload.get("sub")
    if not gebruiker_id:
        raise credential_fout
    gebruiker = db.get(models.Gebruiker, int(gebruiker_id))
    if not gebruiker:
        raise credential_fout
    return gebruiker


def zorg_admin_gebruiker(db: Session) -> None:
    """Maak de standaard admin-gebruiker aan als er nog geen gebruikers zijn.

    Idempotent: draait bij elke startup en bij seed, maar doet niets zodra er al
    een gebruiker bestaat. Zo kan er altijd ingelogd worden, ook op een
    productie-DB die niet opnieuw geseed wordt."""
    if db.query(models.Gebruiker).count() > 0:
        return
    admin = models.Gebruiker(
        email="admin@powercompliance.nl",
        wachtwoord_hash=hash_wachtwoord("Admin2024!"),
        naam="Beheerder",
        bedrijf="PowerCompliance",
        rol="admin",
    )
    db.add(admin)
    db.commit()
