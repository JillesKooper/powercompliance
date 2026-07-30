from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .. import export_service, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/opties", response_model=schemas.ExportOpties)
def export_opties(taal: str = "nl", db: Session = Depends(get_db)):
    """Beschikbare velden + filteropties voor de export-configuratie."""
    return export_service.export_opties(db, "en" if taal == "en" else "nl")


@router.post("")
def maak_export(req: schemas.ExportRequest, db: Session = Depends(get_db)):
    """Genereer een exportbestand (CSV/Excel/JSON), log het en lever af aan webhooks."""
    inhoud, bestandsnaam, media_type, aantal, velden = export_service.bouw_export(
        db, req
    )
    export_service.registreer_export(db, req, bestandsnaam, aantal, velden)
    return Response(
        content=inhoud,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{bestandsnaam}"',
            "X-Export-Aantal": str(aantal),
        },
    )


@router.get("/historie", response_model=List[schemas.ExportLogOut])
def export_historie(db: Session = Depends(get_db)):
    return (
        db.query(models.ExportLog)
        .order_by(models.ExportLog.aangemaakt_op.desc())
        .limit(100)
        .all()
    )


# ---------- Webhook-abonnementen (generieke koppeling) ----------
@router.post("/webhook", response_model=schemas.WebhookOut, status_code=201)
async def abonneer_webhook(request: Request, db: Session = Depends(get_db)):
    """Generiek endpoint waarop een extern systeem zich abonneert op export-events.

    Accepteert zowel {"url": ...} als losse form/body. Bij elke export ontvangt de
    geregistreerde URL een POST met de export-samenvatting.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
    url = (body or {}).get("url")
    if not url or not isinstance(url, str) or not url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400, detail="Geef een geldige http(s)-url op in 'url'."
        )
    bestaand = (
        db.query(models.WebhookAbonnement)
        .filter(models.WebhookAbonnement.url == url)
        .first()
    )
    if bestaand:
        bestaand.actief = True
        bestaand.beschrijving = body.get("beschrijving") or bestaand.beschrijving
        bestaand.geheim = body.get("geheim") or bestaand.geheim
        db.commit()
        db.refresh(bestaand)
        return bestaand
    ab = models.WebhookAbonnement(
        url=url,
        beschrijving=body.get("beschrijving"),
        geheim=body.get("geheim"),
        actief=True,
    )
    db.add(ab)
    db.commit()
    db.refresh(ab)
    return ab


@router.get("/webhook", response_model=List[schemas.WebhookOut])
def lijst_webhooks(db: Session = Depends(get_db)):
    return (
        db.query(models.WebhookAbonnement)
        .order_by(models.WebhookAbonnement.aangemaakt_op.desc())
        .all()
    )


@router.delete("/webhook/{webhook_id}", status_code=204)
def verwijder_webhook(webhook_id: int, db: Session = Depends(get_db)):
    ab = db.get(models.WebhookAbonnement, webhook_id)
    if not ab:
        raise HTTPException(status_code=404, detail="Webhook niet gevonden")
    db.delete(ab)
    db.commit()
    return None
