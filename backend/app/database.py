import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Database-URL is configureerbaar via DATABASE_URL (bv. voor een externe DB in
# de cloud). Zonder die variabele gebruiken we een lokaal SQLite-bestand; als de
# projectmap niet schrijfbaar is (sommige cloud-omgevingen), valt hij terug op
# /tmp zodat de app altijd kan opstarten.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    default_path = os.path.join(os.getcwd(), "powercompliance.db")
    if not os.access(os.path.dirname(default_path) or ".", os.W_OK):
        default_path = "/tmp/powercompliance.db"
    DATABASE_URL = f"sqlite:///{default_path}"

SQLALCHEMY_DATABASE_URL = DATABASE_URL

connect_args = (
    {"check_same_thread": False}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {}
)
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
