import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Badge, Button, Loading, ErrorBox } from "../components/ui";

const CONDITIES = {
  data_ontbreekt: "alleen als data nog ontbreekt",
  geen_reply: "alleen als geen reply ontvangen",
  altijd: "altijd",
};

export default function Sequences() {
  const [items, setItems] = useState(null);
  const [wetgeving, setWetgeving] = useState([]);
  const [error, setError] = useState(null);
  const [bewerken, setBewerken] = useState(null); // sequence-object of {} voor nieuw
  const [schedulerResultaat, setSchedulerResultaat] = useState(null);
  const [schedulerBezig, setSchedulerBezig] = useState(false);

  function laad() {
    api.sequences().then(setItems).catch((e) => setError(e.message));
  }

  useEffect(() => {
    laad();
    api.wetgeving().then(setWetgeving).catch(() => {});
  }, []);

  async function runScheduler() {
    setSchedulerBezig(true);
    setSchedulerResultaat(null);
    try {
      const r = await api.runScheduler();
      setSchedulerResultaat(r);
      laad();
    } catch (e) {
      setError(e.message);
    } finally {
      setSchedulerBezig(false);
    }
  }

  async function toggle(seq) {
    await api.zetSequenceActief(seq.id, !seq.actief);
    laad();
  }

  async function verwijder(seq) {
    if (!window.confirm(`Sequence "${seq.naam}" verwijderen?`)) return;
    await api.verwijderSequence(seq.id);
    laad();
  }

  if (error) return <ErrorBox message={error} />;
  if (!items) return <Loading />;

  return (
    <div className="space-y-6">
      {bewerken && (
        <SequenceModal
          sequence={bewerken}
          wetgeving={wetgeving}
          onClose={() => setBewerken(null)}
          onOpgeslagen={() => {
            setBewerken(null);
            laad();
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 max-w-2xl">
          Geautomatiseerde herinneringsreeksen. Een sequence stuurt op vaste
          intervallen dataverzoeken en stopt zodra alle data is aangeleverd. De
          scheduler draait dagelijks; met “Scheduler nu draaien” voer je hem meteen uit.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" onClick={runScheduler} disabled={schedulerBezig}>
            {schedulerBezig ? "Bezig…" : "▶ Scheduler nu draaien"}
          </Button>
          <Button onClick={() => setBewerken({})}>+ Nieuwe sequence</Button>
        </div>
      </div>

      {schedulerResultaat && (
        <div className="rounded-lg bg-brand-50 border border-brand-100 text-brand-800 px-4 py-3 text-sm">
          <div className="font-medium">
            Scheduler uitgevoerd — {schedulerResultaat.aantal_acties} actie(s).
          </div>
          {schedulerResultaat.acties.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-brand-700/90 max-h-40 overflow-auto">
              {schedulerResultaat.acties.map((a, i) => (
                <li key={i}>
                  • <span className="font-medium">{a.leverancier}</span> — {a.info}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          Nog geen sequences. Maak er één aan om automatische herinneringen te sturen.
        </Card>
      ) : (
        items.map((seq) => (
          <SequenceKaart
            key={seq.id}
            seq={seq}
            onToggle={() => toggle(seq)}
            onBewerk={() => setBewerken(seq)}
            onVerwijder={() => verwijder(seq)}
          />
        ))
      )}
    </div>
  );
}

function SequenceKaart({ seq, onToggle, onBewerk, onVerwijder }) {
  const [detail, setDetail] = useState(null);
  const [open, setOpen] = useState(false);

  async function toggleOpen() {
    if (!open && !detail) {
      const d = await api.sequence(seq.id);
      setDetail(d);
    }
    setOpen((o) => !o);
  }

  const inschrijvingen = detail?.inschrijvingen || [];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800">{seq.naam}</span>
            {seq.actief ? (
              <Badge color="green">Actief</Badge>
            ) : (
              <Badge color="slate">Inactief</Badge>
            )}
            {seq.trigger_type === "wetgeving" ? (
              <Badge color="blue">⚖️ {seq.wetgeving_code || "wetgeving"}</Badge>
            ) : (
              <Badge color="blue">🏭 per leverancier</Badge>
            )}
          </div>
          {seq.beschrijving && (
            <div className="text-sm text-slate-500 mt-1">{seq.beschrijving}</div>
          )}
          <div className="text-xs text-slate-400 mt-1">
            {seq.stappen.length} stap{seq.stappen.length === 1 ? "" : "pen"} ·{" "}
            {seq.aantal_actief} actieve leverancier(s) van {seq.aantal_inschrijvingen}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" onClick={onToggle}>
            {seq.actief ? "Deactiveer" : "Activeer"}
          </Button>
          <Button variant="ghost" onClick={onBewerk}>
            Bewerk
          </Button>
          <Button variant="danger" onClick={onVerwijder}>
            🗑
          </Button>
        </div>
      </div>

      {/* stappen */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-2">
        {seq.stappen.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-300">→</span>}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
              <span className="font-medium text-slate-700">Stap {i + 1}</span>
              <span className="text-slate-400">
                {" "}
                · na {s.wachttijd_dagen}d · {CONDITIES[s.conditie] || s.conditie}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* inschrijvingen */}
      <div className="px-5 py-2 border-t border-slate-100">
        <button
          onClick={toggleOpen}
          className="text-xs text-brand-600 hover:underline"
        >
          {open ? "▲ Verberg leveranciers" : "▼ Toon leveranciers in deze sequence"}
        </button>
        {open && (
          <div className="mt-2">
            {inschrijvingen.length === 0 ? (
              <div className="text-xs text-slate-400 py-2">
                Nog geen leveranciers ingeschreven.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {inschrijvingen.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="text-slate-700">{i.leverancier_naam}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400">
                        stap {Math.min(i.huidige_stap + 1, i.aantal_stappen)}/
                        {i.aantal_stappen} · {i.aantal_ontbrekend} ontbrekend
                      </span>
                      {i.status === "actief" && <Badge color="amber">actief</Badge>}
                      {i.status === "voltooid" && (
                        <Badge color="green">voltooid</Badge>
                      )}
                      {i.status === "gestopt" && (
                        <Badge color="slate">gestopt</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

const LEGE_STAP = { wachttijd_dagen: 7, actie: "mail_versturen", conditie: "data_ontbreekt" };

function SequenceModal({ sequence, wetgeving, onClose, onOpgeslagen }) {
  const bestaand = sequence && sequence.id;
  const [naam, setNaam] = useState(sequence.naam || "");
  const [beschrijving, setBeschrijving] = useState(sequence.beschrijving || "");
  const [triggerType, setTriggerType] = useState(sequence.trigger_type || "leverancier");
  const [wetgevingCode, setWetgevingCode] = useState(sequence.wetgeving_code || "");
  const [actief, setActief] = useState(sequence.actief ?? false);
  const [stappen, setStappen] = useState(
    sequence.stappen && sequence.stappen.length
      ? sequence.stappen.map((s) => ({
          wachttijd_dagen: s.wachttijd_dagen,
          actie: s.actie,
          conditie: s.conditie,
        }))
      : [{ ...LEGE_STAP, wachttijd_dagen: 0 }]
  );
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  function wijzigStap(i, veld, waarde) {
    setStappen((st) =>
      st.map((s, idx) => (idx === i ? { ...s, [veld]: waarde } : s))
    );
  }
  function voegStapToe() {
    setStappen((st) => [...st, { ...LEGE_STAP }]);
  }
  function verwijderStap(i) {
    setStappen((st) => st.filter((_, idx) => idx !== i));
  }

  async function opslaan() {
    if (!naam.trim()) {
      setFout("Geef de sequence een naam.");
      return;
    }
    if (triggerType === "wetgeving" && !wetgevingCode) {
      setFout("Kies een wetgeving voor deze trigger.");
      return;
    }
    setBezig(true);
    setFout(null);
    const payload = {
      naam: naam.trim(),
      beschrijving: beschrijving.trim() || null,
      trigger_type: triggerType,
      wetgeving_code: triggerType === "wetgeving" ? wetgevingCode : null,
      actief,
      stappen: stappen.map((s, i) => ({
        volgorde: i,
        wachttijd_dagen: Number(s.wachttijd_dagen) || 0,
        actie: "mail_versturen",
        conditie: s.conditie,
      })),
    };
    try {
      if (bestaand) await api.wijzigSequence(sequence.id, payload);
      else await api.maakSequence(payload);
      onOpgeslagen();
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">
            {bestaand ? "Sequence bewerken" : "Nieuwe sequence"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {fout && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
              {fout}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Naam</label>
            <input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              className="input"
              placeholder="bv. Herinneringsreeks ontbrekende data"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Beschrijving
            </label>
            <input
              value={beschrijving}
              onChange={(e) => setBeschrijving(e.target.value)}
              className="input"
              placeholder="Korte omschrijving (optioneel)"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Trigger
              </label>
              <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                {[
                  ["leverancier", "Per leverancier"],
                  ["wetgeving", "Per wetgeving"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTriggerType(key)}
                    className={`px-3 py-1.5 text-sm ${
                      triggerType === key
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {triggerType === "wetgeving" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Wetgeving
                </label>
                <select
                  value={wetgevingCode}
                  onChange={(e) => setWetgevingCode(e.target.value)}
                  className="input"
                >
                  <option value="">— kies —</option>
                  {wetgeving.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.code} — {w.naam}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex items-end gap-2 text-sm text-slate-600 pb-1.5">
              <input
                type="checkbox"
                checked={actief}
                onChange={(e) => setActief(e.target.checked)}
              />
              Direct activeren
            </label>
          </div>

          {/* stappen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Stappen</label>
              <button
                onClick={voegStapToe}
                className="text-xs text-brand-600 hover:underline"
              >
                + Stap toevoegen
              </button>
            </div>
            <div className="space-y-2">
              {stappen.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-500 w-14">Stap {i + 1}</span>
                  <span className="text-slate-400">na</span>
                  <input
                    type="number"
                    min="0"
                    value={s.wachttijd_dagen}
                    onChange={(e) => wijzigStap(i, "wachttijd_dagen", e.target.value)}
                    className="w-16 rounded-md border border-slate-300 px-2 py-1"
                  />
                  <span className="text-slate-400">dagen · mail versturen</span>
                  <select
                    value={s.conditie}
                    onChange={(e) => wijzigStap(i, "conditie", e.target.value)}
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 min-w-0"
                  >
                    {Object.entries(CONDITIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {stappen.length > 1 && (
                    <button
                      onClick={() => verwijderStap(i)}
                      className="text-slate-400 hover:text-red-600"
                      title="Verwijder stap"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button onClick={opslaan} disabled={bezig}>
            {bezig ? "Opslaan…" : "Opslaan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
