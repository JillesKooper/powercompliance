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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{t(cfg.titelKey)}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
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
                    ? "border-brand-500 bg-brand-50"
                    : "border-slate-300 hover:border-brand-400 hover:bg-slate-50"
                }`}
              >
                <div className="text-4xl mb-2">📥</div>
                <div className="font-medium text-slate-700">
                  {bezig
                    ? t("modals.import.bezig")
                    : t("modals.import.sleepBestand")}
                </div>
                <div className="text-xs text-slate-400 mt-1">
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
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                  ⚠️ {fout}
                </div>
              )}

              <div className="mt-5 text-xs text-slate-500 space-y-2">
                <div>
                  <span className="font-medium text-slate-600">
                    {t("modals.import.verplichteKolommen")}
                  </span>
                  {cfg.verplicht.map((k) => (
                    <span key={k} className="mr-1">
                      <Badge color="red">{k}</Badge>
                    </span>
                  ))}
                </div>
                <div>
                  <span className="font-medium text-slate-600">
                    {t("modals.import.optioneel")}
                  </span>
                  {cfg.optioneel.map((k) => (
                    <span key={k} className="mr-1">
                      <Badge color="slate">{k}</Badge>
                    </span>
                  ))}
                </div>
                <p className="text-slate-400 pt-1">{t(cfg.hintKey)}</p>
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
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 mb-4">
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
          kleur="text-slate-800"
        />
        {isProduct && (
          <>
            <Stat
              label={t("modals.import.statCompliant")}
              value={r.aantal_compliant}
              kleur="text-emerald-600"
            />
            <Stat
              label={t("modals.import.statDataOntbreekt")}
              value={r.aantal_met_ontbrekende_data}
              kleur="text-red-600"
            />
          </>
        )}
        {!isProduct && (
          <Stat
            label={t("modals.import.statFouten")}
            value={r.aantal_fouten}
            kleur="text-red-600"
          />
        )}
      </div>

      <div className="mb-4">
        <div className="text-xs font-medium text-slate-600 mb-1">
          {t("modals.import.herkendeKolommen")}
        </div>
        <div className="space-y-1 text-xs">
          {Object.entries(r.herkende_kolommen).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-slate-500">{k}</span>
              <span className="text-slate-700 font-medium">→ {v}</span>
            </div>
          ))}
        </div>
        {r.genegeerde_kolommen.length > 0 && (
          <div className="text-xs text-slate-400 mt-2">
            {t("modals.import.genegeerd", {
              lijst: r.genegeerde_kolommen.join(", "),
            })}
          </div>
        )}
      </div>

      {r.fouten.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-red-600 mb-1">
            {t("modals.import.rijenOvergeslagen", { aantal: r.fouten.length })}
          </div>
          <ul className="text-xs text-red-600 space-y-0.5 max-h-28 overflow-auto">
            {r.fouten.map((f, i) => (
              <li key={i}>
                {t("modals.import.rijFout", { rij: f.rij, bericht: f.bericht })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
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
    <div className="rounded-lg border border-slate-200 p-3 text-center">
      <div className={`text-2xl font-bold ${kleur}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
