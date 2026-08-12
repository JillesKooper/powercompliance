import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Laad .env (o.a. ANTHROPIC_API_KEY) voordat routers/modules worden geïmporteerd.
load_dotenv()

from .database import Base, engine
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


_migreer_notificatie_kolommen()
_migreer_wetgeving_kolommen()
_migreer_dataverzoek_kolommen()

app = FastAPI(
    title="PowerCompliance API",
    description="Compliance management platform voor groothandels.",
    version="0.1.0",
)

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
