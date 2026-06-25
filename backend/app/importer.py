"""Import van leveranciers en producten uit CSV/Excel.

- Automatische kolomherkenning: headers worden genormaliseerd en gematcht aan
  bekende veldnamen (incl. veelvoorkomende synoniemen).
- Validatie: ontbrekende verplichte kolommen geven een duidelijke foutmelding.
- Compliance-analyse voor producten: extra kolommen die overeenkomen met een
  ComplianceVeld worden als waarde opgeslagen; daarna wordt per product bepaald
  of het compliant is of data mist. Koppeling aan wetgeving loopt via categorie.
"""
import csv
import io
import re
from typing import List, Tuple

from sqlalchemy.orm import Session

from . import models, compliance


# ---------- normalisatie & mapping ----------
def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


LEVERANCIER_SYNONIEMEN = {
    "naam": {"naam", "name", "leverancier", "supplier", "bedrijf", "bedrijfsnaam", "company"},
    "contactpersoon": {"contactpersoon", "contact", "contactperson", "persoon"},
    "email": {"email", "emailadres", "mail", "emailaddress"},
    "telefoon": {"telefoon", "telefoonnummer", "tel", "phone", "phonenumber"},
    "land": {"land", "country", "landcode"},
}
LEVERANCIER_VERPLICHT = ["naam"]

PRODUCT_SYNONIEMEN = {
    "naam": {"naam", "name", "product", "productnaam", "artikelnaam", "title", "omschrijving"},
    "artikelnummer": {"artikelnummer", "artikelnr", "sku", "artikel", "articlenumber", "itemnumber", "code", "artikelcode"},
    "ean": {"ean", "barcode", "gtin", "ean13", "streepjescode"},
    "beschrijving": {"beschrijving", "description", "omschrijvinglang"},
    "leverancier": {"leverancier", "supplier", "leveranciernaam", "vendor", "fabrikant"},
    "categorie": {"categorie", "category", "productgroep", "groep", "productcategorie"},
}
PRODUCT_VERPLICHT = ["naam", "leverancier"]


def _bouw_synoniem_index(synoniemen: dict) -> dict:
    index = {}
    for veld, namen in synoniemen.items():
        for n in namen:
            index[_norm(n)] = veld
    return index


# ---------- bestand parsen ----------
def parse_bestand(bestandsnaam: str, inhoud: bytes) -> Tuple[List[str], List[dict]]:
    naam = (bestandsnaam or "").lower()
    if naam.endswith(".xlsx") or naam.endswith(".xlsm"):
        return _parse_xlsx(inhoud)
    return _parse_csv(inhoud)


def _parse_csv(inhoud: bytes) -> Tuple[List[str], List[dict]]:
    tekst = inhoud.decode("utf-8-sig", errors="replace")
    # delimiter detecteren (NL-Excel gebruikt vaak ;)
    monster = tekst[:2048]
    try:
        dialect = csv.Sniffer().sniff(monster, delimiters=",;\t|")
        delim = dialect.delimiter
    except csv.Error:
        delim = ";" if monster.count(";") > monster.count(",") else ","
    reader = csv.reader(io.StringIO(tekst), delimiter=delim)
    rijen = [r for r in reader if any((c or "").strip() for c in r)]
    if not rijen:
        return [], []
    headers = [h.strip() for h in rijen[0]]
    data = []
    for r in rijen[1:]:
        rij = {headers[i]: (r[i] if i < len(r) else "") for i in range(len(headers))}
        data.append(rij)
    return headers, data


def _parse_xlsx(inhoud: bytes) -> Tuple[List[str], List[dict]]:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(inhoud), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], []
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    data = []
    for r in rows[1:]:
        if not any(c is not None and str(c).strip() for c in r):
            continue
        rij = {}
        for i, h in enumerate(headers):
            v = r[i] if i < len(r) else None
            rij[h] = "" if v is None else str(v).strip()
        data.append(rij)
    return headers, data


# ---------- kolommen mappen ----------
def map_kolommen(headers: List[str], synoniem_index: dict):
    """Geef terug: {header: veld} voor herkende kolommen + lijst onbekende headers."""
    herkend = {}
    onbekend = []
    for h in headers:
        veld = synoniem_index.get(_norm(h))
        if veld:
            herkend[h] = veld
        else:
            onbekend.append(h)
    return herkend, onbekend


class OntbrekendeKolommen(Exception):
    def __init__(self, kolommen):
        self.kolommen = kolommen
        super().__init__("Ontbrekende verplichte kolommen: " + ", ".join(kolommen))


# ---------- leveranciers importeren ----------
def import_leveranciers(db: Session, bestandsnaam: str, inhoud: bytes) -> dict:
    headers, rijen = parse_bestand(bestandsnaam, inhoud)
    index = _bouw_synoniem_index(LEVERANCIER_SYNONIEMEN)
    herkend, onbekend = map_kolommen(headers, index)

    ontbrekend = [v for v in LEVERANCIER_VERPLICHT if v not in herkend.values()]
    if ontbrekend:
        raise OntbrekendeKolommen(ontbrekend)

    fouten = []
    geimporteerd = 0
    for nr, rij in enumerate(rijen, start=2):  # rij 1 = header
        waarden = {veld: (rij.get(h) or "").strip() for h, veld in herkend.items()}
        if not waarden.get("naam"):
            fouten.append({"rij": nr, "bericht": "Lege of ontbrekende naam"})
            continue
        lev = models.Leverancier(
            naam=waarden.get("naam"),
            contactpersoon=waarden.get("contactpersoon") or None,
            email=waarden.get("email") or None,
            telefoon=waarden.get("telefoon") or None,
            land=waarden.get("land") or "NL",
            actief=True,
        )
        db.add(lev)
        geimporteerd += 1
    db.commit()

    return {
        "type": "leveranciers",
        "bestandsnaam": bestandsnaam,
        "aantal_rijen": len(rijen),
        "aantal_geimporteerd": geimporteerd,
        "aantal_fouten": len(fouten),
        "herkende_kolommen": herkend,
        "genegeerde_kolommen": onbekend,
        "fouten": fouten,
    }


# ---------- producten importeren + compliance-analyse ----------
def import_producten(db: Session, bestandsnaam: str, inhoud: bytes) -> dict:
    headers, rijen = parse_bestand(bestandsnaam, inhoud)
    index = _bouw_synoniem_index(PRODUCT_SYNONIEMEN)
    kern_herkend, rest = map_kolommen(headers, index)

    ontbrekend = [v for v in PRODUCT_VERPLICHT if v not in kern_herkend.values()]
    if ontbrekend:
        raise OntbrekendeKolommen(ontbrekend)

    # compliance-velden indexeren op genormaliseerde sleutel én naam
    velden = db.query(models.ComplianceVeld).all()
    veld_index = {}
    for v in velden:
        veld_index[_norm(v.sleutel)] = v
        veld_index[_norm(v.naam)] = v

    # onbekende kolommen die wél een compliance-veld zijn
    compliance_kolommen = {}  # header -> ComplianceVeld
    echt_onbekend = []
    for h in rest:
        v = veld_index.get(_norm(h))
        if v:
            compliance_kolommen[h] = v
        else:
            echt_onbekend.append(h)

    # bestaande leveranciers/categorieën op naam (case-insensitief)
    lev_op_naam = {
        l.naam.strip().lower(): l for l in db.query(models.Leverancier).all()
    }
    cat_op_naam = {
        c.naam.strip().lower(): c for c in db.query(models.Categorie).all()
    }

    herkend_overzicht = dict(kern_herkend)
    for h, v in compliance_kolommen.items():
        herkend_overzicht[h] = f"compliance: {v.wetgeving.code} · {v.naam}"

    fouten = []
    nieuwe_producten = []
    velden_ingevuld = 0

    for nr, rij in enumerate(rijen, start=2):
        kern = {veld: (rij.get(h) or "").strip() for h, veld in kern_herkend.items()}
        naam = kern.get("naam")
        lev_naam = kern.get("leverancier")
        if not naam:
            fouten.append({"rij": nr, "bericht": "Lege of ontbrekende productnaam"})
            continue
        if not lev_naam:
            fouten.append({"rij": nr, "bericht": "Leverancier ontbreekt"})
            continue
        lev = lev_op_naam.get(lev_naam.strip().lower())
        if not lev:
            fouten.append(
                {"rij": nr, "bericht": f"Leverancier '{lev_naam}' niet gevonden"}
            )
            continue

        # categorie matchen of aanmaken (bepaalt welke wetgeving van toepassing is)
        cat = None
        cat_naam = kern.get("categorie")
        if cat_naam:
            cat = cat_op_naam.get(cat_naam.strip().lower())
            if not cat:
                cat = models.Categorie(naam=cat_naam.strip())
                db.add(cat)
                db.flush()
                cat_op_naam[cat_naam.strip().lower()] = cat

        product = models.Product(
            naam=naam,
            artikelnummer=kern.get("artikelnummer") or None,
            ean=kern.get("ean") or None,
            beschrijving=kern.get("beschrijving") or None,
            leverancier_id=lev.id,
            categorie_id=cat.id if cat else None,
        )
        db.add(product)
        db.flush()

        # compliance-waarden uit extra kolommen
        for h, veld in compliance_kolommen.items():
            cel = (rij.get(h) or "").strip()
            if cel:
                db.add(
                    models.ProductComplianceWaarde(
                        product_id=product.id,
                        compliance_veld_id=veld.id,
                        waarde=cel,
                        ingevuld=True,
                    )
                )
                velden_ingevuld += 1
        nieuwe_producten.append(product)

    db.commit()

    # compliance-status per geïmporteerd product bepalen
    compliant = 0
    met_ontbrekend = 0
    for product in nieuwe_producten:
        db.refresh(product)
        stats = compliance.product_compliance(db, product)
        if stats["aantal_ontbrekend"] == 0:
            compliant += 1
        else:
            met_ontbrekend += 1

    return {
        "type": "producten",
        "bestandsnaam": bestandsnaam,
        "aantal_rijen": len(rijen),
        "aantal_geimporteerd": len(nieuwe_producten),
        "aantal_fouten": len(fouten),
        "aantal_compliant": compliant,
        "aantal_met_ontbrekende_data": met_ontbrekend,
        "aantal_velden_ingevuld": velden_ingevuld,
        "herkende_kolommen": herkend_overzicht,
        "genegeerde_kolommen": echt_onbekend,
        "fouten": fouten,
    }
