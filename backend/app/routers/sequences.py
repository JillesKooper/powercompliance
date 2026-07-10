"""Sequences / reminders: geautomatiseerde mail-cadans naar leveranciers."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, sequence_service
from ..database import get_db

router = APIRouter(prefix="/api/sequences", tags=["sequences"])


# ---------------------------------------------------------------------------
# opbouw van de response-objecten
# ---------------------------------------------------------------------------
def _out(seq: models.Sequence) -> schemas.SequenceOut:
    item = schemas.SequenceOut.model_validate(seq)
    item.aantal_inschrijvingen = len(seq.inschrijvingen)
    item.aantal_actief = sum(1 for i in seq.inschrijvingen if i.status == "actief")
    return item


def _detail(db: Session, seq: models.Sequence) -> schemas.SequenceDetail:
    aantal_stappen = len(seq.stappen)
    inschrijvingen = []
    for i in seq.inschrijvingen:
        lev = i.leverancier
        inschrijvingen.append(
            schemas.SequenceInschrijvingOut(
                id=i.id,
                leverancier_id=i.leverancier_id,
                leverancier_naam=lev.naam if lev else "—",
                status=i.status,
                huidige_stap=i.huidige_stap,
                aantal_stappen=aantal_stappen,
                aantal_ontbrekend=sequence_service.aantal_ontbrekend(db, lev, seq)
                if lev
                else 0,
                laatste_actie_op=i.laatste_actie_op,
                gestart_op=i.gestart_op,
                voltooid_op=i.voltooid_op,
            )
        )
    base = _out(seq)  # SequenceOut met stappen + tellingen
    return schemas.SequenceDetail(
        **base.model_dump(),
        inschrijvingen=sorted(
            inschrijvingen, key=lambda x: (x.status != "actief", x.leverancier_naam)
        ),
    )


def _haal(db: Session, sequence_id: int) -> models.Sequence:
    seq = db.get(models.Sequence, sequence_id)
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence niet gevonden")
    return seq


def _zet_stappen(db: Session, seq: models.Sequence, stappen: List[schemas.SequenceStapIn]):
    """Vervang alle stappen van de sequence."""
    for oud in list(seq.stappen):
        db.delete(oud)
    seq.stappen = []
    db.flush()
    for idx, s in enumerate(sorted(stappen, key=lambda x: x.volgorde)):
        db.add(
            models.SequenceStap(
                sequence_id=seq.id,
                volgorde=idx,
                wachttijd_dagen=max(0, s.wachttijd_dagen),
                actie=s.actie,
                conditie=s.conditie,
            )
        )


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------
@router.get("", response_model=List[schemas.SequenceOut])
def lijst_sequences(db: Session = Depends(get_db)):
    seqs = db.query(models.Sequence).order_by(models.Sequence.aangemaakt_op.desc()).all()
    return [_out(s) for s in seqs]


@router.get("/{sequence_id}", response_model=schemas.SequenceDetail)
def haal_sequence(sequence_id: int, db: Session = Depends(get_db)):
    return _detail(db, _haal(db, sequence_id))


@router.post("", response_model=schemas.SequenceDetail, status_code=201)
def maak_sequence(data: schemas.SequenceCreate, db: Session = Depends(get_db)):
    seq = models.Sequence(
        naam=data.naam,
        beschrijving=data.beschrijving,
        trigger_type=data.trigger_type,
        wetgeving_code=data.wetgeving_code if data.trigger_type == "wetgeving" else None,
        actief=data.actief,
    )
    db.add(seq)
    db.flush()
    _zet_stappen(db, seq, data.stappen)
    db.commit()
    db.refresh(seq)
    if seq.actief:
        sequence_service.synchroniseer_inschrijvingen(db, seq)
        db.commit()
        db.refresh(seq)
    return _detail(db, seq)


@router.put("/{sequence_id}", response_model=schemas.SequenceDetail)
def wijzig_sequence(
    sequence_id: int, data: schemas.SequenceUpdate, db: Session = Depends(get_db)
):
    seq = _haal(db, sequence_id)
    velden = data.model_dump(exclude_unset=True)
    stappen = velden.pop("stappen", None)
    for veld, waarde in velden.items():
        setattr(seq, veld, waarde)
    if seq.trigger_type != "wetgeving":
        seq.wetgeving_code = None
    if stappen is not None:
        _zet_stappen(db, seq, [schemas.SequenceStapIn(**s) for s in stappen])
    db.commit()
    db.refresh(seq)
    if seq.actief:
        sequence_service.synchroniseer_inschrijvingen(db, seq)
        db.commit()
        db.refresh(seq)
    return _detail(db, seq)


@router.post("/{sequence_id}/actief", response_model=schemas.SequenceDetail)
def zet_sequence_actief(
    sequence_id: int, data: schemas.WetgevingActiefRequest, db: Session = Depends(get_db)
):
    """Activeer/deactiveer een sequence (hergebruikt {actief: bool})."""
    seq = _haal(db, sequence_id)
    seq.actief = data.actief
    db.commit()
    db.refresh(seq)
    if seq.actief:
        sequence_service.synchroniseer_inschrijvingen(db, seq)
        db.commit()
        db.refresh(seq)
    return _detail(db, seq)


@router.delete("/{sequence_id}", status_code=204)
def verwijder_sequence(sequence_id: int, db: Session = Depends(get_db)):
    seq = _haal(db, sequence_id)
    db.delete(seq)
    db.commit()
    return None


@router.post("/run-scheduler", response_model=schemas.SchedulerResultaat)
def run_scheduler(db: Session = Depends(get_db)):
    """Draai de dagelijkse sequence-tick nú (handig voor de demo/test)."""
    return sequence_service.tick(db)
