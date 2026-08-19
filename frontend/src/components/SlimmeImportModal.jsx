import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useTaal } from "../context/taal";
import { Button, Badge } from "./ui";

// Slimme productimport in drie stappen:
//   upload → controleer kolommapping + rijen (nieuw/update + AI-categorie) → resultaat.
export default function SlimmeImportModal({ onClose, onKlaar }) {
  const { t } = useTaal();
  const navigate = useNavigate();
  const [stap, setStap] = useState("upload"); // upload | preview | resultaat
  const [bestand, setBestand] = useState(null);
  const [analyse, setAnalyse] = useState(null);
  const [mapping, setMapping] = useState({}); // header -> veld
  const [modus, setModus] = useState("alles");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [resultaat, setResultaat] = useState(null);

  async function analyseer(file) {
    if (!file) return;
    const naam = file.name.toLowerCase();
    if (!naam.endsWith(".csv") && !naam.endsWith(".xlsx") && !naam.endsWith(".xlsm")) {
      setFout(t("slimimport.formaatFout"));
      return;
    }
    setFout(null);
    setBezig(true);
    try {
      const a = await api.analyseerImport(file);
      setBestand(file);
      setAnalyse(a);
      setMapping(Object.fromEntries(a.mapping.map((m) => [m.header, m.veld || ""])));
      setStap("preview");
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  async function importeer() {
    setBezig(true);
    setFout(null);
    try {
      // AI-/bestandscategorieën meesturen zodat ze automatisch gekoppeld worden
      const categorieen = {};
      for (const r of analyse.rijen) {
        if (r.categorie_suggestie) categorieen[r.rij_index] = r.categorie_suggestie;
      }
      const schoon = Object.fromEntries(
        Object.entries(mapping).filter(([, v]) => v)
      );
      const res = await api.bevestigImport(bestand, schoon, modus, categorieen);
      setResultaat(res);
      setStap("resultaat");
      onKlaar?.();
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-surface">
          <h2 className="font-semibold text-ink">{t("slimimport.titel")}</h2>
          <button
            onClick={onClose}
            className="text-faint hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {fout && (
            <div className="mb-4 rounded-lg bg-danger-soft border border-danger-line text-danger-text px-4 py-3 text-sm">
              ⚠️ {fout}
            </div>
          )}

          {stap === "upload" && (
            <UploadStap bezig={bezig} onBestand={analyseer} />
          )}

          {stap === "preview" && analyse && (
            <PreviewStap
              analyse={analyse}
              mapping={mapping}
              setMapping={setMapping}
              modus={modus}
              setModus={setModus}
              bezig={bezig}
              onTerug={() => {
                setStap("upload");
                setAnalyse(null);
              }}
              onImporteer={importeer}
            />
          )}

          {stap === "resultaat" && resultaat && (
            <ResultaatStap
              r={resultaat}
              onClose={onClose}
              onNaarProducten={() => {
                onClose();
                navigate("/producten");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function UploadStap({ bezig, onBestand }) {
  const { t } = useTaal();
  const inputRef = useRef(null);
  const [sleep, setSleep] = useState(false);
  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSleep(true);
        }}
        onDragLeave={() => setSleep(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSleep(false);
          onBestand(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          sleep
            ? "border-brand-500 bg-info-soft"
            : "border-line hover:border-brand-400 hover:bg-hover"
        }`}
      >
        <div className="text-4xl mb-2">📥</div>
        <div className="font-medium text-ink">
          {bezig ? t("slimimport.bezigAnalyse") : t("slimimport.sleepBestand")}
        </div>
        <div className="text-xs text-faint mt-1">{t("slimimport.ondersteund")}</div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xlsm"
          className="hidden"
          onChange={(e) => onBestand(e.target.files?.[0])}
        />
      </div>
      <div className="mt-4 text-center">
        <button
          onClick={() => api.downloadImportTemplate()}
          className="text-sm text-brandtext hover:underline"
        >
          {t("slimimport.templateKnop")}
        </button>
      </div>
    </>
  );
}

function PreviewStap({
  analyse,
  mapping,
  setMapping,
  modus,
  setModus,
  bezig,
  onTerug,
  onImporteer,
}) {
  const { t } = useTaal();
  // doelvelden groeperen voor <optgroup>
  const groepen = useMemo(() => {
    const g = {};
    for (const d of analyse.doelvelden) {
      const key = d.groep === "kern" ? t("slimimport.groepKern") : d.groep;
      (g[key] ||= []).push(d);
    }
    return g;
  }, [analyse.doelvelden, t]);

  const zekerheidVan = Object.fromEntries(
    analyse.mapping.map((m) => [m.header, m.zekerheid])
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-ink">{t("slimimport.stapControleer")}</h3>
        <p className="text-sm text-muted mt-0.5">
          {analyse.ai_gebruikt
            ? t("slimimport.aiHerkend")
            : t("slimimport.heuristischHerkend")}
        </p>
        {analyse.ai_fout && (
          <p className="text-xs text-warning-text mt-1">⚠️ {t("slimimport.aiFout")}</p>
        )}
      </div>

      {/* Kolommapping */}
      <div className="rounded-lg border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-hover text-muted text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2 font-medium">
                {t("slimimport.kolomHeader")}
              </th>
              <th className="text-left px-4 py-2 font-medium">
                {t("slimimport.kolomDoel")}
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {analyse.mapping.map((m) => (
              <tr key={m.header}>
                <td className="px-4 py-2 font-medium text-ink">{m.header}</td>
                <td className="px-4 py-2">
                  <select
                    value={mapping[m.header] || ""}
                    onChange={(e) =>
                      setMapping({ ...mapping, [m.header]: e.target.value })
                    }
                    className="input py-1.5"
                  >
                    <option value="">{t("slimimport.negeren")}</option>
                    {Object.entries(groepen).map(([groep, velden]) => (
                      <optgroup key={groep} label={groep}>
                        {velden.map((d) => (
                          <option key={d.sleutel} value={d.sleutel}>
                            {d.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  {mapping[m.header] && <ZekerheidBadge z={zekerheidVan[m.header]} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rijen-preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-ink">{t("slimimport.rijenTitel")}</h3>
          <span className="text-xs text-muted">
            {t("slimimport.samenvatting", {
              nieuw: analyse.aantal_nieuw,
              update: analyse.aantal_update,
              fouten: analyse.aantal_fouten,
            })}
          </span>
        </div>
        <p className="text-xs text-faint mb-2">{t("slimimport.rijenUitleg")}</p>
        <div className="rounded-lg border border-line overflow-auto max-h-72">
          <table className="w-full text-sm">
            <thead className="bg-hover text-muted text-xs uppercase sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">
                  {t("slimimport.kolNaam")}
                </th>
                <th className="text-left px-3 py-2 font-medium">
                  {t("slimimport.kolArtikel")}
                </th>
                <th className="text-left px-3 py-2 font-medium">
                  {t("slimimport.kolEan")}
                </th>
                <th className="text-left px-3 py-2 font-medium">
                  {t("slimimport.kolActie")}
                </th>
                <th className="text-left px-3 py-2 font-medium">
                  {t("slimimport.kolCategorie")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {analyse.rijen.map((r) => (
                <tr key={r.rij_index}>
                  <td className="px-3 py-2 text-ink">
                    {r.naam || <span className="text-faint">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.artikelnummer || "—"}</td>
                  <td className="px-3 py-2 text-muted">{r.ean || "—"}</td>
                  <td className="px-3 py-2">
                    <ActieBadge r={r} />
                  </td>
                  <td className="px-3 py-2">
                    <CategorieCel r={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {analyse.aantal_rijen > analyse.rijen.length && (
          <div className="text-xs text-faint mt-1">
            {t("slimimport.rijenMeer", {
              n: analyse.aantal_rijen - analyse.rijen.length,
            })}
          </div>
        )}
      </div>

      {/* Modus */}
      <div>
        <h3 className="font-semibold text-ink mb-2">{t("slimimport.stapModus")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ModusOptie
            actief={modus === "alles"}
            onClick={() => setModus("alles")}
            titel={t("slimimport.modusAlles")}
            uitleg={t("slimimport.modusAllesUitleg")}
          />
          <ModusOptie
            actief={modus === "alleen_nieuwe"}
            onClick={() => setModus("alleen_nieuwe")}
            titel={t("slimimport.modusNieuwe")}
            uitleg={t("slimimport.modusNieuweUitleg")}
          />
          <ModusOptie
            actief={modus === "update_bestaande"}
            onClick={() => setModus("update_bestaande")}
            titel={t("slimimport.modusUpdate")}
            uitleg={t("slimimport.modusUpdateUitleg")}
          />
        </div>
      </div>

      <div className="flex justify-between pt-2 border-t border-line">
        <Button variant="ghost" onClick={onTerug}>
          {t("slimimport.terug")}
        </Button>
        <Button onClick={onImporteer} disabled={bezig}>
          {bezig ? t("slimimport.bezigImport") : t("slimimport.importeren")}
        </Button>
      </div>
    </div>
  );
}

function ZekerheidBadge({ z }) {
  const { t } = useTaal();
  if (z >= 0.75)
    return <Badge color="green">{t("slimimport.zekerheidHoog")}</Badge>;
  if (z >= 0.4)
    return <Badge color="amber">{t("slimimport.zekerheidMidden")}</Badge>;
  return <Badge color="slate">{t("slimimport.zekerheidLaag")}</Badge>;
}

function ActieBadge({ r }) {
  const { t } = useTaal();
  if (r.actie === "fout")
    return (
      <span title={r.melding}>
        <Badge color="red">{t("slimimport.actieFout")}</Badge>
      </span>
    );
  if (r.actie === "update")
    return (
      <div className="flex items-center gap-1">
        <Badge color="amber">{t("slimimport.actieUpdate")}</Badge>
        {r.match_op && (
          <span className="text-[10px] text-faint">
            {t("slimimport.matchOp", { veld: r.match_op })}
          </span>
        )}
      </div>
    );
  return <Badge color="green">{t("slimimport.actieNieuw")}</Badge>;
}

function CategorieCel({ r }) {
  const { t } = useTaal();
  if (!r.categorie_suggestie)
    return <span className="text-faint">{t("slimimport.geenCategorie")}</span>;
  const pct = Math.round((r.categorie_zekerheid || 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink">{r.categorie_suggestie}</span>
      {pct > 0 && (
        <span className="text-[10px] text-faint">{pct}%</span>
      )}
    </div>
  );
}

function ModusOptie({ actief, onClick, titel, uitleg }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-colors ${
        actief
          ? "border-brand-500 bg-brand-500/10"
          : "border-line hover:border-brand-400 hover:bg-hover"
      }`}
    >
      <div className="font-medium text-ink text-sm">{titel}</div>
      <div className="text-xs text-muted mt-0.5">{uitleg}</div>
    </button>
  );
}

function ResultaatStap({ r, onClose, onNaarProducten }) {
  const { t } = useTaal();
  return (
    <div>
      <div className="rounded-lg bg-success-soft border border-success-line px-4 py-3 text-sm text-success-text mb-4">
        ✅ {t("slimimport.klaarTitel")} — {r.bestandsnaam}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Stat label={t("slimimport.resNieuw")} value={r.aantal_nieuw} kleur="text-success-text" />
        <Stat label={t("slimimport.resGeupdatet")} value={r.aantal_geupdatet} kleur="text-brandtext" />
        <Stat label={t("slimimport.resVelden")} value={r.aantal_velden_ingevuld} kleur="text-ink" />
        <Stat label={t("slimimport.resCategorie")} value={r.aantal_gecategoriseerd} kleur="text-ink" />
        <Stat label={t("slimimport.resFouten")} value={r.aantal_fouten} kleur="text-danger-text" />
      </div>

      {r.fouten?.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-danger-text mb-1">
            {t("slimimport.rijenOvergeslagen", { aantal: r.fouten.length })}
          </div>
          <ul className="text-xs text-danger-text space-y-0.5 max-h-28 overflow-auto">
            {r.fouten.map((f, i) => (
              <li key={i}>{t("slimimport.rijFout", { rij: f.rij, bericht: f.bericht })}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t border-line">
        <Button variant="ghost" onClick={onClose}>
          {t("actie.sluiten")}
        </Button>
        <Button onClick={onNaarProducten}>{t("slimimport.naarProducten")}</Button>
      </div>
    </div>
  );
}

function Stat({ label, value, kleur }) {
  return (
    <div className="rounded-lg border border-line p-3 text-center">
      <div className={`text-2xl font-bold ${kleur}`}>{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
