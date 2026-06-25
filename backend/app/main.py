from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Laad .env (o.a. ANTHROPIC_API_KEY) voordat routers/modules worden geïmporteerd.
load_dotenv()

from .database import Base, engine
from .routers import leveranciers, producten, overig, imports, email

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PowerCompliance API",
    description="Compliance management platform voor groothandels.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leveranciers.router)
app.include_router(producten.router)
app.include_router(overig.router)
app.include_router(imports.router)
app.include_router(email.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "PowerCompliance"}
