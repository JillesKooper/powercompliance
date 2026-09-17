"""Authenticatie: wachtwoord-hashing (bcrypt) en JWT-tokens (python-jose).

- Wachtwoorden worden met bcrypt gehasht; de platte tekst wordt nooit bewaard.
- Een JWT-token bevat het gebruikers-id (``sub``) en verloopt na 8 uur.
- ``get_current_user`` is een FastAPI-dependency die de Bearer-token valideert
  en de bijbehorende ``Gebruiker`` teruggeeft (of 401 werpt).

De onderteken-sleutel komt uit ``JWT_SECRET`` (env). Zonder die variabele valt
hij terug op een vaste dev-sleutel; zet in productie altijd een eigen geheim.
"""
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from . import models, schemas
from .database import get_db


def gebruiker_naar_schema(gebruiker: "models.Gebruiker") -> "schemas.GebruikerOut":
    """Zet een Gebruiker-model om naar het uitvoer-schema (met afgeleide velden)."""
    data = schemas.GebruikerOut.model_validate(gebruiker)
    data.uitnodiging_openstaand = bool(getattr(gebruiker, "uitnodiging_token", None))
    return data

SECRET_KEY = os.getenv("JWT_SECRET", "powercompliance-dev-secret-wijzig-in-productie")
ALGORITHM = "HS256"
TOKEN_GELDIGHEID_UREN = 8
UITNODIGING_GELDIGHEID_UREN = 48


def genereer_uitnodiging_token() -> str:
    """Genereer een cryptografisch veilig, URL-veilig uitnodigingstoken."""
    return secrets.token_urlsafe(32)

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
def maak_token(
    gebruiker: "models.Gebruiker", organisatie_id: Optional[int] = None
) -> str:
    """Genereer een JWT dat na 8 uur verloopt (sub = gebruikers-id).

    ``organisatie_id`` overschrijft de organisatie in het token — gebruikt bij
    impersonatie, waarbij een superadmin een token krijgt dat naar een specifieke
    organisatie is gescoped."""
    verloopt = datetime.utcnow() + timedelta(hours=TOKEN_GELDIGHEID_UREN)
    org = organisatie_id if organisatie_id is not None else gebruiker.organisatie_id
    payload = {
        "sub": str(gebruiker.id),
        "email": gebruiker.email,
        "rol": gebruiker.rol,
        "organisatie_id": org,
        "exp": verloopt,
    }
    # Markeer een impersonatie-token zodat de frontend een banner kan tonen.
    if organisatie_id is not None and gebruiker.organisatie_id != organisatie_id:
        payload["impersonatie"] = True
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
    # skip_tenant: laad de gebruiker zonder tenant-filter. De id komt uit het
    # gevalideerde token, dus dit is veilig — en nodig zodat een superadmin die
    # een organisatie impersoneert zijn eigen (org-loze) account kan laden.
    gebruiker = db.get(
        models.Gebruiker, int(gebruiker_id), execution_options={"skip_tenant": True}
    )
    if not gebruiker:
        raise credential_fout
    if not gebruiker.actief:
        raise HTTPException(status_code=403, detail="Account is gedeactiveerd")
    return gebruiker


# ---------- Rol-dependencies ----------
BEHEER_ROLLEN = {"superadmin", "owner", "admin"}


def vereis_beheerder(
    gebruiker: "models.Gebruiker" = Depends(get_current_user),
) -> "models.Gebruiker":
    """Sta alleen owner/admin (of superadmin) toe — voor gebruikersbeheer."""
    if gebruiker.rol not in BEHEER_ROLLEN:
        raise HTTPException(status_code=403, detail="Onvoldoende rechten")
    return gebruiker


def vereis_superadmin(
    gebruiker: "models.Gebruiker" = Depends(get_current_user),
) -> "models.Gebruiker":
    """Sta alleen de superadmin toe — voor platform-/organisatiebeheer."""
    if gebruiker.rol != "superadmin":
        raise HTTPException(status_code=403, detail="Alleen voor superadmin")
    return gebruiker


def zorg_standaard_data(db: Session) -> None:
    """Maak idempotent de standaard-organisatie en de twee standaardgebruikers aan.

    - Organisatie "Demo Organisatie" (slug "demo").
    - superadmin@powercompliance.nl (rol superadmin, GEEN organisatie).
    - admin@powercompliance.nl (rol owner, organisatie demo).

    Draait bij elke startup én in de seed, maar doet per record niets als het al
    bestaat. Zo kan er in elke omgeving direct ingelogd worden.

    Belangrijk: deze functie draait bewust buiten tenant-context (org = None),
    zodat er geen automatische filtering/insert-defaulting op de queries zit."""
    demo = (
        db.query(models.Organisatie)
        .filter(models.Organisatie.slug == "demo")
        .first()
    )
    if not demo:
        demo = models.Organisatie(
            naam="Demo Organisatie", slug="demo", actief=True, max_producten=1000
        )
        db.add(demo)
        db.flush()

    if not db.query(models.Gebruiker).filter_by(email="superadmin@powercompliance.nl").first():
        db.add(
            models.Gebruiker(
                email="superadmin@powercompliance.nl",
                wachtwoord_hash=hash_wachtwoord("SuperAdmin2024!"),
                naam="Superadmin",
                bedrijf="PowerCompliance",
                rol="superadmin",
                organisatie_id=None,
                actief=True,
            )
        )
    if not db.query(models.Gebruiker).filter_by(email="admin@powercompliance.nl").first():
        db.add(
            models.Gebruiker(
                email="admin@powercompliance.nl",
                wachtwoord_hash=hash_wachtwoord("Admin2024!"),
                naam="Beheerder",
                bedrijf="Demo Organisatie",
                rol="owner",
                organisatie_id=demo.id,
                actief=True,
            )
        )
    db.commit()
