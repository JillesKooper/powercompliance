from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import (
    models,
    schemas,
    compliance,
    compliance_service,
    notificatie_teksten,
    veld_vertaling,
    wetgeving_refresh_service,
    audit_service,
)
from ..database import get_db

router = APIRouter(prefix="/api", tags=["overig"])


# ---------- Categorieën ----------
@router.get("/categorieen", response_model=List[schemas.CategorieOut])
def lijst_categorieen(db: Session = Depends(get_db)):
    return db.query(models.Categorie).order_by(models.Categorie.naam).all()


# ---------- Wetgeving ----------
@router.get("/wetgeving", response_model=List[schemas.WetgevingOut])
def lijst_wetgeving(taal: str = "nl", db: Session = Depends(get_db)):
    taal = "en" if taal == "en" else "nl"
    wetten = db.query(models.Wetgeving).order_by(models.Wetgeving.code).all()
    uit = []
    for wet in wetten:
        w = schemas.WetgevingOut.model_validate(wet)
        # status dynamisch bepalen op basis van de ingangsdatum (niet de DB-kolom)
        w.status = compliance.bereken_status(wet)
        # veldnamen + veldtypes mee vertalen (op basis van de technische sleutel)
        for veld in w.compliance_velden:
            veld.naam = veld_vertaling.veld_naam_via_sleutel(
                veld.sleutel, veld.naam, taal
            )
            veld.veld_type = veld_vertaling.veld_type(veld.veld_type, taal)
        uit.append(w)
    return uit


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
                status=compliance.bereken_status(wet),
                actief=wet.actief,
                aantal_velden=len(wet.compliance_velden),
                aantal_producten=stats["aantal_producten"],
                compliance_percentage=stats["compliance_percentage"],
                categorieen=sorted(c.naam for c in wet.categorieen),
                laatst_bijgewerkt_op=wet.laatst_bijgewerkt_op,
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
    oud = wet.actief
    wet.actief = data.actief
    if oud != data.actief:
        audit_service.log(
            db,
            audit_service.WETGEVING_GEWIJZIGD,
            audit_service.OBJ_WETGEVING,
            object_id=wet.id,
            object_naam=f"{wet.code} — {wet.naam}",
            oude_waarde="aan" if oud else "uit",
            nieuwe_waarde="aan" if data.actief else "uit",
        )
    db.commit()
    db.refresh(wet)
    # een actief-wijziging beïnvloedt de compliance van alle producten
    background_tasks.add_task(compliance_service.herbereken_alle_bg)
    stats = compliance.wetgeving_stats(db, wet)
    return schemas.WetgevingBeheer(
        id=wet.id,
        code=wet.code,
        naam=wet.naam,
        status=compliance.bereken_status(wet),
        actief=wet.actief,
        aantal_velden=len(wet.compliance_velden),
        aantal_producten=stats["aantal_producten"],
        compliance_percentage=stats["compliance_percentage"],
        categorieen=sorted(c.naam for c in wet.categorieen),
        laatst_bijgewerkt_op=wet.laatst_bijgewerkt_op,
    )


def _wetgeving_out_vertaald(wet: models.Wetgeving, taal: str) -> schemas.WetgevingOut:
    """Bouw een WetgevingOut met vertaalde veldnamen/types (zoals de lijst)."""
    w = schemas.WetgevingOut.model_validate(wet)
    w.status = compliance.bereken_status(wet)
    for veld in w.compliance_velden:
        veld.naam = veld_vertaling.veld_naam_via_sleutel(veld.sleutel, veld.naam, taal)
        veld.veld_type = veld_vertaling.veld_type(veld.veld_type, taal)
    return w


# ---------- Wetgeving-refresh (AI + websearch) ----------
@router.get("/wetgeving/refresh-instelling", response_model=schemas.RefreshInstellingOut)
def wetgeving_refresh_instelling(db: Session = Depends(get_db)):
    return schemas.RefreshInstellingOut(
        frequentie=wetgeving_refresh_service.get_frequentie(db),
        laatste_run=wetgeving_refresh_service.get_laatste_run(db),
    )


@router.post("/wetgeving/refresh-instelling", response_model=schemas.RefreshInstellingOut)
def zet_wetgeving_refresh_instelling(
    data: schemas.RefreshInstellingIn, db: Session = Depends(get_db)
):
    if data.frequentie not in wetgeving_refresh_service.GELDIGE_FREQ:
        raise HTTPException(
            status_code=400,
            detail="Ongeldige frequentie (kies: uit, dagelijks, wekelijks, maandelijks).",
        )
    wetgeving_refresh_service.zet_instelling(
        db, wetgeving_refresh_service.FREQ_SLEUTEL, data.frequentie
    )
    return schemas.RefreshInstellingOut(
        frequentie=wetgeving_refresh_service.get_frequentie(db),
        laatste_run=wetgeving_refresh_service.get_laatste_run(db),
    )


@router.post("/wetgeving/ververs-alle", response_model=schemas.WetgevingRefreshResultaat)
def ververs_alle_wetgeving(db: Session = Depends(get_db)):
    """Haal via de AI de actuele info op voor álle actieve wetgevingen."""
    return wetgeving_refresh_service.ververs_alle_actieve(db)


@router.post("/wetgeving/{wetgeving_id}/ververs", response_model=schemas.WetgevingOut)
def ververs_wetgeving(
    wetgeving_id: int, taal: str = "nl", db: Session = Depends(get_db)
):
    """Haal via de AI de actuele info op voor één wetgeving en geef die terug."""
    wet = db.get(models.Wetgeving, wetgeving_id)
    if not wet:
        raise HTTPException(status_code=404, detail="Wetgeving niet gevonden")
    wetgeving_refresh_service.ververs_een(db, wet)
    db.refresh(wet)
    return _wetgeving_out_vertaald(wet, "en" if taal == "en" else "nl")


# ---------- Ontbrekende data ----------
@router.get("/ontbrekende-data", response_model=List[schemas.OntbrekendProduct])
def ontbrekende_data(taal: str = "nl", db: Session = Depends(get_db)):
    """Alle producten met minstens één ontbrekend compliance-veld."""
    taal = "en" if taal == "en" else "nl"
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
                        veld_naam=veld_vertaling.veld_naam(v, taal),
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


@router.get("/dataverzoeken/{dataverzoek_id}", response_model=schemas.DataverzoekDetail)
def dataverzoek_detail(
    dataverzoek_id: int,
    taal: str = Query("nl"),
    db: Session = Depends(get_db),
):
    """Volledig dataverzoek incl. leverancier, uitgevraagde velden, verstuurde
    mail en eventuele reply — voor de detailweergave in de instellingen."""
    verzoek = db.get(models.Dataverzoek, dataverzoek_id)
    if not verzoek:
        raise HTTPException(status_code=404, detail="Dataverzoek niet gevonden")

    regels = []
    for r in verzoek.regels:
        product = db.get(models.Product, r.product_id) if r.product_id else None
        veld = (
            db.get(models.ComplianceVeld, r.compliance_veld_id)
            if r.compliance_veld_id
            else None
        )
        regels.append(
            schemas.DataverzoekRegelOut(
                id=r.id,
                product_id=r.product_id,
                product_naam=product.naam if product else None,
                compliance_veld_id=r.compliance_veld_id,
                veld_naam=veld_vertaling.veld_naam(veld, taal) if veld else None,
                wetgeving_code=veld.wetgeving.code if veld and veld.wetgeving else None,
                wetgeving_naam=veld.wetgeving.naam if veld and veld.wetgeving else None,
            )
        )

    return schemas.DataverzoekDetail(
        **schemas.DataverzoekOut.model_validate(verzoek).model_dump(),
        verzonden_bericht=verzoek.verzonden_bericht,
        reply_bericht=verzoek.reply_bericht,
        regels=regels,
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
        lev = db.get(models.Leverancier, lev_id)
        audit_service.log(
            db,
            audit_service.DATAVERZOEK_VERSTUURD,
            audit_service.OBJ_DATAVERZOEK,
            object_id=verzoek.id,
            object_naam=data.onderwerp,
            nieuwe_waarde=f"Bulk-dataverzoek aan {lev.naam if lev else lev_id}",
            leverancier_id=lev_id,
        )
    if ids:
        db.add(
            notificatie_teksten.maak(
                "bulk_dataverzoek_aangemaakt",
                {"aantal": len(ids), "onderwerp": data.onderwerp},
                type="succes",
                categorie="Dataverzoek verstuurd",
            )
        )
    db.commit()
    compliance_service.invalideer_dashboard()
    return schemas.BulkDataverzoekResultaat(aantal=len(ids), dataverzoek_ids=ids)


# ---------- Notificaties ----------
def _notificatie_uit(n: models.Notificatie, taal: str) -> schemas.NotificatieOut:
    """Bouw een NotificatieOut met titel/bericht/categorie in de gevraagde taal.

    Bij taal="en" renderen we de tekst uit sleutel+params; ontbreekt de sleutel
    (oude rij), dan blijft de opgeslagen NL-tekst staan."""
    import json

    out = schemas.NotificatieOut.model_validate(n)
    if taal == "en":
        sleutel = n.sleutel
        if sleutel:
            try:
                params = json.loads(n.params) if n.params else {}
            except (TypeError, ValueError):
                params = {}
        else:
            # oude notificatie zonder sleutel: leid sjabloon + params af uit de tekst
            sleutel, params = notificatie_teksten.infer(n.titel, n.bericht)
        if sleutel:
            vert = notificatie_teksten.render(sleutel, params, "en")
            if vert:
                # alleen overschrijven als het veld volledig ingevuld is (geen
                # achtergebleven {plaatshouders}); anders de originele tekst laten
                if vert["titel"] and "{" not in vert["titel"]:
                    out.titel = vert["titel"]
                if vert["bericht"] and "{" not in vert["bericht"]:
                    out.bericht = vert["bericht"]
    out.categorie = notificatie_teksten.categorie_label(n.categorie, taal)
    return out


@router.get("/notificaties", response_model=List[schemas.NotificatieOut])
def lijst_notificaties(taal: str = "nl", db: Session = Depends(get_db)):
    taal = "en" if taal == "en" else "nl"
    rijen = (
        db.query(models.Notificatie)
        .order_by(models.Notificatie.aangemaakt_op.desc())
        .all()
    )
    return [_notificatie_uit(n, taal) for n in rijen]


@router.post(
    "/notificaties/{notificatie_id}/gelezen",
    response_model=schemas.NotificatieOut,
)
def markeer_gelezen(
    notificatie_id: int, taal: str = "nl", db: Session = Depends(get_db)
):
    n = db.get(models.Notificatie, notificatie_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notificatie niet gevonden")
    n.gelezen = True
    db.commit()
    db.refresh(n)
    return _notificatie_uit(n, "en" if taal == "en" else "nl")


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


# ---------- Seed (testdata inladen) ----------
@router.post("/seed")
def laad_seed_data(force: bool = Query(False), db: Session = Depends(get_db)):
    """Vul de database met voorbeelddata.

    Let op: dit reset de volledige database. Om onbedoeld wissen te voorkomen
    gebeurt dat alleen als de database leeg is; gebruik ?force=true om een
    reeds gevulde database te overschrijven.
    """
    if not force and db.query(models.Product).count() > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                "Database bevat al data. Gebruik ?force=true om te overschrijven."
            ),
        )
    # Geef de leesverbinding van deze sessie vrij, zodat seed() de tabellen kan
    # droppen zonder "database is locked" op SQLite.
    db.rollback()
    # Lazily importeren: seed importeert zwaardere modules die niet bij elke
    # request nodig zijn.
    from .. import seed as seed_module

    seed_module.seed()
    compliance_service.invalideer_dashboard()
    return {
        "status": "ok",
        "bericht": "Seed-data geladen",
        "categorieen": db.query(models.Categorie).count(),
        "wetgevingen": db.query(models.Wetgeving).count(),
        "leveranciers": db.query(models.Leverancier).count(),
        "producten": db.query(models.Product).count(),
    }
