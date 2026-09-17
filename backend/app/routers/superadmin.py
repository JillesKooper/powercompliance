"""Superadmin-endpoints: platformbreed organisatiebeheer + impersonatie.

Alleen toegankelijk voor de superadmin (rol ``superadmin``, geen organisatie).
De superadmin draait zonder tenant-context, dus queries zien alle organisaties."""
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth_service
from ..database import get_db

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])


def _slugify(tekst: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (tekst or "").lower()).strip("-")
    return slug or "organisatie"


def _unieke_slug(db: Session, basis: str) -> str:
    slug = _slugify(basis)
    kandidaat = slug
    n = 2
    while db.query(models.Organisatie).filter_by(slug=kandidaat).first():
        kandidaat = f"{slug}-{n}"
        n += 1
    return kandidaat


@router.get("/organisaties", response_model=list[schemas.OrganisatieMetTellingen])
def lijst_organisaties(
    _super: models.Gebruiker = Depends(auth_service.vereis_superadmin),
    db: Session = Depends(get_db),
):
    """Alle organisaties met het aantal gebruikers en producten."""
    organisaties = (
        db.query(models.Organisatie).order_by(models.Organisatie.naam).all()
    )
    resultaat = []
    for org in organisaties:
        aantal_gebruikers = (
            db.query(models.Gebruiker)
            .filter(models.Gebruiker.organisatie_id == org.id)
            .count()
        )
        aantal_producten = (
            db.query(models.Product)
            .filter(models.Product.organisatie_id == org.id)
            .count()
        )
        regel = schemas.OrganisatieMetTellingen.model_validate(org)
        regel.aantal_gebruikers = aantal_gebruikers
        regel.aantal_producten = aantal_producten
        resultaat.append(regel)
    return resultaat


@router.post("/organisaties", response_model=schemas.OrganisatieOut, status_code=201)
def maak_organisatie(
    gegevens: schemas.OrganisatieCreate,
    _super: models.Gebruiker = Depends(auth_service.vereis_superadmin),
    db: Session = Depends(get_db),
):
    """Maak een nieuwe organisatie aan (lege tenant)."""
    naam = (gegevens.naam or "").strip()
    if not naam:
        raise HTTPException(status_code=422, detail="Naam is verplicht")
    slug = (
        _slugify(gegevens.slug)
        if gegevens.slug
        else _unieke_slug(db, naam)
    )
    if db.query(models.Organisatie).filter_by(slug=slug).first():
        raise HTTPException(status_code=409, detail="Slug is al in gebruik")
    org = models.Organisatie(
        naam=naam,
        slug=slug,
        domein=(gegevens.domein or "").strip() or None,
        max_producten=gegevens.max_producten or 1000,
        actief=True,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.post(
    "/organisaties/{organisatie_id}/impersonate",
    response_model=schemas.ImpersonatieResultaat,
)
def impersonate(
    organisatie_id: int,
    superadmin: models.Gebruiker = Depends(auth_service.vereis_superadmin),
    db: Session = Depends(get_db),
):
    """Geef een token dat naar deze organisatie is gescoped (support-inlog).

    De superadmin behoudt zijn rol, maar het token draagt de organisatie mee,
    zodat alle daaropvolgende requests op die organisatie worden gefilterd."""
    org = db.get(models.Organisatie, organisatie_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisatie niet gevonden")
    token = auth_service.maak_token(superadmin, organisatie_id=org.id)
    return schemas.ImpersonatieResultaat(token=token, organisatie=org)
