"""Audit trail: leg elke wijziging in het systeem vast.

``log`` voegt een AuditLog-rij toe aan de sessie maar commit NIET zelf — de
aanroeper commit samen met de rest van zijn wijzigingen, zodat alles binnen één
transactie valt en er niets wordt geregistreerd als de omliggende actie faalt.

Er is (nog) geen inlog/gebruikersbeheer in PowerCompliance; de audit trail legt
daarom de huidige app-gebruiker vast. Die is instelbaar via de app-instelling
``huidige_gebruiker`` en valt anders terug op de standaardgebruiker.
"""
from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from . import models

# Standaard-gebruiker (matcht de gebruiker die in de UI wordt getoond). Zodra er
# echte authenticatie is, kan hier de ingelogde gebruiker worden doorgegeven.
STANDAARD_GEBRUIKER = "Guus van der Mond"
GEBRUIKER_SLEUTEL = "huidige_gebruiker"

# Actie-constanten (consistente filtering/iconen in de frontend)
COMPLIANCE_GEWIJZIGD = "compliance_gewijzigd"
LEVERANCIER_GEWIJZIGD = "leverancier_gewijzigd"
PRODUCT_TOEGEVOEGD = "product_toegevoegd"
PRODUCT_GEWIJZIGD = "product_gewijzigd"
PRODUCT_VERWIJDERD = "product_verwijderd"
WETGEVING_GEWIJZIGD = "wetgeving_gewijzigd"
DATAVERZOEK_VERSTUURD = "dataverzoek_verstuurd"
BULKIMPORT = "bulkimport"
REPLY_VERWERKT = "reply_verwerkt"

# Objecttypen
OBJ_PRODUCT = "product"
OBJ_LEVERANCIER = "leverancier"
OBJ_WETGEVING = "wetgeving"
OBJ_COMPLIANCE = "compliance"
OBJ_DATAVERZOEK = "dataverzoek"
OBJ_IMPORT = "import"


def huidige_gebruiker(db: Session) -> str:
    """Geef de huidige (audit-)gebruiker terug (instelbaar, met terugval)."""
    rij = db.get(models.AppInstelling, GEBRUIKER_SLEUTEL)
    if rij and rij.waarde:
        return rij.waarde
    return STANDAARD_GEBRUIKER


def _als_tekst(waarde) -> Optional[str]:
    if waarde is None:
        return None
    if isinstance(waarde, (datetime, date)):
        return waarde.isoformat()
    if isinstance(waarde, bool):
        return "aan" if waarde else "uit"
    return str(waarde)


def log(
    db: Session,
    actie: str,
    object_type: str,
    *,
    object_id: Optional[int] = None,
    object_naam: Optional[str] = None,
    oude_waarde=None,
    nieuwe_waarde=None,
    leverancier_id: Optional[int] = None,
    product_id: Optional[int] = None,
    gebruiker: Optional[str] = None,
) -> models.AuditLog:
    """Voeg een audit-rij toe aan de sessie (zonder commit)."""
    rij = models.AuditLog(
        gebruiker=gebruiker or huidige_gebruiker(db),
        actie=actie,
        object_type=object_type,
        object_id=object_id,
        object_naam=object_naam,
        oude_waarde=_als_tekst(oude_waarde),
        nieuwe_waarde=_als_tekst(nieuwe_waarde),
        leverancier_id=leverancier_id,
        product_id=product_id,
    )
    db.add(rij)
    return rij


def zoek(
    db: Session,
    *,
    van: Optional[datetime] = None,
    tot: Optional[datetime] = None,
    actie: Optional[str] = None,
    object_type: Optional[str] = None,
    object_id: Optional[int] = None,
    leverancier_id: Optional[int] = None,
    product_id: Optional[int] = None,
    zoekterm: Optional[str] = None,
):
    """Bouw de gefilterde audit-query (nieuwste eerst)."""
    q = db.query(models.AuditLog)
    if van is not None:
        q = q.filter(models.AuditLog.tijdstip >= van)
    if tot is not None:
        q = q.filter(models.AuditLog.tijdstip <= tot)
    if actie:
        q = q.filter(models.AuditLog.actie == actie)
    if object_type:
        q = q.filter(models.AuditLog.object_type == object_type)
    if object_id is not None:
        q = q.filter(models.AuditLog.object_id == object_id)
    if leverancier_id is not None:
        q = q.filter(models.AuditLog.leverancier_id == leverancier_id)
    if product_id is not None:
        q = q.filter(models.AuditLog.product_id == product_id)
    if zoekterm:
        term = f"%{zoekterm}%"
        q = q.filter(
            models.AuditLog.object_naam.ilike(term)
            | models.AuditLog.oude_waarde.ilike(term)
            | models.AuditLog.nieuwe_waarde.ilike(term)
        )
    return q.order_by(models.AuditLog.tijdstip.desc())
