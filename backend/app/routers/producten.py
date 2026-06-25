from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas, compliance
from ..database import get_db

router = APIRouter(prefix="/api/producten", tags=["producten"])


@router.get("", response_model=List[schemas.ProductMetStats])
def lijst_producten(
    leverancier_id: Optional[int] = Query(None),
    categorie_id: Optional[int] = Query(None),
    zoek: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Product)
    if leverancier_id is not None:
        q = q.filter(models.Product.leverancier_id == leverancier_id)
    if categorie_id is not None:
        q = q.filter(models.Product.categorie_id == categorie_id)
    if zoek:
        term = f"%{zoek}%"
        q = q.filter(
            models.Product.naam.ilike(term)
            | models.Product.artikelnummer.ilike(term)
            | models.Product.ean.ilike(term)
        )
    producten = q.order_by(models.Product.naam).all()
    resultaat = []
    for product in producten:
        stats = compliance.product_compliance(db, product)
        item = schemas.ProductMetStats.model_validate(product)
        for k, v in stats.items():
            setattr(item, k, v)
        resultaat.append(item)
    return resultaat


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
    response_model=List[schemas.ProductComplianceRegel],
)
def product_compliance_detail(product_id: int, db: Session = Depends(get_db)):
    """Alle van toepassing zijnde compliance-velden voor dit product, met of de
    waarde is ingevuld (compliant) of ontbreekt."""
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
                veld_naam=v.naam,
                sleutel=v.sleutel,
                veld_type=v.veld_type,
                verplicht=v.verplicht,
                wetgeving_id=v.wetgeving_id,
                wetgeving_code=v.wetgeving.code if v.wetgeving else "—",
                ingevuld=bool(w and w.ingevuld),
                waarde=(w.waarde if w else None),
            )
        )
    return regels


@router.post("", response_model=schemas.ProductOut, status_code=201)
def maak_product(data: schemas.ProductCreate, db: Session = Depends(get_db)):
    if not db.get(models.Leverancier, data.leverancier_id):
        raise HTTPException(status_code=400, detail="Leverancier bestaat niet")
    product = models.Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=schemas.ProductOut)
def wijzig_product(
    product_id: int, data: schemas.ProductUpdate, db: Session = Depends(get_db)
):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    for veld, waarde in data.model_dump(exclude_unset=True).items():
        setattr(product, veld, waarde)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
def verwijder_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    db.delete(product)
    db.commit()
    return None
