"""Demo-modus: kiest een leverancier met ontbrekende data en levert de cijfers
voor de begeleide demo-flow (mail → reply → verrijking → score omhoog).

De flow zelf draait via bestaande endpoints (``/api/email/verstuur`` en
``/api/mail/simuleer-reply``); dit router levert de status en een reset zodat de
demo herhaaldelijk gedraaid kan worden.
"""
import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import compliance, compliance_service, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/demo", tags=["demo"])

REPLY_BRON = "reply"


def _reply_veld_ids(product: models.Product) -> set:
    """Veld-ids die via een reply zijn ingevuld voor dit product."""
    return {
        w.compliance_veld_id
        for w in product.compliance_waarden
        if w.ingevuld and w.bron == REPLY_BRON
    }


def _kies_demo_leverancier(db: Session):
    """Kies een stabiele demo-leverancier.

    Voorkeur: een leverancier die al via een reply verrijkt is (de lopende/
    afgeronde demo). Anders: de leverancier met de meeste ontbrekende velden en
    een e-mailadres.
    """
    leveranciers = db.query(models.Leverancier).all()

    met_reply = []
    met_ontbrekend = []
    for lev in leveranciers:
        reply_aantal = 0
        ontbrekend = 0
        for p in lev.producten:
            reply_aantal += len(_reply_veld_ids(p))
            ontbrekend += len(compliance.ontbrekende_velden_voor_product(db, p))
        if reply_aantal:
            met_reply.append((reply_aantal, lev))
        if ontbrekend and lev.email:
            met_ontbrekend.append((ontbrekend, lev))

    if met_reply:
        return max(met_reply, key=lambda t: t[0])[1]
    if met_ontbrekend:
        return max(met_ontbrekend, key=lambda t: t[0])[1]
    # niets ontbreekt meer: pak de eerste leverancier met producten
    for lev in leveranciers:
        if lev.producten:
            return lev
    return leveranciers[0] if leveranciers else None


def _bouw_status(db: Session, lev: models.Leverancier) -> schemas.DemoStatus:
    cfg_demo_email = os.environ.get("DEMO_EMAIL", "").strip()
    cfg_sendgrid = bool(os.environ.get("SENDGRID_API_KEY", "").strip())

    if lev is None:
        return schemas.DemoStatus(
            demo_email=cfg_demo_email or None, sendgrid_actief=cfg_sendgrid
        )

    pcts_voor, pcts_na = [], []
    velden_ontbrekend = 0
    velden_via_reply = 0
    for p in lev.producten:
        velden = compliance.velden_voor_product(db, p)
        totaal = len(velden)
        ingevuld_ids = compliance.ingevulde_veld_ids(db, p.id)
        reply_ids = _reply_veld_ids(p)
        voor_ids = ingevuld_ids - reply_ids

        velden_via_reply += len(reply_ids)
        velden_ontbrekend += totaal - len(ingevuld_ids)

        if totaal:
            pcts_na.append(len(ingevuld_ids) / totaal * 100)
            pcts_voor.append(len(voor_ids) / totaal * 100)

    def _gem(waarden):
        return round(sum(waarden) / len(waarden), 1) if waarden else 100.0

    return schemas.DemoStatus(
        leverancier=schemas.DemoLeverancier(
            id=lev.id,
            naam=lev.naam,
            contactpersoon=lev.contactpersoon,
            email=lev.email,
        ),
        aantal_producten=len(lev.producten),
        velden_ontbrekend=velden_ontbrekend,
        velden_via_reply=velden_via_reply,
        compliance_voor=_gem(pcts_voor),
        compliance_na=_gem(pcts_na),
        reply_verwerkt=velden_via_reply > 0,
        demo_email=cfg_demo_email or None,
        sendgrid_actief=cfg_sendgrid,
    )


@router.get("/status", response_model=schemas.DemoStatus)
def demo_status(db: Session = Depends(get_db)):
    """Status van de demo-flow voor de gekozen leverancier."""
    lev = _kies_demo_leverancier(db)
    return _bouw_status(db, lev)


@router.post("/reset", response_model=schemas.DemoStatus)
def demo_reset(db: Session = Depends(get_db)):
    """Verwijder de via-reply verrijkte waarden zodat de demo opnieuw kan draaien."""
    lev = _kies_demo_leverancier(db)
    if lev is not None:
        product_ids = [p.id for p in lev.producten]
        if product_ids:
            (
                db.query(models.ProductComplianceWaarde)
                .filter(
                    models.ProductComplianceWaarde.product_id.in_(product_ids),
                    models.ProductComplianceWaarde.bron == REPLY_BRON,
                )
                .delete(synchronize_session=False)
            )
            # lopende demo-dataverzoeken opruimen zodat de teller klopt
            (
                db.query(models.Dataverzoek)
                .filter(
                    models.Dataverzoek.leverancier_id == lev.id,
                    models.Dataverzoek.status.in_(["verzonden", "afgerond"]),
                )
                .delete(synchronize_session=False)
            )
            db.commit()
            for pid in product_ids:
                product = db.get(models.Product, pid)
                if product:
                    compliance_service.herbereken_product(db, product)
            db.commit()
            compliance_service.invalideer_dashboard()
    return _bouw_status(db, lev)
