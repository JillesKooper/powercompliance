"""APScheduler-integratie: draait de sequence-tick dagelijks.

Faalt het opzetten (bv. APScheduler niet geïnstalleerd), dan blijft de app
gewoon werken; de tick kan dan handmatig via het endpoint worden gedraaid.
"""
import logging

logger = logging.getLogger("powercompliance.scheduler")

_scheduler = None


def _dagelijkse_tick() -> None:
    from . import sequence_service

    try:
        resultaat = sequence_service.tick()
        logger.info("Sequence-tick uitgevoerd: %s acties", resultaat["aantal_acties"])
    except Exception:  # noqa: BLE001 — nooit de scheduler laten crashen
        logger.exception("Sequence-tick mislukt")


def _wetgeving_refresh_tick() -> None:
    """Draai de geplande wetgeving-refresh (dagelijks/wekelijks/maandelijks)."""
    from . import wetgeving_refresh_service
    from .database import SessionLocal

    db = SessionLocal()
    try:
        wetgeving_refresh_service.run_indien_gepland(db)
    except Exception:  # noqa: BLE001 — nooit de scheduler laten crashen
        logger.exception("Geplande wetgeving-refresh mislukt")
    finally:
        db.close()


def start_scheduler() -> None:
    """Start de dagelijkse scheduler (idempotent)."""
    global _scheduler
    if _scheduler is not None:
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler

        _scheduler = BackgroundScheduler(daemon=True, timezone="UTC")
        # elke dag om 08:00 UTC controleren welke stappen aan de beurt zijn
        _scheduler.add_job(
            _dagelijkse_tick,
            trigger="cron",
            hour=8,
            minute=0,
            id="sequences_dagelijks",
            replace_existing=True,
        )
        # dagelijks controleren of de geplande wetgeving-refresh aan de beurt is;
        # de service beslist zelf op basis van frequentie + laatste run.
        _scheduler.add_job(
            _wetgeving_refresh_tick,
            trigger="cron",
            hour=7,
            minute=0,
            id="wetgeving_refresh_dagelijks",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info(
            "Scheduler gestart (sequences 08:00 UTC, wetgeving-refresh 07:00 UTC)."
        )
    except Exception:  # noqa: BLE001
        logger.exception("Kon de scheduler niet starten — tick alleen handmatig.")
        _scheduler = None


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
