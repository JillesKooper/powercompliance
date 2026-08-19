"""Vult de database met uitgebreide voorbeelddata.

- 10 categorieën; wetgeving is per categorie gekoppeld (wetgeving↔categorie).
- 12 EU-wetgevingen, elk met compliance-velden en de categorieën waarvoor ze
  gelden. Wetgeving staat standaard AAN als er producten onder vallen.
- 10 leveranciers met Nederlandse bedrijfsnamen.
- 50 producten verdeeld over 7 productcategorieën, met ~40% compliant,
  ~20% gedeeltelijk en ~40% incompleet ingevulde compliance-data.

Draai met:  python -m app.seed
"""
from collections import defaultdict
from datetime import date, timedelta

from .database import Base, SessionLocal, engine
from . import models, compliance_service, notificatie_teksten


def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


# (naam, beschrijving)
CATEGORIEEN = [
    ("Elektronica", "Elektrische en elektronische apparaten"),
    ("Chemie", "Chemische producten en stoffen"),
    ("Bouwmaterialen", "Producten voor de bouw"),
    ("Verpakkingen", "Verpakkingsmaterialen"),
    ("Textiel", "Textiel en kleding"),
    ("Meubels", "Meubilair en woninginrichting"),
    ("Voedsel", "Voedingsmiddelen en ingrediënten"),
    ("Speelgoed", "Speelgoed en spelmateriaal"),
    ("Medisch", "Medische hulpmiddelen"),
    ("Cosmetica", "Cosmetica en verzorgingsproducten"),
]

ALLE = "ALLE"  # geldt voor alle categorieën

# code, naam, beschrijving, van_kracht_vanaf, status,
#   velden=[(naam, sleutel, type)], categorieen=[namen] of ALLE
WETGEVING = [
    (
        "PPWR",
        "Verpakkingsverordening (Packaging & Packaging Waste Regulation)",
        "EU-verordening 2025/40 over verpakkingen en verpakkingsafval.",
        date(2026, 8, 12),
        "aankomend",
        [
            ("Verpakkingsmateriaal type", "ppwr_materiaal", "tekst"),
            ("Aandeel gerecycled materiaal (%)", "ppwr_recyclaat", "getal"),
            ("Recycleerbaarheid (%)", "ppwr_recycleerbaarheid", "getal"),
            ("Verpakkingsgewicht (g)", "ppwr_gewicht", "getal"),
            ("Minimale verpakkingsdikte (mm)", "ppwr_dikte", "getal"),
            ("Is verpakking herbruikbaar", "ppwr_herbruikbaar", "boolean"),
            ("Biobased materiaal percentage (%)", "ppwr_biobased", "getal"),
            ("Gevaarlijke stoffen in verpakking", "ppwr_gevaarlijk", "boolean"),
        ],
        ALLE,
    ),
    (
        "CSRD",
        "Corporate Sustainability Reporting Directive",
        "Duurzaamheidsrapportageverplichting voor grote bedrijven (ESG).",
        date(2024, 1, 1),
        "van kracht",
        [
            ("CO2-voetafdruk scope 1+2 (kg CO2e)", "csrd_co2", "getal"),
            ("CO2-voetafdruk scope 3 (kg CO2e)", "csrd_co2_scope3", "getal"),
            ("Energieverbruik productie (kWh)", "csrd_energie", "getal"),
            ("Waterverbruik productie (liter)", "csrd_water", "getal"),
            ("Duurzaamheidsverslag (URL)", "csrd_verslag", "tekst"),
            ("ESG-rapportagecode", "csrd_code", "tekst"),
        ],
        ALLE,
    ),
    (
        "BATTERIJ",
        "Batterijverordening (EU) 2023/1542",
        "Eisen aan duurzaamheid, koolstofvoetafdruk en het batterijpaspoort.",
        date(2024, 2, 18),
        "van kracht",
        [
            ("Batterijtype (chemie)", "bat_chemie", "tekst"),
            ("Capaciteit (Wh)", "bat_capaciteit", "getal"),
            ("Batterijpaspoort-ID", "bat_paspoort", "tekst"),
            ("CO2-voetafdruk batterij (kg CO2e)", "bat_co2", "getal"),
            ("Gerecycled cobalt percentage (%)", "bat_cobalt", "getal"),
            ("Gerecycled lithium percentage (%)", "bat_lithium", "getal"),
            ("Gerecycled nikkel percentage (%)", "bat_nikkel", "getal"),
            ("Fabrikant batterij", "bat_fabrikant", "tekst"),
            ("Land van productie batterij", "bat_land", "tekst"),
        ],
        ["Elektronica"],
    ),
    (
        "REACH",
        "REACH/CLP — Stoffen & etikettering",
        "Registratie en beperking van chemische stoffen en etikettering.",
        date(2007, 6, 1),
        "van kracht",
        [
            ("SVHC-stoffen aanwezig", "reach_svhc", "boolean"),
            ("Lijst SVHC-stoffen", "reach_svhc_lijst", "tekst"),
            ("CLP-gevarenpictogrammen", "reach_clp", "tekst"),
            ("H-zinnen (gevarenaanduidingen)", "reach_hzinnen", "tekst"),
            ("P-zinnen (voorzorgsmaatregelen)", "reach_pzinnen", "tekst"),
            ("Veiligheidsinformatieblad beschikbaar", "reach_sds_beschikbaar", "boolean"),
            ("Veiligheidsinformatieblad (URL)", "reach_sds_url", "tekst"),
            ("SCIP-nummer", "reach_scip", "tekst"),
        ],
        ["Chemie", "Cosmetica", "Textiel", "Bouwmaterialen", "Speelgoed", "Elektronica"],
    ),
    (
        "CPR",
        "Bouwproductenverordening (Construction Products Regulation)",
        "Prestatieverklaring (DoP) en CE-markering voor bouwproducten.",
        date(2013, 7, 1),
        "van kracht",
        [
            ("Prestatieverklaring (DoP)", "cpr_dop", "bestand"),
            ("CE-markering", "cpr_ce", "boolean"),
            ("Brandklasse", "cpr_brandklasse", "tekst"),
        ],
        ["Bouwmaterialen"],
    ),
    (
        "GPSR",
        "Algemene productveiligheidsverordening (General Product Safety Regulation)",
        "EU 2023/988: veiligheidswaarschuwingen en traceerbaarheid.",
        date(2024, 12, 13),
        "van kracht",
        [
            ("Naam en adres EU-verantwoordelijke marktdeelnemer", "gpsr_marktdeelnemer", "tekst"),
            ("Postadres leverancier", "gpsr_postadres", "tekst"),
            ("Land van oorsprong product", "gpsr_oorsprong", "tekst"),
            ("Technisch dossier aanwezig", "gpsr_technisch_dossier", "boolean"),
            ("Veiligheidswaarschuwingen", "gpsr_waarschuwingen", "tekst"),
            ("Gebruiksaanwijzing aanwezig", "gpsr_handleiding", "boolean"),
            ("CE-markering aanwezig", "gpsr_ce", "boolean"),
            ("Leeftijdsaanduiding", "gpsr_leeftijd", "tekst"),
            ("Serienummer/batchnummer format", "gpsr_batch", "tekst"),
            ("Contactpunt voor productterugroepingen (e-mail/URL)", "gpsr_recall_contact", "tekst"),
        ],
        ["Elektronica", "Speelgoed", "Meubels", "Textiel", "Cosmetica"],
    ),
    (
        "ERP",
        "Ecodesign / ErP-richtlijn (Energy-related Products)",
        "Ecodesign-eisen en energielabels voor energiegerelateerde producten.",
        date(2009, 11, 20),
        "van kracht",
        [
            ("Energieklasse (A-G)", "erp_energieklasse", "tekst"),
            ("Jaarlijks energieverbruik (kWh)", "erp_verbruik", "getal"),
            ("EPREL-registratienummer", "erp_eprel", "tekst"),
            ("Geluidsniveau (dB)", "erp_geluid", "getal"),
            ("Standby-verbruik (W)", "erp_standby", "getal"),
            ("Reparatie-index score", "erp_reparatie", "tekst"),
        ],
        ["Elektronica"],
    ),
    (
        "ESPR",
        "Ecodesign for Sustainable Products Regulation",
        "EU 2024/1781: ecodesign-eisen en digitaal productpaspoort voor duurzame producten.",
        date(2024, 7, 18),
        "aankomend",
        [
            ("Digitaal productpaspoort-ID", "espr_dpp", "tekst"),
            ("Repareerbaarheidsscore (0-10)", "espr_repareerbaarheid", "tekst"),
            ("Levensduur (jaren)", "espr_levensduur", "getal"),
            ("Gedemonteerd in (minuten)", "espr_demontage", "getal"),
            ("Beschikbaarheid reserveonderdelen", "espr_reserveonderdelen", "boolean"),
            ("Softwareondersteuning tot (datum)", "espr_software_tot", "datum"),
            ("Aandeel gerecycled materiaal (%)", "espr_recyclaat", "getal"),
        ],
        ["Elektronica", "Textiel", "Meubels", "Bouwmaterialen"],
    ),
    (
        "EUDR",
        "EU-ontbossingsverordening (Deforestation Regulation)",
        "EU 2023/1115: ontbossingsvrije toeleveringsketens voor o.a. hout, "
        "papier, soja, cacao en palmolie.",
        date(2025, 12, 30),
        "aankomend",
        [
            ("Herkomstland grondstof", "eudr_herkomst", "tekst"),
            ("Geolocatie productie (coördinaten)", "eudr_geo", "tekst"),
            ("Due-diligence verklaringsnummer", "eudr_dds", "tekst"),
            ("Ontbossingsvrij verklaard", "eudr_ontbossingsvrij", "boolean"),
            ("Certificering (FSC/PEFC/etc.)", "eudr_certificering", "tekst"),
        ],
        ["Bouwmaterialen", "Verpakkingen", "Voedsel", "Meubels"],
    ),
    (
        "TEXTIEL",
        "Textielverordening (EU)",
        "Etikettering, vezelsamenstelling en digitaal productpaspoort voor textiel.",
        date(2025, 7, 1),
        "aankomend",
        [
            ("Vezelsamenstelling", "tex_vezels", "tekst"),
            ("Onderhoudssymbolen", "tex_onderhoud", "tekst"),
            ("Land van vervaardiging", "tex_land", "tekst"),
            ("Digitaal productpaspoort-ID", "tex_dpp", "tekst"),
        ],
        ["Textiel"],
    ),
    (
        "SPEELGOED",
        "Speelgoedrichtlijn 2009/48/EC",
        "Veiligheidseisen voor speelgoed (CE, leeftijd, EN 71).",
        date(2011, 7, 20),
        "van kracht",
        [
            ("CE-markering", "toy_ce", "boolean"),
            ("Leeftijdsclassificatie", "toy_leeftijd", "tekst"),
            ("Waarschuwing kleine onderdelen", "toy_waarschuwing", "tekst"),
            ("EN 71 testrapport", "toy_en71", "bestand"),
        ],
        ["Speelgoed"],
    ),
    (
        "MDR",
        "Medische hulpmiddelen (MDR 2017/745)",
        "Eisen aan medische hulpmiddelen: UDI, risicoklasse, CE-certificaat.",
        date(2021, 5, 26),
        "van kracht",
        [
            ("UDI-DI code", "mdr_udi", "tekst"),
            ("Risicoklasse", "mdr_klasse", "tekst"),
            ("CE-certificaat (aangemelde instantie)", "mdr_ce", "bestand"),
            ("Klinische evaluatie", "mdr_klinisch", "bestand"),
        ],
        ["Medisch"],
    ),
    (
        "COSMETICA",
        "Cosmeticaverordening (EC) 1223/2009",
        "Eisen aan cosmetica: INCI, CPNP-notificatie, verantwoordelijke persoon.",
        date(2013, 7, 11),
        "van kracht",
        [
            ("INCI-ingrediëntenlijst", "cos_inci", "tekst"),
            ("CPNP-notificatienummer", "cos_cpnp", "tekst"),
            ("Verantwoordelijke persoon (EU)", "cos_rp", "tekst"),
            ("Productinformatiedossier (PIF)", "cos_pif", "bestand"),
        ],
        ["Cosmetica"],
    ),
    (
        "EAA",
        "European Accessibility Act",
        "EU 2019/882: toegankelijkheidseisen voor producten en diensten "
        "(o.a. digitale interfaces) voor mensen met een beperking.",
        date(2025, 6, 28),
        "van kracht",
        [
            ("Toegankelijkheidsverklaring (URL)", "eaa_verklaring", "tekst"),
            ("Ondersteunde hulptechnologieën", "eaa_hulptech", "tekst"),
            ("Gebruiksaanwijzing in toegankelijk formaat", "eaa_handleiding", "boolean"),
            ("Contactpunt toegankelijkheid", "eaa_contact", "tekst"),
            ("Conformiteitsverklaring EAA (URL)", "eaa_conformiteit", "tekst"),
        ],
        ["Elektronica"],
    ),
]

# code -> (info_url naar officiële bron, korte NL-samenvatting)
EURLEX = "https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:"
WET_INFO = {
    "PPWR": (
        EURLEX + "32025R0040",
        "Stelt eisen aan recycleerbaarheid, recyclaatgehalte en etikettering van "
        "verpakkingen. Geldt voor vrijwel alle verpakte producten en wordt vanaf "
        "augustus 2026 gefaseerd van kracht.",
    ),
    "BATTERIJ": (
        EURLEX + "32023R1542",
        "Regelt duurzaamheid, koolstofvoetafdruk, recyclaatgehalte en het digitale "
        "batterijpaspoort. Geldt voor draagbare, industriële en EV-batterijen.",
    ),
    "REACH": (
        EURLEX + "32006R1907",
        "Verplicht registratie en beperking van chemische stoffen en correcte "
        "etikettering (CLP). Raakt chemie, textiel, cosmetica en veel andere "
        "productgroepen.",
    ),
    "CPR": (
        EURLEX + "32011R0305",
        "Vereist een prestatieverklaring (DoP) en CE-markering voor bouwproducten, "
        "zodat hun prestaties vergelijkbaar zijn binnen de EU.",
    ),
    "GPSR": (
        EURLEX + "32023R0988",
        "Algemene productveiligheidsverordening: veiligheidswaarschuwingen, "
        "traceerbaarheid en een verantwoordelijke marktdeelnemer in de EU voor "
        "consumentenproducten.",
    ),
    "ERP": (
        EURLEX + "32009L0125",
        "Ecodesign-kaderrichtlijn met eisen aan energie-efficiëntie en energielabels "
        "voor energiegerelateerde producten.",
    ),
    "ESPR": (
        EURLEX + "32024R1781",
        "Opvolger van de ErP-richtlijn: bredere ecodesign-eisen en een digitaal "
        "productpaspoort voor duurzame producten. Wordt per productgroep ingevoerd.",
    ),
    "EUDR": (
        EURLEX + "32023R1115",
        "Verbiedt het op de markt brengen van producten die met ontbossing zijn "
        "verbonden (o.a. hout, papier, soja, cacao, palmolie). Vereist due-diligence "
        "met herkomst en geolocatie.",
    ),
    "CSRD": (
        EURLEX + "32022L2464",
        "Verplicht grote bedrijven tot uitgebreide duurzaamheidsrapportage (ESG) "
        "volgens de ESRS-standaarden.",
    ),
    "TEXTIEL": (
        EURLEX + "32011R1007",
        "Regelt de benamingen van textielvezels en de etikettering van de "
        "vezelsamenstelling van textielproducten.",
    ),
    "SPEELGOED": (
        EURLEX + "32009L0048",
        "Stelt veiligheidseisen aan speelgoed (CE-markering, leeftijdsclassificatie, "
        "waarschuwingen en EN 71-tests).",
    ),
    "MDR": (
        EURLEX + "32017R0745",
        "Verordening medische hulpmiddelen: eisen aan UDI, risicoklasse, "
        "CE-certificering en klinische evaluatie.",
    ),
    "COSMETICA": (
        EURLEX + "32009R1223",
        "Regelt de veiligheid van cosmetica: INCI-ingrediëntenlijst, "
        "CPNP-notificatie, een verantwoordelijke persoon in de EU en een PIF.",
    ),
    "EAA": (
        EURLEX + "32019L0882",
        "De European Accessibility Act stelt uniforme toegankelijkheidseisen aan "
        "producten en diensten (zoals computers, smartphones, e-readers en "
        "e-commerce) zodat mensen met een beperking ze zelfstandig kunnen gebruiken. "
        "Van toepassing vanaf 28 juni 2025.",
    ),
}

# (naam, contactpersoon, email, telefoon, adres, postcode, stad, land, kvk_nummer, btw_nummer)
# "Koper Handel Jilles" mist bewust KvK- en BTW-nummer, zodat de GPSR-uitvraag
# van de verantwoordelijke EU-marktdeelnemer (bedrijfsgegevens) demonstreerbaar is.
LEVERANCIERS = [
    ("Van der Berg Elektronica B.V.", "Jan van der Berg", "j.vandenberg@vdberg-elektro.nl", "010-2345678", "Industrieweg 12", "3044 AS", "Rotterdam", "NL", "24123456", "NL812345678B01"),
    ("Koninklijke Jansen Chemie N.V.", "Petra Jansen", "p.jansen@jansenchemie.nl", "040-7654321", "Chemiepark 5", "5651 GH", "Eindhoven", "NL", "17234567", "NL823456789B01"),
    ("Bouwgroep De Vries", "Mark de Vries", "info@bouwgroepdevries.nl", "030-1122334", "Betonlaan 88", "3542 AD", "Utrecht", "NL", "30345678", "NL834567890B01"),
    ("GreenPack Verpakkingen B.V.", "Lisa Bakker", "lisa@greenpack.nl", "020-9988776", "Kartonstraat 3", "1043 AN", "Amsterdam", "NL", "34456789", "NL845678901B01"),
    ("Textielhandel Bakker & Zonen", "Henk Bakker", "verkoop@bakkertextiel.nl", "013-4455667", "Weverijplein 21", "5041 EA", "Tilburg", "NL", "18567890", "NL856789012B01"),
    ("Meubelfabriek Hendriks", "Sophie Hendriks", "s.hendriks@meubelhendriks.nl", "0499-556677", "Houtweg 47", "5688 KL", "Oirschot", "NL", "16678901", "NL867890123B01"),
    ("Smit Foods Nederland B.V.", "Karel Smit", "k.smit@smitfoods.nl", "0345-778899", "Voedselstraat 9", "4001 LK", "Tiel", "NL", "11789012", "NL878901234B01"),
    ("Visser Trading B.V.", "Anouk Visser", "a.visser@vissertrading.nl", "058-2233445", "Havenkade 14", "8861 NL", "Harlingen", "NL", "01890123", "NL889012345B01"),
    ("De Groot Groothandel", "Thomas de Groot", "thomas@degrootgroothandel.nl", "073-6677889", "Groothandelweg 30", "5222 AR", "'s-Hertogenbosch", "NL", "16901234", "NL890123456B01"),
    ("Mulder Industriële Supplies", "Ellen Mulder", "e.mulder@mulder-supplies.nl", "038-3344556", "Fabrieksstraat 7", "8011 CV", "Zwolle", "NL", "05012345", "NL801234567B01"),
    ("Koper Handel Jilles", "Jilles Kooper", "jilles@koperhandel.nl", "071-5566778", "Koperslagerstraat 2", "2312 HN", "Leiden", "NL", None, None),
]

# Extra elektronicaproducten voor "Koper Handel Jilles". Deze leverancier krijgt
# bewust veel ontbrekende data: elk product mist 3–5 verplichte velden,
# verspreid over PPWR, Batterijverordening, REACH/CLP, GPSR en ErP.
KOPER_PRODUCTEN = [
    "Ledlamp E27 9W", "Slimme Stekker WiFi", "Zonnepaneel 400W", "Omvormer 3kW",
    "Thuisbatterij 5kWh", "Draagbaar Powerstation 300W", "E-bike Accu 500Wh",
    "Robotstofzuiger Pro", "Luchtreiniger HEPA", "Espressomachine Deluxe",
    "Föhn 2200W", "Elektrische Tandenborstel", "Draadloze Oordopjes ANC",
    "Smartwatch Sport", "Actiecamera 4K", "Gaming Toetsenbord RGB",
    "Ventilator Staand DC", "Warmtepompdroger 8kg",
]

# Wetgevingen waarover de ontbrekende velden van Koper Handel Jilles worden
# verspreid (alle relevant voor de categorie Elektronica).
KOPER_MISSING_WETGEVINGEN = ["PPWR", "BATTERIJ", "REACH", "GPSR", "ERP"]

# productnamen per categorie (samen 50)
PRODUCTEN_PER_CAT = {
    "Elektronica": [
        "LED Paneel 60x60", "USB-C Snellader 65W", "Draadloze Muis", "Bluetooth Speaker",
        "4K Monitor 27 inch", "Powerbank 20000mAh", "Slimme Thermostaat", "Wifi Router AX",
    ],
    "Chemie": [
        "Industriële Ontvetter 5L", "Siliconenkit Transparant", "Tweecomponentenlijm",
        "Verfverdunner 1L", "Antivries -36", "Vloeibaar Wasmiddel 5L", "Bleekmiddel 2L",
    ],
    "Bouwmaterialen": [
        "Gipsplaat 12.5mm", "Isolatieplaat PIR 100mm", "Houten Vloerdeel Eiken",
        "Betonmortel 25kg", "Dakpan Keramisch", "Multiplex Plaat 18mm", "Cementtegel 60x60",
    ],
    "Verpakkingen": [
        "Kartonnen Doos 40x30x30", "Krimpfolie Rol 50cm", "Luchtkussenfolie 100m",
        "Papieren Draagtas", "Kraftpapier Rol", "Plastic Pallethoes", "Verzendenvelop Gewatteerd",
    ],
    "Textiel": [
        "Katoenen T-shirt", "Polyester Jas", "Wollen Trui", "Linnen Tafelkleed",
        "Fleece Deken", "Denim Spijkerbroek", "Microvezel Handdoek",
    ],
    "Meubels": [
        "Eikenhouten Eettafel", "Bureaustoel Ergonomisch", "Boekenkast Grenen",
        "2-zits Bank Stof", "Salontafel Walnoot", "Ledikant Beuken", "TV-meubel Eiken",
    ],
    "Voedsel": [
        "Pure Chocolade 70%", "Sojasaus 1L", "Palmolie 5L", "Koffiebonen 1kg",
        "Cacaopoeder 500g", "Olijfolie Extra Vierge", "Rijst Basmati 5kg",
    ],
}


def _aantal_te_vullen(profiel: str, n: int) -> int:
    if profiel == "compliant":
        return n
    if profiel == "partial":
        return round(n * 0.65)
    return round(n * 0.15)  # incompleet


# Realistische voorbeeldwaarden per compliance-veld, zodat producten echte data
# tonen (bv. "85") i.p.v. een placeholder. Tekstvelden kiezen uit een lijst;
# id-, getal-, boolean- en bestandvelden worden afgeleid van het veldtype.
_ID_PREFIX = {
    "bat_paspoort": "BP",
    "erp_eprel": "EPREL",
    "espr_dpp": "DPP",
    "tex_dpp": "DPP",
    "eudr_dds": "DDS",
    "mdr_udi": "UDI",
    "cos_cpnp": "CPNP",
}
_TEKST_KEUZES = {
    "ppwr_materiaal": ["Karton (FSC-gecertificeerd)", "PET (mono-materiaal)", "Polypropyleen (PP)", "Glas", "Aluminium"],
    "csrd_code": ["ESRS-E1", "ESRS-E5", "ESRS-S1", "ESRS-G1"],
    "csrd_verslag": ["https://example.com/duurzaamheidsverslag-2025.pdf"],
    "bat_chemie": ["Li-ion (NMC)", "LiFePO4", "NiMH", "Loodzuur"],
    "reach_clp": ["GHS02, GHS07", "GHS05", "GHS07, GHS08", "Geen pictogram vereist"],
    "cpr_brandklasse": ["A1", "A2-s1,d0", "B-s1,d0", "C-s2,d0"],
    "gpsr_marktdeelnemer": ["EU-Importeur B.V., Industrieweg 12, 3044 AS Rotterdam", "Compliance Partners GmbH, Domstraße 8, 50668 Keulen", "EuroDistributie N.V., Havenlaan 40, 2030 Antwerpen"],
    "gpsr_postadres": ["Postbus 1234, 3000 AA Rotterdam", "Postbus 88, 5600 AB Eindhoven", "Postbus 501, 1000 AM Amsterdam"],
    "gpsr_oorsprong": ["Nederland", "Duitsland", "China", "Vietnam", "Polen"],
    "gpsr_waarschuwingen": ["Niet geschikt voor kinderen < 3 jaar", "Buiten bereik van kinderen houden", "Niet blootstellen aan vocht"],
    "gpsr_leeftijd": ["Geen leeftijdsbeperking", "14+", "3+", "Niet voor kinderen < 3 jaar"],
    "gpsr_batch": ["BATCH-JJJJMMDD-####", "LOT-2026-0457", "SN: AA-000123456", "YYWW-serienr."],
    "gpsr_recall_contact": ["recall@uwbedrijf.nl", "https://uwbedrijf.nl/terugroepacties", "veiligheid@uwbedrijf.nl"],
    "erp_energieklasse": ["A", "B", "C", "D"],
    "erp_reparatie": ["8,2 / 10", "7,0 / 10", "5,8 / 10", "9,0 / 10"],
    "espr_repareerbaarheid": ["8,5 / 10", "7,2 / 10", "6,0 / 10", "9,1 / 10"],
    "eudr_herkomst": ["Brazilië", "Indonesië", "Ghana", "Zweden", "Duitsland"],
    "eudr_geo": ["-3.4653, -62.2159", "1.3521, 103.8198", "5.6037, -0.1870"],
    "eudr_certificering": ["FSC 100%", "FSC Mix", "PEFC-gecertificeerd", "Rainforest Alliance"],
    "reach_svhc_lijst": ["Geen SVHC-stoffen boven 0,1%", "Lood (CAS 7439-92-1) < 0,1%", "DEHP (CAS 117-81-7)", "Boorzuur (CAS 10043-35-3)"],
    "reach_hzinnen": ["H315, H319", "H302, H411", "H225, H336", "Geen H-zinnen van toepassing"],
    "reach_pzinnen": ["P264, P280", "P210, P233, P303+P361+P353", "P305+P351+P338", "Geen P-zinnen van toepassing"],
    "reach_sds_url": ["https://example.com/sds/product-nl.pdf", "https://example.com/veiligheidsblad.pdf"],
    "reach_scip": ["SCIP-3f2a9b74-1c8e-4d6a", "SCIP-a71c0e93-55bd-42f1", "Niet SCIP-plichtig"],
    "bat_fabrikant": ["CATL", "LG Energy Solution", "Samsung SDI", "Panasonic", "BYD"],
    "bat_land": ["China", "Zuid-Korea", "Japan", "Polen", "Hongarije"],
    "tex_vezels": ["80% katoen, 20% polyester", "100% biologisch katoen", "65% polyester, 35% viscose"],
    "tex_onderhoud": ["30°C, niet bleken, strijken op lage temperatuur", "Handwas, niet in de droger"],
    "tex_land": ["Portugal", "Turkije", "India", "Bangladesh"],
    "toy_leeftijd": ["3+", "6+", "0-3 jaar (geen kleine onderdelen)", "8+"],
    "toy_waarschuwing": ["Bevat kleine onderdelen — verstikkingsgevaar", "Niet geschikt voor kinderen < 3 jaar"],
    "mdr_klasse": ["Klasse I", "Klasse IIa", "Klasse IIb", "Klasse III"],
    "cos_inci": ["Aqua, Glycerin, Parfum", "Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine"],
    "cos_rp": ["CosmeSafe EU B.V., Amsterdam", "Beauty Compliance GmbH, München"],
}


def _voorbeeld_waarde(veld: "models.ComplianceVeld", product: "models.Product") -> str:
    """Genereer een realistische, deterministische waarde voor een compliance-veld."""
    naam = veld.naam.lower()
    h = (product.id * 31 + veld.id * 7) % 9973  # deterministische variatie per product/veld

    if veld.veld_type == "boolean":
        # Velden waar "Nee" het gewenste/gebruikelijke antwoord is
        # (geen gevaarlijke/SVHC-stoffen aanwezig).
        if "svhc" in veld.sleutel or "gevaarlijk" in veld.sleutel:
            return "Nee" if h % 5 else "Ja"
        return "Ja" if h % 4 else "Nee"
    if veld.veld_type == "datum":
        # bv. "Softwareondersteuning tot": 1–5 jaar in de toekomst
        return (date.today() + timedelta(days=365 + h % 1460)).isoformat()
    if veld.veld_type == "bestand":
        ref = product.artikelnummer or f"P{product.id}"
        return f"{veld.sleutel}_{ref}.pdf"
    if veld.veld_type == "getal":
        if "%" in veld.naam:
            return str(40 + h % 61)  # 40–100 %
        if "co2" in naam:
            return str(50 + h % 1950)  # kg CO2e
        if "kwh" in naam:
            return str(15 + h % 285)  # kWh/jaar
        if "wh" in naam:
            return str(800 + h % 4200)  # Wh
        if "(g)" in naam or "gewicht" in naam:
            return str(20 + h % 480)  # gram
        if "(mm)" in naam or "dikte" in naam:
            return str(1 + h % 5)  # mm (verpakkingsdikte)
        if "(db)" in naam or "geluid" in naam:
            return str(20 + h % 56)  # dB
        if "(w)" in naam:
            return str(h % 6)  # W (standby-verbruik)
        if "liter" in naam:
            return str(100 + h % 9900)  # liter (waterverbruik)
        if "jaren" in naam or "levensduur" in naam:
            return str(3 + h % 13)  # jaren (levensduur)
        if "minuten" in naam:
            return str(2 + h % 59)  # minuten (demontagetijd)
        return str(1 + h % 999)
    # tekst
    if veld.sleutel in _ID_PREFIX:
        return f"{_ID_PREFIX[veld.sleutel]}-{1000 + h % 9000}"
    keuzes = _TEKST_KEUZES.get(veld.sleutel)
    if keuzes:
        return keuzes[h % len(keuzes)]
    return f"{veld.naam} (gedocumenteerd)"


def seed():
    reset_db()
    db = SessionLocal()
    try:
        # categorieën
        cat_map = {}
        for naam, beschrijving in CATEGORIEEN:
            c = models.Categorie(naam=naam, beschrijving=beschrijving)
            db.add(c)
            cat_map[naam] = c
        db.flush()
        alle_cat_namen = list(cat_map.keys())

        # wetgeving + velden + categorie-koppeling
        wet_map = {}  # code -> Wetgeving
        wetcode_to_velden = defaultdict(list)
        wetcode_to_catnamen = {}
        for code, naam, beschr, dt, status, velden, catnamen in WETGEVING:
            info = WET_INFO.get(code, (None, None))
            w = models.Wetgeving(
                code=code, naam=naam, beschrijving=beschr,
                van_kracht_vanaf=dt, status=status, actief=True,
                info_url=info[0], samenvatting=info[1],
            )
            namen = alle_cat_namen if catnamen == ALLE else catnamen
            w.categorieen = [cat_map[n] for n in namen]
            db.add(w)
            db.flush()
            wet_map[code] = w
            wetcode_to_catnamen[code] = namen
            for vnaam, sleutel, vtype in velden:
                cv = models.ComplianceVeld(
                    naam=vnaam, sleutel=sleutel, veld_type=vtype,
                    verplicht=True, wetgeving_id=w.id, categorie_id=None,
                )
                db.add(cv)
                wetcode_to_velden[code].append(cv)
        db.flush()

        # categorie -> relevante velden (voor het vullen van data)
        cat_to_velden = defaultdict(list)
        for code, namen in wetcode_to_catnamen.items():
            for n in namen:
                cat_to_velden[n].extend(wetcode_to_velden[code])

        # leveranciers
        leveranciers = []
        for (naam, contact, email, telefoon, adres, postcode, stad, land,
             kvk, btw) in LEVERANCIERS:
            lev = models.Leverancier(
                naam=naam, contactpersoon=contact, email=email,
                telefoon=telefoon, adres=adres, postcode=postcode, stad=stad,
                land=land, kvk_nummer=kvk, btw_nummer=btw, actief=True,
            )
            db.add(lev)
            leveranciers.append(lev)
        db.flush()

        # platte lijst van (naam, categorie)
        producten_def = []
        for cat_naam, namen in PRODUCTEN_PER_CAT.items():
            for n in namen:
                producten_def.append((n, cat_naam))

        primary = {
            "Elektronica": leveranciers[0],
            "Chemie": leveranciers[1],
            "Bouwmaterialen": leveranciers[2],
            "Verpakkingen": leveranciers[3],
            "Textiel": leveranciers[4],
            "Meubels": leveranciers[5],
            "Voedsel": leveranciers[6],
        }
        generals = [leveranciers[7], leveranciers[8], leveranciers[9]]

        prod_objs = []
        for i, (naam, cat_naam) in enumerate(producten_def):
            lev = generals[(i // 5) % 3] if i % 5 == 4 else primary[cat_naam]
            p = models.Product(
                naam=naam,
                artikelnummer=f"ART-{1000 + i}",
                ean=f"87{i:011d}",
                categorie_id=cat_map[cat_naam].id,
                leverancier_id=lev.id,
            )
            db.add(p)
            prod_objs.append((p, cat_naam))
        db.flush()

        # compliance-waarden vullen volgens profiel (~40/20/40)
        telling = {"compliant": 0, "partial": 0, "incompleet": 0}
        for i, (product, cat_naam) in enumerate(prod_objs):
            r = i % 5
            profiel = "compliant" if r in (0, 1) else "partial" if r == 2 else "incompleet"
            telling[profiel] += 1
            velden = sorted(cat_to_velden.get(cat_naam, []), key=lambda v: v.id)
            k = _aantal_te_vullen(profiel, len(velden))
            for veld in velden[:k]:
                db.add(
                    models.ProductComplianceWaarde(
                        product_id=product.id,
                        compliance_veld_id=veld.id,
                        waarde=_voorbeeld_waarde(veld, product),
                        ingevuld=True,
                    )
                )

        # ------------------------------------------------------------------
        # Leverancier met veel ontbrekende data: "Koper Handel Jilles".
        # ≥15 elektronicaproducten met elk 3–5 ontbrekende verplichte velden,
        # verspreid over PPWR, Batterijverordening, REACH/CLP, GPSR en ErP.
        # ------------------------------------------------------------------
        koper = next(l for l in leveranciers if l.naam == "Koper Handel Jilles")
        koper_velden = sorted(cat_to_velden.get("Elektronica", []), key=lambda v: v.id)
        koper_prod_objs = []
        for i, naam in enumerate(KOPER_PRODUCTEN):
            p = models.Product(
                naam=naam,
                artikelnummer=f"ART-2{i:03d}",
                ean=f"88{i:011d}",
                categorie_id=cat_map["Elektronica"].id,
                leverancier_id=koper.id,
            )
            db.add(p)
            koper_prod_objs.append(p)
        db.flush()

        for i, product in enumerate(koper_prod_objs):
            # 3–5 ontbrekende velden, elk uit een andere wetgeving zodat de
            # ontbrekende data over meerdere verordeningen verspreid is.
            aantal_missend = 3 + (i % 3)  # 3, 4 of 5
            missend = set()
            for j in range(aantal_missend):
                code = KOPER_MISSING_WETGEVINGEN[(i + j) % len(KOPER_MISSING_WETGEVINGEN)]
                velden_van_wet = wetcode_to_velden[code]
                veld = velden_van_wet[(i + j) % len(velden_van_wet)]
                missend.add(veld.sleutel)
            for veld in koper_velden:
                if veld.sleutel in missend:
                    continue  # dit veld bewust leeg laten
                db.add(
                    models.ProductComplianceWaarde(
                        product_id=product.id,
                        compliance_veld_id=veld.id,
                        waarde=_voorbeeld_waarde(veld, product),
                        ingevuld=True,
                    )
                )
        prod_objs.extend((p, "Elektronica") for p in koper_prod_objs)
        telling["incompleet"] += len(koper_prod_objs)

        # wetgeving standaard AAN als er producten onder vallen
        product_cat_namen = {cat for _, cat in prod_objs}
        for code, w in wet_map.items():
            w.actief = bool(set(wetcode_to_catnamen[code]) & product_cat_namen)
        # EAA staat standaard uit; handmatig te activeren in de app
        if "EAA" in wet_map:
            wet_map["EAA"].actief = False
        db.flush()

        # --- Data-onderbouwing voor de demo-notificaties --------------------
        # Zorg dat de gegenereerde meldingen kloppen met de échte productdata:
        # de "twijfelachtige waarde"- en "nieuwe data"-meldingen verwijzen naar
        # velden die we hier expliciet zetten.
        led = prod_objs[0][0]
        choco = next(p for p, _ in prod_objs if p.naam.startswith("Pure Chocolade"))
        leverancier0 = leveranciers[0]

        def _zet_veldwaarde(product, sleutel, waarde, twijfelachtig=False):
            veld = (
                db.query(models.ComplianceVeld)
                .filter(models.ComplianceVeld.sleutel == sleutel)
                .first()
            )
            if not veld:
                return
            w = (
                db.query(models.ProductComplianceWaarde)
                .filter_by(product_id=product.id, compliance_veld_id=veld.id)
                .first()
            )
            if w is None:
                w = models.ProductComplianceWaarde(
                    product_id=product.id, compliance_veld_id=veld.id
                )
                db.add(w)
            w.waarde = waarde
            w.ingevuld = True
            w.twijfelachtig = twijfelachtig

        # 1) Twijfelachtige waarde: recycleerbaarheid buiten 0–100% op het LED-paneel.
        _zet_veldwaarde(led, "ppwr_recycleerbaarheid", "127", twijfelachtig=True)
        # 2) Nieuwe EUDR-data ontvangen: herkomstland ingevuld voor de chocolade.
        _zet_veldwaarde(choco, "eudr_herkomst", "Ghana")
        db.flush()

        # gedenormaliseerde compliance-cache per product vullen
        for product, _ in prod_objs:
            compliance_service.herbereken_product(db, product)

        # dataverzoeken
        db.add_all(
            [
                models.Dataverzoek(
                    leverancier_id=leveranciers[0].id,
                    onderwerp="Ontbrekende PPWR-verpakkingsdata",
                    bericht="Graag aanleveren: verpakkingsmateriaal en recyclaatgehalte.",
                    status="verzonden",
                    # binnen 7 dagen: onderbouwt de "Deadline nadert"-melding
                    deadline=date.today() + timedelta(days=5),
                ),
                models.Dataverzoek(
                    leverancier_id=leveranciers[6].id,
                    onderwerp="EUDR due-diligence voor voedingsproducten",
                    bericht="Herkomst en ontbossingsvrij-verklaring nodig conform EUDR.",
                    status="open",
                    deadline=date.today() + timedelta(days=30),
                ),
            ]
        )

        # notificaties met categorie + gerelateerde entiteit
        # (led / choco / leverancier0 zijn hierboven al bepaald en onderbouwd)
        db.add_all(
            [
                notificatie_teksten.maak(
                    "eudr_aankomend",
                    {},
                    type="waarschuwing",
                    categorie="Aankomende wetgeving",
                ),
                notificatie_teksten.maak(
                    "nieuwe_data_eudr",
                    {"product": choco.naam},
                    type="succes",
                    categorie="Nieuwe data ontvangen",
                    entiteit_type="product",
                    entiteit_id=choco.id,
                ),
                notificatie_teksten.maak(
                    "deadline_nadert",
                    {"leverancier": leverancier0.naam},
                    type="waarschuwing",
                    categorie="Deadline nadert",
                    entiteit_type="dataverzoek",
                    entiteit_id=leverancier0.id,
                ),
                notificatie_teksten.maak(
                    "twijfelachtige_waarde",
                    {"product": led.naam},
                    type="fout",
                    categorie="Twijfelachtige waarde",
                    entiteit_type="product",
                    entiteit_id=led.id,
                ),
                notificatie_teksten.maak(
                    "leverancier_openstaand",
                    {"leverancier": leverancier0.naam},
                    type="info",
                    categorie="Leverancier-update",
                    entiteit_type="leverancier",
                    entiteit_id=leverancier0.id,
                ),
            ]
        )

        db.commit()
        actief = [c for c, w in wet_map.items() if w.actief]
        inactief = [c for c, w in wet_map.items() if not w.actief]
        print("Seed voltooid:")
        print(f"  {db.query(models.Categorie).count()} categorieën")
        print(f"  {db.query(models.Wetgeving).count()} wetgevingen "
              f"(actief: {', '.join(actief)} | inactief: {', '.join(inactief) or '—'})")
        print(f"  {db.query(models.ComplianceVeld).count()} compliance-velden")
        print(f"  {db.query(models.Leverancier).count()} leveranciers")
        print(f"  {db.query(models.Product).count()} producten "
              f"(compliant: {telling['compliant']}, gedeeltelijk: {telling['partial']}, "
              f"incompleet: {telling['incompleet']})")
        print(f"  + 'Koper Handel Jilles': {len(koper_prod_objs)} elektronicaproducten "
              f"met elk 3–5 ontbrekende velden over PPWR/Batterij/REACH/GPSR/ErP")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
