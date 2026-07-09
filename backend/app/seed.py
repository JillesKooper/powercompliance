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
from . import models, compliance_service


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
            ("Verpakkingsmateriaal", "ppwr_materiaal", "tekst"),
            ("Recycleerbaarheid (%)", "ppwr_recycleerbaarheid", "getal"),
            ("Aandeel gerecycled materiaal (%)", "ppwr_recyclaat", "getal"),
            ("Verpakkingsgewicht (g)", "ppwr_gewicht", "getal"),
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
            ("ESG-rapportagecode", "csrd_code", "tekst"),
            ("CO2-voetafdruk scope 1+2 (kg CO2e)", "csrd_co2", "getal"),
            ("Duurzaamheidsverslag (URL)", "csrd_verslag", "tekst"),
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
            ("Batterijchemie", "bat_chemie", "tekst"),
            ("Capaciteit (Wh)", "bat_capaciteit", "getal"),
            ("CO2-voetafdruk (kg CO2e)", "bat_co2", "getal"),
            ("Batterijpaspoort-ID", "bat_paspoort", "tekst"),
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
            ("Veiligheidsinformatieblad (SDS)", "reach_sds", "bestand"),
            ("CLP-gevarenpictogrammen", "reach_clp", "tekst"),
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
            ("Verantwoordelijke EU-marktdeelnemer", "gpsr_marktdeelnemer", "tekst"),
            ("Veiligheidswaarschuwingen", "gpsr_waarschuwingen", "tekst"),
            ("Gebruiksaanwijzing aanwezig", "gpsr_handleiding", "boolean"),
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
            ("Energie-efficiëntieklasse", "erp_energieklasse", "tekst"),
            ("Energieverbruik (kWh/jaar)", "erp_verbruik", "getal"),
            ("EPREL-registratienummer", "erp_eprel", "tekst"),
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
            ("Repareerbaarheidsscore", "espr_repareerbaarheid", "tekst"),
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
            ("Ontbossingsvrij verklaard", "eudr_ontbossingsvrij", "boolean"),
            ("Due-diligence verklaringsnummer", "eudr_dds", "tekst"),
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
}

LEVERANCIERS = [
    ("Van der Berg Elektronica B.V.", "Jan van der Berg", "j.vandenberg@vdberg-elektro.nl", "NL"),
    ("Koninklijke Jansen Chemie N.V.", "Petra Jansen", "p.jansen@jansenchemie.nl", "NL"),
    ("Bouwgroep De Vries", "Mark de Vries", "info@bouwgroepdevries.nl", "NL"),
    ("GreenPack Verpakkingen B.V.", "Lisa Bakker", "lisa@greenpack.nl", "NL"),
    ("Textielhandel Bakker & Zonen", "Henk Bakker", "verkoop@bakkertextiel.nl", "NL"),
    ("Meubelfabriek Hendriks", "Sophie Hendriks", "s.hendriks@meubelhendriks.nl", "NL"),
    ("Smit Foods Nederland B.V.", "Karel Smit", "k.smit@smitfoods.nl", "NL"),
    ("Visser Trading B.V.", "Anouk Visser", "a.visser@vissertrading.nl", "NL"),
    ("De Groot Groothandel", "Thomas de Groot", "thomas@degrootgroothandel.nl", "NL"),
    ("Mulder Industriële Supplies", "Ellen Mulder", "e.mulder@mulder-supplies.nl", "NL"),
]

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
    "gpsr_marktdeelnemer": ["EU-Importeur B.V., Rotterdam", "Compliance Partners GmbH, Keulen", "EuroDistributie N.V., Antwerpen"],
    "gpsr_waarschuwingen": ["Niet geschikt voor kinderen < 3 jaar", "Buiten bereik van kinderen houden", "Niet blootstellen aan vocht"],
    "erp_energieklasse": ["A", "B", "C", "A+"],
    "espr_repareerbaarheid": ["8,5 / 10", "7,2 / 10", "6,0 / 10", "9,1 / 10"],
    "eudr_herkomst": ["Brazilië", "Indonesië", "Ghana", "Zweden", "Duitsland"],
    "eudr_geo": ["-3.4653, -62.2159", "1.3521, 103.8198", "5.6037, -0.1870"],
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
        if "svhc" in veld.sleutel:
            return "Nee" if h % 5 else "Ja"  # meestal geen SVHC-stoffen aanwezig
        return "Ja" if h % 4 else "Nee"
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
        for naam, contact, email, land in LEVERANCIERS:
            lev = models.Leverancier(
                naam=naam, contactpersoon=contact, email=email, land=land, actief=True
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

        # wetgeving standaard AAN als er producten onder vallen
        product_cat_namen = {cat for _, cat in prod_objs}
        for code, w in wet_map.items():
            w.actief = bool(set(wetcode_to_catnamen[code]) & product_cat_namen)
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
                    deadline=date.today() + timedelta(days=14),
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
        led = prod_objs[0][0]
        choco = next(p for p, _ in prod_objs if p.naam.startswith("Pure Chocolade"))
        leverancier0 = leveranciers[0]
        db.add_all(
            [
                models.Notificatie(
                    titel="EUDR wordt binnenkort van kracht",
                    bericht=(
                        "De EU-ontbossingsverordening geldt vanaf eind 2025. Controleer "
                        "herkomst en due-diligence voor hout-, papier- en voedingsproducten."
                    ),
                    type="waarschuwing",
                    categorie="Aankomende wetgeving",
                ),
                models.Notificatie(
                    titel=f"Nieuwe data ontvangen voor {choco.naam}",
                    bericht="De leverancier heeft de EUDR-herkomstdata aangeleverd.",
                    type="succes",
                    categorie="Nieuwe data ontvangen",
                    entiteit_type="product",
                    entiteit_id=choco.id,
                ),
                models.Notificatie(
                    titel="Deadline dataverzoek nadert",
                    bericht=(
                        f"Het dataverzoek aan {leverancier0.naam} voor PPWR-data verloopt "
                        "binnen 7 dagen."
                    ),
                    type="waarschuwing",
                    categorie="Deadline nadert",
                    entiteit_type="dataverzoek",
                    entiteit_id=leverancier0.id,
                ),
                models.Notificatie(
                    titel=f"Twijfelachtige waarde bij {led.naam}",
                    bericht="De opgegeven recycleerbaarheid valt buiten het bereik (0–100%).",
                    type="fout",
                    categorie="Twijfelachtige waarde",
                    entiteit_type="product",
                    entiteit_id=led.id,
                ),
                models.Notificatie(
                    titel=f"{leverancier0.naam} heeft openstaande dataverzoeken",
                    bericht="Meerdere producten van deze leverancier missen data.",
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
    finally:
        db.close()


if __name__ == "__main__":
    seed()
