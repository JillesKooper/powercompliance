"""Logica om te bepalen welke compliance-data ontbreekt.

Een compliance-veld is van toepassing op een product wanneer:
- het veld geen categorie heeft (geldt dan voor alle producten), OF
- de categorie van het veld gelijk is aan de categorie van het product.

Een veld 'ontbreekt' wanneer er geen ProductComplianceWaarde bestaat met
ingevuld=True voor dat product/veld.
"""
from typing import List

from sqlalchemy.orm import Session

from . import models


def velden_voor_product(db: Session, product: models.Product) -> List[models.ComplianceVeld]:
    """Alle compliance-velden die van toepassing zijn op dit product."""
    q = db.query(models.ComplianceVeld).filter(
        (models.ComplianceVeld.categorie_id.is_(None))
        | (models.ComplianceVeld.categorie_id == product.categorie_id)
    )
    return q.all()


def ingevulde_veld_ids(db: Session, product_id: int) -> set:
    rijen = (
        db.query(models.ProductComplianceWaarde.compliance_veld_id)
        .filter(
            models.ProductComplianceWaarde.product_id == product_id,
            models.ProductComplianceWaarde.ingevuld.is_(True),
        )
        .all()
    )
    return {r[0] for r in rijen}


def product_compliance(db: Session, product: models.Product) -> dict:
    """Geef tellingen + percentage terug voor één product."""
    velden = velden_voor_product(db, product)
    ingevuld = ingevulde_veld_ids(db, product.id)
    totaal = len(velden)
    aantal_ingevuld = len([v for v in velden if v.id in ingevuld])
    aantal_ontbrekend = totaal - aantal_ingevuld
    pct = round((aantal_ingevuld / totaal) * 100, 1) if totaal else 100.0
    return {
        "aantal_velden": totaal,
        "aantal_ingevuld": aantal_ingevuld,
        "aantal_ontbrekend": aantal_ontbrekend,
        "compliance_percentage": pct,
    }


def ontbrekende_velden_voor_product(
    db: Session, product: models.Product
) -> List[models.ComplianceVeld]:
    velden = velden_voor_product(db, product)
    ingevuld = ingevulde_veld_ids(db, product.id)
    return [v for v in velden if v.id not in ingevuld]
