"""Engelse vertalingen van compliance-veldnamen, -types en Excel-koppen.

De veldnamen staan in het Nederlands in de database. Voor taal="en" mappen we
op de technische ``sleutel`` (die taal-onafhankelijk is) naar een Engelse naam.
Zo blijven de vertalingen stabiel, ook als de weergavenaam ooit wijzigt.

Wetgevingscodes (PPWR, REACH, …) en eigennamen worden NIET vertaald.
"""
from typing import Optional

# sleutel -> Engelse veldnaam
EN_VELD_NAAM = {
    # PPWR
    "ppwr_materiaal": "Packaging material",
    "ppwr_recycleerbaarheid": "Recyclability (%)",
    "ppwr_recyclaat": "Share of recycled material (%)",
    "ppwr_gewicht": "Packaging weight (g)",
    # CSRD
    "csrd_code": "ESG reporting code",
    "csrd_co2": "CO2 footprint scope 1+2 (kg CO2e)",
    "csrd_verslag": "Sustainability report (URL)",
    # Batterij
    "bat_chemie": "Battery chemistry",
    "bat_capaciteit": "Capacity (Wh)",
    "bat_co2": "CO2 footprint (kg CO2e)",
    "bat_paspoort": "Battery passport ID",
    # REACH/CLP
    "reach_svhc": "SVHC substances present",
    "reach_sds": "Safety data sheet (SDS)",
    "reach_clp": "CLP hazard pictograms",
    # CPR
    "cpr_dop": "Declaration of Performance (DoP)",
    "cpr_ce": "CE marking",
    "cpr_brandklasse": "Fire class",
    # GPSR
    "gpsr_marktdeelnemer": "Responsible EU economic operator",
    "gpsr_waarschuwingen": "Safety warnings",
    "gpsr_handleiding": "Instructions for use present",
    # ErP
    "erp_energieklasse": "Energy efficiency class",
    "erp_verbruik": "Energy consumption (kWh/year)",
    "erp_eprel": "EPREL registration number",
    # ESPR
    "espr_dpp": "Digital product passport ID",
    "espr_repareerbaarheid": "Reparability score",
    "espr_recyclaat": "Share of recycled material (%)",
    # EUDR
    "eudr_herkomst": "Country of origin of raw material",
    "eudr_geo": "Production geolocation (coordinates)",
    "eudr_ontbossingsvrij": "Declared deforestation-free",
    "eudr_dds": "Due diligence statement number",
    # Textiel
    "tex_vezels": "Fibre composition",
    "tex_onderhoud": "Care symbols",
    "tex_land": "Country of manufacture",
    "tex_dpp": "Digital product passport ID",
    # Speelgoed
    "toy_ce": "CE marking",
    "toy_leeftijd": "Age classification",
    "toy_waarschuwing": "Small parts warning",
    "toy_en71": "EN 71 test report",
    # MDR
    "mdr_udi": "UDI-DI code",
    "mdr_klasse": "Risk class",
    "mdr_ce": "CE certificate (notified body)",
    "mdr_klinisch": "Clinical evaluation",
    # Cosmetica
    "cos_inci": "INCI ingredient list",
    "cos_cpnp": "CPNP notification number",
    "cos_rp": "Responsible person (EU)",
    "cos_pif": "Product information file (PIF)",
}

# veld_type -> Engelse weergave
EN_VELD_TYPE = {
    "tekst": "text",
    "getal": "number",
    "boolean": "boolean",
    "datum": "date",
    "bestand": "file",
}

# Excel-koppen per taal
EXCEL_KOPPEN = {
    "nl": [
        "Product",
        "Artikelnummer",
        "EAN",
        "Wetgeving",
        "Ontbrekend veld",
        "Veldtype",
        "Waarde (in te vullen)",
    ],
    "en": [
        "Product",
        "Article number",
        "EAN",
        "Legislation",
        "Missing field",
        "Field type",
        "Value (to fill in)",
    ],
}

EXCEL_TITEL = {"nl": "Ontbrekende data", "en": "Missing data"}


def veld_naam(veld, taal: str = "nl") -> str:
    """Geef de (evt. Engelse) weergavenaam van een compliance-veld."""
    if taal == "en":
        return EN_VELD_NAAM.get(getattr(veld, "sleutel", None), veld.naam)
    return veld.naam


def veld_naam_via_sleutel(sleutel: Optional[str], fallback: str, taal: str = "nl") -> str:
    """Zoals ``veld_naam`` maar op basis van een losse sleutel + fallbacknaam."""
    if taal == "en" and sleutel:
        return EN_VELD_NAAM.get(sleutel, fallback)
    return fallback


def veld_type(type_nl: str, taal: str = "nl") -> str:
    """Geef de (evt. Engelse) weergave van een veldtype."""
    if taal == "en":
        return EN_VELD_TYPE.get(type_nl, type_nl)
    return type_nl
