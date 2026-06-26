from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, compliance
from ..database import get_db

router = APIRouter(prefix="/api", tags=["overig"])


# ---------- Categorieën ----------
@router.get("/categorieen", response_model=List[schemas.CategorieOut])
def lijst_categorieen(db: Session = Depends(get_db)):
    return db.query(models.Categorie).order_by(models.Categorie.naam).all()


# ---------- Wetgeving ----------
@router.get("/wetgeving", response_model=List[schemas.WetgevingOut])
def lijst_wetgeving(db: Session = Depends(get_db)):
    return db.query(models.Wetgeving).order_by(models.Wetgeving.code).all()


@router.get("/wetgeving/beheer", response_model=List[schemas.WetgevingBeheer])
def wetgeving_beheer(db: Session = Depends(get_db)):
    """Beheeroverzicht: per wetgeving aan/uit, aantal producten en compliance-score."""
    resultaat = []
    for wet in db.query(models.Wetgeving).order_by(models.Wetgeving.code).all():
        stats = compliance.wetgeving_stats(db, wet)
        resultaat.append(
            schemas.WetgevingBeheer(
                id=wet.id,
                code=wet.code,
                naam=wet.naam,
                status=wet.status,
                actief=wet.actief,
                aantal_velden=len(wet.compliance_velden),
                aantal_producten=stats["aantal_producten"],
                compliance_percentage=stats["compliance_percentage"],
                categorieen=sorted(c.naam for c in wet.categorieen),
            )
        )
    return resultaat


@router.post("/wetgeving/{wetgeving_id}/actief", response_model=schemas.WetgevingBeheer)
def zet_wetgeving_actief(
    wetgeving_id: int,
    data: schemas.WetgevingActiefRequest,
    db: Session = Depends(get_db),
):
    wet = db.get(models.Wetgeving, wetgeving_id)
    if not wet:
        raise HTTPException(status_code=404, detail="Wetgeving niet gevonden")
    wet.actief = data.actief
    db.commit()
    db.refresh(wet)
    stats = compliance.wetgeving_stats(db, wet)
    return schemas.WetgevingBeheer(
        id=wet.id,
        code=wet.code,
        naam=wet.naam,
        status=wet.status,
        actief=wet.actief,
        aantal_velden=len(wet.compliance_velden),
        aantal_producten=stats["aantal_producten"],
        compliance_percentage=stats["compliance_percentage"],
        categorieen=sorted(c.naam for c in wet.categorieen),
    )


# ---------- Ontbrekende data ----------
@router.get("/ontbrekende-data", response_model=List[schemas.OntbrekendProduct])
def ontbrekende_data(db: Session = Depends(get_db)):
    """Alle producten met minstens één ontbrekend compliance-veld."""
    resultaat = []
    producten = db.query(models.Product).order_by(models.Product.naam).all()
    for product in producten:
        ontbrekend = compliance.ontbrekende_velden_voor_product(db, product)
        if not ontbrekend:
            continue
        resultaat.append(
            schemas.OntbrekendProduct(
                product_id=product.id,
                product_naam=product.naam,
                artikelnummer=product.artikelnummer,
                leverancier_id=product.leverancier_id,
                leverancier_naam=product.leverancier.naam if product.leverancier else "—",
                ontbrekende_velden=[
                    schemas.OntbrekendVeld(
                        compliance_veld_id=v.id,
                        veld_naam=v.naam,
                        wetgeving_code=v.wetgeving.code if v.wetgeving else "—",
                    )
                    for v in ontbrekend
                ],
            )
        )
    return resultaat


# ---------- Dataverzoeken ----------
@router.get("/dataverzoeken", response_model=List[schemas.DataverzoekOut])
def lijst_dataverzoeken(db: Session = Depends(get_db)):
    return (
        db.query(models.Dataverzoek)
        .order_by(models.Dataverzoek.aangemaakt_op.desc())
        .all()
    )


@router.post("/dataverzoeken", response_model=schemas.DataverzoekOut, status_code=201)
def maak_dataverzoek(data: schemas.DataverzoekCreate, db: Session = Depends(get_db)):
    verzoek = models.Dataverzoek(**data.model_dump())
    db.add(verzoek)
    db.commit()
    db.refresh(verzoek)
    return verzoek


# ---------- Notificaties ----------
@router.get("/notificaties", response_model=List[schemas.NotificatieOut])
def lijst_notificaties(db: Session = Depends(get_db)):
    return (
        db.query(models.Notificatie)
        .order_by(models.Notificatie.aangemaakt_op.desc())
        .all()
    )


@router.post(
    "/notificaties/{notificatie_id}/gelezen",
    response_model=schemas.NotificatieOut,
)
def markeer_gelezen(notificatie_id: int, db: Session = Depends(get_db)):
    n = db.get(models.Notificatie, notificatie_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notificatie niet gevonden")
    n.gelezen = True
    db.commit()
    db.refresh(n)
    return n


@router.post("/notificaties/gelezen-alles")
def markeer_alles_gelezen(db: Session = Depends(get_db)):
    aantal = (
        db.query(models.Notificatie)
        .filter(models.Notificatie.gelezen.is_(False))
        .update({models.Notificatie.gelezen: True})
    )
    db.commit()
    return {"gemarkeerd": aantal}


# ---------- Dashboard ----------
@router.get("/dashboard", response_model=schemas.DashboardStats)
def dashboard(db: Session = Depends(get_db)):
    producten = db.query(models.Product).all()
    pcts = []
    totaal_ontbrekend = 0
    incompleet = 0
    for product in producten:
        stats = compliance.product_compliance(db, product)
        pcts.append(stats["compliance_percentage"])
        totaal_ontbrekend += stats["aantal_ontbrekend"]
        if stats["aantal_ontbrekend"] > 0:
            incompleet += 1

    # compliance per actieve wetgeving (met producten die eronder vallen)
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

    return schemas.DashboardStats(
        aantal_leveranciers=db.query(models.Leverancier).count(),
        aantal_producten=len(producten),
        aantal_categorieen=db.query(models.Categorie).count(),
        aantal_wetgeving=db.query(models.Wetgeving).count(),
        aantal_ontbrekende_velden=totaal_ontbrekend,
        aantal_producten_incompleet=incompleet,
        gemiddelde_compliance=round(sum(pcts) / len(pcts), 1) if pcts else 100.0,
        open_dataverzoeken=db.query(models.Dataverzoek)
        .filter(models.Dataverzoek.status.in_(["open", "verzonden"]))
        .count(),
        compliance_per_wetgeving=per_wet,
    )
