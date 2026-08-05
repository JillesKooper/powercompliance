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
    adres: Optional[str] = None
    land: Optional[str] = "NL"
    actief: bool = True


class LeverancierCreate(LeverancierBase):
    pass


class LeverancierUpdate(BaseModel):
    naam: Optional[str] = None
    contactpersoon: Optional[str] = None
    email: Optional[str] = None
    telefoon: Optional[str] = None
    adres: Optional[str] = None
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
    laatst_bijgewerkt_op: Optional[datetime] = None
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
    laatst_bijgewerkt_op: Optional[datetime] = None


class WetgevingActiefRequest(BaseModel):
    actief: bool


# ---------- Wetgeving-refresh (AI + websearch) ----------
class WetgevingRefreshRegel(BaseModel):
    code: str
    status: str  # ok | mislukt
    gewijzigd: bool = False
    velden: List[str] = []


class WetgevingRefreshResultaat(BaseModel):
    aantal_ververst: int
    aantal_gewijzigd: int
    laatste_run: Optional[datetime] = None
    regels: List[WetgevingRefreshRegel] = []


class RefreshInstellingOut(BaseModel):
    frequentie: str  # uit | dagelijks | wekelijks | maandelijks
    laatste_run: Optional[datetime] = None


class RefreshInstellingIn(BaseModel):
    frequentie: str


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
    product_id: Optional[int] = None  # gericht uitvragen voor 1 product


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
    # scope van de uitvraag: "product" | "wetgeving" | "leverancier"
    scope: str = "leverancier"
    product_id: Optional[int] = None
    product_naam: Optional[str] = None


class EmailVerstuurRequest(BaseModel):
    leverancier_id: int
    onderwerp: str
    tekst: Optional[str] = None  # mailtekst; wordt echt verstuurd via Gmail SMTP
    aan_naam: Optional[str] = None
    aan_email: Optional[str] = None
    deadline: Optional[date] = None
    taal: str = "nl"  # nl | en — bepaalt o.a. de taal van de Excel-bijlage
    # scope voor de mee te sturen Excel-bijlage
    wetgeving_code: Optional[str] = None
    product_id: Optional[int] = None


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
    taal: str = "nl"  # nl | en — taal van de kolomkoppen/veldlabels


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


# ---------- Interactiehistorie (activiteit) ----------
class ActiviteitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    leverancier_id: int
    type: str  # mail_verstuurd | reply_ontvangen | data_aangevuld | status_gewijzigd | notificatie
    omschrijving: str
    detail: Optional[str] = None
    aangemaakt_op: datetime


# ---------- Sequences / reminders ----------
class SequenceStapIn(BaseModel):
    volgorde: int = 0
    wachttijd_dagen: int = 7
    actie: str = "mail_versturen"
    conditie: str = "data_ontbreekt"  # altijd | data_ontbreekt | geen_reply
    # optionele eigen mailinhoud; leeg = automatisch genereren bij verzending
    onderwerp: Optional[str] = None
    mailtekst: Optional[str] = None


class SequenceStapOut(SequenceStapIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SequenceBase(BaseModel):
    naam: str
    beschrijving: Optional[str] = None
    trigger_type: str = "leverancier"  # leverancier | wetgeving
    wetgeving_code: Optional[str] = None
    actief: bool = False


class SequenceCreate(SequenceBase):
    stappen: List[SequenceStapIn] = []


class SequenceUpdate(BaseModel):
    naam: Optional[str] = None
    beschrijving: Optional[str] = None
    trigger_type: Optional[str] = None
    wetgeving_code: Optional[str] = None
    actief: Optional[bool] = None
    stappen: Optional[List[SequenceStapIn]] = None  # aanwezig = volledig vervangen


class SequenceInschrijvingOut(BaseModel):
    id: int
    leverancier_id: int
    leverancier_naam: str
    status: str  # actief | voltooid | gestopt
    huidige_stap: int  # aantal doorlopen stappen (= index volgende stap)
    aantal_stappen: int
    aantal_ontbrekend: int
    laatste_actie_op: Optional[datetime] = None
    gestart_op: datetime
    voltooid_op: Optional[datetime] = None


class SequenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    naam: str
    beschrijving: Optional[str] = None
    trigger_type: str
    wetgeving_code: Optional[str] = None
    actief: bool
    aangemaakt_op: datetime
    stappen: List[SequenceStapOut] = []
    aantal_inschrijvingen: int = 0
    aantal_actief: int = 0


class SequenceDetail(SequenceOut):
    inschrijvingen: List[SequenceInschrijvingOut] = []


class SchedulerResultaat(BaseModel):
    tijdstip: str
    aantal_acties: int
    acties: List[dict] = []


# ---------- Sequence mailinhoud (genereren + preview) ----------
class SequenceMailGenereerRequest(BaseModel):
    wetgeving_code: Optional[str] = None  # scope; None = alle wetgeving
    taal: str = "nl"


class SequenceMailPreviewRequest(BaseModel):
    wetgeving_code: Optional[str] = None
    onderwerp: Optional[str] = None  # leeg = automatisch onderwerp
    mailtekst: Optional[str] = None  # leeg = automatisch (AI/sjabloon) genereren
    taal: str = "nl"


class SequenceMailResultaat(BaseModel):
    onderwerp: str
    tekst: str
    leverancier_naam: str  # de leverancier waarop de preview is gebaseerd
    aan_email: Optional[str] = None
    voorbeeld: bool = False  # True = fictief voorbeeld (geen echte kandidaat gevonden)
    ai_gebruikt: bool = False
    ai_fout: Optional[str] = None
    placeholders: List[str] = []  # beschikbare placeholders voor eigen tekst
