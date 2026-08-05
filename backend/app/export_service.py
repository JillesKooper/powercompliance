"""PIM/ERP-export: bouwt CSV/Excel/JSON van goedgekeurde productdata en levert
een samenvatting af aan geabonneerde webhooks.

Een export bestaat uit gekozen velden (product-basisvelden + compliance-velden) en
filters (leverancier, categorie, wetgeving, alleen volledig-compliant). Elke export
wordt vastgelegd in de exporthistorie (ExportLog).
"""
import csv
import io
import json
from datetime import date, datetime
from typing import List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from . import compliance, models, schemas, veld_vertaling

# Product-basisvelden die exporteerbaar zijn (sleutel -> label)
BASIS_VELDEN = [
    ("id", "Product-ID"),
    ("naam", "Naam"),
    ("artikelnummer", "Artikelnummer"),
    ("ean", "EAN"),
    ("merk", "Merk"),
    ("beschrijving", "Beschrijving"),
    ("leverancier", "Leverancier"),
    ("categorie", "Categorie"),
    ("compliance_percentage", "Compliance %"),
    ("compliance_status", "Compliance-status"),
    ("aantal_ontbrekend", "Ontbrekende velden"),
]
STANDAARD_VELDEN = ["artikelnummer", "naam", "ean", "leverancier", "categorie"]


def beschikbare_velden(db: Session, taal: str = "nl") -> List[schemas.ExportVeld]:
    """Alle exporteerbare velden: basisvelden + compliance-velden per wetgeving."""
    velden = [
        schemas.ExportVeld(
            sleutel=s,
            label=veld_vertaling.basis_veld_label(s, lbl, taal),
            groep="product",
        )
        for s, lbl in BASIS_VELDEN
    ]
    veld_rijen = (
        db.query(models.ComplianceVeld)
        .join(models.Wetgeving, models.ComplianceVeld.wetgeving_id == models.Wetgeving.id)
        .order_by(models.Wetgeving.code, models.ComplianceVeld.naam)
        .all()
    )
    for cv in veld_rijen:
        code = cv.wetgeving.code if cv.wetgeving else "—"
        velden.append(
            schemas.ExportVeld(
                sleutel=f"cf:{cv.id}",
                label=veld_vertaling.veld_naam(cv, taal),
                groep=code,
            )
        )
    return velden


def export_opties(db: Session, taal: str = "nl") -> schemas.ExportOpties:
    return schemas.ExportOpties(
        velden=beschikbare_velden(db, taal),
        leveranciers=[
            {"id": l.id, "naam": l.naam}
            for l in db.query(models.Leverancier).order_by(models.Leverancier.naam).all()
        ],
        categorieen=[
            {"id": c.id, "naam": c.naam}
            for c in db.query(models.Categorie).order_by(models.Categorie.naam).all()
        ],
        wetgeving=[
            {"code": w.code, "naam": w.naam}
            for w in db.query(models.Wetgeving).order_by(models.Wetgeving.code).all()
        ],
    )


def _veld_label(db: Session, sleutel: str, taal: str = "nl") -> str:
    if sleutel.startswith("cf:"):
        cv = db.get(models.ComplianceVeld, int(sleutel[3:]))
        if cv:
            code = cv.wetgeving.code if cv.wetgeving else "—"
            return f"{code} · {veld_vertaling.veld_naam(cv, taal)}"
        return sleutel
    for s, lbl in BASIS_VELDEN:
        if s == sleutel:
            return veld_vertaling.basis_veld_label(s, lbl, taal)
    return sleutel


def selecteer_producten(
    db: Session, req: schemas.ExportRequest
) -> List[models.Product]:
    q = db.query(models.Product)
    if req.leverancier_id is not None:
        q = q.filter(models.Product.leverancier_id == req.leverancier_id)
    if req.categorie_id is not None:
        q = q.filter(models.Product.categorie_id == req.categorie_id)
    if req.wetgeving_code:
        wet = (
            db.query(models.Wetgeving)
            .filter(models.Wetgeving.code == req.wetgeving_code)
            .first()
        )
        cat_ids = [c.id for c in wet.categorieen] if wet else []
        q = q.filter(models.Product.categorie_id.in_(cat_ids or [-1]))
    if req.alleen_compliant:
        q = q.filter(models.Product.compliance_status == "compliant")
    return q.order_by(models.Product.naam).all()


def _waarde_voor(
    product: models.Product, sleutel: str, waarden_map: dict
) -> str:
    if sleutel.startswith("cf:"):
        w = waarden_map.get(int(sleutel[3:]))
        return w.waarde if (w and w.ingevuld and w.waarde) else ""
    if sleutel == "leverancier":
        return product.leverancier.naam if product.leverancier else ""
    if sleutel == "categorie":
        return product.categorie.naam if product.categorie else ""
    waarde = getattr(product, sleutel, "")
    return "" if waarde is None else str(waarde)


def bouw_rijen(
    db: Session, req: schemas.ExportRequest
) -> Tuple[List[str], List[List[str]], List[str]]:
    """Geef (veldsleutels, datarijen, kopregel-labels) terug."""
    taal = "en" if getattr(req, "taal", "nl") == "en" else "nl"
    velden = req.velden or list(STANDAARD_VELDEN)
    producten = selecteer_producten(db, req)
    labels = [_veld_label(db, s, taal) for s in velden]
    rijen = []
    for p in producten:
        waarden_map = {w.compliance_veld_id: w for w in p.compliance_waarden}
        rijen.append([_waarde_voor(p, s, waarden_map) for s in velden])
    return velden, rijen, labels


# ---------- formaten ----------
def naar_csv(labels: List[str], rijen: List[List[str]]) -> bytes:
    buf = io.StringIO()
    schrijver = csv.writer(buf, delimiter=";")
    schrijver.writerow(labels)
    schrijver.writerows(rijen)
    return buf.getvalue().encode("utf-8-sig")


def naar_xlsx(labels: List[str], rijen: List[List[str]]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()
    ws = wb.active
    ws.title = "Export"
    ws.append(labels)
    for cel in ws[1]:
        cel.font = Font(bold=True)
    for rij in rijen:
        ws.append(rij)
    for i, label in enumerate(labels, start=1):
        kolom = ws.column_dimensions[chr(64 + i)] if i <= 26 else None
        if kolom is not None:
            kolom.width = max(12, min(40, len(label) + 6))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def naar_json(velden: List[str], labels: List[str], rijen: List[List[str]]) -> bytes:
    records = [
        {label: rij[i] for i, label in enumerate(labels)} for rij in rijen
    ]
    payload = {
        "geexporteerd_op": datetime.utcnow().isoformat() + "Z",
        "aantal": len(records),
        "velden": labels,
        "records": records,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")


MEDIA = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "json": "application/json",
}
EXT = {"csv": "csv", "xlsx": "xlsx", "json": "json"}


def bouw_export(
    db: Session, req: schemas.ExportRequest
) -> Tuple[bytes, str, str, int, List[str]]:
    """Bouw het exportbestand. Geef (inhoud, bestandsnaam, media_type, aantal, velden)."""
    formaat = req.formaat if req.formaat in MEDIA else "csv"
    velden, rijen, labels = bouw_rijen(db, req)
    if formaat == "xlsx":
        inhoud = naar_xlsx(labels, rijen)
    elif formaat == "json":
        inhoud = naar_json(velden, labels, rijen)
    else:
        inhoud = naar_csv(labels, rijen)
    stempel = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    bestandsnaam = f"pim-export-{stempel}.{EXT[formaat]}"
    return inhoud, bestandsnaam, MEDIA[formaat], len(rijen), velden


# ---------- webhooks / PIM-koppelingen ----------
def actieve_koppelingen(db: Session) -> List[models.WebhookAbonnement]:
    """Alle actieve PIM/ERP-koppelingen (webhook-abonnementen)."""
    return (
        db.query(models.WebhookAbonnement)
        .filter(models.WebhookAbonnement.actief.is_(True))
        .all()
    )


def lever_aan_webhooks(
    db: Session,
    samenvatting: dict,
    abonnees: Optional[List[models.WebhookAbonnement]] = None,
) -> List[dict]:
    """POST de export-samenvatting naar de (actieve) webhook-abonnementen."""
    if abonnees is None:
        abonnees = actieve_koppelingen(db)
    resultaten = []
    for ab in abonnees:
        status = "ok"
        try:
            headers = {"Content-Type": "application/json"}
            if ab.geheim:
                headers["X-PowerCompliance-Secret"] = ab.geheim
            resp = httpx.post(ab.url, json=samenvatting, headers=headers, timeout=8.0)
            status = f"{resp.status_code} {resp.reason_phrase}".strip()
        except Exception as e:  # noqa: BLE001 - netwerkfouten netjes vastleggen
            status = f"fout: {type(e).__name__}"
        ab.laatste_status = status
        ab.laatst_afgeleverd_op = datetime.utcnow()
        resultaten.append({"webhook_id": ab.id, "url": ab.url, "status": status})
    db.commit()
    return resultaten


def registreer_export(
    db: Session,
    req: schemas.ExportRequest,
    bestandsnaam: str,
    aantal: int,
    velden: List[str],
    bron: str = "handmatig",
    webhook_resultaat: Optional[List[dict]] = None,
) -> models.ExportLog:
    """Log de export + lever (indien nog niet gebeurd) af aan webhooks.

    Geef ``webhook_resultaat`` mee wanneer de aflevering al is uitgevoerd
    (bv. door :func:`push_naar_pim`); dan wordt niet nogmaals bezorgd.
    Geef het ExportLog-record terug.
    """
    if webhook_resultaat is None:
        samenvatting = {
            "event": "product.export",
            "formaat": req.formaat,
            "bestandsnaam": bestandsnaam,
            "aantal_producten": aantal,
            "velden": velden,
            "filters": {
                "leverancier_id": req.leverancier_id,
                "categorie_id": req.categorie_id,
                "wetgeving_code": req.wetgeving_code,
                "alleen_compliant": req.alleen_compliant,
            },
            "tijdstip": datetime.utcnow().isoformat() + "Z",
        }
        webhook_resultaat = lever_aan_webhooks(db, samenvatting)
    log = models.ExportLog(
        formaat=req.formaat,
        bestandsnaam=bestandsnaam,
        aantal_producten=aantal,
        aantal_velden=len(velden),
        velden=json.dumps(velden, ensure_ascii=False),
        filters=json.dumps(
            {
                "leverancier_id": req.leverancier_id,
                "categorie_id": req.categorie_id,
                "wetgeving_code": req.wetgeving_code,
                "alleen_compliant": req.alleen_compliant,
            },
            ensure_ascii=False,
        ),
        bron=bron,
        webhook_resultaat=json.dumps(webhook_resultaat, ensure_ascii=False)
        if webhook_resultaat
        else None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def push_naar_pim(db: Session, req: schemas.ExportRequest) -> dict:
    """Verstuur de daadwerkelijke compliance-data naar de gekoppelde PIM/ERP-systemen.

    In tegenstelling tot :func:`lever_aan_webhooks` (die enkel een samenvatting
    stuurt) bevat de payload hier de volledige records. Geeft een resultaat-dict
    terug met per koppeling de afleverstatus. De router controleert vooraf of er
    überhaupt een koppeling actief is.
    """
    koppelingen = actieve_koppelingen(db)
    taal = "en" if getattr(req, "taal", "nl") == "en" else "nl"
    velden, rijen, labels = bouw_rijen(db, req)
    records = [
        {label: rij[i] for i, label in enumerate(labels)} for rij in rijen
    ]
    stempel = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    bestandsnaam = f"pim-export-{stempel}.json"
    payload = {
        "event": "product.export",
        "formaat": "json",
        "bestandsnaam": bestandsnaam,
        "aantal_producten": len(records),
        "velden": labels,
        "filters": {
            "leverancier_id": req.leverancier_id,
            "categorie_id": req.categorie_id,
            "wetgeving_code": req.wetgeving_code,
            "alleen_compliant": req.alleen_compliant,
        },
        "records": records,
        "tijdstip": datetime.utcnow().isoformat() + "Z",
    }
    webhook_resultaat = lever_aan_webhooks(db, payload, abonnees=koppelingen)
    registreer_export(
        db,
        req,
        bestandsnaam,
        len(records),
        velden,
        bron="pim",
        webhook_resultaat=webhook_resultaat,
    )
    return {
        "aantal_producten": len(records),
        "bestandsnaam": bestandsnaam,
        "aantal_koppelingen": len(koppelingen),
        "koppelingen": webhook_resultaat,
    }
