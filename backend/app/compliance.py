"""Logica om te bepalen welke compliance-data van toepassing is en ontbreekt.

Welke wetgeving geldt voor een product wordt automatisch bepaald op basis van de
categorie van het product (de wetgeving↔categorie-koppeling). Alleen wetgeving
die actief staat (door de beheerder ingeschakeld) telt mee. Alle compliance-velden
van een relevante, actieve wetgeving zijn van toepassing op het product.

Een veld 'ontbreekt' wanneer er geen ProductComplianceWaarde bestaat met
ingevuld=True voor dat product/veld.
"""
import logging
from typing import List

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from . import models

log = logging.getLogger(__name__)


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
    """Alle compliance-velden die voor dit product ontbreken.

    Een veld is 'ontbrekend' als er GEEN ProductComplianceWaarde met een niet-lege
    waarde bestaat voor dit specifieke product (de rij ontbreekt, of waarde is NULL
    of leeg). Dit wordt met één LEFT JOIN bepaald, equivalent aan:

        SELECT cv.* FROM compliance_velden cv
        LEFT JOIN product_compliance_waarden pcw
          ON pcw.compliance_veld_id = cv.id AND pcw.product_id = :pid
        WHERE cv.wetgeving_id IN (<relevante, actieve wetgeving van dit product>)
          AND (pcw.id IS NULL OR pcw.waarde IS NULL OR TRIM(pcw.waarde) = '')

    Alleen velden van de relevante, actieve wetgeving (op basis van de categorie)
    tellen mee. Reeds ingevulde velden — ook automatisch gescrapte, nog niet
    geverifieerde waarden — worden dus nooit als ontbrekend teruggegeven.
    """
    wet_ids = [w.id for w in relevante_wetgeving_voor_product(db, product)]
    if not wet_ids:
        return []

    cv = models.ComplianceVeld
    pcw = models.ProductComplianceWaarde
    # VOOR filteren: alle van toepassing zijnde velden (voor debuglogging).
    alle_velden = (
        db.query(cv).filter(cv.wetgeving_id.in_(wet_ids)).order_by(cv.id).all()
    )
    # NA filteren: LEFT JOIN op de waarde-rij van DIT product; houd alleen velden
    # zonder (niet-lege) waarde over.
    ontbrekend = (
        db.query(cv)
        .outerjoin(
            pcw,
            and_(pcw.compliance_veld_id == cv.id, pcw.product_id == product.id),
        )
        .filter(cv.wetgeving_id.in_(wet_ids))
        .filter(or_(pcw.id.is_(None), pcw.waarde.is_(None), func.trim(pcw.waarde) == ""))
        .order_by(cv.id)
        .all()
    )
    if log.isEnabledFor(logging.DEBUG):
        log.debug(
            "product %r (id=%s) VOOR filteren: %d velden %s",
            product.naam, product.id, len(alle_velden), [v.naam for v in alle_velden],
        )
        log.debug(
            "product %r (id=%s) NA filteren: %d ontbrekend %s",
            product.naam, product.id, len(ontbrekend), [v.naam for v in ontbrekend],
        )
    return ontbrekend


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
