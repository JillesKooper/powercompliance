"""Vertaalbare notificatieteksten (NL/EN).

Notificaties worden met dynamische data gegenereerd. Om ze in de gekozen taal te
kunnen tonen, slaan we per notificatie een ``sleutel`` (welk sjabloon) en
``params`` (de ingevulde waarden) op. Op basis daarvan renderen we de titel en
het bericht in NL of EN.

Eigennamen in de params (leverancier-, product-, documentnamen, e-mailonderwerpen)
blijven onvertaald; alleen het sjabloon-skelet wordt vertaald.
"""
import json
from typing import Optional

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
            "bericht": "{aantal} velden automatisch aangevuld over {producten} producten ({methode}).",
        },
        "en": {
            "titel": "Reply processed from {leverancier}",
            "bericht": "{aantal} fields filled in automatically across {producten} products ({methode}).",
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
    try:
        return {
            "titel": tekst["titel"].format(**p),
            "bericht": tekst["bericht"].format(**p),
        }
    except (KeyError, IndexError):
        # ontbrekende param: geef het sjabloon ongewijzigd terug i.p.v. te crashen
        return {"titel": tekst["titel"], "bericht": tekst["bericht"]}


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
