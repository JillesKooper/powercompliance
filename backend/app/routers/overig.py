from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas, compliance, compliance_service
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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    wet = db.get(models.Wetgeving, wetgeving_id)
    if not wet:
        raise HTTPException(status_code=404, detail="Wetgeving niet gevonden")
    wet.actief = data.actief
    db.commit()
    db.refresh(wet)
    # een actief-wijziging beïnvloedt de compliance van alle producten
    background_tasks.add_task(compliance_service.herbereken_alle_bg)
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
@router.get("/dataverzoeken", response_model=schemas.DataverzoekenPagina)
def lijst_dataverzoeken(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(models.Dataverzoek)
    if status:
        q = q.filter(models.Dataverzoek.status == status)
    total = q.count()
    items = (
        q.order_by(models.Dataverzoek.aangemaakt_op.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return schemas.DataverzoekenPagina(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if per_page else 1,
    )


@router.post("/dataverzoeken", response_model=schemas.DataverzoekOut, status_code=201)
def maak_dataverzoek(data: schemas.DataverzoekCreate, db: Session = Depends(get_db)):
    verzoek = models.Dataverzoek(**data.model_dump())
    db.add(verzoek)
    db.commit()
    db.refresh(verzoek)
    compliance_service.invalideer_dashboard()
    return verzoek


@router.post("/dataverzoeken/bulk", response_model=schemas.BulkDataverzoekResultaat)
def bulk_dataverzoeken(data: schemas.BulkDataverzoekRequest, db: Session = Depends(get_db)):
    """Maak in één keer dataverzoeken aan voor meerdere leveranciers."""
    ids = []
    geldige = (
        db.query(models.Leverancier.id)
        .filter(models.Leverancier.id.in_(data.leverancier_ids))
        .all()
    )
    geldige_ids = {r[0] for r in geldige}
    for lev_id in data.leverancier_ids:
        if lev_id not in geldige_ids:
            continue
        verzoek = models.Dataverzoek(
            leverancier_id=lev_id,
            onderwerp=data.onderwerp,
            bericht=data.bericht,
            status="verzonden",
            deadline=data.deadline,
        )
        db.add(verzoek)
        db.flush()
        ids.append(verzoek.id)
    if ids:
        db.add(
            models.Notificatie(
                titel=f"{len(ids)} dataverzoeken in bulk aangemaakt",
                bericht=data.onderwerp,
                type="succes",
                categorie="Dataverzoek verstuurd",
            )
        )
    db.commit()
    compliance_service.invalideer_dashboard()
    return schemas.BulkDataverzoekResultaat(aantal=len(ids), dataverzoek_ids=ids)


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


# ---------- Dashboard (gecachet) ----------
@router.get("/dashboard", response_model=schemas.DashboardStats)
def dashboard(db: Session = Depends(get_db)):
    return compliance_service.bouw_dashboard(db)
