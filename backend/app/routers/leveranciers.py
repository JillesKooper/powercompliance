from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, compliance
from ..database import get_db

router = APIRouter(prefix="/api/leveranciers", tags=["leveranciers"])


@router.get("", response_model=List[schemas.LeverancierMetStats])
def lijst_leveranciers(db: Session = Depends(get_db)):
    leveranciers = db.query(models.Leverancier).order_by(models.Leverancier.naam).all()
    resultaat = []
    for lev in leveranciers:
        totaal_ontbrekend = 0
        pcts = []
        for product in lev.producten:
            stats = compliance.product_compliance(db, product)
            totaal_ontbrekend += stats["aantal_ontbrekend"]
            pcts.append(stats["compliance_percentage"])
        gem = round(sum(pcts) / len(pcts), 1) if pcts else 100.0
        item = schemas.LeverancierMetStats.model_validate(lev)
        item.aantal_producten = len(lev.producten)
        item.aantal_ontbrekend = totaal_ontbrekend
        item.compliance_percentage = gem
        resultaat.append(item)
    return resultaat


@router.get("/{leverancier_id}", response_model=schemas.LeverancierOut)
def haal_leverancier(leverancier_id: int, db: Session = Depends(get_db)):
    lev = db.get(models.Leverancier, leverancier_id)
    if not lev:
        raise HTTPException(status_code=404, detail="Leverancier niet gevonden")
    return lev


@router.post("", response_model=schemas.LeverancierOut, status_code=201)
def maak_leverancier(data: schemas.LeverancierCreate, db: Session = Depends(get_db)):
    lev = models.Leverancier(**data.model_dump())
    db.add(lev)
    db.commit()
    db.refresh(lev)
    return lev


@router.put("/{leverancier_id}", response_model=schemas.LeverancierOut)
def wijzig_leverancier(
    leverancier_id: int,
    data: schemas.LeverancierUpdate,
    db: Session = Depends(get_db),
):
    lev = db.get(models.Leverancier, leverancier_id)
    if not lev:
        raise HTTPException(status_code=404, detail="Leverancier niet gevonden")
    for veld, waarde in data.model_dump(exclude_unset=True).items():
        setattr(lev, veld, waarde)
    db.commit()
    db.refresh(lev)
    return lev


@router.delete("/{leverancier_id}", status_code=204)
def verwijder_leverancier(leverancier_id: int, db: Session = Depends(get_db)):
    lev = db.get(models.Leverancier, leverancier_id)
    if not lev:
        raise HTTPException(status_code=404, detail="Leverancier niet gevonden")
    db.delete(lev)
    db.commit()
    return None
