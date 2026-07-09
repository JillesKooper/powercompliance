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
    export,
    rapportages,
    documenten,
)

Base.metadata.create_all(bind=engine)

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
)

app.include_router(leveranciers.router)
app.include_router(producten.router)
app.include_router(overig.router)
app.include_router(imports.router)
app.include_router(email.router)
app.include_router(export.router)
app.include_router(rapportages.router)
app.include_router(documenten.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "PowerCompliance"}
