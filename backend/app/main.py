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
    gebruikers,
    superadmin,
)
from . import scheduler, models, tenant

Base.metadata.create_all(bind=engine)

# Registreer de multi-tenant events (automatische filtering + insert-defaulting).
tenant.registreer_events(SessionLocal)


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


# Tenant-tabellen die een ``organisatie_id``-kolom (moeten) hebben.
_TENANT_TABELLEN = [
    "leveranciers",
    "producten",
    "wetgeving",
    "compliance_velden",
    "product_compliance_waarden",
    "dataverzoeken",
    "dataverzoek_regels",
    "product_documenten",
    "export_logs",
    "webhook_abonnementen",
    "notificaties",
    "leverancier_activiteiten",
    "sequences",
    "sequence_stappen",
    "sequence_inschrijvingen",
    "audit_logs",
]


def _migreer_multitenant():
    """Migreer een bestaande database naar de multi-tenant structuur (idempotent).

    - Voegt ``organisatie_id`` toe aan alle tenant-tabellen die het nog missen.
    - Voegt de nieuwe gebruikers-kolommen toe (rol/uitnodiging/laatste_login/…).
    - Maakt de standaard "Demo Organisatie" aan en koppelt alle bestaande data
      (en bestaande gebruikers) daaraan, zodat niets "org-loos" achterblijft.
    - Zorgt voor de standaardgebruikers (superadmin + owner).

    Draait bij het opstarten buiten elke request/tenant-context, dus zonder
    automatische filtering."""
    from sqlalchemy import inspect, text
    from . import auth_service

    try:
        insp = inspect(engine)
        tabellen = set(insp.get_table_names())
    except Exception:
        return

    # 1. Ontbrekende kolommen toevoegen (SQLite: ADD COLUMN is niet-blokkerend).
    with engine.begin() as conn:
        for tabel in _TENANT_TABELLEN:
            if tabel not in tabellen:
                continue
            cols = {c["name"] for c in insp.get_columns(tabel)}
            if "organisatie_id" not in cols:
                try:
                    conn.execute(
                        text(f"ALTER TABLE {tabel} ADD COLUMN organisatie_id INTEGER")
                    )
                except Exception:
                    pass
        if "gebruikers" in tabellen:
            gcols = {c["name"] for c in insp.get_columns("gebruikers")}
            nieuw = {
                "organisatie_id": "INTEGER",
                "actief": "BOOLEAN",
                "uitgenodigd_door": "INTEGER",
                "laatste_login": "DATETIME",
                "uitnodiging_token": "VARCHAR",
                "uitnodiging_verloopt": "DATETIME",
            }
            for kolom, typ in nieuw.items():
                if kolom not in gcols:
                    try:
                        conn.execute(
                            text(f"ALTER TABLE gebruikers ADD COLUMN {kolom} {typ}")
                        )
                    except Exception:
                        pass

    # 2. Demo-organisatie + backfill van bestaande rijen.
    db = SessionLocal()
    try:
        demo = (
            db.query(models.Organisatie)
            .filter(models.Organisatie.slug == "demo")
            .first()
        )
        if not demo:
            demo = models.Organisatie(
                naam="Demo Organisatie", slug="demo", actief=True, max_producten=1000
            )
            db.add(demo)
            db.commit()

        with engine.begin() as conn:
            for tabel in _TENANT_TABELLEN:
                if tabel in tabellen:
                    try:
                        conn.execute(
                            text(
                                f"UPDATE {tabel} SET organisatie_id = :o "
                                "WHERE organisatie_id IS NULL"
                            ),
                            {"o": demo.id},
                        )
                    except Exception:
                        pass
            # Bestaande gebruikers activeren + aan de demo-org koppelen (behalve de
            # superadmin), en de oude "admin"-rol promoveren tot org-owner.
            try:
                conn.execute(text("UPDATE gebruikers SET actief = 1 WHERE actief IS NULL"))
                conn.execute(
                    text(
                        "UPDATE gebruikers SET organisatie_id = :o "
                        "WHERE organisatie_id IS NULL "
                        "AND email <> 'superadmin@powercompliance.nl'"
                    ),
                    {"o": demo.id},
                )
                conn.execute(
                    text(
                        "UPDATE gebruikers SET rol = 'owner' "
                        "WHERE email = 'admin@powercompliance.nl' AND rol = 'admin'"
                    )
                )
            except Exception:
                pass

        # 3. Standaardgebruikers borgen (superadmin + owner).
        auth_service.zorg_standaard_data(db)
    except Exception:
        pass
    finally:
        db.close()


_migreer_notificatie_kolommen()
_migreer_wetgeving_kolommen()
_migreer_dataverzoek_kolommen()
_migreer_leverancier_kolommen()
_migreer_multitenant()

app = FastAPI(
    title="PowerCompliance API",
    description="Compliance management platform voor groothandels.",
    version="0.1.0",
)

# Paden die zonder JWT-token bereikbaar blijven: inloggen, de seed-endpoint en
# de health-check. OPTIONS-verzoeken (CORS-preflight) en de API-docs blijven ook
# vrij toegankelijk.
PUBLIEKE_PADEN = {"/api/auth/login", "/api/seed", "/api/health"}
# Prefix-gebaseerde publieke paden: de API-docs en de uitnodigingsflow (het
# valideren/accepteren van een uitnodiging gebeurt vóór het inloggen).
PUBLIEKE_PREFIXEN = (
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/auth/uitnodiging",
)


class TenantMiddleware:
    """Beveiligt /api-endpoints én zet per request de tenant-context.

    Dit is een *pure ASGI*-middleware (geen BaseHTTPMiddleware): zo draait de
    downstream-app in dezelfde context, waardoor de ``ContextVar`` met de
    organisatie betrouwbaar doorwerkt tot in de (sync) endpoints — ook die in de
    threadpool. Zonder geldig token op een beveiligd pad → 401.

    Wordt vóór de CORS-middleware geregistreerd zodat CORS de buitenste laag
    blijft en ook 401-antwoorden de juiste CORS-headers krijgen."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        from starlette.requests import Request
        from . import auth_service

        request = Request(scope)
        pad = scope.get("path", "")
        method = scope.get("method", "GET")
        vrij = (
            method == "OPTIONS"
            or pad in PUBLIEKE_PADEN
            or not pad.startswith("/api")
            or any(pad.startswith(p) for p in PUBLIEKE_PREFIXEN)
        )

        payload = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            payload = auth_service.decodeer_token(auth_header[7:].strip())

        if not vrij and not payload:
            resp = JSONResponse(
                status_code=401,
                content={"detail": "Niet geautoriseerd"},
                headers={"WWW-Authenticate": "Bearer"},
            )
            await resp(scope, receive, send)
            return

        org_id = None
        is_super = False
        if payload:
            is_super = payload.get("rol") == "superadmin"
            org_id = payload.get("organisatie_id")

        tokens = tenant.zet_context(org_id, is_super)
        try:
            await self.app(scope, receive, send)
        finally:
            tenant.reset_context(tokens)


app.add_middleware(TenantMiddleware)


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
app.include_router(gebruikers.router)
app.include_router(superadmin.router)
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
