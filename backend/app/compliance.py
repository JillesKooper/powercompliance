"""Logica om te bepalen welke compliance-data van toepassing is en ontbreekt.

Welke wetgeving geldt voor een product wordt automatisch bepaald op basis van de
categorie van het product (de wetgeving↔categorie-koppeling). Alleen wetgeving
die actief staat (door de beheerder ingeschakeld) telt mee. Alle compliance-velden
van een relevante, actieve wetgeving zijn van toepassing op het product.

Een veld 'ontbreekt' wanneer er geen ProductComplianceWaarde bestaat met
ingevuld=True voor dat product/veld.
"""
from typing import List

from sqlalchemy.orm import Session

from . import models


def relevante_wetgeving_voor_product(
    db: Session, product: models.Product, alleen_actief: bool = True
) -> List[models.Wetgeving]:
    """Wetgeving die op dit product van toepassing is (op basis van categorie)."""
    if product.categorie_id is None:
        return []
    q = db.query(models.Wetgeving).filter(
        models.Wetgeving.categorieen.any(id=product.categorie_id)
    )
    if alleen_actief:
        q = q.filter(models.Wetgeving.actief.is_(True))
    return q.order_by(models.Wetgeving.code).all()


def velden_voor_product(db: Session, product: models.Product) -> List[models.ComplianceVeld]:
    """Alle compliance-velden van de relevante, actieve wetgeving voor dit product."""
    velden = []
    for wet in relevante_wetgeving_voor_product(db, product):
        velden.extend(wet.compliance_velden)
    return velden


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


def veld_ids_met_waarde(db: Session, product_id: int) -> set:
    """Veld-ids die voor dit product al een niet-lege waarde hebben.

    Kijkt puur naar de opgeslagen ``waarde`` (NIET NULL en niet leeg na strippen),
    ongeacht de ``ingevuld``-vlag. Wordt gebruikt om te bepalen welke velden nog
    daadwerkelijk uitgevraagd moeten worden in een dataverzoek: een veld met een
    (eventueel nog niet geverifieerde) waarde is niet 'ontbrekend' en hoeft niet
    opnieuw uitgevraagd te worden.
    """
    rijen = (
        db.query(
            models.ProductComplianceWaarde.compliance_veld_id,
            models.ProductComplianceWaarde.waarde,
        )
        .filter(
            models.ProductComplianceWaarde.product_id == product_id,
            models.ProductComplianceWaarde.waarde.isnot(None),
        )
        .all()
    )
    return {vid for vid, waarde in rijen if str(waarde).strip() != ""}


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


def wetgeving_stats(db: Session, wetgeving: models.Wetgeving) -> dict:
    """Aantal producten dat onder deze wetgeving valt + gem. compliance-score.

    Onafhankelijk van of de wetgeving actief staat (voor het beheeroverzicht)."""
    cat_ids = {c.id for c in wetgeving.categorieen}
    veld_ids = [v.id for v in wetgeving.compliance_velden]
    if not cat_ids:
        return {"aantal_producten": 0, "compliance_percentage": 100.0}
    producten = (
        db.query(models.Product)
        .filter(models.Product.categorie_id.in_(cat_ids))
        .all()
    )
    if not producten or not veld_ids:
        return {
            "aantal_producten": len(producten),
            "compliance_percentage": 100.0,
        }
    pcts = []
    for p in producten:
        ingevuld = ingevulde_veld_ids(db, p.id)
        aantal = len([vid for vid in veld_ids if vid in ingevuld])
        pcts.append(aantal / len(veld_ids) * 100)
    return {
        "aantal_producten": len(producten),
        "compliance_percentage": round(sum(pcts) / len(pcts), 1),
    }
