"""Automatisch scrapen van ontbrekende productdata.

Bronvolgorde: GS1 registry → Open Food Facts (voedsel) → fabrikantwebsite →
DuckDuckGo. De verzamelde tekst wordt met de Anthropic API (claude-sonnet-4-6)
geïnterpreteerd om veldwaarden te extraheren.

Gevonden waarden worden opgeslagen met bron="automatisch", geverifieerd=False en
twijfelachtig=True. Levert een bron niets op, dan wordt het veld op
"niet_gevonden" gezet. Blijven er na het scrapen velden ontbreken, dan wordt
automatisch een dataverzoek naar de leverancier aangemaakt.

Werkt zonder netwerk/sleutel: bronnen falen dan stil → velden worden
"niet_gevonden" en er wordt een dataverzoek gegenereerd (de gespecificeerde
degradatie).
"""
import json
import os
from datetime import datetime
from typing import List, Optional, Tuple

from . import compliance, compliance_service, models, notificatie_teksten
from .database import SessionLocal

MODEL = "claude-sonnet-4-6"
TIMEOUT = 8.0
HEADERS = {"User-Agent": "PowerCompliance/1.0 (+compliance-bot)"}


# ---------- losse bronnen (elk: geef (tekst, url) of None) ----------
def _http_get(url: str, params: dict = None):
    import httpx

    try:
        r = httpx.get(
            url, params=params, headers=HEADERS, timeout=TIMEOUT, follow_redirects=True
        )
        if r.status_code == 200:
            return r
    except Exception:
        return None
    return None


def bron_gs1(ean: Optional[str]) -> Optional[Tuple[str, str]]:
    if not ean:
        return None
    url = "https://www.gs1.org/services/verified-by-gs1/results"
    r = _http_get(url, {"gtin": ean})
    if not r:
        return None
    from bs4 import BeautifulSoup

    tekst = BeautifulSoup(r.text, "html.parser").get_text(" ", strip=True)
    return (tekst[:6000], str(r.url)) if tekst else None


def bron_open_food_facts(ean: Optional[str]) -> Optional[Tuple[str, str]]:
    if not ean:
        return None
    url = f"https://world.openfoodfacts.org/api/v2/product/{ean}.json"
    r = _http_get(url)
    if not r:
        return None
    try:
        data = r.json()
    except Exception:
        return None
    if data.get("status") != 1:
        return None
    return (json.dumps(data.get("product", {}))[:6000], url)


def bron_fabrikant(merk: Optional[str], naam: str) -> Optional[Tuple[str, str]]:
    """Best-effort: zoek de fabrikantpagina via DuckDuckGo met merk + productnaam."""
    if not merk:
        return None
    return bron_duckduckgo(f"{merk} {naam} specificaties datasheet")


def bron_duckduckgo(query: str) -> Optional[Tuple[str, str]]:
    url = "https://html.duckduckgo.com/html/"
    r = _http_get(url, {"q": query})
    if not r:
        return None
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(r.text, "html.parser")
    snippets = [
        el.get_text(" ", strip=True)
        for el in soup.select(".result__snippet, .result__title")
    ]
    tekst = " ".join(snippets)
    return (tekst[:6000], url) if tekst else None


def verzamel_bronnen(product: models.Product) -> List[Tuple[str, str, str]]:
    """Geef lijst van (bronnaam, tekst, url) in de gespecificeerde volgorde."""
    resultaten = []
    is_voedsel = product.categorie and product.categorie.naam == "Voedsel"

    for naam, fn in [
        ("GS1", lambda: bron_gs1(product.ean)),
        ("Open Food Facts", (lambda: bron_open_food_facts(product.ean)) if is_voedsel else (lambda: None)),
        ("Fabrikant", lambda: bron_fabrikant(product.merk, product.naam)),
        ("DuckDuckGo", lambda: bron_duckduckgo(f"{product.naam} {product.merk or ''} compliance")),
    ]:
        try:
            res = fn()
        except Exception:
            res = None
        if res:
            resultaten.append((naam, res[0], res[1]))
    return resultaten


# ---------- AI-interpretatie ----------
def interpreteer_met_ai(velden: List[models.ComplianceVeld], bronnen) -> dict:
    """Geef dict sleutel -> {"waarde": str, "twijfelachtig": bool} terug."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or not bronnen:
        return {}
    try:
        import anthropic

        veld_lijst = "\n".join(f"- {v.sleutel}: {v.naam} ({v.veld_type})" for v in velden)
        context = "\n\n".join(f"## Bron: {n} ({u})\n{t}" for n, t, u in bronnen)
        prompt = (
            "Hieronder staat tekst die online is gevonden over een product, en een "
            "lijst van compliance-velden die we proberen in te vullen. Haal voor elk "
            "veld de waarde uit de tekst indien aanwezig. Geef ALLEEN geldige JSON terug: "
            'een object met per veldsleutel {"waarde": "...", "twijfelachtig": true/false}. '
            "Laat een veld weg als je geen betrouwbare waarde vindt. Zet twijfelachtig op "
            "true als je niet zeker bent.\n\n"
            f"VELDEN:\n{veld_lijst}\n\nGEVONDEN TEKST:\n{context}"
        )
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        tekst = "".join(b.text for b in resp.content if b.type == "text").strip()
        # haal JSON eruit
        start, eind = tekst.find("{"), tekst.rfind("}")
        if start == -1 or eind == -1:
            return {}
        return json.loads(tekst[start : eind + 1])
    except Exception:
        return {}


# ---------- hoofdtaak ----------
def scrape_product_bg(product_id: int) -> None:
    db = SessionLocal()
    try:
        product = db.get(models.Product, product_id)
        if not product:
            return
        ontbrekend = compliance.ontbrekende_velden_voor_product(db, product)
        if not ontbrekend:
            return

        bronnen = verzamel_bronnen(product)
        gevonden = interpreteer_met_ai(ontbrekend, bronnen) if bronnen else {}
        bron_url = bronnen[0][2] if bronnen else None

        nog_ontbrekend = []
        for veld in ontbrekend:
            bestaand = (
                db.query(models.ProductComplianceWaarde)
                .filter_by(product_id=product.id, compliance_veld_id=veld.id)
                .first()
            )
            # handmatige of geverifieerde waarden nooit overschrijven
            if bestaand and (bestaand.bron == "handmatig" or bestaand.geverifieerd):
                continue

            treffer = gevonden.get(veld.sleutel)
            if treffer and treffer.get("waarde"):
                rij = bestaand or models.ProductComplianceWaarde(
                    product_id=product.id, compliance_veld_id=veld.id
                )
                rij.waarde = str(treffer["waarde"])
                rij.bron = "automatisch"
                rij.bron_url = bron_url
                rij.geverifieerd = False
                rij.twijfelachtig = bool(treffer.get("twijfelachtig", True))
                rij.ingevuld = False  # telt pas na verificatie
                if not bestaand:
                    db.add(rij)
            else:
                rij = bestaand or models.ProductComplianceWaarde(
                    product_id=product.id, compliance_veld_id=veld.id
                )
                rij.bron = "niet_gevonden"
                rij.bron_url = None
                rij.waarde = None
                rij.ingevuld = False
                if not bestaand:
                    db.add(rij)
                nog_ontbrekend.append(veld)

        # als er nog velden ontbreken: automatisch dataverzoek naar leverancier
        if nog_ontbrekend:
            codes = sorted({v.wetgeving.code for v in nog_ontbrekend if v.wetgeving})
            db.add(
                models.Dataverzoek(
                    leverancier_id=product.leverancier_id,
                    onderwerp=(
                        f"Automatisch dataverzoek: {len(nog_ontbrekend)} velden niet "
                        f"online gevonden voor {product.naam}"
                    ),
                    bericht=(
                        "Onze automatische scrape kon de volgende data niet online "
                        f"vinden ({', '.join(codes)}). Graag aanleveren."
                    ),
                    status="open",
                )
            )
            db.add(
                notificatie_teksten.maak(
                    "scrape_onvolledig",
                    {"product": product.naam, "aantal": len(nog_ontbrekend)},
                    type="waarschuwing",
                    categorie="Scrape resultaat",
                    entiteit_type="product",
                    entiteit_id=product.id,
                )
            )

        # herbereken compliance van dit product
        compliance_service.herbereken_product(db, product)
        db.commit()
    finally:
        db.close()
    compliance_service.invalideer_dashboard()
