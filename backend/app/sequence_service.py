"""Sequences / reminders: automatische mail-cadans richting leveranciers.

De ``tick()`` wordt dagelijks door de scheduler aangeroepen (en kan handmatig via
een endpoint worden getriggerd voor de demo). Per actieve sequence:

1. schrijft hij nieuwe, passende leveranciers in (die nog ontbrekende data hebben);
2. rondt hij inschrijvingen af waarvan alle data inmiddels is aangeleverd
   (auto-stop) of waarvan alle stappen zijn doorlopen;
3. voert hij de eerstvolgende stap uit zodra de wachttijd is verstreken en de
   conditie klopt — dat betekent: een echte mail via Gmail SMTP versturen en de
   activiteit op de tijdlijn registreren.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from . import activiteit_service, email_generator, mail_service, models
from .database import SessionLocal


# ---------------------------------------------------------------------------
# hulpfuncties
# ---------------------------------------------------------------------------
def _scope_code(seq: models.Sequence) -> Optional[str]:
    """De wetgeving-scope van de sequence (None = alle wetgeving)."""
    if seq.trigger_type == "wetgeving" and seq.wetgeving_code:
        return seq.wetgeving_code
    return None


def aantal_ontbrekend(db: Session, lev: models.Leverancier, seq: models.Sequence) -> int:
    per_product, _ = email_generator.verzamel_ontbrekend(db, lev, _scope_code(seq))
    return sum(len(velden) for _, velden in per_product)


def _kandidaat_leveranciers(
    db: Session, seq: models.Sequence
) -> List[models.Leverancier]:
    """Leveranciers die op deze sequence van toepassing zijn én nog ontbrekende
    data hebben binnen de scope."""
    leveranciers = db.query(models.Leverancier).all()
    return [lev for lev in leveranciers if aantal_ontbrekend(db, lev, seq) > 0]


def _reply_ontvangen_sinds(db: Session, leverancier_id: int, sinds: datetime) -> bool:
    return (
        db.query(models.LeverancierActiviteit)
        .filter(
            models.LeverancierActiviteit.leverancier_id == leverancier_id,
            models.LeverancierActiviteit.type == activiteit_service.REPLY_ONTVANGEN,
            models.LeverancierActiviteit.aangemaakt_op >= sinds,
        )
        .first()
        is not None
    )


def _conditie_geldt(
    db: Session,
    seq: models.Sequence,
    stap: models.SequenceStap,
    inschrijving: models.SequenceInschrijving,
    ontbrekend: int,
) -> bool:
    if stap.conditie == "altijd":
        return True
    if stap.conditie == "data_ontbreekt":
        return ontbrekend > 0
    if stap.conditie == "geen_reply":
        return not _reply_ontvangen_sinds(db, inschrijving.leverancier_id, inschrijving.gestart_op)
    return True


# ---------------------------------------------------------------------------
# inschrijvingen synchroniseren
# ---------------------------------------------------------------------------
def synchroniseer_inschrijvingen(db: Session, seq: models.Sequence) -> int:
    """Schrijf nieuwe passende leveranciers in. Geeft het aantal nieuwe in."""
    if not seq.actief:
        return 0
    bestaande = {i.leverancier_id for i in seq.inschrijvingen}
    nieuw = 0
    nu = datetime.utcnow()
    for lev in _kandidaat_leveranciers(db, seq):
        if lev.id in bestaande:
            continue
        db.add(
            models.SequenceInschrijving(
                sequence_id=seq.id,
                leverancier_id=lev.id,
                status="actief",
                huidige_stap=0,
                gestart_op=nu,
                laatste_actie_op=nu,
            )
        )
        nieuw += 1
    return nieuw


# ---------------------------------------------------------------------------
# stap uitvoeren (mail versturen + activiteit)
# ---------------------------------------------------------------------------
def _verstuur_stap_mail(
    db: Session,
    seq: models.Sequence,
    stap: models.SequenceStap,
    lev: models.Leverancier,
) -> dict:
    code = _scope_code(seq)
    per_product, per_wet = email_generator.verzamel_ontbrekend(db, lev, code)
    aantal_producten = len(per_product)
    aantal_velden = sum(len(velden) for _, velden in per_product)
    link = email_generator.portaal_link(lev)

    # Eigen, door de beheerder ingestelde mailinhoud heeft voorrang; anders wordt
    # de mail automatisch (AI/sjabloon) gegenereerd. Placeholders worden ingevuld.
    waarden = email_generator.placeholder_waarden(
        lev, per_wet, link, aantal_velden, aantal_producten
    )
    if stap.onderwerp:
        onderwerp = email_generator.render_sjabloon(stap.onderwerp, waarden)
    else:
        onderwerp = email_generator.maak_onderwerp(lev, per_wet, "nl", None)
    if stap.mailtekst:
        tekst = email_generator.render_sjabloon(stap.mailtekst, waarden)
    else:
        tekst, _, _ = email_generator.genereer_tekst(
            lev, per_wet, None, "nl", link, aantal_velden, aantal_producten
        )

    mail = mail_service.verstuur_mail(
        onderwerp=onderwerp,
        tekst=tekst,
        aan_naam=lev.contactpersoon,
        aan_email=lev.email,
    )
    kanaal_tekst = (
        f"Echt verstuurd via Gmail SMTP naar {mail['ontvanger']}."
        if mail["kanaal"] == "gmail" and mail["verzonden"]
        else f"Verzending gesimuleerd ({mail['info']})."
    )
    stapnr = stap.volgorde + 1
    db.add(
        models.Dataverzoek(
            leverancier_id=lev.id,
            onderwerp=onderwerp,
            bericht=f"Automatisch dataverzoek via sequence '{seq.naam}' (stap {stapnr}). {kanaal_tekst}",
            status="verzonden",
        )
    )
    activiteit_service.log_activiteit(
        db,
        lev.id,
        activiteit_service.MAIL_VERSTUURD,
        f"Sequence '{seq.naam}' — stap {stapnr}: dataverzoek verstuurd ({onderwerp})",
        detail=tekst + f"\n\n[{kanaal_tekst}]",
    )
    return {"verzonden": mail["verzonden"], "kanaal": mail["kanaal"], "onderwerp": onderwerp}


# ---------------------------------------------------------------------------
# de dagelijkse tick
# ---------------------------------------------------------------------------
def _verwerk_inschrijving(
    db: Session,
    seq: models.Sequence,
    stappen: List[models.SequenceStap],
    inschrijving: models.SequenceInschrijving,
    nu: datetime,
    negeer_wachttijd: bool = False,
) -> Optional[dict]:
    """Verwerk één inschrijving. Geeft een actie-dict terug of None (niets gedaan).

    Met ``negeer_wachttijd=True`` wordt de eerstvolgende stap direct uitgevoerd
    (voor de knop 'Nu uitvragen').
    """
    if inschrijving.status != "actief":
        return None
    lev = inschrijving.leverancier
    ontbrekend = aantal_ontbrekend(db, lev, seq)

    # auto-stop: alle data aangeleverd
    if ontbrekend == 0:
        inschrijving.status = "voltooid"
        inschrijving.voltooid_op = nu
        return {
            "sequence": seq.naam,
            "leverancier": lev.naam,
            "actie": "voltooid",
            "info": "Alle data aangeleverd — sequence gestopt.",
        }

    # alle stappen doorlopen?
    if inschrijving.huidige_stap >= len(stappen):
        inschrijving.status = "voltooid"
        inschrijving.voltooid_op = nu
        return {
            "sequence": seq.naam,
            "leverancier": lev.naam,
            "actie": "voltooid",
            "info": "Laatste stap doorlopen.",
        }

    stap = stappen[inschrijving.huidige_stap]
    if not negeer_wachttijd:
        due = inschrijving.laatste_actie_op + timedelta(days=stap.wachttijd_dagen)
        if nu < due:
            return None  # wachttijd nog niet verstreken

    stapnr = stap.volgorde + 1
    if not _conditie_geldt(db, seq, stap, inschrijving, ontbrekend):
        inschrijving.huidige_stap += 1
        inschrijving.laatste_actie_op = nu
        return {
            "sequence": seq.naam,
            "leverancier": lev.naam,
            "actie": "overgeslagen",
            "info": f"Stap {stapnr} overgeslagen (conditie '{stap.conditie}').",
        }

    resultaat = _verstuur_stap_mail(db, seq, stap, lev)
    inschrijving.huidige_stap += 1
    inschrijving.laatste_actie_op = nu
    return {
        "sequence": seq.naam,
        "leverancier": lev.naam,
        "actie": "mail_verstuurd",
        "info": (
            f"Stap {stapnr}: {'verzonden via ' + resultaat['kanaal'] if resultaat['verzonden'] else 'gesimuleerd'}"
            f" — {resultaat['onderwerp']}"
        ),
    }


def tick(db: Optional[Session] = None, nu: Optional[datetime] = None) -> dict:
    """Voer alle openstaande sequence-stappen uit die aan de beurt zijn."""
    eigen_sessie = db is None
    if eigen_sessie:
        db = SessionLocal()
    nu = nu or datetime.utcnow()
    acties: List[dict] = []
    try:
        sequences = (
            db.query(models.Sequence).filter(models.Sequence.actief.is_(True)).all()
        )
        for seq in sequences:
            synchroniseer_inschrijvingen(db, seq)
        db.commit()

        for seq in sequences:
            stappen = sorted(seq.stappen, key=lambda s: s.volgorde)
            for inschrijving in seq.inschrijvingen:
                actie = _verwerk_inschrijving(db, seq, stappen, inschrijving, nu)
                if actie:
                    acties.append(actie)

        db.commit()
    finally:
        if eigen_sessie:
            db.close()

    return {"tijdstip": nu.isoformat(), "aantal_acties": len(acties), "acties": acties}


# ---------------------------------------------------------------------------
# mailinhoud: genereren + preview (voor de sequence-editor)
# ---------------------------------------------------------------------------
def genereer_stap_mail(db: Session, wetgeving_code: Optional[str], taal: str = "nl") -> dict:
    """Genereer een herbruikbaar mailsjabloon (onderwerp + tekst met placeholders)
    dat de beheerder als startpunt voor een stap kan gebruiken/aanpassen."""
    onderwerp, tekst, ai_gebruikt, ai_fout = email_generator.genereer_sjabloon(
        wetgeving_code, taal
    )
    lev, _, _, _ = email_generator.voorbeeld_context(db, wetgeving_code)
    return {
        "onderwerp": onderwerp,
        "tekst": tekst,
        "leverancier_naam": lev.naam if lev else "Voorbeeld Leverancier B.V.",
        "aan_email": lev.email if lev else None,
        "voorbeeld": lev is None,
        "ai_gebruikt": ai_gebruikt,
        "ai_fout": ai_fout,
        "placeholders": email_generator.PLACEHOLDERS,
    }


def preview_stap_mail(
    db: Session,
    wetgeving_code: Optional[str],
    onderwerp: Optional[str],
    mailtekst: Optional[str],
    taal: str = "nl",
) -> dict:
    """Render de mail zoals de leverancier hem zou ontvangen, op basis van een
    representatieve leverancier met ontbrekende data. Eigen onderwerp/tekst
    worden met placeholders ingevuld; leeg = automatisch gegenereerd."""
    lev, per_wet, aantal_velden, aantal_producten = email_generator.voorbeeld_context(
        db, wetgeving_code
    )
    link = email_generator.portaal_link(lev) if lev else email_generator.PORTAAL_BASIS + "/0/aanleveren"
    waarden = email_generator.placeholder_waarden(
        lev, per_wet, link, aantal_velden, aantal_producten, taal
    )

    ai_gebruikt, ai_fout = False, None
    if onderwerp:
        onderwerp_uit = email_generator.render_sjabloon(onderwerp, waarden)
    else:
        onderwerp_uit = (
            email_generator.render_sjabloon(
                email_generator._sjabloon_onderwerp(wetgeving_code, taal), waarden
            )
        )
    if mailtekst:
        tekst_uit = email_generator.render_sjabloon(mailtekst, waarden)
    elif lev:
        tekst_uit, ai_gebruikt, ai_fout = email_generator.genereer_tekst(
            lev, per_wet, None, taal, link, aantal_velden, aantal_producten
        )
    else:
        tekst_uit = email_generator.render_sjabloon(
            email_generator._sjabloon_fallback(taal), waarden
        )

    return {
        "onderwerp": onderwerp_uit,
        "tekst": tekst_uit,
        "leverancier_naam": lev.naam if lev else "Voorbeeld Leverancier B.V.",
        "aan_email": lev.email if lev else None,
        "voorbeeld": lev is None,
        "ai_gebruikt": ai_gebruikt,
        "ai_fout": ai_fout,
        "placeholders": email_generator.PLACEHOLDERS,
    }


def voer_sequence_nu_uit(db: Session, seq: models.Sequence, nu: Optional[datetime] = None) -> dict:
    """Zet de sequence direct in gang: stuur nu de eerstvolgende stap naar alle
    actieve leveranciers (wachttijd wordt genegeerd). Activeert de sequence indien nodig."""
    nu = nu or datetime.utcnow()
    if not seq.actief:
        seq.actief = True
    synchroniseer_inschrijvingen(db, seq)
    db.commit()

    stappen = sorted(seq.stappen, key=lambda s: s.volgorde)
    acties: List[dict] = []
    for inschrijving in seq.inschrijvingen:
        actie = _verwerk_inschrijving(
            db, seq, stappen, inschrijving, nu, negeer_wachttijd=True
        )
        if actie:
            acties.append(actie)
    db.commit()
    return {"tijdstip": nu.isoformat(), "aantal_acties": len(acties), "acties": acties}
