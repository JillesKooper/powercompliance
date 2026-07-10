"""Inkomende mailverwerking: ontvang (of simuleer) een leveranciersreply en vul
de ontbrekende compliance-velden automatisch aan met behulp van AI."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import activiteit_service, mail_service, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/mail", tags=["mail"])


def _haal_leverancier(db: Session, leverancier_id: int) -> models.Leverancier:
    lev = db.get(models.Leverancier, leverancier_id)
    if not lev:
        raise HTTPException(status_code=404, detail="Leverancier niet gevonden")
    return lev


def _markeer_dataverzoeken_ontvangen(db: Session, leverancier_id: int) -> None:
    """Zet lopende dataverzoeken van deze leverancier op 'afgerond'."""
    (
        db.query(models.Dataverzoek)
        .filter(
            models.Dataverzoek.leverancier_id == leverancier_id,
            models.Dataverzoek.status.in_(["open", "verzonden"]),
        )
        .update({models.Dataverzoek.status: "afgerond"}, synchronize_session=False)
    )


def _verwerk_en_registreer(
    db: Session,
    lev: models.Leverancier,
    reply_tekst: str,
    wetgeving_code=None,
) -> schemas.MailVerwerktResultaat:
    resultaat = mail_service.verwerk_reply(db, lev, reply_tekst, wetgeving_code)

    # Reply-ontvangst altijd op de tijdlijn zetten (ook als er 0 velden matchten).
    activiteit_service.log_activiteit(
        db,
        lev.id,
        activiteit_service.REPLY_ONTVANGEN,
        f"Reply ontvangen van {lev.naam}",
        detail=reply_tekst,
    )

    if resultaat["aantal_ingevuld"] > 0:
        _markeer_dataverzoeken_ontvangen(db, lev.id)
        db.add(
            models.Notificatie(
                titel=f"Reply verwerkt van {lev.naam}",
                bericht=(
                    f"{resultaat['aantal_ingevuld']} velden automatisch aangevuld "
                    f"over {resultaat['aantal_producten']} producten "
                    + ("(AI-parsing)" if resultaat["ai_gebruikt"] else "(regel-parser)")
                ),
                type="succes",
                categorie="Nieuwe data ontvangen",
                entiteit_type="leverancier",
                entiteit_id=lev.id,
            )
        )
        detail = "\n".join(
            f"• [{v['product_naam']}] {v['veld_naam']} = {v['waarde']}"
            for v in resultaat["velden"]
        )
        activiteit_service.log_activiteit(
            db,
            lev.id,
            activiteit_service.DATA_AANGEVULD,
            (
                f"{resultaat['aantal_ingevuld']} velden aangevuld over "
                f"{resultaat['aantal_producten']} producten "
                + ("(AI-parsing)" if resultaat["ai_gebruikt"] else "(regel-parser)")
            ),
            detail=detail,
        )

    db.commit()

    return schemas.MailVerwerktResultaat(
        leverancier_id=lev.id,
        reply_tekst=reply_tekst,
        aantal_ingevuld=resultaat["aantal_ingevuld"],
        aantal_producten=resultaat["aantal_producten"],
        velden=[schemas.MailVerwerktVeld(**v) for v in resultaat["velden"]],
        ai_gebruikt=resultaat["ai_gebruikt"],
        ai_fout=resultaat["ai_fout"],
    )


@router.post("/inbound", response_model=schemas.MailVerwerktResultaat)
def inbound_mail(data: schemas.MailInboundRequest, db: Session = Depends(get_db)):
    """Ontvang een inkomende reply (platte tekst) en verwerk de aangeleverde data.

    Dit endpoint bootst een inbound-mailwebhook na: stuur de platte tekst van de
    reply mee en de AI koppelt de waarden aan de ontbrekende compliance-velden.
    """
    lev = _haal_leverancier(db, data.leverancier_id)
    return _verwerk_en_registreer(db, lev, data.tekst, data.wetgeving_code)


@router.post("/simuleer-reply", response_model=schemas.MailVerwerktResultaat)
def simuleer_reply(data: schemas.SimuleerReplyRequest, db: Session = Depends(get_db)):
    """Genereer een realistische leveranciersreply en verwerk die direct.

    Handig voor de demo: één klik levert een platte-tekst reply met de
    ontbrekende waarden op, die vervolgens door de AI wordt geparseerd.
    """
    lev = _haal_leverancier(db, data.leverancier_id)
    reply_tekst, kandidaten = mail_service.genereer_reply_tekst(
        db, lev, data.wetgeving_code
    )
    if not kandidaten:
        raise HTTPException(
            status_code=409,
            detail="Deze leverancier heeft geen ontbrekende data om aan te leveren.",
        )
    return _verwerk_en_registreer(db, lev, reply_tekst, data.wetgeving_code)
