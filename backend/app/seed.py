"""Vult de database met voorbeelddata: EU-wetgeving, compliance-velden,
categorieën, leveranciers en producten — inclusief deels ontbrekende data zodat
de 'ontbrekende data'-functionaliteit zichtbaar is.

Draai met:  python -m app.seed
"""
from datetime import date, datetime, timedelta

from .database import Base, SessionLocal, engine
from . import models


def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


# (code, naam, beschrijving, van_kracht_vanaf, status, [velden])
# veld = (naam, sleutel, veld_type, categorie_naam_of_None)
WETGEVING = [
    (
        "PPWR",
        "Verpakkingsverordening (Packaging & Packaging Waste Regulation)",
        "EU-verordening 2025/40 over verpakkingen en verpakkingsafval: recycleerbaarheid, recyclaatgehalte en etikettering.",
        date(2026, 8, 12),
        "aankomend",
        [
            ("Verpakkingsmateriaal", "ppwr_materiaal", "tekst", None),
            ("Recycleerbaarheid (%)", "ppwr_recycleerbaarheid", "getal", None),
            ("Aandeel gerecycled materiaal (%)", "ppwr_recyclaat", "getal", None),
            ("Verpakkingsgewicht (g)", "ppwr_gewicht", "getal", None),
        ],
    ),
    (
        "BATTERIJ",
        "Batterijverordening (EU) 2023/1542",
        "Eisen aan duurzaamheid, koolstofvoetafdruk, recyclaatgehalte en het digitale batterijpaspoort.",
        date(2024, 2, 18),
        "van kracht",
        [
            ("Batterijchemie", "bat_chemie", "tekst", "Batterijen & Accu's"),
            ("Capaciteit (Wh)", "bat_capaciteit", "getal", "Batterijen & Accu's"),
            ("CO2-voetafdruk (kg CO2e)", "bat_co2", "getal", "Batterijen & Accu's"),
            ("Batterijpaspoort-ID", "bat_paspoort", "tekst", "Batterijen & Accu's"),
        ],
    ),
    (
        "REACH",
        "REACH/CLP — Stoffen & etikettering",
        "Registratie en beperking van chemische stoffen (REACH) en indeling, etikettering en verpakking van gevaarlijke stoffen (CLP).",
        date(2007, 6, 1),
        "van kracht",
        [
            ("SVHC-stoffen aanwezig", "reach_svhc", "boolean", None),
            ("Veiligheidsinformatieblad (SDS)", "reach_sds", "bestand", None),
            ("CLP-gevarenpictogrammen", "reach_clp", "tekst", None),
        ],
    ),
    (
        "CPR",
        "Bouwproductenverordening (Construction Products Regulation)",
        "Prestatieverklaring (DoP) en CE-markering voor bouwproducten.",
        date(2013, 7, 1),
        "van kracht",
        [
            ("Prestatieverklaring (DoP)", "cpr_dop", "bestand", "Bouwmaterialen"),
            ("CE-markering", "cpr_ce", "boolean", "Bouwmaterialen"),
            ("Brandklasse", "cpr_brandklasse", "tekst", "Bouwmaterialen"),
        ],
    ),
    (
        "GPSR",
        "Algemene productveiligheidsverordening (General Product Safety Regulation)",
        "EU-verordening 2023/988: veiligheidswaarschuwingen, traceerbaarheid en verantwoordelijke marktdeelnemer in de EU.",
        date(2024, 12, 13),
        "van kracht",
        [
            ("Verantwoordelijke EU-marktdeelnemer", "gpsr_marktdeelnemer", "tekst", None),
            ("Veiligheidswaarschuwingen", "gpsr_waarschuwingen", "tekst", None),
            ("Gebruiksaanwijzing aanwezig", "gpsr_handleiding", "boolean", None),
        ],
    ),
    (
        "ERP",
        "Ecodesign / ErP-richtlijn (Energy-related Products)",
        "Ecodesign-eisen en energielabels voor energiegerelateerde producten.",
        date(2009, 11, 20),
        "van kracht",
        [
            ("Energie-efficiëntieklasse", "erp_energieklasse", "tekst", "Elektronica"),
            ("Energieverbruik (kWh/jaar)", "erp_verbruik", "getal", "Elektronica"),
            ("EPREL-registratienummer", "erp_eprel", "tekst", "Elektronica"),
        ],
    ),
]

CATEGORIEEN = [
    ("Elektronica", "Elektrische en elektronische apparaten"),
    ("Batterijen & Accu's", "Draagbare en industriële batterijen"),
    ("Bouwmaterialen", "Producten voor de bouw"),
    ("Verpakkingen", "Verpakkingsmaterialen"),
    ("Gereedschap", "Hand- en elektrisch gereedschap"),
]

LEVERANCIERS = [
    ("Volt Electronics B.V.", "Jan de Vries", "j.devries@volt-electro.nl", "NL"),
    ("PowerCell GmbH", "Anna Schmidt", "a.schmidt@powercell.de", "DE"),
    ("BouwTotaal Groothandel", "Mark Jansen", "info@bouwtotaal.nl", "NL"),
    ("GreenPack Solutions", "Lisa Bakker", "lisa@greenpack.eu", "BE"),
    ("ToolMaster Trading", "Peter Visser", "p.visser@toolmaster.nl", "NL"),
]

# (naam, artikelnummer, ean, categorie_naam, leverancier_naam)
PRODUCTEN = [
    ("LED Paneel 60x60", "VLT-LED-6060", "8710000000017", "Elektronica", "Volt Electronics B.V."),
    ("USB-C Snellader 65W", "VLT-CHG-65", "8710000000024", "Elektronica", "Volt Electronics B.V."),
    ("Lithium Accu 18V 4Ah", "PWR-LI-184", "4010000000010", "Batterijen & Accu's", "PowerCell GmbH"),
    ("AA Oplaadbare Batterij 4-pack", "PWR-AA-4", "4010000000027", "Batterijen & Accu's", "PowerCell GmbH"),
    ("Gipsplaat 12.5mm", "BT-GIPS-125", "8712000000013", "Bouwmaterialen", "BouwTotaal Groothandel"),
    ("Isolatieplaat PIR 100mm", "BT-PIR-100", "8712000000020", "Bouwmaterialen", "BouwTotaal Groothandel"),
    ("Kartonnen doos 40x30x30", "GP-BOX-403030", "5410000000019", "Verpakkingen", "GreenPack Solutions"),
    ("Krimpfolie rol 50cm", "GP-FOIL-50", "5410000000026", "Verpakkingen", "GreenPack Solutions"),
    ("Accuboormachine 18V", "TM-DRILL-18", "8714000000015", "Gereedschap", "ToolMaster Trading"),
    ("Haakse slijper 125mm", "TM-GRIND-125", "8714000000022", "Gereedschap", "ToolMaster Trading"),
]


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

        # wetgeving + velden
        veld_objs = []
        for code, naam, beschr, dt, status, velden in WETGEVING:
            w = models.Wetgeving(
                code=code,
                naam=naam,
                beschrijving=beschr,
                van_kracht_vanaf=dt,
                status=status,
            )
            db.add(w)
            db.flush()
            for vnaam, sleutel, vtype, cat_naam in velden:
                cv = models.ComplianceVeld(
                    naam=vnaam,
                    sleutel=sleutel,
                    veld_type=vtype,
                    verplicht=True,
                    wetgeving_id=w.id,
                    categorie_id=cat_map[cat_naam].id if cat_naam else None,
                )
                db.add(cv)
                veld_objs.append(cv)
        db.flush()

        # leveranciers
        lev_map = {}
        for naam, contact, email, land in LEVERANCIERS:
            lev = models.Leverancier(
                naam=naam, contactpersoon=contact, email=email, land=land, actief=True
            )
            db.add(lev)
            lev_map[naam] = lev
        db.flush()

        # producten
        prod_objs = []
        for naam, art, ean, cat_naam, lev_naam in PRODUCTEN:
            p = models.Product(
                naam=naam,
                artikelnummer=art,
                ean=ean,
                categorie_id=cat_map[cat_naam].id,
                leverancier_id=lev_map[lev_naam].id,
            )
            db.add(p)
            prod_objs.append(p)
        db.flush()

        # compliance-waarden: vul ~60% in zodat er duidelijk data ontbreekt.
        for i, product in enumerate(prod_objs):
            van_toepassing = [
                v
                for v in veld_objs
                if v.categorie_id is None or v.categorie_id == product.categorie_id
            ]
            for j, veld in enumerate(van_toepassing):
                # deterministisch patroon: laat sommige velden bewust leeg
                ingevuld = (i + j) % 5 != 0 and (i + j) % 7 != 0
                if ingevuld:
                    db.add(
                        models.ProductComplianceWaarde(
                            product_id=product.id,
                            compliance_veld_id=veld.id,
                            waarde="ingevuld",
                            ingevuld=True,
                        )
                    )

        # een paar dataverzoeken
        db.add(
            models.Dataverzoek(
                leverancier_id=lev_map["Volt Electronics B.V."].id,
                onderwerp="Ontbrekende PPWR-verpakkingsdata",
                bericht="Graag aanleveren: verpakkingsmateriaal en recyclaatgehalte.",
                status="verzonden",
                deadline=date.today() + timedelta(days=14),
            )
        )
        db.add(
            models.Dataverzoek(
                leverancier_id=lev_map["PowerCell GmbH"].id,
                onderwerp="Batterijpaspoort + CO2-voetafdruk",
                bericht="Conform Batterijverordening hebben we het paspoort-ID nodig.",
                status="open",
                deadline=date.today() + timedelta(days=30),
            )
        )

        # notificaties (met categorie + gerelateerde entiteit voor doorklikken)
        accu = next(p for p in prod_objs if p.naam.startswith("Lithium Accu"))
        led = prod_objs[0]
        volt = lev_map["Volt Electronics B.V."]
        powercell = lev_map["PowerCell GmbH"]
        db.add_all(
            [
                models.Notificatie(
                    titel="PPWR wordt binnenkort van kracht",
                    bericht=(
                        "De Verpakkingsverordening (PPWR) geldt vanaf 12 augustus 2026. "
                        "Controleer of alle producten de vereiste verpakkingsdata hebben."
                    ),
                    type="waarschuwing",
                    categorie="Aankomende wetgeving",
                ),
                models.Notificatie(
                    titel=f"Nieuwe data ontvangen voor {accu.naam}",
                    bericht=(
                        f"{powercell.naam} heeft de batterijchemie en capaciteit "
                        f"aangeleverd voor {accu.naam}."
                    ),
                    type="succes",
                    categorie="Nieuwe data ontvangen",
                    entiteit_type="product",
                    entiteit_id=accu.id,
                ),
                models.Notificatie(
                    titel="Deadline dataverzoek nadert",
                    bericht=(
                        f"Het dataverzoek aan {volt.naam} voor PPWR-data verloopt binnen "
                        "7 dagen. Er is nog geen reactie ontvangen."
                    ),
                    type="waarschuwing",
                    categorie="Deadline nadert",
                    entiteit_type="dataverzoek",
                    entiteit_id=volt.id,
                ),
                models.Notificatie(
                    titel=f"Twijfelachtige waarde bij {led.naam}",
                    bericht=(
                        "De opgegeven recycleerbaarheid (120%) valt buiten het geldige "
                        "bereik (0–100%). Controleer de waarde bij de leverancier."
                    ),
                    type="fout",
                    categorie="Twijfelachtige waarde",
                    entiteit_type="product",
                    entiteit_id=led.id,
                ),
                models.Notificatie(
                    titel=f"{volt.naam} heeft openstaande dataverzoeken",
                    bericht="Deze leverancier heeft meerdere producten met ontbrekende data.",
                    type="info",
                    categorie="Leverancier-update",
                    entiteit_type="leverancier",
                    entiteit_id=volt.id,
                ),
                models.Notificatie(
                    titel=f"Dataverzoek verstuurd naar {volt.naam}",
                    bericht="Het verzoek voor PPWR-data is verzonden.",
                    type="succes",
                    categorie="Dataverzoek verstuurd",
                    entiteit_type="dataverzoek",
                    entiteit_id=volt.id,
                    gelezen=True,
                ),
            ]
        )

        db.commit()
        print("Seed voltooid:")
        print(f"  {db.query(models.Wetgeving).count()} wetgevingen")
        print(f"  {db.query(models.ComplianceVeld).count()} compliance-velden")
        print(f"  {db.query(models.Categorie).count()} categorieën")
        print(f"  {db.query(models.Leverancier).count()} leveranciers")
        print(f"  {db.query(models.Product).count()} producten")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
