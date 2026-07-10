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
    tekst: Optional[str] = None  # mailtekst; wordt echt verstuurd via Gmail SMTP
    aan_naam: Optional[str] = None
    aan_email: Optional[str] = None
    deadline: Optional[date] = None


class MailAflevering(BaseModel):
    verzonden: bool
    kanaal: str  # gmail | gesimuleerd
    ontvanger: str
    info: str
    status_code: Optional[int] = None


class EmailVerstuurResultaat(BaseModel):
    dataverzoek: DataverzoekOut
    mail: MailAflevering


# ---------- Inkomende reply (mailverwerking) ----------
class MailInboundRequest(BaseModel):
    leverancier_id: int
    tekst: str  # platte tekst van de inkomende reply
    wetgeving_code: Optional[str] = None


class SimuleerReplyRequest(BaseModel):
    leverancier_id: int
    wetgeving_code: Optional[str] = None


class MailVerwerktVeld(BaseModel):
    product_id: int
    product_naam: str
    compliance_veld_id: int
    veld_naam: str
    wetgeving_code: str
    waarde: str


class MailVerwerktResultaat(BaseModel):
    leverancier_id: int
    reply_tekst: Optional[str] = None  # de (gesimuleerde) reply die verwerkt is
    aantal_ingevuld: int
    aantal_producten: int
    velden: List[MailVerwerktVeld] = []
    ai_gebruikt: bool
    ai_fout: Optional[str] = None


# ---------- Demo-modus ----------
class DemoLeverancier(BaseModel):
    id: int
    naam: str
    contactpersoon: Optional[str] = None
    email: Optional[str] = None


class DemoStatus(BaseModel):
    leverancier: Optional[DemoLeverancier] = None
    aantal_producten: int = 0
    velden_ontbrekend: int = 0  # nog ontbrekend (excl. reeds via reply verrijkt)
    velden_via_reply: int = 0  # al ingevuld via een reply
    compliance_voor: float = 100.0
    compliance_na: float = 100.0
    reply_verwerkt: bool = False
    demo_email: Optional[str] = None
    gmail_actief: bool = False


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


# ---------- Documentbeheer ----------
class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    documenttype: str
    originele_naam: str
    mime_type: Optional[str] = None
    grootte: int = 0
    verloopdatum: Optional[date] = None
    notitie: Optional[str] = None
    geupload_op: datetime
    # afgeleid:
    verloop_status: Optional[str] = None  # geldig | verloopt_binnenkort | verlopen | geen
    dagen_tot_verloop: Optional[int] = None


class DocumentMetProduct(DocumentOut):
    product_naam: Optional[str] = None
    artikelnummer: Optional[str] = None
    leverancier_naam: Optional[str] = None


class VerlopendDocumentenOverzicht(BaseModel):
    verlopen: List[DocumentMetProduct] = []
    verloopt_binnenkort: List[DocumentMetProduct] = []
    aantal_verlopen: int = 0
    aantal_binnenkort: int = 0


# ---------- PIM/ERP-export ----------
class ExportVeld(BaseModel):
    sleutel: str
    label: str
    groep: str  # "product" | wetgeving-code


class ExportOpties(BaseModel):
    velden: List[ExportVeld] = []
    leveranciers: List[dict] = []
    categorieen: List[dict] = []
    wetgeving: List[dict] = []


class ExportRequest(BaseModel):
    formaat: str = "csv"  # csv | xlsx | json
    velden: List[str] = []  # veldsleutels; leeg = alle product-basisvelden
    leverancier_id: Optional[int] = None
    categorie_id: Optional[int] = None
    wetgeving_code: Optional[str] = None
    alleen_compliant: bool = False  # alleen goedgekeurde/complete productdata


class ExportLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    formaat: str
    bestandsnaam: str
    aantal_producten: int
    aantal_velden: int
    velden: Optional[str] = None
    filters: Optional[str] = None
    bron: str
    webhook_resultaat: Optional[str] = None
    aangemaakt_op: datetime


class WebhookCreate(BaseModel):
    url: str
    beschrijving: Optional[str] = None
    geheim: Optional[str] = None


class WebhookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    url: str
    beschrijving: Optional[str] = None
    actief: bool
    laatste_status: Optional[str] = None
    laatst_afgeleverd_op: Optional[datetime] = None
    aangemaakt_op: datetime


# ---------- Rapportages ----------
class ComplianceOverzichtRegel(BaseModel):
    code: str
    naam: str
    aantal_producten: int
    compliance_percentage: float
    aantal_ontbrekende_velden: int


class LeverancierScorecard(BaseModel):
    leverancier_id: int
    naam: str
    aantal_producten: int
    compleetheid_percentage: float
    open_verzoeken: int
    gem_responstijd_dagen: Optional[float] = None


class RisicoLeverancier(BaseModel):
    leverancier_id: int
    naam: str
    deadline: Optional[date] = None
    dagen_tot_deadline: Optional[int] = None
    risicocategorie: str  # "30" | "60" | "90"
    aantal_ontbrekend: int
    onderwerp: Optional[str] = None


class TrendPunt(BaseModel):
    maand: str  # YYYY-MM
    label: str  # bv. "jan 2026"
    compliance_percentage: float
    aantal_producten: int


class RapportagesData(BaseModel):
    compliance_overzicht: List[ComplianceOverzichtRegel] = []
    scorecards: List[LeverancierScorecard] = []
    risico: List[RisicoLeverancier] = []
    trend: List[TrendPunt] = []
