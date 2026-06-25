from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import importer, schemas
from ..database import get_db

router = APIRouter(prefix="/api/import", tags=["import"])

TOEGESTAAN = (".csv", ".xlsx", ".xlsm")


def _controleer_bestand(file: UploadFile):
    naam = (file.filename or "").lower()
    if not naam.endswith(TOEGESTAAN):
        raise HTTPException(
            status_code=400,
            detail="Niet-ondersteund formaat. Gebruik CSV of Excel (.xlsx).",
        )


@router.post("/leveranciers", response_model=schemas.ImportSamenvatting)
async def import_leveranciers(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    _controleer_bestand(file)
    inhoud = await file.read()
    try:
        resultaat = importer.import_leveranciers(db, file.filename, inhoud)
    except importer.OntbrekendeKolommen as e:
        raise HTTPException(
            status_code=422,
            detail=f"Ontbrekende verplichte kolommen: {', '.join(e.kolommen)}",
        )
    return resultaat


@router.post("/producten", response_model=schemas.ImportSamenvatting)
async def import_producten(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    _controleer_bestand(file)
    inhoud = await file.read()
    try:
        resultaat = importer.import_producten(db, file.filename, inhoud)
    except importer.OntbrekendeKolommen as e:
        raise HTTPException(
            status_code=422,
            detail=f"Ontbrekende verplichte kolommen: {', '.join(e.kolommen)}",
        )
    return resultaat
