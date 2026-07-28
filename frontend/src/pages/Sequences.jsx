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
  const [uitvraagMelding, setUitvraagMelding] = useState(null);
  const [uitvraagBezigId, setUitvraagBezigId] = useState(null);

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

  async function nuUitvragen(seq) {
    setUitvraagBezigId(seq.id);
    setUitvraagMelding(null);
    try {
      const r = await api.nuUitvragen(seq.id);
      const aantal =
        r?.aantal_verstuurd ??
        r?.aantal_mails ??
        r?.aantal ??
        r?.aantal_acties ??
        0;
      setUitvraagMelding({
        naam: seq.naam,
        tekst: `${aantal} mail${aantal === 1 ? "" : "s"} verstuurd voor "${seq.naam}".`,
      });
      laad();
    } catch (e) {
      setError(e.message);
    } finally {
      setUitvraagBezigId(null);
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

      {uitvraagMelding && (
        <div className="rounded-lg bg-green-50 border border-green-100 text-green-800 px-4 py-3 text-sm">
          ✅ {uitvraagMelding.tekst}
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
            uitvraagBezig={uitvraagBezigId === seq.id}
            onNuUitvragen={() => nuUitvragen(seq)}
            onToggle={() => toggle(seq)}
            onBewerk={() => setBewerken(seq)}
            onVerwijder={() => verwijder(seq)}
          />
        ))
      )}
    </div>
  );
}

function SequenceKaart({ seq, uitvraagBezig, onNuUitvragen, onToggle, onBewerk, onVerwijder }) {
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
          <Button onClick={onNuUitvragen} disabled={uitvraagBezig}>
            {uitvraagBezig ? "Bezig…" : "📤 Nu uitvragen"}
          </Button>
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

const LEGE_STAP = {
  wachttijd_dagen: 7,
  actie: "mail_versturen",
  conditie: "data_ontbreekt",
  onderwerp: "",
  mailtekst: "",
};

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
          onderwerp: s.onderwerp || "",
          mailtekst: s.mailtekst || "",
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
        onderwerp: (s.onderwerp || "").trim() || null,
        mailtekst: (s.mailtekst || "").trim() || null,
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
                <StapRij
                  key={i}
                  index={i}
                  stap={s}
                  aantalStappen={stappen.length}
                  wetgevingCode={triggerType === "wetgeving" ? wetgevingCode : null}
                  onWijzig={(veld, waarde) => wijzigStap(i, veld, waarde)}
                  onVerwijder={() => verwijderStap(i)}
                />
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

function StapRij({ index, stap, aantalStappen, wetgevingCode, onWijzig, onVerwijder }) {
  const [open, setOpen] = useState(false);
  const [bezigAI, setBezigAI] = useState(false);
  const [preview, setPreview] = useState(null); // {onderwerp, tekst, ...} of null
  const [bezigPreview, setBezigPreview] = useState(false);
  const [fout, setFout] = useState(null);

  const eigenInhoud = Boolean((stap.onderwerp || "").trim() || (stap.mailtekst || "").trim());

  async function genereerAI() {
    setBezigAI(true);
    setFout(null);
    try {
      const r = await api.sequenceGenereerMail({ wetgeving_code: wetgevingCode || null });
      onWijzig("onderwerp", r.onderwerp || "");
      onWijzig("mailtekst", r.tekst || "");
      if (r.ai_fout) setFout(`AI niet gebruikt: ${r.ai_fout}`);
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezigAI(false);
    }
  }

  async function toonPreview() {
    setBezigPreview(true);
    setFout(null);
    try {
      const r = await api.sequencePreviewMail({
        wetgeving_code: wetgevingCode || null,
        onderwerp: (stap.onderwerp || "").trim() || null,
        mailtekst: (stap.mailtekst || "").trim() || null,
      });
      setPreview(r);
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezigPreview(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 text-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="font-medium text-slate-500 w-14">Stap {index + 1}</span>
        <span className="text-slate-400">na</span>
        <input
          type="number"
          min="0"
          value={stap.wachttijd_dagen}
          onChange={(e) => onWijzig("wachttijd_dagen", e.target.value)}
          className="w-16 rounded-md border border-slate-300 px-2 py-1"
        />
        <span className="text-slate-400">dagen · mail versturen</span>
        <select
          value={stap.conditie}
          onChange={(e) => onWijzig("conditie", e.target.value)}
          className="flex-1 rounded-md border border-slate-300 px-2 py-1 min-w-0"
        >
          {Object.entries(CONDITIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {aantalStappen > 1 && (
          <button
            onClick={onVerwijder}
            className="text-slate-400 hover:text-red-600"
            title="Verwijder stap"
          >
            ×
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-brand-600 hover:underline"
        >
          {open ? "▲ Verberg mailinhoud" : "▼ Mailinhoud"}
          {!open && eigenInhoud && (
            <span className="ml-1 text-slate-400">(eigen tekst ingesteld)</span>
          )}
          {!open && !eigenInhoud && (
            <span className="ml-1 text-slate-400">(automatisch genereren)</span>
          )}
        </button>

        {open && (
          <div className="mt-2 space-y-3 rounded-lg bg-slate-50 border border-slate-100 p-3">
            {fout && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">
                {fout}
              </div>
            )}
            <p className="text-xs text-slate-500">
              Laat leeg om de mail automatisch te laten genereren (AI/sjabloon), of
              stel hier een eigen onderwerp en tekst in. Placeholders:{" "}
              <code className="text-brand-700">{"{aanhef}"}</code>,{" "}
              <code className="text-brand-700">{"{ontbrekende_data}"}</code>,{" "}
              <code className="text-brand-700">{"{portaal_link}"}</code>,{" "}
              <code className="text-brand-700">{"{leverancier}"}</code>.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Onderwerp
              </label>
              <input
                value={stap.onderwerp || ""}
                onChange={(e) => onWijzig("onderwerp", e.target.value)}
                className="input"
                placeholder="Automatisch (bv. {leverancier} – ontbrekende productcompliance-data)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Mailtekst
              </label>
              <textarea
                value={stap.mailtekst || ""}
                onChange={(e) => onWijzig("mailtekst", e.target.value)}
                rows={8}
                className="input font-mono text-xs leading-relaxed"
                placeholder="Laat leeg om automatisch te genereren, of typ hier je eigen mailtekst met placeholders…"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={genereerAI} disabled={bezigAI}>
                {bezigAI ? "Genereren…" : "✨ Genereer met AI"}
              </Button>
              <Button variant="ghost" onClick={toonPreview} disabled={bezigPreview}>
                {bezigPreview ? "Laden…" : "👁 Preview"}
              </Button>
              {(stap.onderwerp || stap.mailtekst) && (
                <button
                  type="button"
                  onClick={() => {
                    onWijzig("onderwerp", "");
                    onWijzig("mailtekst", "");
                    setPreview(null);
                  }}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Wissen
                </button>
              )}
            </div>

            {preview && (
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  Preview voor{" "}
                  <span className="font-medium text-slate-700">
                    {preview.leverancier_naam}
                  </span>
                  {preview.aan_email ? ` <${preview.aan_email}>` : ""}
                  {preview.voorbeeld && " (fictief voorbeeld)"}
                  {preview.ai_gebruikt && " · AI-gegenereerd"}
                </div>
                <div className="px-3 py-2 border-b border-slate-100 text-sm">
                  <span className="text-slate-400">Onderwerp: </span>
                  <span className="font-medium text-slate-800">{preview.onderwerp}</span>
                </div>
                <pre className="px-3 py-3 text-xs text-slate-700 whitespace-pre-wrap font-sans max-h-72 overflow-auto">
                  {preview.tekst}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
