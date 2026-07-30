"""Documentbeheer: opslag, verloopstatus en vervalnotificaties.

Documenten worden fysiek opgeslagen in backend/uploads/. Per document houden we
een verloopdatum bij; binnen 60 dagen verlopen of al verlopen documenten worden
gesignaleerd op het dashboard en leiden tot een notificatie.
"""
import os
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from . import models, schemas, notificatie_teksten

# backend/uploads/ — relatief t.o.v. de projectmap van de backend
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

VERLOOP_DREMPEL_DAGEN = 60

# Toegestane documenttypes (sleutel -> label)
DOCUMENTTYPES = {
    "veiligheidsblad": "Veiligheidsinformatieblad (SDS)",
    "ce-certificaat": "CE-certificaat",
    "dop": "Prestatieverklaring (DoP)",
    "energielabel": "Energielabel",
    "conformiteitsverklaring": "EU-conformiteitsverklaring (DoC)",
    "testrapport": "Testrapport",
    "overig": "Overig document",
}


def bewaar_bestand(originele_naam: str, inhoud: bytes) -> str:
    """Schrijf de bytes weg onder een unieke bestandsnaam en geef die naam terug."""
    suffix = Path(originele_naam or "").suffix.lower() or ".pdf"
    veilige_naam = f"{uuid.uuid4().hex}{suffix}"
    pad = UPLOAD_DIR / veilige_naam
    with open(pad, "wb") as f:
        f.write(inhoud)
    return veilige_naam


def pad_voor(doc: models.ProductDocument) -> Path:
    return UPLOAD_DIR / doc.bestandsnaam


def verwijder_bestand(doc: models.ProductDocument) -> None:
    try:
        os.remove(pad_voor(doc))
    except OSError:
        pass


def verloop_info(verloopdatum: Optional[date]) -> tuple[str, Optional[int]]:
    """Bepaal (status, dagen_tot_verloop) voor een verloopdatum."""
    if verloopdatum is None:
        return "geen", None
    dagen = (verloopdatum - date.today()).days
    if dagen < 0:
        return "verlopen", dagen
    if dagen <= VERLOOP_DREMPEL_DAGEN:
        return "verloopt_binnenkort", dagen
    return "geldig", dagen


def naar_out(doc: models.ProductDocument) -> schemas.DocumentOut:
    status, dagen = verloop_info(doc.verloopdatum)
    return schemas.DocumentOut(
        id=doc.id,
        product_id=doc.product_id,
        documenttype=doc.documenttype,
        originele_naam=doc.originele_naam,
        mime_type=doc.mime_type,
        grootte=doc.grootte or 0,
        verloopdatum=doc.verloopdatum,
        notitie=doc.notitie,
        geupload_op=doc.geupload_op,
        verloop_status=status,
        dagen_tot_verloop=dagen,
    )


def naar_out_met_product(doc: models.ProductDocument) -> schemas.DocumentMetProduct:
    basis = naar_out(doc)
    product = doc.product
    return schemas.DocumentMetProduct(
        **basis.model_dump(),
        product_naam=product.naam if product else None,
        artikelnummer=product.artikelnummer if product else None,
        leverancier_naam=(
            product.leverancier.naam if product and product.leverancier else None
        ),
    )


def maak_verloop_notificatie(db: Session, doc: models.ProductDocument) -> None:
    """Maak een notificatie als een document (al) verlopen is of binnenkort verloopt."""
    status, dagen = verloop_info(doc.verloopdatum)
    if status not in ("verlopen", "verloopt_binnenkort"):
        return
    type_label = DOCUMENTTYPES.get(doc.documenttype, doc.documenttype)
    product = doc.product
    pnaam = product.naam if product else "product"
    if status == "verlopen":
        sleutel = "document_verlopen"
        params = {
            "type_label": type_label,
            "document": doc.originele_naam,
            "product": pnaam,
        }
        ntype = "fout"
    else:
        sleutel = "document_verloopt_binnenkort"
        params = {
            "type_label": type_label,
            "document": doc.originele_naam,
            "product": pnaam,
            "dagen": dagen,
            "datum": doc.verloopdatum.isoformat(),
        }
        ntype = "waarschuwing"
    db.add(
        notificatie_teksten.maak(
            sleutel,
            params,
            type=ntype,
            categorie="Document verloopt",
            entiteit_type="product",
            entiteit_id=doc.product_id,
        )
    )


def verlopend_overzicht(db: Session) -> schemas.VerlopendDocumentenOverzicht:
    """Alle verlopen + binnenkort verlopende documenten (voor dashboardwidgets)."""
    docs = (
        db.query(models.ProductDocument)
        .filter(models.ProductDocument.verloopdatum.isnot(None))
        .order_by(models.ProductDocument.verloopdatum)
        .all()
    )
    verlopen, binnenkort = [], []
    for doc in docs:
        status, _ = verloop_info(doc.verloopdatum)
        if status == "verlopen":
            verlopen.append(naar_out_met_product(doc))
        elif status == "verloopt_binnenkort":
            binnenkort.append(naar_out_met_product(doc))
    return schemas.VerlopendDocumentenOverzicht(
        verlopen=verlopen,
        verloopt_binnenkort=binnenkort,
        aantal_verlopen=len(verlopen),
        aantal_binnenkort=len(binnenkort),
    )
