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
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


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
    land = Column(String, nullable=True, default="NL")
    actief = Column(Boolean, default=True)
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)

    producten = relationship(
        "Product", back_populates="leverancier", cascade="all, delete-orphan"
    )
    dataverzoeken = relationship(
        "Dataverzoek", back_populates="leverancier", cascade="all, delete-orphan"
    )


class Product(Base):
    __tablename__ = "producten"

    id = Column(Integer, primary_key=True, index=True)
    naam = Column(String, nullable=False, index=True)
    artikelnummer = Column(String, nullable=True, index=True)
    ean = Column(String, nullable=True)
    beschrijving = Column(Text, nullable=True)
    leverancier_id = Column(Integer, ForeignKey("leveranciers.id"), nullable=False)
    categorie_id = Column(Integer, ForeignKey("categorieen.id"), nullable=True)
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)

    leverancier = relationship("Leverancier", back_populates="producten")
    categorie = relationship("Categorie", back_populates="producten")
    compliance_waarden = relationship(
        "ProductComplianceWaarde",
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

    compliance_velden = relationship(
        "ComplianceVeld", back_populates="wetgeving", cascade="all, delete-orphan"
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
    product_id = Column(Integer, ForeignKey("producten.id"), nullable=False)
    compliance_veld_id = Column(
        Integer, ForeignKey("compliance_velden.id"), nullable=False
    )
    waarde = Column(Text, nullable=True)
    ingevuld = Column(Boolean, default=False)
    bijgewerkt_op = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="compliance_waarden")
    compliance_veld = relationship("ComplianceVeld", back_populates="waarden")


class Dataverzoek(Base):
    __tablename__ = "dataverzoeken"

    id = Column(Integer, primary_key=True, index=True)
    leverancier_id = Column(Integer, ForeignKey("leveranciers.id"), nullable=False)
    onderwerp = Column(String, nullable=False)
    bericht = Column(Text, nullable=True)
    status = Column(String, default="open")  # open | verzonden | ontvangen | afgerond
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


class Notificatie(Base):
    __tablename__ = "notificaties"

    id = Column(Integer, primary_key=True, index=True)
    titel = Column(String, nullable=False)
    bericht = Column(Text, nullable=True)
    type = Column(String, default="info")  # info | waarschuwing | fout | succes
    gelezen = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    aangemaakt_op = Column(DateTime, default=datetime.utcnow)
