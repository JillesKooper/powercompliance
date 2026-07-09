from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .. import report_service, schemas
from ..database import get_db

router = APIRouter(prefix="/api/rapportages", tags=["rapportages"])


@router.get("", response_model=schemas.RapportagesData)
def alle_rapportages(db: Session = Depends(get_db)):
    """Alle rapportagedata in één call (voor de Rapportages-pagina)."""
    return report_service.alles(db)


@router.get("/compliance-overzicht", response_model=List[schemas.ComplianceOverzichtRegel])
def compliance_overzicht(db: Session = Depends(get_db)):
    return report_service.compliance_overzicht(db)


@router.get("/scorecards", response_model=List[schemas.LeverancierScorecard])
def scorecards(db: Session = Depends(get_db)):
    return report_service.scorecards(db)


@router.get("/risico", response_model=List[schemas.RisicoLeverancier])
def risico(db: Session = Depends(get_db)):
    return report_service.risico(db)


@router.get("/trend", response_model=List[schemas.TrendPunt])
def trend(db: Session = Depends(get_db)):
    return report_service.trend(db)


MEDIA = {
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@router.get("/{soort}/export")
def exporteer_rapportage(soort: str, formaat: str = "pdf", db: Session = Depends(get_db)):
    """Exporteer een rapportage als PDF of Excel."""
    if soort not in report_service.SOORTEN:
        raise HTTPException(status_code=404, detail="Onbekende rapportage")
    if formaat not in MEDIA:
        raise HTTPException(status_code=400, detail="Formaat moet pdf of xlsx zijn")
    if formaat == "pdf":
        inhoud, bestandsnaam = report_service.bouw_pdf(db, soort)
    else:
        inhoud, bestandsnaam = report_service.bouw_xlsx(db, soort)
    return Response(
        content=inhoud,
        media_type=MEDIA[formaat],
        headers={"Content-Disposition": f'attachment; filename="{bestandsnaam}"'},
    )
