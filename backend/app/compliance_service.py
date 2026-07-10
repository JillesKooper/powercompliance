"""Schaalbaarheid: asynchrone (her)berekening van de compliance-cache per product
en een in-memory cache voor dashboard-statistieken.

De per-product velden compliance_percentage / aantal_ontbrekend / compliance_status
worden gedenormaliseerd opgeslagen zodat lijsten en het dashboard niet bij elke
request alles hoeven te herberekenen. Herberekening draait als BackgroundTask.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from . import activiteit_service, compliance, models
from .database import SessionLocal

# statussen die als "echt" tellen voor het loggen van een statuswijziging
_ECHTE_STATUSSEN = {"compliant", "gedeeltelijk", "incompleet"}

# ---------- dashboard-cache ----------
_dashboard_cache = {"data": None, "geldig": False}


def invalideer_dashboard():
    _dashboard_cache["geldig"] = False


def bepaal_status(aantal_ontbrekend: int, pct: float) -> str:
    if aantal_ontbrekend == 0:
        return "compliant"
    if pct >= 50:
        return "gedeeltelijk"
    return "incompleet"


STATUS_LABELS = {
    "compliant": "compliant",
    "gedeeltelijk": "gedeeltelijk compliant",
    "incompleet": "incompleet",
}


def herbereken_product(db: Session, product: models.Product) -> None:
    oude_status = product.compliance_status
    stats = compliance.product_compliance(db, product)
    nieuwe_status = bepaal_status(
        stats["aantal_ontbrekend"], stats["compliance_percentage"]
    )
    product.compliance_percentage = stats["compliance_percentage"]
    product.aantal_ontbrekend = stats["aantal_ontbrekend"]
    product.compliance_status = nieuwe_status
    product.compliance_bijgewerkt = datetime.utcnow()

    # Registreer een echte statuswijziging op de leverancier-tijdlijn (niet bij
    # de eerste berekening vanaf "onbekend", om ruis te voorkomen).
    if (
        oude_status in _ECHTE_STATUSSEN
        and nieuwe_status != oude_status
        and product.leverancier_id
    ):
        activiteit_service.log_activiteit(
            db,
            product.leverancier_id,
            activiteit_service.STATUS_GEWIJZIGD,
            (
                f"'{product.naam}': compliance {STATUS_LABELS.get(oude_status, oude_status)}"
                f" → {STATUS_LABELS.get(nieuwe_status, nieuwe_status)}"
                f" ({stats['compliance_percentage']}%)"
            ),
        )


# ---------- BackgroundTask-varianten (eigen sessie) ----------
def herbereken_product_bg(product_id: int) -> None:
    db = SessionLocal()
    try:
        product = db.get(models.Product, product_id)
        if product:
            herbereken_product(db, product)
            db.commit()
    finally:
        db.close()
    invalideer_dashboard()


def herbereken_alle_bg() -> None:
    db = SessionLocal()
    try:
        for product in db.query(models.Product).all():
            herbereken_product(db, product)
        db.commit()
    finally:
        db.close()
    invalideer_dashboard()


# ---------- dashboard (gecachet) ----------
def bouw_dashboard(db: Session) -> dict:
    if _dashboard_cache["geldig"] and _dashboard_cache["data"] is not None:
        return _dashboard_cache["data"]

    producten = db.query(models.Product).all()
    aantal = len(producten)
    gem = (
        round(sum(p.compliance_percentage or 0 for p in producten) / aantal, 1)
        if aantal
        else 100.0
    )
    totaal_ontbrekend = sum(p.aantal_ontbrekend or 0 for p in producten)
    incompleet = sum(1 for p in producten if (p.compliance_status or "") != "compliant")

    per_wet = []
    actieve_wetten = (
        db.query(models.Wetgeving)
        .filter(models.Wetgeving.actief.is_(True))
        .order_by(models.Wetgeving.code)
        .all()
    )
    for wet in actieve_wetten:
        stats = compliance.wetgeving_stats(db, wet)
        if stats["aantal_producten"] == 0:
            continue
        per_wet.append(
            {
                "code": wet.code,
                "naam": wet.naam,
                "percentage": stats["compliance_percentage"],
            }
        )

    data = {
        "aantal_leveranciers": db.query(models.Leverancier).count(),
        "aantal_producten": aantal,
        "aantal_categorieen": db.query(models.Categorie).count(),
        "aantal_wetgeving": db.query(models.Wetgeving).count(),
        "aantal_ontbrekende_velden": totaal_ontbrekend,
        "aantal_producten_incompleet": incompleet,
        "gemiddelde_compliance": gem,
        "open_dataverzoeken": db.query(models.Dataverzoek)
        .filter(models.Dataverzoek.status.in_(["open", "verzonden"]))
        .count(),
        "compliance_per_wetgeving": per_wet,
    }
    _dashboard_cache["data"] = data
    _dashboard_cache["geldig"] = True
    return data
