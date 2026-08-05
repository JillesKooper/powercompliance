"""Vertaalbare notificatieteksten (NL/EN).

Notificaties worden met dynamische data gegenereerd. Om ze in de gekozen taal te
kunnen tonen, slaan we per notificatie een ``sleutel`` (welk sjabloon) en
``params`` (de ingevulde waarden) op. Op basis daarvan renderen we de titel en
het bericht in NL of EN.

Eigennamen in de params (leverancier-, product-, documentnamen, e-mailonderwerpen)
blijven onvertaald; alleen het sjabloon-skelet wordt vertaald.
"""
import json
import re
from typing import Optional, Tuple

# sleutel -> { taal -> {"titel": ..., "bericht": ...} } (str.format-sjablonen)
TEMPLATES = {
    "scrape_onvolledig": {
        "nl": {
            "titel": "Scrape onvolledig voor {product}",
            "bericht": "{aantal} veld(en) niet online gevonden; dataverzoek aangemaakt voor de leverancier.",
        },
        "en": {
            "titel": "Incomplete scrape for {product}",
            "bericht": "{aantal} field(s) not found online; a data request was created for the supplier.",
        },
    },
    "document_verlopen": {
        "nl": {
            "titel": "Document verlopen: {type_label}",
            "bericht": "Het document '{document}' van {product} is verlopen.",
        },
        "en": {
            "titel": "Document expired: {type_label}",
            "bericht": "The document '{document}' of {product} has expired.",
        },
    },
    "document_verloopt_binnenkort": {
        "nl": {
            "titel": "Document verloopt binnenkort: {type_label}",
            "bericht": "Het document '{document}' van {product} verloopt over {dagen} dagen ({datum}).",
        },
        "en": {
            "titel": "Document expiring soon: {type_label}",
            "bericht": "The document '{document}' of {product} expires in {dagen} days ({datum}).",
        },
    },
    "eudr_aankomend": {
        "nl": {
            "titel": "EUDR wordt binnenkort van kracht",
            "bericht": "De EU-ontbossingsverordening geldt vanaf eind 2025. Controleer herkomst en due-diligence voor hout-, papier- en voedingsproducten.",
        },
        "en": {
            "titel": "EUDR takes effect soon",
            "bericht": "The EU Deforestation Regulation applies from the end of 2025. Check origin and due diligence for wood, paper and food products.",
        },
    },
    "nieuwe_data_eudr": {
        "nl": {
            "titel": "Nieuwe data ontvangen voor {product}",
            "bericht": "De leverancier heeft de EUDR-herkomstdata aangeleverd.",
        },
        "en": {
            "titel": "New data received for {product}",
            "bericht": "The supplier has supplied the EUDR origin data.",
        },
    },
    "deadline_nadert": {
        "nl": {
            "titel": "Deadline dataverzoek nadert",
            "bericht": "Het dataverzoek aan {leverancier} voor PPWR-data verloopt binnen 7 dagen.",
        },
        "en": {
            "titel": "Data request deadline approaching",
            "bericht": "The data request to {leverancier} for PPWR data expires within 7 days.",
        },
    },
    "twijfelachtige_waarde": {
        "nl": {
            "titel": "Twijfelachtige waarde bij {product}",
            "bericht": "De opgegeven recycleerbaarheid valt buiten het bereik (0–100%).",
        },
        "en": {
            "titel": "Questionable value for {product}",
            "bericht": "The given recyclability is outside the valid range (0–100%).",
        },
    },
    "leverancier_openstaand": {
        "nl": {
            "titel": "{leverancier} heeft openstaande dataverzoeken",
            "bericht": "Meerdere producten van deze leverancier missen data.",
        },
        "en": {
            "titel": "{leverancier} has open data requests",
            "bericht": "Several products from this supplier are missing data.",
        },
    },
    "dataverzoek_verstuurd": {
        "nl": {
            "titel": "Dataverzoek verstuurd naar {leverancier}",
            "bericht": "{onderwerp} — {kanaal}",
        },
        "en": {
            "titel": "Data request sent to {leverancier}",
            "bericht": "{onderwerp} — {kanaal}",
        },
    },
    "bulk_dataverzoek_wetgeving": {
        "nl": {
            "titel": "{aantal} dataverzoeken verstuurd voor {code}",
            "bericht": "Verzonden naar: {namen}",
        },
        "en": {
            "titel": "{aantal} data requests sent for {code}",
            "bericht": "Sent to: {namen}",
        },
    },
    "reply_verwerkt": {
        "nl": {
            "titel": "Reply verwerkt van {leverancier}",
            "bericht": "{aantal} velden automatisch aangevuld over {producten} producten ({methode})",
        },
        "en": {
            "titel": "Reply processed from {leverancier}",
            "bericht": "{aantal} fields filled in automatically across {producten} products ({methode})",
        },
    },
    "bulk_dataverzoek_aangemaakt": {
        "nl": {
            "titel": "{aantal} dataverzoeken in bulk aangemaakt",
            "bericht": "{onderwerp}",
        },
        "en": {
            "titel": "{aantal} data requests created in bulk",
            "bericht": "{onderwerp}",
        },
    },
    "wetgeving_nieuwe_ingangsdatum": {
        "nl": {
            "titel": "Nieuwe ingangsdatum voor {code}",
            "bericht": "{code} geldt volgens de laatste informatie vanaf {datum}. Controleer de compliance-impact.",
        },
        "en": {
            "titel": "New effective date for {code}",
            "bericht": "According to the latest information, {code} applies from {datum}. Check the compliance impact.",
        },
    },
    "wetgeving_gewijzigd": {
        "nl": {
            "titel": "Wetgeving {code} bijgewerkt",
            "bericht": "De informatie over {code} is bijgewerkt (o.a. {velden}). Bekijk de wijzigingen op de wetgevingspagina.",
        },
        "en": {
            "titel": "Legislation {code} updated",
            "bericht": "The information about {code} has been updated ({velden}). Review the changes on the legislation page.",
        },
    },
}

# NL categorie-label -> { taal -> label }. We bewaren het NL-label in de kolom
# ``categorie`` (backward compatible) en vertalen bij het uitlezen.
CATEGORIE = {
    "Scrape resultaat": {"nl": "Scrape resultaat", "en": "Scrape result"},
    "Document verloopt": {"nl": "Document verloopt", "en": "Document expiring"},
    "Aankomende wetgeving": {"nl": "Aankomende wetgeving", "en": "Upcoming legislation"},
    "Nieuwe data ontvangen": {"nl": "Nieuwe data ontvangen", "en": "New data received"},
    "Deadline nadert": {"nl": "Deadline nadert", "en": "Deadline approaching"},
    "Twijfelachtige waarde": {"nl": "Twijfelachtige waarde", "en": "Questionable value"},
    "Leverancier-update": {"nl": "Leverancier-update", "en": "Supplier update"},
    "Dataverzoek verstuurd": {"nl": "Dataverzoek verstuurd", "en": "Data request sent"},
    "Wetgeving bijgewerkt": {"nl": "Wetgeving bijgewerkt", "en": "Legislation updated"},
}

# Params die zelf een (vertaalbare) enum-waarde zijn i.p.v. vrije tekst.
_ENUM_PARAMS = {
    "methode": {
        "ai": {"nl": "AI-parsing", "en": "AI parsing"},
        "regel": {"nl": "regel-parser", "en": "rule parser"},
    },
}


def _norm(taal: Optional[str]) -> str:
    return "en" if taal == "en" else "nl"


def _lokaliseer_params(params: dict, taal: str) -> dict:
    """Vertaal enum-achtige params (zoals de parse-methode); laat vrije tekst staan."""
    out = dict(params or {})
    for sleutel, opties in _ENUM_PARAMS.items():
        waarde = out.get(sleutel)
        if waarde in opties:
            out[sleutel] = opties[waarde].get(taal, opties[waarde]["nl"])
    return out


def render(sleutel: Optional[str], params: Optional[dict], taal: str = "nl") -> Optional[dict]:
    """Render {titel, bericht} voor een sleutel + params in de gevraagde taal.

    Geeft None terug als de sleutel onbekend is (caller valt dan terug op de
    opgeslagen NL-tekst)."""
    taal = _norm(taal)
    sjabloon = TEMPLATES.get(sleutel)
    if not sjabloon:
        return None
    tekst = sjabloon.get(taal) or sjabloon["nl"]
    p = _lokaliseer_params(params or {}, taal)

    def vul(s):
        if s is None:
            return None
        # vul bekende {params}; laat onbekende plaatshouders staan (nooit crashen)
        return re.sub(
            r"\{(\w+)\}",
            lambda m: str(p[m.group(1)]) if m.group(1) in p else m.group(0),
            s,
        )

    return {"titel": vul(tekst["titel"]), "bericht": vul(tekst.get("bericht"))}


# ---------- Reverse-match voor oude notificaties (zonder sleutel) ----------
# Bestaande notificaties (aangemaakt vóór de i18n-sjablonen) hebben geen sleutel
# of params. Om die tóch te kunnen vertalen, leiden we de sleutel + params af uit
# de opgeslagen Nederlandse titel/bericht via regex-matching op de NL-sjablonen.
def _sjabloon_naar_regex(sjabloon: str) -> "re.Pattern":
    delen = re.split(r"(\{\w+\})", sjabloon)
    stukken = []
    for d in delen:
        m = re.fullmatch(r"\{(\w+)\}", d)
        if m:
            stukken.append(f"(?P<{m.group(1)}>.+?)")
        else:
            stukken.append(re.escape(d))
    return re.compile("^" + "".join(stukken) + "$", re.DOTALL)


_REVERSE_INDEX = None


def _reverse_index():
    global _REVERSE_INDEX
    if _REVERSE_INDEX is None:
        _REVERSE_INDEX = []
        for sleutel, langs in TEMPLATES.items():
            nl = langs["nl"]
            titel_re = _sjabloon_naar_regex(nl["titel"])
            bericht_re = (
                _sjabloon_naar_regex(nl["bericht"]) if nl.get("bericht") else None
            )
            _REVERSE_INDEX.append((sleutel, titel_re, bericht_re))
    return _REVERSE_INDEX


# gelokaliseerde NL enum-waarde -> (paramnaam, sleutel), voor het terugmappen
_ENUM_REVERSE = {}
for _pkey, _opts in _ENUM_PARAMS.items():
    for _enumkey, _langs in _opts.items():
        _ENUM_REVERSE[_langs["nl"]] = (_pkey, _enumkey)


def infer(titel: Optional[str], bericht: Optional[str]) -> Tuple[Optional[str], dict]:
    """Leid (sleutel, params) af uit een opgeslagen NL-titel/bericht. Geeft
    (None, {}) als niets matcht."""
    for sleutel, titel_re, bericht_re in _reverse_index():
        m = titel_re.match(titel or "")
        if not m:
            continue
        params = dict(m.groupdict())
        if bericht_re is not None and bericht:
            mb = bericht_re.match(bericht)
            if mb:
                params.update(mb.groupdict())
        # gelokaliseerde enum-waarden terugmappen naar hun sleutel (bv. "AI-parsing" -> "ai")
        for k, v in list(params.items()):
            terug = _ENUM_REVERSE.get(v)
            if terug and terug[0] == k:
                params[k] = terug[1]
        return sleutel, params
    return None, {}


def categorie_label(categorie_nl: Optional[str], taal: str = "nl") -> Optional[str]:
    if categorie_nl is None:
        return None
    vert = CATEGORIE.get(categorie_nl)
    if not vert:
        return categorie_nl
    return vert.get(_norm(taal), categorie_nl)


def maak(
    sleutel: str,
    params: dict,
    *,
    type: str = "info",
    categorie: Optional[str] = None,
    entiteit_type: Optional[str] = None,
    entiteit_id: Optional[int] = None,
):
    """Bouw een models.Notificatie met NL-tekst (opgeslagen) + sleutel/params
    zodat de leeslaag hem later in EN kan renderen."""
    from . import models

    nl = render(sleutel, params, "nl") or {"titel": sleutel, "bericht": None}
    return models.Notificatie(
        titel=nl["titel"],
        bericht=nl["bericht"],
        type=type,
        categorie=categorie,
        sleutel=sleutel,
        params=json.dumps(params or {}, default=str, ensure_ascii=False),
        entiteit_type=entiteit_type,
        entiteit_id=entiteit_id,
    )
