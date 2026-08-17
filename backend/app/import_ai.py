"""AI-ondersteuning voor de slimme bulkimport (Anthropic API).

Twee taken:
- ``ai_map_kolommen``: mapt de kolomkoppen van een leveranciersbestand naar de
  velden in PowerCompliance, ook bij afwijkende kolomnamen/volgorde.
- ``ai_categoriseer``: bepaalt per product de vermoedelijke categorie (uit de
  bestaande categorieën) met een betrouwbaarheidsscore.

Alles is defensief opgezet — net als de wetgeving-refresh: ontbreekt de
ANTHROPIC_API_KEY of faalt een call, dan geeft de functie ``None`` terug en valt
de importer terug op de heuristische kolomherkenning (en slaat categorisatie
over). De app blijft dus altijd werken, ook zonder AI.
"""
import json
import logging
import os
from typing import List, Optional

logger = logging.getLogger("powercompliance.import_ai")

# Lichter/sneller model: kolom-mapping en categorisatie zijn eenvoudige taken.
MODEL = "claude-haiku-4-5-20251001"


def _client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.info("Geen ANTHROPIC_API_KEY — AI-import overgeslagen (heuristiek).")
        return None
    try:
        import anthropic

        return anthropic.Anthropic(api_key=api_key)
    except Exception:  # noqa: BLE001
        logger.exception("Kon Anthropic-client niet initialiseren.")
        return None


def _vraag_json(client, prompt: str, max_tokens: int = 1500) -> Optional[dict]:
    """Doe één call en parse het JSON-object uit het antwoord (defensief)."""
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        tekst = "".join(
            b.text for b in resp.content if getattr(b, "type", None) == "text"
        ).strip()
        start, eind = tekst.find("{"), tekst.rfind("}")
        if start == -1 or eind == -1:
            return None
        return json.loads(tekst[start : eind + 1])
    except Exception:  # noqa: BLE001 — nooit de import laten crashen
        logger.exception("AI-import-call mislukt.")
        return None


def ai_map_kolommen(
    headers: List[str],
    voorbeeldrijen: List[dict],
    doelvelden: List[dict],
) -> Optional[dict]:
    """Vraag de AI om headers → doelveld-sleutel te mappen.

    ``doelvelden`` is een lijst {sleutel, label, groep}. Geeft een dict terug:
    {header: {"veld": sleutel|None, "zekerheid": 0..1}}, of None bij falen.
    """
    client = _client()
    if not client:
        return None

    velden_omschrijving = "\n".join(
        f'- sleutel "{d["sleutel"]}": {d["label"]} ({d["groep"]})'
        for d in doelvelden
    )
    # Compacte voorbeeldwaarden per kolom (max 3), zodat de AI de inhoud ziet.
    voorbeelden = {}
    for h in headers:
        waarden = [
            str(r.get(h, "")).strip()
            for r in voorbeeldrijen[:5]
            if str(r.get(h, "")).strip()
        ]
        voorbeelden[h] = waarden[:3]

    prompt = (
        "Je bent een data-integratie-assistent voor een compliance-platform. "
        "Een leverancier levert een productlijst aan met eigen kolomnamen. Map "
        "elke kolomkop naar het juiste doelveld in ons systeem.\n\n"
        "Beschikbare doelvelden (gebruik exact de opgegeven sleutel):\n"
        f"{velden_omschrijving}\n\n"
        "Kolomkoppen met voorbeeldwaarden:\n"
        f"{json.dumps(voorbeelden, ensure_ascii=False)}\n\n"
        "Regels:\n"
        "- Kies per kolom hoogstens één doelveld-sleutel.\n"
        "- Gebruik null als een kolom nergens goed op past.\n"
        "- Gebruik elke doelveld-sleutel hoogstens één keer.\n"
        "- 'zekerheid' is een getal tussen 0 en 1.\n\n"
        "Antwoord UITSLUITEND met één JSON-object van deze vorm, zonder extra "
        "tekst:\n"
        '{ "mapping": { "<kolomkop>": { "veld": "<sleutel of null>", '
        '"zekerheid": 0.0 } } }'
    )
    data = _vraag_json(client, prompt)
    if not data or not isinstance(data.get("mapping"), dict):
        return None

    geldige = {d["sleutel"] for d in doelvelden}
    resultaat = {}
    for header, info in data["mapping"].items():
        if header not in headers or not isinstance(info, dict):
            continue
        veld = info.get("veld")
        if veld not in geldige:
            veld = None
        try:
            zekerheid = float(info.get("zekerheid", 0.0))
        except (TypeError, ValueError):
            zekerheid = 0.0
        resultaat[header] = {
            "veld": veld,
            "zekerheid": max(0.0, min(1.0, zekerheid)),
        }
    return resultaat or None


def ai_categoriseer(
    producten: List[dict],
    categorieen: List[str],
) -> Optional[dict]:
    """Bepaal per product de vermoedelijke categorie + betrouwbaarheid.

    ``producten`` is een lijst {index, naam, beschrijving}. ``categorieen`` zijn
    de bestaande categorienamen (de AI mag hieruit kiezen of een nieuwe naam
    voorstellen). Geeft {index: {"categorie": str, "zekerheid": 0..1}} of None.
    """
    client = _client()
    if not client or not producten:
        return None

    lijst = [
        {
            "index": p["index"],
            "naam": p.get("naam") or "",
            "beschrijving": (p.get("beschrijving") or "")[:200],
        }
        for p in producten
    ]
    prompt = (
        "Je bent een productclassificatie-assistent voor een groothandel. "
        "Bepaal voor elk product de meest passende productcategorie op basis van "
        "naam en beschrijving.\n\n"
        "Bestaande categorieën (kies bij voorkeur hieruit):\n"
        f"{json.dumps(categorieen, ensure_ascii=False)}\n\n"
        "Producten:\n"
        f"{json.dumps(lijst, ensure_ascii=False)}\n\n"
        "Regels:\n"
        "- Kies waar mogelijk een bestaande categorie (exacte naam).\n"
        "- Alleen als niets past mag je een korte nieuwe categorienaam voorstellen.\n"
        "- 'zekerheid' is een getal tussen 0 en 1.\n\n"
        "Antwoord UITSLUITEND met één JSON-object van deze vorm, zonder extra "
        "tekst:\n"
        '{ "categorieen": [ { "index": 0, "categorie": "<naam>", '
        '"zekerheid": 0.0 } ] }'
    )
    data = _vraag_json(client, prompt, max_tokens=2000)
    if not data or not isinstance(data.get("categorieen"), list):
        return None

    resultaat = {}
    for item in data["categorieen"]:
        if not isinstance(item, dict):
            continue
        try:
            idx = int(item.get("index"))
        except (TypeError, ValueError):
            continue
        naam = (item.get("categorie") or "").strip()
        if not naam:
            continue
        try:
            zekerheid = float(item.get("zekerheid", 0.0))
        except (TypeError, ValueError):
            zekerheid = 0.0
        resultaat[idx] = {
            "categorie": naam,
            "zekerheid": max(0.0, min(1.0, zekerheid)),
        }
    return resultaat or None
