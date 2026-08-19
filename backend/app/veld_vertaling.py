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
    "ppwr_materiaal": "Packaging material type",
    "ppwr_recyclaat": "Share of recycled material (%)",
    "ppwr_recycleerbaarheid": "Recyclability (%)",
    "ppwr_gewicht": "Packaging weight (g)",
    "ppwr_dikte": "Minimum packaging thickness (mm)",
    "ppwr_herbruikbaar": "Packaging is reusable",
    "ppwr_biobased": "Bio-based material percentage (%)",
    "ppwr_gevaarlijk": "Hazardous substances in packaging",
    # CSRD
    "csrd_co2": "CO2 footprint scope 1+2 (kg CO2e)",
    "csrd_co2_scope3": "CO2 footprint scope 3 (kg CO2e)",
    "csrd_energie": "Production energy use (kWh)",
    "csrd_water": "Production water use (litres)",
    "csrd_verslag": "Sustainability report (URL)",
    "csrd_code": "ESG reporting code",
    # Batterij
    "bat_chemie": "Battery type (chemistry)",
    "bat_capaciteit": "Capacity (Wh)",
    "bat_paspoort": "Battery passport ID",
    "bat_co2": "Battery CO2 footprint (kg CO2e)",
    "bat_cobalt": "Recycled cobalt percentage (%)",
    "bat_lithium": "Recycled lithium percentage (%)",
    "bat_nikkel": "Recycled nickel percentage (%)",
    "bat_fabrikant": "Battery manufacturer",
    "bat_land": "Battery country of production",
    # REACH/CLP
    "reach_svhc": "SVHC substances present",
    "reach_svhc_lijst": "List of SVHC substances",
    "reach_clp": "CLP hazard pictograms",
    "reach_hzinnen": "H-statements (hazard statements)",
    "reach_pzinnen": "P-statements (precautionary statements)",
    "reach_sds_beschikbaar": "Safety data sheet available",
    "reach_sds_url": "Safety data sheet (URL)",
    "reach_scip": "SCIP number",
    # CPR
    "cpr_dop": "Declaration of Performance (DoP)",
    "cpr_ce": "CE marking",
    "cpr_brandklasse": "Fire class",
    # GPSR
    "gpsr_marktdeelnemer": "Name and address of responsible EU economic operator",
    "gpsr_postadres": "Supplier postal address",
    "gpsr_oorsprong": "Product country of origin",
    "gpsr_technisch_dossier": "Technical file available",
    "gpsr_waarschuwingen": "Safety warnings",
    "gpsr_handleiding": "Instructions for use present",
    "gpsr_ce": "CE marking present",
    "gpsr_leeftijd": "Age marking",
    "gpsr_batch": "Serial/batch number format",
    "gpsr_recall_contact": "Product recall contact point (email/URL)",
    # ErP
    "erp_energieklasse": "Energy class (A-G)",
    "erp_verbruik": "Annual energy consumption (kWh)",
    "erp_eprel": "EPREL registration number",
    "erp_geluid": "Noise level (dB)",
    "erp_standby": "Standby consumption (W)",
    "erp_reparatie": "Repair index score",
    # ESPR
    "espr_dpp": "Digital product passport ID",
    "espr_repareerbaarheid": "Reparability score (0-10)",
    "espr_levensduur": "Lifespan (years)",
    "espr_demontage": "Disassembly time (minutes)",
    "espr_reserveonderdelen": "Spare parts availability",
    "espr_software_tot": "Software support until (date)",
    "espr_recyclaat": "Share of recycled material (%)",
    # EUDR
    "eudr_herkomst": "Country of origin of raw material",
    "eudr_geo": "Production geolocation (coordinates)",
    "eudr_dds": "Due diligence statement number",
    "eudr_ontbossingsvrij": "Declared deforestation-free",
    "eudr_certificering": "Certification (FSC/PEFC/etc.)",
    # EAA
    "eaa_verklaring": "Accessibility statement (URL)",
    "eaa_hulptech": "Supported assistive technologies",
    "eaa_handleiding": "Instructions in accessible format",
    "eaa_contact": "Accessibility contact point",
    "eaa_conformiteit": "EAA declaration of conformity (URL)",
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

# Product-basisveldlabels (export): NL-label -> Engelse weergave, op sleutel.
EN_BASIS_VELD = {
    "id": "Product ID",
    "naam": "Name",
    "artikelnummer": "Article number",
    "ean": "EAN",
    "merk": "Brand",
    "beschrijving": "Description",
    "leverancier": "Supplier",
    "categorie": "Category",
    "compliance_percentage": "Compliance %",
    "compliance_status": "Compliance status",
    "aantal_ontbrekend": "Missing fields",
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


def basis_veld_label(sleutel: str, fallback: str, taal: str = "nl") -> str:
    """Geef het (evt. Engelse) label van een product-basisveld voor de export."""
    if taal == "en":
        return EN_BASIS_VELD.get(sleutel, fallback)
    return fallback
