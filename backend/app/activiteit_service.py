"""Interactiehistorie: leg activiteiten per leverancier vast op de tijdlijn.

``log_activiteit`` voegt een rij toe aan de sessie maar commit NIET zelf — de
aanroeper commit samen met de rest van zijn wijzigingen. Zo blijft alles binnen
één transactie en registreren we niets als de omliggende actie faalt.
"""
from typing import Optional

from sqlalchemy.orm import Session

from . import models

# Types (voor consistente filtering/iconen in de frontend)
MAIL_VERSTUURD = "mail_verstuurd"
REPLY_ONTVANGEN = "reply_ontvangen"
DATA_AANGEVULD = "data_aangevuld"
STATUS_GEWIJZIGD = "status_gewijzigd"
NOTIFICATIE = "notificatie"


def log_activiteit(
    db: Session,
    leverancier_id: int,
    type: str,
    omschrijving: str,
    detail: Optional[str] = None,
) -> models.LeverancierActiviteit:
    """Voeg een activiteit toe aan de sessie (zonder commit)."""
    activiteit = models.LeverancierActiviteit(
        leverancier_id=leverancier_id,
        type=type,
        omschrijving=omschrijving,
        detail=detail,
    )
    db.add(activiteit)
    return activiteit
