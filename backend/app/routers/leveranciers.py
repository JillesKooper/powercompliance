from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas, compliance_service
from ..database import get_db

router = APIRouter(prefix="/api/leveranciers", tags=["leveranciers"])


@router.get("", response_model=schemas.LeveranciersPagina)
def lijst_leveranciers(
    zoek: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(models.Leverancier)
    if zoek:
        q = q.filter(models.Leverancier.naam.ilike(f"%{zoek}%"))
    total = q.count()
    leveranciers = (
        q.order_by(models.Leverancier.naam)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    resultaat = []
    for lev in leveranciers:
        # gebruik de gedenormaliseerde compliance-cache per product (schaalbaar)
        producten = lev.producten
        totaal_ontbrekend = sum(p.aantal_ontbrekend or 0 for p in producten)
        gem = (
            round(sum(p.compliance_percentage or 0 for p in producten) / len(producten), 1)
            if producten
            else 100.0
        )
        item = schemas.LeverancierMetStats.model_validate(lev)
        item.aantal_producten = len(producten)
        item.aantal_ontbrekend = totaal_ontbrekend
        item.compliance_percentage = gem
        resultaat.append(item)
    return schemas.LeveranciersPagina(
        items=resultaat,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if per_page else 1,
    )


@router.get("/{leverancier_id}", response_model=schemas.LeverancierOut)
def haal_leverancier(leverancier_id: int, db: Session = Depends(get_db)):
    lev = db.get(models.Leverancier, leverancier_id)
    if not lev:
        raise HTTPException(status_code=404, detail="Leverancier niet gevonden")
    return lev


@router.get(
    "/{leverancier_id}/activiteit", response_model=List[schemas.ActiviteitOut]
)
def leverancier_activiteit(leverancier_id: int, db: Session = Depends(get_db)):
    """Interactiehistorie (tijdlijn) van deze leverancier, nieuwste eerst."""
    if not db.get(models.Leverancier, leverancier_id):
        raise HTTPException(status_code=404, detail="Leverancier niet gevonden")
    return (
        db.query(models.LeverancierActiviteit)
        .filter(models.LeverancierActiviteit.leverancier_id == leverancier_id)
        .order_by(models.LeverancierActiviteit.aangemaakt_op.desc())
        .all()
    )


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
