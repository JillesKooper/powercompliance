import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useTaal } from "../context/taal";
import { Button, Badge } from "./ui";

const CONFIG = {
  producten: {
    titelKey: "modals.import.titelProducten",
    fn: api.importProducten,
    verplicht: ["Naam", "Leverancier"],
    optioneel: ["Artikelnummer", "EAN", "Categorie", "+ compliance-kolommen"],
    hintKey: "modals.import.hintProducten",
  },
  leveranciers: {
    titelKey: "modals.import.titelLeveranciers",
    fn: api.importLeveranciers,
    verplicht: ["Naam"],
    optioneel: ["Contactpersoon", "E-mail", "Telefoon", "Land"],
    hintKey: "modals.import.hintLeveranciers",
  },
};

export default function ImportDialog({ soort, onClose, onKlaar }) {
  const { t } = useTaal();
  const cfg = CONFIG[soort];
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [sleep, setSleep] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [resultaat, setResultaat] = useState(null);

  async function verwerk(file) {
    if (!file) return;
    const naam = file.name.toLowerCase();
    if (!naam.endsWith(".csv") && !naam.endsWith(".xlsx") && !naam.endsWith(".xlsm")) {
      setFout(t("modals.import.formaatFout"));
      return;
    }
    setFout(null);
    setBezig(true);
    try {
      const r = await cfg.fn(file);
      setResultaat(r);
      onKlaar?.();
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-semibold text-ink">{t(cfg.titelKey)}</h2>
          <button
            onClick={onClose}
            className="text-faint hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {!resultaat ? (
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
                  verwerk(e.dataTransfer.files?.[0]);
                }}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  sleep
                    ? "border-brand-500 bg-info-soft"
                    : "border-line hover:border-brand-400 hover:bg-hover"
                }`}
              >
                <div className="text-4xl mb-2">📥</div>
                <div className="font-medium text-ink">
                  {bezig
                    ? t("modals.import.bezig")
                    : t("modals.import.sleepBestand")}
                </div>
                <div className="text-xs text-faint mt-1">
                  {t("modals.import.ondersteund")}
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xlsm"
                  className="hidden"
                  onChange={(e) => verwerk(e.target.files?.[0])}
                />
              </div>

              {fout && (
                <div className="mt-4 rounded-lg bg-danger-soft border border-danger-line text-danger-text px-4 py-3 text-sm">
                  ⚠️ {fout}
                </div>
              )}

              <div className="mt-5 text-xs text-muted space-y-2">
                <div>
                  <span className="font-medium text-muted">
                    {t("modals.import.verplichteKolommen")}
                  </span>
                  {cfg.verplicht.map((k) => (
                    <span key={k} className="mr-1">
                      <Badge color="red">{k}</Badge>
                    </span>
                  ))}
                </div>
                <div>
                  <span className="font-medium text-muted">
                    {t("modals.import.optioneel")}
                  </span>
                  {cfg.optioneel.map((k) => (
                    <span key={k} className="mr-1">
                      <Badge color="slate">{k}</Badge>
                    </span>
                  ))}
                </div>
                <p className="text-faint pt-1">{t(cfg.hintKey)}</p>
              </div>
            </>
          ) : (
            <Samenvatting
              r={resultaat}
              onClose={onClose}
              onNaarOntbrekend={() => {
                onClose();
                navigate("/ontbrekende-data");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Samenvatting({ r, onClose, onNaarOntbrekend }) {
  const { t } = useTaal();
  const isProduct = r.type === "producten";
  const typeLabel = isProduct
    ? t("modals.import.typeProducten")
    : t("modals.import.typeLeveranciers");
  return (
    <div>
      <div className="rounded-lg bg-success-soft border border-success-line px-4 py-3 text-sm text-success-text mb-4">
        ✅{" "}
        {t("modals.import.voltooid", {
          aantal: r.aantal_geimporteerd,
          type: typeLabel,
          bestand: r.bestandsnaam,
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat
          label={t("modals.import.statGeimporteerd")}
          value={r.aantal_geimporteerd}
          kleur="text-ink"
        />
        {isProduct && (
          <>
            <Stat
              label={t("modals.import.statCompliant")}
              value={r.aantal_compliant}
              kleur="text-success-text"
            />
            <Stat
              label={t("modals.import.statDataOntbreekt")}
              value={r.aantal_met_ontbrekende_data}
              kleur="text-danger-text"
            />
          </>
        )}
        {!isProduct && (
          <Stat
            label={t("modals.import.statFouten")}
            value={r.aantal_fouten}
            kleur="text-danger-text"
          />
        )}
      </div>

      <div className="mb-4">
        <div className="text-xs font-medium text-muted mb-1">
          {t("modals.import.herkendeKolommen")}
        </div>
        <div className="space-y-1 text-xs">
          {Object.entries(r.herkende_kolommen).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted">{k}</span>
              <span className="text-ink font-medium">→ {v}</span>
            </div>
          ))}
        </div>
        {r.genegeerde_kolommen.length > 0 && (
          <div className="text-xs text-faint mt-2">
            {t("modals.import.genegeerd", {
              lijst: r.genegeerde_kolommen.join(", "),
            })}
          </div>
        )}
      </div>

      {r.fouten.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-danger-text mb-1">
            {t("modals.import.rijenOvergeslagen", { aantal: r.fouten.length })}
          </div>
          <ul className="text-xs text-danger-text space-y-0.5 max-h-28 overflow-auto">
            {r.fouten.map((f, i) => (
              <li key={i}>
                {t("modals.import.rijFout", { rij: f.rij, bericht: f.bericht })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t border-line">
        <Button variant="ghost" onClick={onClose}>
          {t("actie.sluiten")}
        </Button>
        {isProduct && r.aantal_met_ontbrekende_data > 0 && (
          <Button onClick={onNaarOntbrekend}>
            {t("modals.import.naarOntbrekend")}
          </Button>
        )}
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
