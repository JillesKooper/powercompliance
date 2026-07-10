# PowerCompliance

Compliance management platform voor groothandels. Geeft inzicht in welke
productdata ontbreekt per leverancier, gekoppeld aan EU-wetgeving zoals **PPWR**,
de **Batterijverordening**, **REACH/CLP**, **CPR**, **GPSR** en **ErP**.

Monorepo:

```
compliancehub/
├── backend/    FastAPI + SQLAlchemy + SQLite
└── frontend/   React + Vite + Tailwind CSS
```

## Snel starten

### Backend (poort 8000)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed          # vult de database met voorbeelddata
uvicorn app.main:app --reload --port 8000
```

API-docs: http://localhost:8000/docs

### Frontend (poort 5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — de Vite-dev-server proxyt `/api` naar de backend.

## Datamodel

| Entiteit | Beschrijving |
|---|---|
| **Leverancier** | Toeleverancier met contactgegevens |
| **Product** | Artikel, gekoppeld aan leverancier + categorie |
| **Categorie** | Productcategorie (bepaalt welke velden van toepassing zijn) |
| **Wetgeving** | EU-regelgeving (PPWR, CSRD, Batterij, REACH/CLP, CPR, GPSR, ErP, EUDR, Textiel, Speelgoed, MDR, Cosmetica) — met `actief`-toggle en gekoppelde categorieën |
| **ComplianceVeld** | Verplicht datapunt onder een wetgeving |
| **ProductComplianceWaarde** | Ingevulde waarde per product/veld (basis voor "ontbrekende data") |
| **Dataverzoek** | Verzoek aan leverancier om ontbrekende data aan te leveren |
| **Notificatie** | Meldingen (bv. aankomende wetgeving) |

Welke wetgeving op een product van toepassing is, wordt **automatisch bepaald op
basis van de categorie** van het product (wetgeving↔categorie-koppeling). Alleen
**actieve** wetgeving telt mee in compliance-berekeningen en dataverzoeken. Een
compliance-veld van een relevante, actieve wetgeving geldt voor het product.

## Schaalbaarheid

- **Paginering** op de lijst-endpoints (producten, leveranciers, dataverzoeken),
  standaard 50 per pagina (`?page=&per_page=`), met een paginerings-UI.
- **Database-indexen** op veelgebruikte velden (`leverancier_id`, `categorie_id`,
  `ean`, `compliance_status`, dataverzoek-`status`).
- **Asynchrone compliance-berekening** via FastAPI `BackgroundTasks`: de
  compliance-score per product wordt gedenormaliseerd opgeslagen en op de
  achtergrond herberekend, zodat lijsten en dashboard niet bij elke request
  alles herberekenen.
- **Dashboard-cache**: statistieken worden gecachet en alleen herberekend als er
  iets wijzigt (producten, waarden, dataverzoeken, wetgeving-toggle).
- **Bulk-dataverzoeken**: `POST /api/dataverzoeken/bulk` maakt in één keer
  dataverzoeken aan voor meerdere geselecteerde leveranciers (knop op de
  Leveranciers-pagina).

## Automatisch scrapen van ontbrekende data

Heeft een product ontbrekende velden, dan kan een scrape-taak worden gestart
(automatisch bij aanmaken, of via de knop **🔎 Scrape ontbrekende data** op de
productdetailpagina). De scraper doorzoekt in volgorde: **GS1 → Open Food Facts
(voedsel) → fabrikantwebsite → DuckDuckGo**, en laat de Anthropic API
(`claude-sonnet-4-6`) de gevonden tekst interpreteren.

- Gevonden waarden krijgen bron **"automatisch"** + een twijfelachtig-vlag en
  tellen pas mee na verificatie. Op de productdetailpagina toont elk veld of de
  waarde **handmatig**, **automatisch gevonden**, **niet online gevonden** of nog
  **ontbreekt**, met de bron-URL. Per automatische waarde is er een knop
  **Verifieer**.
- Levert het scrapen niets op, dan wordt het veld op **"niet gevonden online"**
  gezet en wordt automatisch een dataverzoek naar de leverancier aangemaakt.

> Zonder netwerk/API-sleutel falen de bronnen stil → velden worden
> "niet gevonden online" en er wordt een dataverzoek gegenereerd (de
> gespecificeerde degradatie).

## Wetgevingsinformatie

Elke wetgeving heeft een **korte NL-samenvatting** (zichtbaar op de
wetgevingspagina zonder doorklikken) en een knop **Officiële tekst →** die de
officiële EUR-Lex-bron in een nieuw tabblad opent.

## Wetgevingsbeheer (instellingen)

Op **Instellingen** staat een beheeroverzicht van alle wetgeving met een
aan/uit-toggle. Per wetgeving zie je hoeveel producten eronder vallen en de
huidige compliance-score. Wetgeving staat standaard AAN als er producten onder
vallen (anders uit, bv. Speelgoed/MDR/Cosmetica zonder producten). Uitgezette
wetgeving wordt genegeerd in alle compliance-berekeningen, het dashboard en
dataverzoeken.

## Belangrijkste endpoints

- `GET/POST/PUT/DELETE /api/leveranciers` — CRUD leveranciers (met stats)
- `GET/POST/PUT/DELETE /api/producten` — CRUD producten (filters + compliance-%)
- `GET /api/producten/{id}/compliance` — alle velden van een product met ingevuld/ontbreekt
- `GET /api/ontbrekende-data` — producten met ontbrekende velden
- `GET /api/wetgeving` — wetgeving incl. compliance-velden
- `GET /api/dashboard` — geaggregeerde KPI's
- `GET /api/categorieen`, `/api/dataverzoeken`, `/api/notificaties`
- `POST /api/notificaties/{id}/gelezen` en `POST /api/notificaties/gelezen-alles` — markeer als gelezen
- `POST /api/import/producten` — CSV/Excel-import producten (multipart)
- `POST /api/import/leveranciers` — CSV/Excel-import leveranciers (multipart)
- `POST /api/email/genereer` — genereer dataverzoek-mail (AI, claude-sonnet-4-6); optioneel `wetgeving_code` om gericht per wetgeving uit te vragen
- `GET /api/email/bijlage/{leverancier_id}?wetgeving=CODE` — Excel met ontbrekende velden (optioneel gescoped)
- `POST /api/email/verstuur` — verstuur het dataverzoek als **échte e-mail via Gmail SMTP** (valt terug op gesimuleerde verzending zonder inloggegevens) en registreer het
- `GET /api/email/uitvraag-wetgeving/{code}/leveranciers` — leveranciers met ontbrekende data voor een wetgeving
- `POST /api/email/uitvraag-wetgeving` — stuur in één keer een dataverzoek naar alle (of geselecteerde) leveranciers voor die wetgeving
- `POST /api/mail/inbound` — ontvang een inkomende reply (platte tekst); de AI parseert de waarden en vult de ontbrekende velden automatisch aan
- `POST /api/mail/simuleer-reply` — genereer én verwerk in één klik een realistische leveranciersreply (voor de demo)
- `GET /api/demo/status` — status van de demo-flow (gekozen leverancier + voor/na-compliance)
- `POST /api/demo/reset` — verwijder de via reply verrijkte waarden zodat de demo opnieuw kan draaien

## E-mailgeneratie (dataverzoeken)

Op **Ontbrekende data** zit per leverancier een knop **✉️ E-mail genereren**. De
modal toont:

- **Aan** (contactpersoon + e-mailadres) en **CC** `compliance@uwbedrijf.nl`
- **Onderwerp** — automatisch ingevuld (bewerkbaar)
- **Bijlage** — automatisch gegenereerde Excel met de ontbrekende velden
- **Mailtekst** — gegenereerd via de **Anthropic API** (`claude-sonnet-4-6`) op
  basis van de ontbrekende velden en wetgeving van die leverancier
- **Taalkeuze** Nederlands / Engels en een **deadline**-datumkiezer

De mail biedt de leverancier twee aanlevermethodes: (1) reply met de data als
platte tekst, of (2) upload via een portaallink. Knoppen: **Hergenereer met AI**,
**Kopieer**, **Verstuur**.

Er zijn drie ingangen:

- **Ontbrekende data** — knop **✉️ E-mail genereren** per leverancier voor álle
  ontbrekende data in één mail.
- **Productdetail** — per wetgeving een knop **✉️ Uitvragen bij leverancier**, om
  gericht alleen de ontbrekende velden van die wetgeving uit te vragen.
- **Wetgeving** — per wetgeving een knop **✉️ Uitvragen**, die in één keer alle
  betrokken leveranciers (met selectie) een dataverzoek stuurt. Het onderwerp
  bevat automatisch leverancier + wetgeving + deadline.

### Anthropic API-sleutel

Zet je sleutel in `backend/.env` (zie `backend/.env.example`):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Zonder sleutel werkt de functie nog steeds: de mailtekst valt dan terug op een
nette sjabloontekst (de modal toont dat met "Sjabloon gebruikt").

## E-mail demo-flow (Gmail SMTP + reply-verwerking)

De volledige demo laat zien hoe een dataverzoek écht de deur uit gaat en hoe een
leveranciersreply automatisch verwerkt wordt.

1. **Echte e-mails via Gmail SMTP** — bij **Verstuur** gaat het dataverzoek als
   echte e-mail via Gmail (`smtp.gmail.com:587`, STARTTLS, Python's ingebouwde
   `smtplib`). Met een optioneel **demo-adres** (`DEMO_EMAIL`) gaan alle mails
   daarheen. Zonder Gmail-inloggegevens wordt de verzending gesimuleerd, zodat de
   demo altijd werkt.
2. **Reply-verwerking** — met **📥 Simuleer leverancier reply** (op *Ontbrekende
   data*) komt er een platte-tekst reply binnen via `POST /api/mail/inbound`. De
   **Anthropic API** (`claude-sonnet-4-6`) parseert de reply en vult de
   ontbrekende velden automatisch aan (met een robuuste regel-parser als
   fallback).
3. **Voor/Na-vergelijking** — op **Productdetail** verschijnt een **Voor/Na**-
   schakelaar: *Voor* toont de ontbrekende velden rood, *Na* toont ze groen
   ingevuld, met een geanimeerde overgang van de compliance-score.
4. **Demo-modus** — op het **Dashboard** doorloopt **▶ Start demo** de hele flow
   automatisch (mail → reply → AI-verrijking → score omhoog) met een
   voortgangsindicator per stap.

### Gmail SMTP-configuratie

Zet in `backend/.env` (zie `backend/.env.example`):

```
GMAIL_USER=jouw.adres@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx        # Gmail app-wachtwoord (16 tekens), NIET je gewone wachtwoord
MAIL_FROM_NAAM=PowerCompliance
DEMO_EMAIL=jij@voorbeeld.nl                # optioneel: alle demo-mails gaan hierheen
```

Een app-wachtwoord maak je aan via **Google-account → Beveiliging → 2-staps­verificatie
→ App-wachtwoorden** (2-staps­verificatie moet aan staan).

## Notificaties

Notificaties op het **Dashboard** zijn klikbaar en openen een modal met de
volledige inhoud, datum & tijd, het type/de categorie (bv. "Deadline nadert",
"Nieuwe data ontvangen", "Twijfelachtige waarde") en — indien gekoppeld — de
gerelateerde entiteit: een **product** → productdetail, **leverancier** →
leveranciersdetail, of **dataverzoek** → ontbrekende-data-pagina. De modal heeft
knoppen **Markeer als gelezen** en **Ga naar**. Ongelezen notificaties hebben een
vet lettertype + bolletje, en de **sidebar toont een teller** naast Dashboard.

## Frontend-pagina's

Dashboard · Producten · Leveranciers · Ontbrekende data · Wetgeving · Instellingen
Detailpagina's: `/#/producten/:id` en `/#/leveranciers/:id` (klik op een naam).

## Import (CSV / Excel)

Op **Producten** en **Leveranciers** zit een knop **⬆ Importeren** met een
drag-and-drop-zone én bestandskiezer. Ondersteund: `.csv` en `.xlsx`.

- **Automatische kolomherkenning** — headers worden genormaliseerd en gematcht
  op synoniemen (bv. `Company`/`Bedrijf` → naam, `SKU`/`Artikelnr` →
  artikelnummer). Ontbrekende verplichte kolommen geven een foutmelding
  (product: `Naam` + `Leverancier`; leverancier: `Naam`).
- **Compliance-analyse na import** — extra kolommen die overeenkomen met een
  compliance-veld (bv. `Verpakkingsmateriaal`) worden automatisch ingevuld.
  Elk product wordt via zijn categorie aan de juiste wetgeving gekoppeld en er
  wordt bepaald of het compliant is of data mist.
- **Importoverzicht** — na afloop: aantal geïmporteerd / compliant / met
  ontbrekende data, de herkende kolommen en overgeslagen rijen, met een knop
  direct door naar **Ontbrekende data**.
