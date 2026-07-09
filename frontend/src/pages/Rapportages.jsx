import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { Card, Badge, Loading, ErrorBox } from "../components/ui";

const BLAUW = "#1a73e8";
const PIE_KLEUREN = ["#1a73e8", "#34a853", "#fbbc04", "#ea4335", "#8ab4f8"];

export default function Rapportages() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [bezig, setBezig] = useState(null); // `${soort}:${formaat}`

  useEffect(() => {
    api.rapportages().then(setData).catch((e) => setError(e.message));
  }, []);

  async function exporteer(soort, formaat) {
    setBezig(`${soort}:${formaat}`);
    try {
      await api.exporteerRapportage(soort, formaat);
    } catch (e) {
      alert("Export mislukt: " + e.message);
    } finally {
      setBezig(null);
    }
  }

  const compleetheidVerdeling = useMemo(() => {
    if (!data) return [];
    const buckets = { "≥ 90% compleet": 0, "60–89%": 0, "< 60%": 0 };
    for (const s of data.scorecards) {
      if (s.compleetheid_percentage >= 90) buckets["≥ 90% compleet"]++;
      else if (s.compleetheid_percentage >= 60) buckets["60–89%"]++;
      else buckets["< 60%"]++;
    }
    return Object.entries(buckets)
      .map(([naam, waarde]) => ({ naam, waarde }))
      .filter((b) => b.waarde > 0);
  }, [data]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      {/* a. Compliance-overzicht per wetgeving */}
      <Rapport
        titel="Compliance per wetgeving"
        omschrijving="Percentage compliant, aantal producten en ontbrekende velden per wetgeving."
        soort="compliance"
        bezig={bezig}
        onExport={exporteer}
      >
        {data.compliance_overzicht.length === 0 ? (
          <Leeg />
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.compliance_overzicht}
                  margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                  <XAxis dataKey="code" tick={{ fontSize: 12, fill: "#666" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#666" }} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "Compliance"]}
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e0e0e0" }}
                  />
                  <Bar dataKey="compliance_percentage" fill={BLAUW} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Tabel
              kop={["Wetgeving", "Naam", "Producten", "Compliance", "Ontbrekend"]}
              rijen={data.compliance_overzicht.map((r) => [
                <span className="font-medium text-ink">{r.code}</span>,
                <span className="text-muted">{r.naam}</span>,
                r.aantal_producten,
                <Badge color={r.compliance_percentage >= 80 ? "green" : "amber"}>
                  {r.compliance_percentage}%
                </Badge>,
                <span className={r.aantal_ontbrekende_velden ? "text-red-600" : "text-muted"}>
                  {r.aantal_ontbrekende_velden}
                </span>,
              ])}
            />
          </>
        )}
      </Rapport>

      {/* b. Leveranciersscorecards */}
      <Rapport
        titel="Leveranciersscorecards"
        omschrijving="Compleetheid, openstaande dataverzoeken en gemiddelde responstijd per leverancier."
        soort="scorecards"
        bezig={bezig}
        onExport={exporteer}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabel
              kop={["Leverancier", "Producten", "Compleetheid", "Open verzoeken", "Resp.tijd"]}
              rijen={data.scorecards.map((s) => [
                <span className="font-medium text-ink">{s.naam}</span>,
                s.aantal_producten,
                <Badge color={s.compleetheid_percentage >= 80 ? "green" : "amber"}>
                  {s.compleetheid_percentage}%
                </Badge>,
                s.open_verzoeken > 0 ? (
                  <span className="text-amber-600">{s.open_verzoeken}</span>
                ) : (
                  <span className="text-muted">0</span>
                ),
                s.gem_responstijd_dagen == null
                  ? <span className="text-muted">—</span>
                  : `${s.gem_responstijd_dagen} d`,
              ])}
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Verdeling compleetheid
            </div>
            {compleetheidVerdeling.length === 0 ? (
              <Leeg />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={compleetheidVerdeling}
                      dataKey="waarde"
                      nameKey="naam"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={(e) => e.waarde}
                    >
                      {compleetheidVerdeling.map((_, i) => (
                        <Cell key={i} fill={PIE_KLEUREN[i % PIE_KLEUREN.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </Rapport>

      {/* c. Risicosignalering */}
      <Rapport
        titel="Risicosignalering"
        omschrijving="Leveranciers met een deadline binnen 30/60/90 dagen én nog ontbrekende data."
        soort="risico"
        bezig={bezig}
        onExport={exporteer}
      >
        {data.risico.length === 0 ? (
          <div className="text-sm text-muted py-4">
            🎉 Geen leveranciers met een naderende deadline en ontbrekende data.
          </div>
        ) : (
          <Tabel
            kop={["Leverancier", "Deadline", "Resterend", "Risico", "Ontbrekend"]}
            rijen={data.risico.map((r) => [
              <span className="font-medium text-ink">{r.naam}</span>,
              r.deadline || "—",
              `${r.dagen_tot_deadline} dagen`,
              <Badge
                color={
                  r.risicocategorie === "30"
                    ? "red"
                    : r.risicocategorie === "60"
                    ? "amber"
                    : "slate"
                }
              >
                ≤ {r.risicocategorie} dagen
              </Badge>,
              <span className="text-red-600">{r.aantal_ontbrekend} velden</span>,
            ])}
          />
        )}
      </Rapport>

      {/* d. Compliance-trend over tijd */}
      <Rapport
        titel="Compliance-trend"
        omschrijving="Gemiddelde compliance per maand — gaat het beter of slechter?"
        soort="trend"
        bezig={bezig}
        onExport={exporteer}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.trend}
              margin={{ top: 8, right: 12, bottom: 4, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#666" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#666" }} />
              <Tooltip
                formatter={(v) => [`${v}%`, "Compliance"]}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e0e0e0" }}
              />
              <Line
                type="monotone"
                dataKey="compliance_percentage"
                stroke={BLAUW}
                strokeWidth={2}
                dot={{ r: 3, fill: BLAUW }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Rapport>
    </div>
  );
}

function Rapport({ titel, omschrijving, soort, bezig, onExport, children }) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-semibold text-ink">{titel}</h2>
          <p className="text-sm text-muted mt-0.5">{omschrijving}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onExport(soort, "pdf")}
            disabled={bezig === `${soort}:pdf`}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover disabled:opacity-50"
          >
            {bezig === `${soort}:pdf` ? "…" : "PDF"}
          </button>
          <button
            onClick={() => onExport(soort, "xlsx")}
            disabled={bezig === `${soort}:xlsx`}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover disabled:opacity-50"
          >
            {bezig === `${soort}:xlsx` ? "…" : "Excel"}
          </button>
        </div>
      </div>
      {children}
    </Card>
  );
}

function Tabel({ kop, rijen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-line">
            {kop.map((k, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rijen.map((rij, i) => (
            <tr key={i} className="border-b border-line/60">
              {rij.map((cel, j) => (
                <td key={j} className="px-3 py-2">
                  {cel}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Leeg() {
  return <div className="text-sm text-muted py-6 text-center">Geen gegevens.</div>;
}
