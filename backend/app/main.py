import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Laad .env (o.a. ANTHROPIC_API_KEY) voordat routers/modules worden geïmporteerd.
load_dotenv()

from .database import Base, engine, SessionLocal
from .routers import (
    leveranciers,
    producten,
    overig,
    imports,
    email,
    mail,
    demo,
    sequences,
    export,
    rapportages,
    documenten,
    audit,
    auth,
)
from . import scheduler

Base.metadata.create_all(bind=engine)


def _migreer_notificatie_kolommen():
    """Voeg de i18n-kolommen (sleutel, params) toe aan bestaande databases.

    ``create_all`` maakt alleen ontbrekende TABELLEN aan, geen ontbrekende
    kolommen. Deze idempotente mini-migratie voegt de kolommen toe als ze nog
    niet bestaan, zodat bestaande installaties blijven werken."""
    from sqlalchemy import inspect, text

    try:
        insp = inspect(engine)
        bestaande = {c["name"] for c in insp.get_columns("notificaties")}
    except Exception:
        return
    toe_te_voegen = [c for c in ("sleutel", "params") if c not in bestaande]
    with engine.begin() as conn:
        for kolom in toe_te_voegen:
            try:
                conn.execute(
                    text(f"ALTER TABLE notificaties ADD COLUMN {kolom} VARCHAR")
                )
            except Exception:
                pass


def _migreer_wetgeving_kolommen():
    """Voeg de refresh-kolom toe aan bestaande wetgeving-tabellen (idempotent)."""
    from sqlalchemy import inspect, text

    try:
        insp = inspect(engine)
        bestaande = {c["name"] for c in insp.get_columns("wetgeving")}
    except Exception:
        return
    if "laatst_bijgewerkt_op" in bestaande:
        return
    with engine.begin() as conn:
        try:
            conn.execute(
                text("ALTER TABLE wetgeving ADD COLUMN laatst_bijgewerkt_op DATETIME")
            )
        except Exception:
            pass


def _migreer_dataverzoek_kolommen():
    """Voeg de mail-/reply-kolommen toe aan bestaande dataverzoeken-tabellen.

    ``verzonden_bericht`` bewaart de volledige verstuurde mailtekst en
    ``reply_bericht`` de ontvangen leveranciersreply; beide zijn nodig om het
    dataverzoek-detail te tonen. Idempotent."""
    from sqlalchemy import inspect, text

    try:
        insp = inspect(engine)
        bestaande = {c["name"] for c in insp.get_columns("dataverzoeken")}
    except Exception:
        return
    toe_te_voegen = [
        c for c in ("verzonden_bericht", "reply_bericht") if c not in bestaande
    ]
    with engine.begin() as conn:
        for kolom in toe_te_voegen:
            try:
                conn.execute(
                    text(f"ALTER TABLE dataverzoeken ADD COLUMN {kolom} TEXT")
                )
            except Exception:
                pass


def _migreer_leverancier_kolommen():
    """Voeg de contact-/bedrijfskolommen toe aan bestaande leveranciers-tabellen.

    ``create_all`` maakt alleen ontbrekende TABELLEN aan, geen ontbrekende
    kolommen. Na de uitbreiding van het Leverancier-model (postcode, stad,
    KvK-/BTW-nummer) moet een bestaande database die kolommen alsnog krijgen,
    anders faalt elke query met "no such column: leveranciers.postcode".
    Idempotent: al aanwezige kolommen (bv. telefoon, land) worden overgeslagen."""
    from sqlalchemy import inspect, text

    try:
        insp = inspect(engine)
        bestaande = {c["name"] for c in insp.get_columns("leveranciers")}
    except Exception:
        return
    kolommen = ("postcode", "stad", "land", "telefoon", "kvk_nummer", "btw_nummer")
    toe_te_voegen = [c for c in kolommen if c not in bestaande]
    with engine.begin() as conn:
        for kolom in toe_te_voegen:
            try:
                conn.execute(
                    text(f"ALTER TABLE leveranciers ADD COLUMN {kolom} VARCHAR")
                )
            except Exception:
                pass


def _zorg_admin_gebruiker():
    """Maak bij het opstarten de standaard admin-gebruiker aan (idempotent).

    Zo bestaat er in elke omgeving (ook een verse productie-DB) direct een
    account om mee in te loggen, zonder dat de volledige seed hoeft te draaien."""
    from . import auth_service

    db = SessionLocal()
    try:
        auth_service.zorg_admin_gebruiker(db)
    except Exception:
        pass
    finally:
        db.close()


_migreer_notificatie_kolommen()
_migreer_wetgeving_kolommen()
_migreer_dataverzoek_kolommen()
_migreer_leverancier_kolommen()
_zorg_admin_gebruiker()

app = FastAPI(
    title="PowerCompliance API",
    description="Compliance management platform voor groothandels.",
    version="0.1.0",
)

# Paden die zonder JWT-token bereikbaar blijven: inloggen, de seed-endpoint en
# de health-check. OPTIONS-verzoeken (CORS-preflight) en de API-docs blijven ook
# vrij toegankelijk.
PUBLIEKE_PADEN = {"/api/auth/login", "/api/seed", "/api/health"}
PUBLIEKE_PREFIXEN = ("/docs", "/redoc", "/openapi.json")


@app.middleware("http")
async def vereis_authenticatie(request: Request, call_next):
    """Beveilig alle /api-endpoints: zonder geldig JWT-token → 401.

    Uitzonderingen: de publieke paden hierboven en CORS-preflight (OPTIONS).
    Deze middleware wordt vóór de CORS-middleware geregistreerd, zodat CORS de
    buitenste laag blijft en ook 401-antwoorden de juiste CORS-headers krijgen."""
    pad = request.url.path
    vrij = (
        request.method == "OPTIONS"
        or pad in PUBLIEKE_PADEN
        or not pad.startswith("/api")
        or any(pad.startswith(p) for p in PUBLIEKE_PREFIXEN)
    )
    if not vrij:
        from . import auth_service

        auth_header = request.headers.get("Authorization", "")
        token = (
            auth_header[7:].strip()
            if auth_header.lower().startswith("bearer ")
            else None
        )
        if not token or not auth_service.decodeer_token(token):
            return JSONResponse(
                status_code=401,
                content={"detail": "Niet geautoriseerd"},
                headers={"WWW-Authenticate": "Bearer"},
            )
    return await call_next(request)


# Lokale dev-origins plus optioneel de gedeployde frontend via FRONTEND_URL.
# FRONTEND_URL mag een komma-gescheiden lijst zijn (meerdere domeinen).
allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
frontend_url = os.getenv("FRONTEND_URL", "").strip()
if frontend_url:
    allowed_origins.extend(
        origin.strip() for origin in frontend_url.split(",") if origin.strip()
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Nodig zodat de frontend bij downloads (cross-origin) de bestandsnaam en het
    # aantal-header kan uitlezen.
    expose_headers=["Content-Disposition", "X-Export-Aantal"],
)

app.include_router(auth.router)
app.include_router(leveranciers.router)
app.include_router(producten.router)
app.include_router(overig.router)
app.include_router(imports.router)
app.include_router(email.router)
app.include_router(mail.router)
app.include_router(demo.router)
app.include_router(sequences.router)
app.include_router(export.router)
app.include_router(rapportages.router)
app.include_router(documenten.router)
app.include_router(audit.router)


@app.on_event("startup")
def _start_scheduler():
    # Dagelijkse sequence-scheduler starten (faalt stil als APScheduler ontbreekt).
    scheduler.start_scheduler()


@app.on_event("shutdown")
def _stop_scheduler():
    scheduler.shutdown_scheduler()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "PowerCompliance"}
