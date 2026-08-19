"""SQLAlchemy datamodel voor PowerCompliance.

Kern-entiteiten (zoals gevraagd): Leverancier, Product, Categorie, Wetgeving,
ComplianceVeld, Dataverzoek, Notificatie.

Aanvullend (nodig om "ontbrekende data per leverancier" te kunnen berekenen):
- ProductComplianceWaarde: de daadwerkelijk ingevulde waarde van een
  compliance-veld voor een specifiek product.
- DataverzoekRegel: koppelt een dataverzoek aan de ontbrekende velden.
"""
from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


# Koppeltabel: welke categorieën vallen onder welke wetgeving (m-op-n).
# Bepaalt welke wetgeving automatisch van toepassing is op een product.
wetgeving_categorie = Table(
    "wetgeving_categorie",
    Base.metadata,
    Column("wetgeving_id", Integer, ForeignKey("wetgeving.id"), primary_key=True),
    Column("categorie_id", Integer, ForeignKey("categorieen.id"), primary_key=True),
)


class Categorie(Base):
    __tablename__ = "categorieen"

    id = Column(Integer, primary_key=True, index=True)
    naam = Column(String, nullable=False, unique=True)
    beschrijving = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("categorieen.id"), nullable=True)

    parent = relationship("Categorie", remote_side=[id], backref="subcategorieen")
    producten = relationship("Product", back_populates="categorie")
    compliance_velden = relationship("ComplianceVeld", back_populates="categorie")


class Leverancier(Base):
    __tablename__ = "leveranciers"

    id = Column(Integer, primary_key=True, index=True)
    naam = Column(String, nullable=False, index=True)
    contactpersoon = Column(String, nullable=True)
    email = Column(String, nullable=True)
    telefoon = Column(String, nullable=True)
    adres = Column(String, nullable=True)  # straat + huisnummer
    postcode = Column(String, nullable=True)
    stad = Column(String, nullable=True)
    land = Column(String, nullable=True, default="NL")
    # Bedrijfsidentificatie — o.a. nodig voor de GPSR-vereiste "verantwoordelijke
    # EU-marktdeelnemer" (naam + adres). Wordt bij de leverancier uitgevraagd als
    # deze nog ontbreekt (zie email_generator.ontbrekende_leverancier_gegevens).
    kvk_nummer = Column(String, nullable=True)
    btw_nummer = Column(String, nullable=True)
    actief = Column(Boolean, default=True)
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)

    producten = relationship(
        "Product", back_populates="leverancier", cascade="all, delete-orphan"
    )
    dataverzoeken = relationship(
        "Dataverzoek", back_populates="leverancier", cascade="all, delete-orphan"
    )
    activiteiten = relationship(
        "LeverancierActiviteit",
        back_populates="leverancier",
        cascade="all, delete-orphan",
    )
    sequence_inschrijvingen = relationship(
        "SequenceInschrijving",
        back_populates="leverancier",
        cascade="all, delete-orphan",
    )


class Product(Base):
    __tablename__ = "producten"

    id = Column(Integer, primary_key=True, index=True)
    naam = Column(String, nullable=False, index=True)
    artikelnummer = Column(String, nullable=True, index=True)
    ean = Column(String, nullable=True, index=True)
    merk = Column(String, nullable=True)
    beschrijving = Column(Text, nullable=True)
    leverancier_id = Column(
        Integer, ForeignKey("leveranciers.id"), nullable=False, index=True
    )
    categorie_id = Column(
        Integer, ForeignKey("categorieen.id"), nullable=True, index=True
    )
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)

    # gedenormaliseerde compliance-cache (asynchroon herberekend) voor schaal
    compliance_percentage = Column(Float, default=100.0)
    aantal_ontbrekend = Column(Integer, default=0)
    compliance_status = Column(
        String, default="onbekend", index=True
    )  # compliant | gedeeltelijk | incompleet
    compliance_bijgewerkt = Column(DateTime, nullable=True)

    leverancier = relationship("Leverancier", back_populates="producten")
    categorie = relationship("Categorie", back_populates="producten")
    compliance_waarden = relationship(
        "ProductComplianceWaarde",
        back_populates="product",
        cascade="all, delete-orphan",
    )
    documenten = relationship(
        "ProductDocument",
        back_populates="product",
        cascade="all, delete-orphan",
    )


class Wetgeving(Base):
    __tablename__ = "wetgeving"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, nullable=False, unique=True)  # bv. PPWR, REACH
    naam = Column(String, nullable=False)
    beschrijving = Column(Text, nullable=True)
    van_kracht_vanaf = Column(Date, nullable=True)
    status = Column(String, default="van kracht")  # van kracht | aankomend | concept
    # door beheerder aan/uit te zetten; uit = niet meegenomen in compliance
    actief = Column(Boolean, default=True)
    info_url = Column(String, nullable=True)  # officiële bron (EUR-Lex)
    samenvatting = Column(Text, nullable=True)  # korte NL-samenvatting
    # wanneer de wetgeving-informatie voor het laatst via de AI-refresh is
    # bijgewerkt (ingangsdatum/status/samenvatting).
    laatst_bijgewerkt_op = Column(DateTime, nullable=True)

    compliance_velden = relationship(
        "ComplianceVeld", back_populates="wetgeving", cascade="all, delete-orphan"
    )
    categorieen = relationship(
        "Categorie", secondary=wetgeving_categorie, backref="wetgevingen"
    )


class ComplianceVeld(Base):
    __tablename__ = "compliance_velden"

    id = Column(Integer, primary_key=True, index=True)
    naam = Column(String, nullable=False)
    sleutel = Column(String, nullable=False)  # technische sleutel
    beschrijving = Column(Text, nullable=True)
    veld_type = Column(String, default="tekst")  # tekst | getal | boolean | datum | bestand
    verplicht = Column(Boolean, default=True)
    wetgeving_id = Column(Integer, ForeignKey("wetgeving.id"), nullable=False)
    # null = geldt voor alle categorieën, anders alleen voor deze categorie
    categorie_id = Column(Integer, ForeignKey("categorieen.id"), nullable=True)

    wetgeving = relationship("Wetgeving", back_populates="compliance_velden")
    categorie = relationship("Categorie", back_populates="compliance_velden")
    waarden = relationship(
        "ProductComplianceWaarde",
        back_populates="compliance_veld",
        cascade="all, delete-orphan",
    )


class ProductComplianceWaarde(Base):
    __tablename__ = "product_compliance_waarden"
    __table_args__ = (
        UniqueConstraint("product_id", "compliance_veld_id", name="uq_product_veld"),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("producten.id"), nullable=False, index=True)
    compliance_veld_id = Column(
        Integer, ForeignKey("compliance_velden.id"), nullable=False
    )
    waarde = Column(Text, nullable=True)
    # ingevuld=True telt mee voor compliance (handmatig of geverifieerd-automatisch)
    ingevuld = Column(Boolean, default=False)
    # bron: handmatig | automatisch | niet_gevonden
    bron = Column(String, default="handmatig")
    bron_url = Column(String, nullable=True)
    geverifieerd = Column(Boolean, default=False)
    twijfelachtig = Column(Boolean, default=False)
    bijgewerkt_op = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="compliance_waarden")
    compliance_veld = relationship("ComplianceVeld", back_populates="waarden")


class Dataverzoek(Base):
    __tablename__ = "dataverzoeken"

    id = Column(Integer, primary_key=True, index=True)
    leverancier_id = Column(
        Integer, ForeignKey("leveranciers.id"), nullable=False, index=True
    )
    onderwerp = Column(String, nullable=False)
    bericht = Column(Text, nullable=True)
    # Volledige tekst van de daadwerkelijk verstuurde mail (los van ``bericht``,
    # dat alleen een korte samenvatting/metadata bevat).
    verzonden_bericht = Column(Text, nullable=True)
    # Platte tekst van de ontvangen reply van de leverancier (indien binnen).
    reply_bericht = Column(Text, nullable=True)
    status = Column(
        String, default="open", index=True
    )  # open | verzonden | ontvangen | afgerond
    deadline = Column(Date, nullable=True)
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)

    leverancier = relationship("Leverancier", back_populates="dataverzoeken")
    regels = relationship(
        "DataverzoekRegel", back_populates="dataverzoek", cascade="all, delete-orphan"
    )


class DataverzoekRegel(Base):
    __tablename__ = "dataverzoek_regels"

    id = Column(Integer, primary_key=True, index=True)
    dataverzoek_id = Column(Integer, ForeignKey("dataverzoeken.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("producten.id"), nullable=True)
    compliance_veld_id = Column(
        Integer, ForeignKey("compliance_velden.id"), nullable=True
    )

    dataverzoek = relationship("Dataverzoek", back_populates="regels")


class ProductDocument(Base):
    """Geüpload document gekoppeld aan een product (PDF e.d.).

    Documenttype bv. veiligheidsblad, CE-certificaat, DoP, energielabel.
    Verloopdatum wordt bijgehouden voor vervalnotificaties.
    """

    __tablename__ = "product_documenten"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("producten.id"), nullable=False, index=True)
    documenttype = Column(String, nullable=False)  # veiligheidsblad | ce-certificaat | dop | energielabel | overig
    bestandsnaam = Column(String, nullable=False)  # opgeslagen bestandsnaam (uniek)
    originele_naam = Column(String, nullable=False)  # naam zoals geüpload
    mime_type = Column(String, nullable=True)
    grootte = Column(Integer, default=0)  # bytes
    verloopdatum = Column(Date, nullable=True, index=True)
    notitie = Column(Text, nullable=True)
    geupload_op = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="documenten")


class ExportLog(Base):
    """Exporthistorie: registreert elke export naar een bronsysteem (PIM/ERP)."""

    __tablename__ = "export_logs"

    id = Column(Integer, primary_key=True, index=True)
    formaat = Column(String, nullable=False)  # csv | xlsx | json
    bestandsnaam = Column(String, nullable=False)
    aantal_producten = Column(Integer, default=0)
    aantal_velden = Column(Integer, default=0)
    velden = Column(Text, nullable=True)  # JSON-lijst van geëxporteerde veldsleutels
    filters = Column(Text, nullable=True)  # JSON van toegepaste filters
    bron = Column(String, default="handmatig")  # handmatig | webhook
    webhook_resultaat = Column(Text, nullable=True)  # JSON met afleverstatus per abonnee
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)


class WebhookAbonnement(Base):
    """Extern systeem dat zich abonneert op export-events (generieke koppeling)."""

    __tablename__ = "webhook_abonnementen"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    beschrijving = Column(String, nullable=True)
    geheim = Column(String, nullable=True)  # optioneel gedeeld geheim (header)
    actief = Column(Boolean, default=True)
    laatste_status = Column(String, nullable=True)  # bv. "200 OK" of foutmelding
    laatst_afgeleverd_op = Column(DateTime, nullable=True)
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)


class Notificatie(Base):
    __tablename__ = "notificaties"

    id = Column(Integer, primary_key=True, index=True)
    titel = Column(String, nullable=False)
    bericht = Column(Text, nullable=True)
    type = Column(String, default="info")  # info | waarschuwing | fout | succes (kleur/ernst)
    # categorie = leesbaar type, bv. "Nieuwe data ontvangen", "Deadline nadert",
    # "Twijfelachtige waarde", "Aankomende wetgeving".
    categorie = Column(String, nullable=True)
    gelezen = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    # gerelateerde entiteit voor doorklikken: "product" | "leverancier" | "dataverzoek"
    entiteit_type = Column(String, nullable=True)
    entiteit_id = Column(Integer, nullable=True)
    # i18n: sjabloonsleutel + ingevulde params, zodat titel/bericht bij het
    # uitlezen in NL of EN gerenderd kunnen worden (zie notificatie_teksten.py).
    sleutel = Column(String, nullable=True)
    params = Column(Text, nullable=True)  # JSON-string met de sjabloonwaarden
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)


class LeverancierActiviteit(Base):
    """Interactiehistorie per leverancier (tijdlijn).

    Legt elke interactie vast: verstuurde mails, ontvangen replies, aangevulde
    data en compliance-statuswijzigingen.
    """

    __tablename__ = "leverancier_activiteiten"

    id = Column(Integer, primary_key=True, index=True)
    leverancier_id = Column(
        Integer, ForeignKey("leveranciers.id"), nullable=False, index=True
    )
    # type: mail_verstuurd | reply_ontvangen | data_aangevuld | status_gewijzigd | notificatie
    type = Column(String, nullable=False, index=True)
    omschrijving = Column(String, nullable=False)
    detail = Column(Text, nullable=True)  # bv. de volledige mail-/replytekst
    aangemaakt_op = Column(DateTime, default=datetime.utcnow, index=True)

    leverancier = relationship("Leverancier", back_populates="activiteiten")


class Sequence(Base):
    """Een geautomatiseerde reeks herinneringsstappen (mail-cadans).

    Trigger bepaalt op welke leveranciers de sequence van toepassing is: alle
    leveranciers met ontbrekende data ("leverancier") of leveranciers met
    ontbrekende data voor één wetgeving ("wetgeving").
    """

    __tablename__ = "sequences"

    id = Column(Integer, primary_key=True, index=True)
    naam = Column(String, nullable=False)
    beschrijving = Column(Text, nullable=True)
    trigger_type = Column(String, default="leverancier")  # leverancier | wetgeving
    wetgeving_code = Column(String, nullable=True)  # bij trigger_type == "wetgeving"
    actief = Column(Boolean, default=False)
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)

    stappen = relationship(
        "SequenceStap",
        back_populates="sequence",
        cascade="all, delete-orphan",
        order_by="SequenceStap.volgorde",
    )
    inschrijvingen = relationship(
        "SequenceInschrijving",
        back_populates="sequence",
        cascade="all, delete-orphan",
    )


class SequenceStap(Base):
    __tablename__ = "sequence_stappen"

    id = Column(Integer, primary_key=True, index=True)
    sequence_id = Column(Integer, ForeignKey("sequences.id"), nullable=False, index=True)
    volgorde = Column(Integer, default=0)  # stapnummer (0-gebaseerd)
    wachttijd_dagen = Column(Integer, default=7)  # dagen na de vorige stap/inschrijving
    actie = Column(String, default="mail_versturen")  # mail_versturen
    # conditie: altijd | data_ontbreekt | geen_reply
    conditie = Column(String, default="data_ontbreekt")
    # optionele, door de beheerder ingestelde mailinhoud voor deze stap.
    # Leeg = de mail wordt bij verzending automatisch (AI/sjabloon) gegenereerd.
    # Ondersteunt placeholders zoals {aanhef}, {ontbrekende_data}, {portaal_link}.
    onderwerp = Column(String, nullable=True)
    mailtekst = Column(Text, nullable=True)

    sequence = relationship("Sequence", back_populates="stappen")


class SequenceInschrijving(Base):
    """Deelname van één leverancier aan een sequence, met de huidige stap."""

    __tablename__ = "sequence_inschrijvingen"
    __table_args__ = (
        UniqueConstraint("sequence_id", "leverancier_id", name="uq_sequence_leverancier"),
    )

    id = Column(Integer, primary_key=True, index=True)
    sequence_id = Column(Integer, ForeignKey("sequences.id"), nullable=False, index=True)
    leverancier_id = Column(
        Integer, ForeignKey("leveranciers.id"), nullable=False, index=True
    )
    status = Column(String, default="actief")  # actief | voltooid | gestopt
    # aantal reeds uitgevoerde stappen (= index van de volgende stap)
    huidige_stap = Column(Integer, default=0)
    laatste_actie_op = Column(DateTime, default=datetime.utcnow)  # start of laatste stap
    gestart_op = Column(DateTime, default=datetime.utcnow)
    voltooid_op = Column(DateTime, nullable=True)

    sequence = relationship("Sequence", back_populates="inschrijvingen")
    leverancier = relationship(
        "Leverancier", back_populates="sequence_inschrijvingen"
    )


class AuditLog(Base):
    """Audit trail: registreert elke wijziging in het systeem.

    Eén rij per wijziging, met wie (``gebruiker``), wanneer (``tijdstip``),
    wat voor actie (``actie``), op welk object (``object_type``/``object_id``/
    ``object_naam``) en de waarde vóór en na (``oude_waarde``/``nieuwe_waarde``).

    ``leverancier_id`` en ``product_id`` worden waar mogelijk meegeschreven,
    zodat de audit trail per leverancier/product te filteren is (o.a. voor de
    tabbladen op de detailpagina's).
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tijdstip = Column(DateTime, default=datetime.utcnow, index=True)
    gebruiker = Column(String, nullable=False, default="Systeem")
    # actie: compliance_gewijzigd | leverancier_gewijzigd | product_toegevoegd |
    # product_gewijzigd | product_verwijderd | wetgeving_gewijzigd |
    # dataverzoek_verstuurd | bulkimport | reply_verwerkt
    actie = Column(String, nullable=False, index=True)
    object_type = Column(String, nullable=False, index=True)  # product | leverancier | wetgeving | compliance | dataverzoek | import
    object_id = Column(Integer, nullable=True, index=True)
    object_naam = Column(String, nullable=True)
    oude_waarde = Column(Text, nullable=True)
    nieuwe_waarde = Column(Text, nullable=True)
    # optionele koppelingen voor filtering per leverancier/product
    leverancier_id = Column(Integer, nullable=True, index=True)
    product_id = Column(Integer, nullable=True, index=True)


class AppInstelling(Base):
    """Eenvoudige sleutel/waarde-opslag voor app-instellingen.

    Gebruikt o.a. voor de automatische-vernieuwing-frequentie van de
    wetgeving-refresh en het tijdstip van de laatste run.
    """

    __tablename__ = "app_instellingen"

    sleutel = Column(String, primary_key=True)
    waarde = Column(String, nullable=True)
    bijgewerkt_op = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
