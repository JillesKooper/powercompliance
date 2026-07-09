from datetime import date
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import documenten, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api", tags=["documenten"])

MAX_BYTES = 25 * 1024 * 1024  # 25 MB


@router.get("/documenten/types")
def documenttypes():
    """Beschikbare documenttypes (sleutel -> label)."""
    return documenten.DOCUMENTTYPES


@router.get(
    "/producten/{product_id}/documenten", response_model=List[schemas.DocumentOut]
)
def lijst_documenten(product_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Product, product_id):
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    docs = (
        db.query(models.ProductDocument)
        .filter(models.ProductDocument.product_id == product_id)
        .order_by(models.ProductDocument.geupload_op.desc())
        .all()
    )
    return [documenten.naar_out(d) for d in docs]


@router.post(
    "/producten/{product_id}/documenten",
    response_model=schemas.DocumentOut,
    status_code=201,
)
async def upload_document(
    product_id: int,
    documenttype: str = Form(...),
    verloopdatum: Optional[str] = Form(None),
    notitie: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product niet gevonden")
    if documenttype not in documenten.DOCUMENTTYPES:
        raise HTTPException(status_code=400, detail="Onbekend documenttype")

    inhoud = await file.read()
    if len(inhoud) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Bestand is te groot (max 25 MB).")
    if not inhoud:
        raise HTTPException(status_code=400, detail="Leeg bestand.")

    verloop: Optional[date] = None
    if verloopdatum:
        try:
            verloop = date.fromisoformat(verloopdatum)
        except ValueError:
            raise HTTPException(status_code=400, detail="Ongeldige verloopdatum.")

    bestandsnaam = documenten.bewaar_bestand(file.filename, inhoud)
    doc = models.ProductDocument(
        product_id=product_id,
        documenttype=documenttype,
        bestandsnaam=bestandsnaam,
        originele_naam=file.filename or bestandsnaam,
        mime_type=file.content_type,
        grootte=len(inhoud),
        verloopdatum=verloop,
        notitie=notitie or None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    # vervalnotificatie indien (bijna) verlopen
    documenten.maak_verloop_notificatie(db, doc)
    db.commit()
    return documenten.naar_out(doc)


@router.get("/documenten/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(models.ProductDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document niet gevonden")
    pad = documenten.pad_voor(doc)
    if not pad.exists():
        raise HTTPException(status_code=404, detail="Bestand niet meer aanwezig")
    return FileResponse(
        path=pad,
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.originele_naam,
    )


@router.delete("/documenten/{document_id}", status_code=204)
def verwijder_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(models.ProductDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document niet gevonden")
    documenten.verwijder_bestand(doc)
    db.delete(doc)
    db.commit()
    return None


@router.get(
    "/leveranciers/{leverancier_id}/documenten",
    response_model=List[schemas.DocumentMetProduct],
)
def documenten_van_leverancier(leverancier_id: int, db: Session = Depends(get_db)):
    if not db.get(models.Leverancier, leverancier_id):
        raise HTTPException(status_code=404, detail="Leverancier niet gevonden")
    docs = (
        db.query(models.ProductDocument)
        .join(models.Product, models.ProductDocument.product_id == models.Product.id)
        .filter(models.Product.leverancier_id == leverancier_id)
        .order_by(models.ProductDocument.verloopdatum.is_(None), models.ProductDocument.verloopdatum)
        .all()
    )
    return [documenten.naar_out_met_product(d) for d in docs]


@router.get("/documenten/verlopend", response_model=schemas.VerlopendDocumentenOverzicht)
def verlopende_documenten(db: Session = Depends(get_db)):
    return documenten.verlopend_overzicht(db)
