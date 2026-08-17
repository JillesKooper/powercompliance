from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import (
    models,
    schemas,
    compliance,
    compliance_service,
    scraper,
    veld_vertaling,
    audit_service,
)
from ..database import get_db

router = APIRouter(prefix="/api/producten", tags=["producten"])


def _veld_status(w: Optional[models.ProductComplianceWaarde]) -> str:
    if not w:
        return "ontbreekt"
    if w.bron == "niet_gevonden":
        return "niet_gevonden_online"
    if w.bron == "automatisch" and not w.geverifieerd:
        return "automatisch"
    if w.ingevuld:
        return "ingevuld"
    return "ontbreekt"


@router.get("", response_model=schemas.ProductenPagina)
def lijst_producten(
    leverancier_id: Optional[int] = Query(None),
    categorie_id: Optional[int] = Query(None),
    compliance_status: Optional[str] = Query(None),
    zoek: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(models.Product)
    if leverancier_id is not None:
        q = q.filter(models.Product.leverancier_id == leverancier_id)
    if categorie_id is not None:
        q = q.filter(models.Product.categorie_id == categorie_id)
    if compliance_status:
        q = q.filter(models.Product.compliance_status == compliance_status)
    if zoek:
        term = f"%{zoek}%"
        q = q.filter(
            models.Product.naam.ilike(term)
            | models.Product.artikelnummer.ilike(term)
            | models.Product.ean.ilike(term)
        )
    total = q.count()
    producten = (
        q.order_by(models.Product.naam)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    # lijst gebruikt de gedenormaliseerde compliance-cache (schaalbaar)
    items = [schemas.ProductMetStats.model_validate(p) for p in producten]
    return schemas.ProductenPagina(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if per_page else 1,
    )


@router.get("/{product_id}", response_model=schemas.ProductMetStats)
def haal_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    item = schemas.ProductMetStats.model_validate(product)
    for k, v in compliance.product_compliance(db, product).items():
        setattr(item, k, v)
    return item


@router.get(
    "/{product_id}/compliance",
    response_model=list[schemas.ProductComplianceRegel],
)
def product_compliance_detail(
    product_id: int, taal: str = "nl", db: Session = Depends(get_db)
):
    """Alle van toepassing zijnde compliance-velden voor dit product, met per veld
    de bron (handmatig / automatisch / niet gevonden / ontbreekt)."""
    taal = "en" if taal == "en" else "nl"
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    velden = compliance.velden_voor_product(db, product)
    waarden = {w.compliance_veld_id: w for w in product.compliance_waarden}
    regels = []
    for v in sorted(velden, key=lambda x: (x.wetgeving.code, x.naam)):
        w = waarden.get(v.id)
        regels.append(
            schemas.ProductComplianceRegel(
                compliance_veld_id=v.id,
                veld_naam=veld_vertaling.veld_naam(v, taal),
                sleutel=v.sleutel,
                veld_type=veld_vertaling.veld_type(v.veld_type, taal),
                verplicht=v.verplicht,
                wetgeving_id=v.wetgeving_id,
                wetgeving_code=v.wetgeving.code if v.wetgeving else "—",
                ingevuld=bool(w and w.ingevuld),
                waarde=(w.waarde if w else None),
                bron=(w.bron if w else None),
                bron_url=(w.bron_url if w else None),
                geverifieerd=bool(w and w.geverifieerd),
                twijfelachtig=bool(w and w.twijfelachtig),
                status=_veld_status(w),
            )
        )
    return regels


@router.post("", response_model=schemas.ProductOut, status_code=201)
def maak_product(
    data: schemas.ProductCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not db.get(models.Leverancier, data.leverancier_id):
        raise HTTPException(status_code=400, detail="Leverancier bestaat niet")
    product = models.Product(**data.model_dump())
    db.add(product)
    db.flush()
    audit_service.log(
        db,
        audit_service.PRODUCT_TOEGEVOEGD,
        audit_service.OBJ_PRODUCT,
        object_id=product.id,
        object_naam=product.naam,
        nieuwe_waarde=product.naam,
        leverancier_id=product.leverancier_id,
        product_id=product.id,
    )
    db.commit()
    db.refresh(product)
    # compliance herberekenen + automatisch scrapen als er velden ontbreken
    background_tasks.add_task(compliance_service.herbereken_product_bg, product.id)
    background_tasks.add_task(scraper.scrape_product_bg, product.id)
    return product


@router.put("/{product_id}", response_model=schemas.ProductOut)
def wijzig_product(
    product_id: int,
    data: schemas.ProductUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    velden = data.model_dump(exclude_unset=True)
    # wijzigingen bepalen (oude → nieuwe waarde) voor de audit trail
    wijzigingen = {
        veld: (getattr(product, veld), waarde)
        for veld, waarde in velden.items()
        if getattr(product, veld) != waarde
    }
    for veld, waarde in velden.items():
        setattr(product, veld, waarde)
    if wijzigingen:
        oud = "; ".join(f"{v}: {o}" for v, (o, _) in wijzigingen.items())
        nieuw = "; ".join(f"{v}: {n}" for v, (_, n) in wijzigingen.items())
        audit_service.log(
            db,
            audit_service.PRODUCT_GEWIJZIGD,
            audit_service.OBJ_PRODUCT,
            object_id=product.id,
            object_naam=product.naam,
            oude_waarde=oud,
            nieuwe_waarde=nieuw,
            leverancier_id=product.leverancier_id,
            product_id=product.id,
        )
    db.commit()
    db.refresh(product)
    background_tasks.add_task(compliance_service.herbereken_product_bg, product.id)
    return product


@router.delete("/{product_id}", status_code=204)
def verwijder_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    audit_service.log(
        db,
        audit_service.PRODUCT_VERWIJDERD,
        audit_service.OBJ_PRODUCT,
        object_id=product.id,
        object_naam=product.naam,
        oude_waarde=product.naam,
        leverancier_id=product.leverancier_id,
        product_id=product.id,
    )
    db.delete(product)
    db.commit()
    compliance_service.invalideer_dashboard()
    return None


@router.post("/{product_id}/scrape")
def start_scrape(
    product_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Start handmatig een scrape-taak voor ontbrekende velden."""
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    background_tasks.add_task(scraper.scrape_product_bg, product.id)
    return {"gestart": True}


@router.post(
    "/{product_id}/compliance/{veld_id}/verifieer",
    response_model=schemas.ProductComplianceRegel,
)
def verifieer_waarde(
    product_id: int,
    veld_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Keur een automatisch gevonden waarde goed (telt daarna mee voor compliance)."""
    w = (
        db.query(models.ProductComplianceWaarde)
        .filter_by(product_id=product_id, compliance_veld_id=veld_id)
        .first()
    )
    if not w or not w.waarde:
        raise HTTPException(status_code=404, detail="Geen waarde om te verifiëren")
    w.geverifieerd = True
    w.ingevuld = True
    w.twijfelachtig = False
    db.commit()
    db.refresh(w)
    background_tasks.add_task(compliance_service.herbereken_product_bg, product_id)
    veld = db.get(models.ComplianceVeld, veld_id)
    return schemas.ProductComplianceRegel(
        compliance_veld_id=veld_id,
        veld_naam=veld.naam if veld else "",
        sleutel=veld.sleutel if veld else "",
        veld_type=veld.veld_type if veld else "tekst",
        verplicht=veld.verplicht if veld else True,
        wetgeving_id=veld.wetgeving_id if veld else 0,
        wetgeving_code=veld.wetgeving.code if veld and veld.wetgeving else "—",
        ingevuld=True,
        waarde=w.waarde,
        bron=w.bron,
        bron_url=w.bron_url,
        geverifieerd=True,
        twijfelachtig=False,
        status="ingevuld",
    )


def _regel_uit_waarde(
    veld: models.ComplianceVeld,
    w: Optional[models.ProductComplianceWaarde],
    taal: str,
) -> schemas.ProductComplianceRegel:
    return schemas.ProductComplianceRegel(
        compliance_veld_id=veld.id,
        veld_naam=veld_vertaling.veld_naam(veld, taal),
        sleutel=veld.sleutel,
        veld_type=veld_vertaling.veld_type(veld.veld_type, taal),
        verplicht=veld.verplicht,
        wetgeving_id=veld.wetgeving_id,
        wetgeving_code=veld.wetgeving.code if veld.wetgeving else "—",
        ingevuld=bool(w and w.ingevuld),
        waarde=(w.waarde if w else None),
        bron=(w.bron if w else None),
        bron_url=(w.bron_url if w else None),
        geverifieerd=bool(w and w.geverifieerd),
        twijfelachtig=bool(w and w.twijfelachtig),
        status=_veld_status(w),
    )


@router.put(
    "/{product_id}/compliance-waarde/{veld_id}",
    response_model=schemas.ProductComplianceRegel,
)
def wijzig_compliance_waarde(
    product_id: int,
    veld_id: int,
    data: schemas.ComplianceWaardeUpdate,
    taal: str = "nl",
    db: Session = Depends(get_db),
):
    """Bewerk een (handmatig ingevulde) compliance-veldwaarde en herbereken de score."""
    taal = "en" if taal == "en" else "nl"
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    veld = db.get(models.ComplianceVeld, veld_id)
    if not veld:
        raise HTTPException(status_code=404, detail="Compliance-veld niet gevonden")

    nieuwe_waarde = (data.waarde or "").strip()
    w = (
        db.query(models.ProductComplianceWaarde)
        .filter_by(product_id=product_id, compliance_veld_id=veld_id)
        .first()
    )
    oude_waarde = w.waarde if w else None
    if not w:
        w = models.ProductComplianceWaarde(
            product_id=product_id, compliance_veld_id=veld_id
        )
        db.add(w)
    # handmatige bewerking: telt mee (geverifieerd), bron wordt handmatig
    w.waarde = nieuwe_waarde or None
    w.ingevuld = bool(nieuwe_waarde)
    w.bron = "handmatig"
    w.bron_url = None
    w.geverifieerd = True
    w.twijfelachtig = False

    # audit trail: leg de inline compliance-wijziging vast (oud → nieuw)
    if (oude_waarde or None) != (nieuwe_waarde or None):
        audit_service.log(
            db,
            audit_service.COMPLIANCE_GEWIJZIGD,
            audit_service.OBJ_COMPLIANCE,
            object_id=product_id,
            object_naam=f"{product.naam} · {veld.naam}",
            oude_waarde=oude_waarde,
            nieuwe_waarde=nieuwe_waarde or None,
            leverancier_id=product.leverancier_id,
            product_id=product_id,
        )

    # synchroon herberekenen zodat de frontend de nieuwe score direct kan tonen
    db.flush()
    compliance_service.herbereken_product(db, product)
    db.commit()
    db.refresh(w)
    compliance_service.invalideer_dashboard()
    return _regel_uit_waarde(veld, w, taal)
