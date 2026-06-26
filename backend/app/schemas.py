"""Pydantic-schemas voor request/response validatie."""
from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


# ---------- Categorie ----------
class CategorieBase(BaseModel):
    naam: str
    beschrijving: Optional[str] = None
    parent_id: Optional[int] = None


class CategorieOut(CategorieBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Leverancier ----------
class LeverancierBase(BaseModel):
    naam: str
    contactpersoon: Optional[str] = None
    email: Optional[str] = None
    telefoon: Optional[str] = None
    land: Optional[str] = "NL"
    actief: bool = True


class LeverancierCreate(LeverancierBase):
    pass


class LeverancierUpdate(BaseModel):
    naam: Optional[str] = None
    contactpersoon: Optional[str] = None
    email: Optional[str] = None
    telefoon: Optional[str] = None
    land: Optional[str] = None
    actief: Optional[bool] = None


class LeverancierOut(LeverancierBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    aangemaakt_op: datetime


class LeverancierMetStats(LeverancierOut):
    aantal_producten: int = 0
    aantal_ontbrekend: int = 0
    compliance_percentage: float = 100.0


# ---------- Product ----------
class ProductBase(BaseModel):
    naam: str
    artikelnummer: Optional[str] = None
    ean: Optional[str] = None
    beschrijving: Optional[str] = None
    leverancier_id: int
    categorie_id: Optional[int] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    naam: Optional[str] = None
    artikelnummer: Optional[str] = None
    ean: Optional[str] = None
    beschrijving: Optional[str] = None
    leverancier_id: Optional[int] = None
    categorie_id: Optional[int] = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    aangemaakt_op: datetime
    leverancier: Optional[LeverancierOut] = None
    categorie: Optional[CategorieOut] = None


class ProductMetStats(ProductOut):
    aantal_velden: int = 0
    aantal_ingevuld: int = 0
    aantal_ontbrekend: int = 0
    compliance_percentage: float = 100.0
    compliance_status: str = "onbekend"


# ---------- Wetgeving / ComplianceVeld ----------
class ComplianceVeldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    naam: str
    sleutel: str
    beschrijving: Optional[str] = None
    veld_type: str
    verplicht: bool
    wetgeving_id: int
    categorie_id: Optional[int] = None


class WetgevingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    naam: str
    beschrijving: Optional[str] = None
    van_kracht_vanaf: Optional[date] = None
    status: str
    actief: bool = True
    info_url: Optional[str] = None
    samenvatting: Optional[str] = None
    compliance_velden: List[ComplianceVeldOut] = []


class WetgevingBeheer(BaseModel):
    id: int
    code: str
    naam: str
    status: str
    actief: bool
    aantal_velden: int
    aantal_producten: int
    compliance_percentage: float
    categorieen: List[str] = []


class WetgevingActiefRequest(BaseModel):
    actief: bool


# ---------- Bulk dataverzoeken ----------
class BulkDataverzoekRequest(BaseModel):
    leverancier_ids: List[int]
    onderwerp: str
    bericht: Optional[str] = None
    deadline: Optional[date] = None


class BulkDataverzoekResultaat(BaseModel):
    aantal: int
    dataverzoek_ids: List[int] = []


# ---------- Ontbrekende data ----------
class OntbrekendVeld(BaseModel):
    compliance_veld_id: int
    veld_naam: str
    wetgeving_code: str


class OntbrekendProduct(BaseModel):
    product_id: int
    product_naam: str
    artikelnummer: Optional[str] = None
    leverancier_id: int
    leverancier_naam: str
    ontbrekende_velden: List[OntbrekendVeld] = []


# ---------- Dataverzoek ----------
class DataverzoekCreate(BaseModel):
    leverancier_id: int
    onderwerp: str
    bericht: Optional[str] = None
    deadline: Optional[date] = None


class DataverzoekOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    leverancier_id: int
    onderwerp: str
    bericht: Optional[str] = None
    status: str
    deadline: Optional[date] = None
    aangemaakt_op: datetime
    leverancier: Optional[LeverancierOut] = None


# ---------- Notificatie ----------
class NotificatieOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    titel: str
    bericht: Optional[str] = None
    type: str
    categorie: Optional[str] = None
    gelezen: bool
    link: Optional[str] = None
    entiteit_type: Optional[str] = None
    entiteit_id: Optional[int] = None
    aangemaakt_op: datetime


# ---------- Product compliance-detail ----------
class ProductComplianceRegel(BaseModel):
    compliance_veld_id: int
    veld_naam: str
    sleutel: str
    veld_type: str
    verplicht: bool
    wetgeving_id: int
    wetgeving_code: str
    ingevuld: bool
    waarde: Optional[str] = None
    bron: Optional[str] = None  # handmatig | automatisch | niet_gevonden
    bron_url: Optional[str] = None
    geverifieerd: bool = False
    twijfelachtig: bool = False
    status: str = "ontbreekt"  # ingevuld | automatisch | niet_gevonden_online | ontbreekt


# ---------- Import ----------
class ImportFout(BaseModel):
    rij: int
    bericht: str


class ImportSamenvatting(BaseModel):
    type: str  # "producten" | "leveranciers"
    bestandsnaam: str
    aantal_rijen: int
    aantal_geimporteerd: int
    aantal_fouten: int
    # alleen voor producten:
    aantal_compliant: int = 0
    aantal_met_ontbrekende_data: int = 0
    aantal_velden_ingevuld: int = 0
    herkende_kolommen: dict = {}      # originele header -> veldnaam
    genegeerde_kolommen: List[str] = []
    fouten: List[ImportFout] = []


# ---------- E-mailgeneratie ----------
class EmailGenereerRequest(BaseModel):
    leverancier_id: int
    taal: str = "nl"  # nl | en
    deadline: Optional[date] = None
    wetgeving_code: Optional[str] = None  # gericht uitvragen per wetgeving


class EmailGenereerResponse(BaseModel):
    leverancier_id: int
    aan_naam: Optional[str] = None
    aan_email: Optional[str] = None
    cc: str
    onderwerp: str
    tekst: str
    portaal_link: str
    bestandsnaam: str
    bijlage_url: str
    aantal_velden: int
    aantal_producten: int
    taal: str
    ai_gebruikt: bool
    ai_fout: Optional[str] = None


class EmailVerstuurRequest(BaseModel):
    leverancier_id: int
    onderwerp: str
    deadline: Optional[date] = None


class WetgevingUitvraagLeverancier(BaseModel):
    id: int
    naam: str
    contactpersoon: Optional[str] = None
    email: Optional[str] = None
    aantal_velden: int
    aantal_producten: int


class WetgevingUitvraagRequest(BaseModel):
    wetgeving_code: str
    taal: str = "nl"
    deadline: Optional[date] = None
    leverancier_ids: Optional[list[int]] = None  # None = alle betrokken leveranciers


class WetgevingUitvraagResultaat(BaseModel):
    wetgeving_code: str
    aantal: int
    leveranciers: list[dict] = []


# ---------- Dashboard ----------
class DashboardStats(BaseModel):
    aantal_leveranciers: int
    aantal_producten: int
    aantal_categorieen: int
    aantal_wetgeving: int
    aantal_ontbrekende_velden: int
    aantal_producten_incompleet: int
    gemiddelde_compliance: float
    open_dataverzoeken: int
    compliance_per_wetgeving: List[dict] = []


# ---------- Paginering (na de bovenstaande modellen gedefinieerd) ----------
class Pagina(BaseModel):
    total: int
    page: int
    per_page: int
    pages: int


class ProductenPagina(Pagina):
    items: List[ProductMetStats] = []


class LeveranciersPagina(Pagina):
    items: List[LeverancierMetStats] = []


class DataverzoekenPagina(Pagina):
    items: List[DataverzoekOut] = []
