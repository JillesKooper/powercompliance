import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useTaal } from "../context/taal";
import { categorieNaam } from "../i18n/dataVertaling";
import { Button, Loading } from "./ui";

const FORMATEN = [
  { key: "csv", label: "CSV", hintKey: "modals.export.hintCsv" },
  { key: "xlsx", label: "Excel", hintKey: "modals.export.hintXlsx" },
  { key: "json", label: "JSON", hintKey: "modals.export.hintJson" },
];

export default function ExportModal({ onClose }) {
  const { t, taal } = useTaal();
  const [opties, setOpties] = useState(null);
  const [formaat, setFormaat] = useState("xlsx");
  const [gekozen, setGekozen] = useState(() => new Set());
  const [leverancierId, setLeverancierId] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [wetgevingCode, setWetgevingCode] = useState("");
  const [alleenCompliant, setAlleenCompliant] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null);
  const [historie, setHistorie] = useState([]);

  useEffect(() => {
    api
      .exportOpties(taal)
      .then((o) => {
        setOpties(o);
        // standaard: de product-basisvelden voorselecteren
        const standaard = o.velden
          .filter((v) => v.groep === "product")
          .map((v) => v.sleutel)
          .filter((s) =>
            ["artikelnummer", "naam", "ean", "leverancier", "categorie"].includes(s)
          );
        setGekozen(new Set(standaard));
      })
      .catch((e) => setMelding({ type: "fout", tekst: e.message }));
    laadHistorie();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taal]);

  function laadHistorie() {
    api.exportHistorie().then((h) => setHistorie(h.slice(0, 5))).catch(() => {});
  }

  const groepen = useMemo(() => {
    if (!opties) return [];
    const map = new Map();
    for (const v of opties.velden) {
      if (!map.has(v.groep)) map.set(v.groep, []);
      map.get(v.groep).push(v);
    }
    return [...map.entries()];
  }, [opties]);

  function toggle(sleutel) {
    setGekozen((prev) => {
      const s = new Set(prev);
      s.has(sleutel) ? s.delete(sleutel) : s.add(sleutel);
      return s;
    });
  }

  async function exporteer() {
    if (gekozen.size === 0) {
      setMelding({ type: "fout", tekst: t("modals.export.kiesVeld") });
      return;
    }
    setBezig(true);
    setMelding(null);
    try {
      // behoud de volgorde zoals in de optielijst
      const volgorde = opties.velden
        .map((v) => v.sleutel)
        .filter((s) => gekozen.has(s));
      const res = await api.exporteer({
        formaat,
        velden: volgorde,
        leverancier_id: leverancierId ? Number(leverancierId) : null,
        categorie_id: categorieId ? Number(categorieId) : null,
        wetgeving_code: wetgevingCode || null,
        alleen_compliant: alleenCompliant,
        taal,
      });
      setMelding({
        type: "succes",
        tekst: t("modals.export.exportGestart", {
          aantal: res.aantal ?? "?",
          bestandsnaam: res.bestandsnaam,
        }),
      });
      laadHistorie();
    } catch (e) {
      setMelding({ type: "fout", tekst: e.message });
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-semibold text-ink">{t("modals.export.titel")}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>

        {!opties ? (
          <div className="p-6">
            <Loading />
          </div>
        ) : (
          <div className="p-6 space-y-5 overflow-auto">
            {/* Formaat */}
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                {t("modals.export.formaat")}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {FORMATEN.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFormaat(f.key)}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      formaat === f.key
                        ? "border-brand-500 bg-brand-50 text-ink"
                        : "border-line hover:bg-hover text-muted"
                    }`}
                  >
                    <div className="font-medium text-ink">{f.label}</div>
                    <div className="text-[11px] text-muted">{t(f.hintKey)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                {t("modals.export.welkeProducten")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={leverancierId}
                  onChange={(e) => setLeverancierId(e.target.value)}
                  className="input bg-white"
                >
                  <option value="">{t("modals.export.alleLeveranciers")}</option>
                  {opties.leveranciers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.naam}
                    </option>
                  ))}
                </select>
                <select
                  value={categorieId}
                  onChange={(e) => setCategorieId(e.target.value)}
                  className="input bg-white"
                >
                  <option value="">{t("modals.export.alleCategorieen")}</option>
                  {opties.categorieen.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categorieNaam(c.naam, taal)}
                    </option>
                  ))}
                </select>
                <select
                  value={wetgevingCode}
                  onChange={(e) => setWetgevingCode(e.target.value)}
                  className="input bg-white"
                >
                  <option value="">{t("modals.export.alleWetgeving")}</option>
                  {opties.wetgeving.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.code}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 mt-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={alleenCompliant}
                  onChange={(e) => setAlleenCompliant(e.target.checked)}
                />
                {t("modals.export.alleenCompliant")}
              </label>
            </div>

            {/* Velden */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                  {t("modals.export.welkeVelden", { aantal: gekozen.size })}
                </div>
                <button
                  onClick={() => setGekozen(new Set())}
                  className="text-xs text-brand-600 hover:underline"
                >
                  {t("modals.export.allesWissen")}
                </button>
              </div>
              <div className="space-y-3 max-h-56 overflow-auto rounded-md border border-line p-3">
                {groepen.map(([groep, velden]) => (
                  <div key={groep}>
                    <div className="text-[11px] font-semibold text-muted mb-1">
                      {groep === "product"
                        ? t("modals.export.productvelden")
                        : t("modals.export.wetgevingGroep", { groep })}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      {velden.map((v) => (
                        <label
                          key={v.sleutel}
                          className="flex items-center gap-2 text-sm text-ink"
                        >
                          <input
                            type="checkbox"
                            checked={gekozen.has(v.sleutel)}
                            onChange={() => toggle(v.sleutel)}
                          />
                          <span className="truncate">{v.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {melding && (
              <div
                className={`rounded-md border px-4 py-2 text-sm ${
                  melding.type === "succes"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                {melding.tekst}
              </div>
            )}

            {historie.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  {t("modals.export.recenteExports")}
                </div>
                <div className="space-y-1">
                  {historie.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between text-xs text-muted border-b border-line/70 py-1"
                    >
                      <span className="text-ink">{h.bestandsnaam}</span>
                      <span>
                        {t("modals.export.prodDatum", {
                          aantal: h.aantal_producten,
                          datum: new Date(h.aangemaakt_op).toLocaleString(
                            taal === "en" ? "en-GB" : "nl-NL"
                          ),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 px-6 py-4 border-t border-line">
          <Button variant="ghost" onClick={onClose}>
            {t("actie.sluiten")}
          </Button>
          <div className="ml-auto">
            <Button onClick={exporteer} disabled={bezig || !opties}>
              {bezig ? t("modals.export.exporteren") : t("modals.export.exporteer")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
