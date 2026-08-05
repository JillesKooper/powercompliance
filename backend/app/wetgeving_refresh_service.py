"""AI-gestuurde wetgeving-refresh.

Haalt via de Anthropic API (met de web_search-tool) de meest actuele informatie
op over elke actieve wetgeving — ingangsdatum, status, samenvatting en recente
wijzigingen/nieuwe verplichtingen — en werkt de database bij. Bij een wijziging
(nieuwe ingangsdatum, gewijzigde status of samenvatting) wordt een notificatie
aangemaakt.

Alles is defensief: ontbreekt de API-sleutel of faalt een call, dan blijft de
app werken en rapporteert de refresh dat de betreffende wetgeving is mislukt.
"""
import json
import logging
import os
from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from . import models, notificatie_teksten

logger = logging.getLogger("powercompliance.wetgeving_refresh")

MODEL = "claude-opus-4-8"

# app_instellingen-sleutels
FREQ_SLEUTEL = "wetgeving_refresh_frequentie"
LAATSTE_RUN_SLEUTEL = "wetgeving_refresh_laatste_run"

GELDIGE_FREQ = {"uit", "dagelijks", "wekelijks", "maandelijks"}
_INTERVAL_DAGEN = {"dagelijks": 1, "wekelijks": 7, "maandelijks": 30}
_GELDIGE_STATUS = {"van kracht", "aankomend", "concept"}

# labels voor gewijzigde velden in de notificatie
_VELD_LABEL = {
    "ingangsdatum": "ingangsdatum",
    "status": "status",
    "samenvatting": "samenvatting",
}


# ---------- instellingen (sleutel/waarde) ----------
def get_instelling(db: Session, sleutel: str, default: Optional[str] = None) -> Optional[str]:
    rij = db.get(models.AppInstelling, sleutel)
    return rij.waarde if rij and rij.waarde is not None else default


def zet_instelling(db: Session, sleutel: str, waarde: Optional[str]) -> None:
    rij = db.get(models.AppInstelling, sleutel)
    if rij:
        rij.waarde = waarde
    else:
        db.add(models.AppInstelling(sleutel=sleutel, waarde=waarde))
    db.commit()


def get_frequentie(db: Session) -> str:
    freq = get_instelling(db, FREQ_SLEUTEL, "uit")
    return freq if freq in GELDIGE_FREQ else "uit"


def get_laatste_run(db: Session) -> Optional[datetime]:
    ruw = get_instelling(db, LAATSTE_RUN_SLEUTEL)
    if not ruw:
        return None
    try:
        return datetime.fromisoformat(ruw)
    except ValueError:
        return None


# ---------- AI-call ----------
def _parse_datum(waarde) -> Optional[date]:
    if not waarde or not isinstance(waarde, str):
        return None
    try:
        return date.fromisoformat(waarde.strip()[:10])
    except ValueError:
        return None


def _vraag_ai(wet: models.Wetgeving) -> Optional[dict]:
    """Vraag de Anthropic API (met websearch) om de actuele wetgeving-info.

    Geeft een dict terug met sleutels van_kracht_vanaf/status/samenvatting/
    wijzigingen, of None als er geen betrouwbaar antwoord is.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.info("Geen ANTHROPIC_API_KEY — wetgeving-refresh overgeslagen.")
        return None
    try:
        import anthropic

        prompt = (
            "Je bent een compliance-analist voor een groothandel. Zoek de meest "
            "actuele, betrouwbare informatie op over de volgende EU/NL-wetgeving en "
            "vat die kort samen in het Nederlands.\n\n"
            f"Wetgeving: {wet.code} — {wet.naam}\n"
            f"Huidige bekende ingangsdatum: {wet.van_kracht_vanaf or 'onbekend'}\n"
            f"Huidige bekende status: {wet.status}\n\n"
            "Gebruik de web_search-tool om officiële bronnen (bijv. EUR-Lex, "
            "Europese Commissie, rijksoverheid) te raadplegen. Let op recente "
            "wijzigingen, uitgestelde of vervroegde ingangsdata en nieuwe "
            "verplichtingen.\n\n"
            "Geef je eindantwoord UITSLUITEND als één geldig JSON-object, zonder "
            "extra tekst eromheen, met exact deze sleutels:\n"
            '{\n'
            '  "van_kracht_vanaf": "YYYY-MM-DD of null",\n'
            '  "status": "van kracht | aankomend | concept",\n'
            '  "samenvatting": "2-4 zinnen Nederlandse samenvatting van de kern en scope",\n'
            '  "wijzigingen": "korte NL-omschrijving van recente wijzigingen of nieuwe verplichtingen, of null"\n'
            "}"
        )
        client = anthropic.Anthropic(api_key=api_key)
        messages = [{"role": "user", "content": prompt}]
        tools = [{"type": "web_search_20260209", "name": "web_search"}]

        resp = None
        for _ in range(6):  # server-tool-lus kan pauzeren (pause_turn)
            resp = client.messages.create(
                model=MODEL,
                max_tokens=2000,
                tools=tools,
                messages=messages,
            )
            if resp.stop_reason == "pause_turn":
                messages.append({"role": "assistant", "content": resp.content})
                continue
            break

        if resp is None:
            return None
        tekst = "".join(
            b.text for b in resp.content if getattr(b, "type", None) == "text"
        ).strip()
        start, eind = tekst.find("{"), tekst.rfind("}")
        if start == -1 or eind == -1:
            return None
        return json.loads(tekst[start : eind + 1])
    except Exception:  # noqa: BLE001 — nooit de refresh laten crashen
        logger.exception("AI-refresh mislukt voor %s", wet.code)
        return None


# ---------- refresh ----------
def ververs_een(db: Session, wet: models.Wetgeving) -> dict:
    """Ververs één wetgeving; werk de DB bij en maak zo nodig een notificatie."""
    data = _vraag_ai(wet)
    wet.laatst_bijgewerkt_op = datetime.utcnow()

    if not data:
        db.commit()
        return {"code": wet.code, "status": "mislukt", "gewijzigd": False, "velden": []}

    gewijzigd: list[str] = []

    nieuwe_datum = _parse_datum(data.get("van_kracht_vanaf"))
    if nieuwe_datum and nieuwe_datum != wet.van_kracht_vanaf:
        wet.van_kracht_vanaf = nieuwe_datum
        gewijzigd.append("ingangsdatum")

    nieuwe_status = (data.get("status") or "").strip().lower()
    if nieuwe_status in _GELDIGE_STATUS and nieuwe_status != wet.status:
        wet.status = nieuwe_status
        gewijzigd.append("status")

    nieuwe_samenvatting = (data.get("samenvatting") or "").strip()
    if nieuwe_samenvatting and nieuwe_samenvatting != (wet.samenvatting or "").strip():
        wet.samenvatting = nieuwe_samenvatting
        gewijzigd.append("samenvatting")

    if gewijzigd:
        if "ingangsdatum" in gewijzigd and wet.van_kracht_vanaf:
            db.add(
                notificatie_teksten.maak(
                    "wetgeving_nieuwe_ingangsdatum",
                    {"code": wet.code, "datum": wet.van_kracht_vanaf.isoformat()},
                    type="waarschuwing",
                    categorie="Wetgeving bijgewerkt",
                    entiteit_type="wetgeving",
                    entiteit_id=wet.id,
                )
            )
        else:
            labels = ", ".join(_VELD_LABEL.get(v, v) for v in gewijzigd)
            db.add(
                notificatie_teksten.maak(
                    "wetgeving_gewijzigd",
                    {"code": wet.code, "velden": labels},
                    type="info",
                    categorie="Wetgeving bijgewerkt",
                    entiteit_type="wetgeving",
                    entiteit_id=wet.id,
                )
            )

    db.commit()
    return {
        "code": wet.code,
        "status": "ok",
        "gewijzigd": bool(gewijzigd),
        "velden": gewijzigd,
    }


def ververs_alle_actieve(db: Session) -> dict:
    """Ververs alle actieve wetgevingen en leg de run-tijd vast."""
    wetten = (
        db.query(models.Wetgeving)
        .filter(models.Wetgeving.actief.is_(True))
        .order_by(models.Wetgeving.code)
        .all()
    )
    regels = [ververs_een(db, wet) for wet in wetten]
    zet_instelling(db, LAATSTE_RUN_SLEUTEL, datetime.utcnow().isoformat())
    return {
        "aantal_ververst": len(regels),
        "aantal_gewijzigd": sum(1 for r in regels if r["gewijzigd"]),
        "laatste_run": get_laatste_run(db),
        "regels": regels,
    }


def run_indien_gepland(db: Session) -> None:
    """Draai de refresh als de automatische frequentie dat vereist (scheduler)."""
    freq = get_frequentie(db)
    if freq == "uit":
        return
    laatste = get_laatste_run(db)
    dagen = _INTERVAL_DAGEN.get(freq, 1)
    if laatste and (datetime.utcnow() - laatste).days < dagen:
        return
    logger.info("Geplande wetgeving-refresh (%s) gestart.", freq)
    ververs_alle_actieve(db)
