import json

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
)
from sqlalchemy.orm import Session

from .. import compliance_service, importer, schemas
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
    compliance_service.invalideer_dashboard()
    return resultaat


@router.post("/producten", response_model=schemas.ImportSamenvatting)
async def import_producten(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
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
    # compliance-cache van alle producten asynchroon herberekenen
    background_tasks.add_task(compliance_service.herbereken_alle_bg)
    return resultaat


# ---------- Slimme bulkimport (analyse → preview → bevestigen) ----------
@router.post("/producten/analyseer", response_model=schemas.ImportAnalyse)
async def analyseer_producten(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """Analyseer een productbestand: voorgestelde kolommapping, nieuw/update per
    rij en AI-categoriesuggesties — zonder iets op te slaan."""
    _controleer_bestand(file)
    inhoud = await file.read()
    return importer.analyseer_producten(db, file.filename, inhoud)


@router.post("/producten/bevestig", response_model=schemas.ImportBevestigResultaat)
async def bevestig_producten(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    mapping: str = Form(...),
    modus: str = Form("alles"),
    categorieen: str = Form("{}"),
    db: Session = Depends(get_db),
):
    """Voer de import uit met de (door de gebruiker gecorrigeerde) mapping."""
    _controleer_bestand(file)
    inhoud = await file.read()
    try:
        mapping_dict = json.loads(mapping or "{}")
        categorie_dict = json.loads(categorieen or "{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Ongeldige mapping/categorieën.")
    if not isinstance(mapping_dict, dict) or not isinstance(categorie_dict, dict):
        raise HTTPException(status_code=400, detail="Ongeldige mapping/categorieën.")

    resultaat = importer.bevestig_producten(
        db, file.filename, inhoud, mapping_dict, modus, categorie_dict
    )
    background_tasks.add_task(compliance_service.herbereken_alle_bg)
    return resultaat


@router.get("/producten/template")
def download_template(db: Session = Depends(get_db)):
    """Download een lege Excel-importtemplate met voorbeeldrijen en instructies."""
    inhoud = importer.template_producten_xlsx(db)
    return Response(
        content=inhoud,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="powercompliance-import-template.xlsx"'
        },
    )
