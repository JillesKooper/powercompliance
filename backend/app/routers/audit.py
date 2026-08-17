"""Audit trail: tijdlijn van alle wijzigingen, filterbaar en exporteerbaar."""
import io
from datetime import date, datetime, time
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from .. import audit_service, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/audit", tags=["audit"])

# Leesbare labels per actie/objecttype voor de Excel-export (NL).
_ACTIE_LABEL = {
    audit_service.COMPLIANCE_GEWIJZIGD: "Compliance-waarde gewijzigd",
    audit_service.LEVERANCIER_GEWIJZIGD: "Leverancier gewijzigd",
    audit_service.PRODUCT_TOEGEVOEGD: "Product toegevoegd",
    audit_service.PRODUCT_GEWIJZIGD: "Product gewijzigd",
    audit_service.PRODUCT_VERWIJDERD: "Product verwijderd",
    audit_service.WETGEVING_GEWIJZIGD: "Wetgeving aan/uit",
    audit_service.DATAVERZOEK_VERSTUURD: "Dataverzoek verstuurd",
    audit_service.BULKIMPORT: "Bulkimport uitgevoerd",
    audit_service.REPLY_VERWERKT: "Reply verwerkt",
}


def _parse_van(waarde: Optional[str]) -> Optional[datetime]:
    if not waarde:
        return None
    try:
        return datetime.combine(date.fromisoformat(waarde[:10]), time.min)
    except ValueError:
        return None


def _parse_tot(waarde: Optional[str]) -> Optional[datetime]:
    """Einddatum inclusief: tot en met het einde van die dag."""
    if not waarde:
        return None
    try:
        return datetime.combine(date.fromisoformat(waarde[:10]), time.max)
    except ValueError:
        return None


@router.get("", response_model=schemas.AuditPagina)
def lijst_audit(
    van: Optional[str] = Query(None, description="Vanaf-datum (YYYY-MM-DD)"),
    tot: Optional[str] = Query(None, description="Tot-en-met-datum (YYYY-MM-DD)"),
    actie: Optional[str] = Query(None),
    object_type: Optional[str] = Query(None),
    object_id: Optional[int] = Query(None),
    leverancier_id: Optional[int] = Query(None),
    product_id: Optional[int] = Query(None),
    zoek: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = audit_service.zoek(
        db,
        van=_parse_van(van),
        tot=_parse_tot(tot),
        actie=actie,
        object_type=object_type,
        object_id=object_id,
        leverancier_id=leverancier_id,
        product_id=product_id,
        zoekterm=zoek,
    )
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    return schemas.AuditPagina(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if per_page else 1,
    )


@router.get("/filters", response_model=schemas.AuditFilters)
def audit_filters(db: Session = Depends(get_db)):
    """Beschikbare filterwaarden: voorkomende acties + leveranciers."""
    acties = [
        r[0]
        for r in db.query(models.AuditLog.actie).distinct().all()
        if r[0]
    ]
    leveranciers = [
        {"id": l.id, "naam": l.naam}
        for l in db.query(models.Leverancier).order_by(models.Leverancier.naam).all()
    ]
    return schemas.AuditFilters(acties=sorted(acties), leveranciers=leveranciers)


@router.get("/export")
def exporteer_audit(
    van: Optional[str] = Query(None),
    tot: Optional[str] = Query(None),
    actie: Optional[str] = Query(None),
    object_type: Optional[str] = Query(None),
    object_id: Optional[int] = Query(None),
    leverancier_id: Optional[int] = Query(None),
    product_id: Optional[int] = Query(None),
    zoek: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Exporteer de (gefilterde) audit trail als Excel-bestand."""
    from openpyxl import Workbook
    from openpyxl.styles import Font

    rijen = audit_service.zoek(
        db,
        van=_parse_van(van),
        tot=_parse_tot(tot),
        actie=actie,
        object_type=object_type,
        object_id=object_id,
        leverancier_id=leverancier_id,
        product_id=product_id,
        zoekterm=zoek,
    ).all()

    labels = [
        "Tijdstip",
        "Gebruiker",
        "Actie",
        "Objecttype",
        "Object",
        "Oude waarde",
        "Nieuwe waarde",
    ]
    wb = Workbook()
    ws = wb.active
    ws.title = "Audit trail"
    ws.append(labels)
    for cel in ws[1]:
        cel.font = Font(bold=True)
    for r in rijen:
        ws.append(
            [
                r.tijdstip.strftime("%Y-%m-%d %H:%M:%S") if r.tijdstip else "",
                r.gebruiker or "",
                _ACTIE_LABEL.get(r.actie, r.actie),
                r.object_type or "",
                r.object_naam or (str(r.object_id) if r.object_id else ""),
                r.oude_waarde or "",
                r.nieuwe_waarde or "",
            ]
        )
    breedtes = [20, 20, 26, 14, 34, 34, 34]
    for i, breedte in enumerate(breedtes, start=1):
        if i <= 26:
            ws.column_dimensions[chr(64 + i)].width = breedte
    buf = io.BytesIO()
    wb.save(buf)
    inhoud = buf.getvalue()

    stempel = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    bestandsnaam = f"audit-trail-{stempel}.xlsx"
    return Response(
        content=inhoud,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{bestandsnaam}"',
            "X-Export-Aantal": str(len(rijen)),
        },
    )
