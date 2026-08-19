import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Badge, Button, Loading, ErrorBox } from "../components/ui";
import { useTaal } from "../context/taal";
import { wetgevingCode, wetgevingNaam } from "../i18n/dataVertaling";

const CONDITIE_KEYS = {
  data_ontbreekt: "sequences.conditie.data_ontbreekt",
  geen_reply: "sequences.conditie.geen_reply",
  altijd: "sequences.conditie.altijd",
};

export default function Sequences() {
  const { t } = useTaal();
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
        tekst: t("sequences.uitvraagMelding", { aantal, naam: seq.naam }),
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
    if (!window.confirm(t("sequences.verwijderBevestig", { naam: seq.naam }))) return;
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
        <p className="text-sm text-muted max-w-2xl">
          {t("sequences.intro")}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" onClick={runScheduler} disabled={schedulerBezig}>
            {schedulerBezig ? t("actie.bezig") : t("sequences.schedulerNuDraaien")}
          </Button>
          <Button onClick={() => setBewerken({})}>{t("sequences.nieuweSequence")}</Button>
        </div>
      </div>

      {schedulerResultaat && (
        <div className="rounded-lg bg-info-soft border border-info-line text-brandtext px-4 py-3 text-sm">
          <div className="font-medium">
            {t("sequences.schedulerUitgevoerd", { aantal: schedulerResultaat.aantal_acties })}
          </div>
          {schedulerResultaat.acties.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-brandtext/90 max-h-40 overflow-auto">
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
        <div className="rounded-lg bg-success-soft border border-success-line text-success-text px-4 py-3 text-sm">
          ✅ {uitvraagMelding.tekst}
        </div>
      )}

      {items.length === 0 ? (
        <Card className="p-10 text-center text-muted">
          {t("sequences.leeg")}
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
  const { t } = useTaal();
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
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink">{seq.naam}</span>
            {seq.actief ? (
              <Badge color="green">{t("status.actief")}</Badge>
            ) : (
              <Badge color="slate">{t("sequences.inactief")}</Badge>
            )}
            {seq.trigger_type === "wetgeving" ? (
              <Badge color="blue">⚖️ {seq.wetgeving_code || t("nav.wetgeving")}</Badge>
            ) : (
              <Badge color="blue">🏭 {t("sequences.perLeverancier")}</Badge>
            )}
          </div>
          {seq.beschrijving && (
            <div className="text-sm text-muted mt-1">{seq.beschrijving}</div>
          )}
          <div className="text-xs text-faint mt-1">
            {t("sequences.stappenTelling", { aantal: seq.stappen.length })} ·{" "}
            {t("sequences.actieveLeveranciers", {
              actief: seq.aantal_actief,
              totaal: seq.aantal_inschrijvingen,
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={onNuUitvragen} disabled={uitvraagBezig}>
            {uitvraagBezig ? t("actie.bezig") : t("sequences.nuUitvragen")}
          </Button>
          <Button variant="ghost" onClick={onToggle}>
            {seq.actief ? t("sequences.deactiveer") : t("sequences.activeer")}
          </Button>
          <Button variant="ghost" onClick={onBewerk}>
            {t("actie.bewerken")}
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
            {i > 0 && <span className="text-faint">→</span>}
            <div className="rounded-lg border border-line bg-hover px-3 py-1.5 text-xs">
              <span className="font-medium text-ink">{t("sequences.stap", { nr: i + 1 })}</span>
              <span className="text-faint">
                {" "}
                · {t("sequences.naDagen", { dagen: s.wachttijd_dagen })} ·{" "}
                {CONDITIE_KEYS[s.conditie] ? t(CONDITIE_KEYS[s.conditie]) : s.conditie}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* inschrijvingen */}
      <div className="px-5 py-2 border-t border-line">
        <button
          onClick={toggleOpen}
          className="text-xs text-brandtext hover:underline"
        >
          {open
            ? t("sequences.verbergLeveranciers")
            : t("sequences.toonLeveranciers")}
        </button>
        {open && (
          <div className="mt-2">
            {inschrijvingen.length === 0 ? (
              <div className="text-xs text-faint py-2">
                {t("sequences.geenInschrijvingen")}
              </div>
            ) : (
              <div className="divide-y divide-line">
                {inschrijvingen.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="text-ink">{i.leverancier_naam}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-faint">
                        {t("sequences.stapVanTotaal", {
                          huidige: Math.min(i.huidige_stap + 1, i.aantal_stappen),
                          totaal: i.aantal_stappen,
                          ontbrekend: i.aantal_ontbrekend,
                        })}
                      </span>
                      {i.status === "actief" && (
                        <Badge color="amber">
                          {t("sequences.inschrijvingActief")}
                        </Badge>
                      )}
                      {i.status === "voltooid" && (
                        <Badge color="green">
                          {t("sequences.inschrijvingVoltooid")}
                        </Badge>
                      )}
                      {i.status === "gestopt" && (
                        <Badge color="slate">
                          {t("sequences.inschrijvingGestopt")}
                        </Badge>
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
  const { t, taal } = useTaal();
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
      setFout(t("sequences.geefNaam"));
      return;
    }
    if (triggerType === "wetgeving" && !wetgevingCode) {
      setFout(t("sequences.kiesWetgeving"));
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
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-semibold text-ink">
            {bestaand
              ? t("sequences.sequenceBewerken")
              : t("sequences.nieuweSequence")}
          </h2>
          <button
            onClick={onClose}
            className="text-faint hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {fout && (
            <div className="rounded-lg bg-danger-soft border border-danger-line text-danger-text px-4 py-2 text-sm">
              {fout}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              {t("sequences.veldNaam")}
            </label>
            <input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              className="input"
              placeholder={t("sequences.naamPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              {t("sequences.veldBeschrijving")}
            </label>
            <input
              value={beschrijving}
              onChange={(e) => setBeschrijving(e.target.value)}
              className="input"
              placeholder={t("sequences.beschrijvingPlaceholder")}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                {t("sequences.trigger")}
              </label>
              <div className="inline-flex rounded-lg border border-line overflow-hidden">
                {[
                  ["leverancier", t("sequences.triggerPerLeverancier")],
                  ["wetgeving", t("sequences.triggerPerWetgeving")],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTriggerType(key)}
                    className={`px-3 py-1.5 text-sm ${
                      triggerType === key
                        ? "bg-brand-600 text-white"
                        : "bg-surface text-muted hover:bg-hover"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {triggerType === "wetgeving" && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  {t("sequences.veldWetgeving")}
                </label>
                <select
                  value={wetgevingCode}
                  onChange={(e) => setWetgevingCode(e.target.value)}
                  className="input"
                >
                  <option value="">{t("sequences.kiesPlaceholder")}</option>
                  {wetgeving.map((w) => (
                    <option key={w.code} value={w.code}>
                      {wetgevingCode(w.code, taal)} — {wetgevingNaam(w.code, w.naam, taal)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex items-end gap-2 text-sm text-muted pb-1.5">
              <input
                type="checkbox"
                checked={actief}
                onChange={(e) => setActief(e.target.checked)}
              />
              {t("sequences.directActiveren")}
            </label>
          </div>

          {/* stappen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted">
                {t("sequences.stappen")}
              </label>
              <button
                onClick={voegStapToe}
                className="text-xs text-brandtext hover:underline"
              >
                {t("sequences.stapToevoegen")}
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

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line">
          <Button variant="ghost" onClick={onClose}>
            {t("actie.annuleren")}
          </Button>
          <Button onClick={opslaan} disabled={bezig}>
            {bezig ? t("sequences.opslaanBezig") : t("sequences.opslaan")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StapRij({ index, stap, aantalStappen, wetgevingCode, onWijzig, onVerwijder }) {
  const { t } = useTaal();
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
      if (r.ai_fout) setFout(t("sequences.aiNietGebruikt", { fout: r.ai_fout }));
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
    <div className="rounded-lg border border-line text-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="font-medium text-muted w-14">
          {t("sequences.stapNr", { nr: index + 1 })}
        </span>
        <span className="text-faint">{t("sequences.na")}</span>
        <input
          type="number"
          min="0"
          value={stap.wachttijd_dagen}
          onChange={(e) => onWijzig("wachttijd_dagen", e.target.value)}
          className="w-16 rounded-md border border-line px-2 py-1"
        />
        <span className="text-faint">{t("sequences.dagenMailVersturen")}</span>
        <select
          value={stap.conditie}
          onChange={(e) => onWijzig("conditie", e.target.value)}
          className="flex-1 rounded-md border border-line px-2 py-1 min-w-0"
        >
          {Object.keys(CONDITIE_KEYS).map((k) => (
            <option key={k} value={k}>
              {t(CONDITIE_KEYS[k])}
            </option>
          ))}
        </select>
        {aantalStappen > 1 && (
          <button
            onClick={onVerwijder}
            className="text-faint hover:text-danger-text"
            title={t("sequences.verwijderStap")}
          >
            ×
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-brandtext hover:underline"
        >
          {open
            ? t("sequences.verbergMailinhoud")
            : t("sequences.toonMailinhoud")}
          {!open && eigenInhoud && (
            <span className="ml-1 text-faint">
              {t("sequences.eigenTekstIngesteld")}
            </span>
          )}
          {!open && !eigenInhoud && (
            <span className="ml-1 text-faint">
              {t("sequences.automatischGenereren")}
            </span>
          )}
        </button>

        {open && (
          <div className="mt-2 space-y-3 rounded-lg bg-hover border border-line p-3">
            {fout && (
              <div className="rounded-md bg-danger-soft border border-danger-line text-danger-text px-3 py-2 text-xs">
                {fout}
              </div>
            )}
            <p className="text-xs text-muted">
              {t("sequences.mailinhoudUitleg")}{" "}
              <code className="text-brandtext">{"{aanhef}"}</code>,{" "}
              <code className="text-brandtext">{"{ontbrekende_data}"}</code>,{" "}
              <code className="text-brandtext">{"{portaal_link}"}</code>,{" "}
              <code className="text-brandtext">{"{leverancier}"}</code>.
            </p>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                {t("sequences.onderwerp")}
              </label>
              <input
                value={stap.onderwerp || ""}
                onChange={(e) => onWijzig("onderwerp", e.target.value)}
                className="input"
                placeholder={t("sequences.onderwerpPlaceholder")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                {t("sequences.mailtekst")}
              </label>
              <textarea
                value={stap.mailtekst || ""}
                onChange={(e) => onWijzig("mailtekst", e.target.value)}
                rows={8}
                className="input font-mono text-xs leading-relaxed"
                placeholder={t("sequences.mailtekstPlaceholder")}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={genereerAI} disabled={bezigAI}>
                {bezigAI ? t("sequences.genererenBezig") : t("sequences.genereerAi")}
              </Button>
              <Button variant="ghost" onClick={toonPreview} disabled={bezigPreview}>
                {bezigPreview ? t("sequences.previewBezig") : t("sequences.preview")}
              </Button>
              {(stap.onderwerp || stap.mailtekst) && (
                <button
                  type="button"
                  onClick={() => {
                    onWijzig("onderwerp", "");
                    onWijzig("mailtekst", "");
                    setPreview(null);
                  }}
                  className="text-xs text-faint hover:text-danger-text"
                >
                  {t("sequences.wissen")}
                </button>
              )}
            </div>

            {preview && (
              <div className="rounded-lg border border-line bg-surface overflow-hidden">
                <div className="px-3 py-2 border-b border-line bg-hover text-xs text-muted">
                  {t("sequences.previewVoor")}{" "}
                  <span className="font-medium text-ink">
                    {preview.leverancier_naam}
                  </span>
                  {preview.aan_email ? ` <${preview.aan_email}>` : ""}
                  {preview.voorbeeld && t("sequences.fictiefVoorbeeld")}
                  {preview.ai_gebruikt && t("sequences.aiGegenereerd")}
                </div>
                <div className="px-3 py-2 border-b border-line text-sm">
                  <span className="text-faint">
                    {t("sequences.previewOnderwerp")}
                  </span>
                  <span className="font-medium text-ink">{preview.onderwerp}</span>
                </div>
                <pre className="px-3 py-3 text-xs text-ink whitespace-pre-wrap font-sans max-h-72 overflow-auto">
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
