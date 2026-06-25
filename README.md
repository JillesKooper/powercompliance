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
| **Wetgeving** | EU-regelgeving (PPWR, Batterij, REACH/CLP, CPR, GPSR, ErP) |
| **ComplianceVeld** | Verplicht datapunt onder een wetgeving |
| **ProductComplianceWaarde** | Ingevulde waarde per product/veld (basis voor "ontbrekende data") |
| **Dataverzoek** | Verzoek aan leverancier om ontbrekende data aan te leveren |
| **Notificatie** | Meldingen (bv. aankomende wetgeving) |

Een compliance-veld geldt voor een product als het veld géén categorie heeft
(geldt voor alles) óf de categorie overeenkomt met die van het product.

## Belangrijkste endpoints

- `GET/POST/PUT/DELETE /api/leveranciers` — CRUD leveranciers (met stats)
- `GET/POST/PUT/DELETE /api/producten` — CRUD producten (filters + compliance-%)
- `GET /api/ontbrekende-data` — producten met ontbrekende velden
- `GET /api/wetgeving` — wetgeving incl. compliance-velden
- `GET /api/dashboard` — geaggregeerde KPI's
- `GET /api/categorieen`, `/api/dataverzoeken`, `/api/notificaties`

## Frontend-pagina's

Dashboard · Producten · Leveranciers · Ontbrekende data · Wetgeving · Instellingen
