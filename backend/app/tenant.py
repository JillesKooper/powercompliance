"""Multi-tenant kern: request-context + automatische tenant-filtering.

Elke ingelogde gebruiker hoort bij één organisatie (behalve de superadmin). De
middleware (zie main.py) zet per request de organisatie in een ``ContextVar``.
Twee SQLAlchemy-events gebruiken die context om tenant-isolatie af te dwingen
ZONDER dat elke afzonderlijke query aangepast hoeft te worden:

1. ``do_orm_execute``: voegt aan elke SELECT op een tenant-model een
   ``WHERE organisatie_id = <huidige org>`` toe (via ``with_loader_criteria``).
2. ``before_insert``: zet ``organisatie_id`` automatisch op nieuwe rijen.

Is er geen organisatie in de context (superadmin, seed-scripts, opstarten), dan
wordt er NIET gefilterd en NIET automatisch gezet — die code beheert de
organisatie expliciet.
"""
import contextvars
from typing import Optional

from sqlalchemy import event
from sqlalchemy.orm import with_loader_criteria

from . import models

# Per-request context. Standaard "geen organisatie" → geen filtering.
_org_id: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "huidige_org_id", default=None
)
_is_superadmin: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "huidige_is_superadmin", default=False
)


def zet_context(org_id: Optional[int], is_superadmin: bool = False):
    """Zet de tenant-context voor het huidige request; geef reset-tokens terug."""
    return (_org_id.set(org_id), _is_superadmin.set(is_superadmin))


def reset_context(tokens) -> None:
    """Herstel de tenant-context (aan het einde van het request)."""
    org_token, super_token = tokens
    _org_id.reset(org_token)
    _is_superadmin.reset(super_token)


def huidige_org_id() -> Optional[int]:
    return _org_id.get()


def is_superadmin() -> bool:
    return _is_superadmin.get()


_events_geregistreerd = False


def registreer_events(session_factory) -> None:
    """Registreer de tenant-events op de gegeven sessionmaker + tenant-modellen.

    Idempotent: registreert maar één keer per proces, ongeacht via welk
    startpunt (uvicorn/app.main, ``python -m app.seed`` of de demo-reset) de
    functie wordt aangeroepen."""
    global _events_geregistreerd
    if _events_geregistreerd:
        return
    _events_geregistreerd = True

    @event.listens_for(session_factory, "do_orm_execute")
    def _tenant_filter(execute_state):  # noqa: ANN001
        # Alleen SELECT's filteren; kolom-/relatie-refreshes met rust laten.
        if (
            not execute_state.is_select
            or execute_state.is_column_load
            or execute_state.is_relationship_load
        ):
            return
        # Ontsnappingsluik: queries met execution_option skip_tenant=True worden
        # NIET gefilterd (bv. het laden van de ingelogde gebruiker zelf, ook als
        # een superadmin een organisatie impersoneert).
        if execute_state.execution_options.get("skip_tenant"):
            return
        org = _org_id.get()
        if org is None:
            # Superadmin of buiten-request-context: geen tenant-filter.
            return
        for model in models.TENANT_MODELS:
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    model,
                    model.organisatie_id == org,
                    include_aliases=True,
                )
            )

    def _default_org(mapper, connection, target):  # noqa: ANN001
        org = _org_id.get()
        if org is not None and getattr(target, "organisatie_id", None) is None:
            target.organisatie_id = org

    for model in models.TENANT_MODELS:
        event.listen(model, "before_insert", _default_org)
