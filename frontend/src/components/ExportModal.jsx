import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Button, Loading } from "./ui";

const FORMATEN = [
  { key: "csv", label: "CSV", hint: "Universeel, ; als scheidingsteken" },
  { key: "xlsx", label: "Excel", hint: "Opgemaakt .xlsx-bestand" },
  { key: "json", label: "JSON", hint: "Voor API-/systeemkoppelingen" },
];

export default function ExportModal({ onClose }) {
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
      .exportOpties()
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
  }, []);

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
      setMelding({ type: "fout", tekst: "Kies minstens één veld om te exporteren." });
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
      });
      setMelding({
        type: "succes",
        tekst: `Export gestart: ${res.aantal ?? "?"} producten in ${res.bestandsnaam}. Webhook-abonnees zijn op de hoogte gesteld.`,
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
          <h2 className="font-semibold text-ink">Exporteer naar PIM/ERP</h2>
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
                Formaat
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
                    <div className="text-[11px] text-muted">{f.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                Welke producten
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={leverancierId}
                  onChange={(e) => setLeverancierId(e.target.value)}
                  className="input bg-white"
                >
                  <option value="">Alle leveranciers</option>
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
                  <option value="">Alle categorieën</option>
                  {opties.categorieen.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.naam}
                    </option>
                  ))}
                </select>
                <select
                  value={wetgevingCode}
                  onChange={(e) => setWetgevingCode(e.target.value)}
                  className="input bg-white"
                >
                  <option value="">Alle wetgeving</option>
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
                Alleen volledig goedgekeurde (compliant) producten
              </label>
            </div>

            {/* Velden */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                  Welke velden ({gekozen.size})
                </div>
                <button
                  onClick={() => setGekozen(new Set())}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Alles wissen
                </button>
              </div>
              <div className="space-y-3 max-h-56 overflow-auto rounded-md border border-line p-3">
                {groepen.map(([groep, velden]) => (
                  <div key={groep}>
                    <div className="text-[11px] font-semibold text-muted mb-1">
                      {groep === "product" ? "Productvelden" : `Wetgeving · ${groep}`}
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
                  Recente exports
                </div>
                <div className="space-y-1">
                  {historie.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between text-xs text-muted border-b border-line/70 py-1"
                    >
                      <span className="text-ink">{h.bestandsnaam}</span>
                      <span>
                        {h.aantal_producten} prod. ·{" "}
                        {new Date(h.aangemaakt_op).toLocaleString("nl-NL")}
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
            Sluiten
          </Button>
          <div className="ml-auto">
            <Button onClick={exporteer} disabled={bezig || !opties}>
              {bezig ? "Exporteren…" : "Exporteer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
