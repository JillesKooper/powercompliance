import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, StatCard, ProgressBar, Loading, ErrorBox } from "../components/ui";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [notificaties, setNotificaties] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.dashboard(), api.notificaties()])
      .then(([s, n]) => {
        setStats(s);
        setNotificaties(n);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Gemiddelde compliance"
          value={`${stats.gemiddelde_compliance}%`}
          accent={stats.gemiddelde_compliance >= 80 ? "green" : "amber"}
          sub="over alle producten"
        />
        <StatCard
          label="Ontbrekende velden"
          value={stats.aantal_ontbrekende_velden}
          accent="red"
          sub={`${stats.aantal_producten_incompleet} producten incompleet`}
        />
        <StatCard
          label="Leveranciers"
          value={stats.aantal_leveranciers}
          sub={`${stats.aantal_producten} producten`}
        />
        <StatCard
          label="Open dataverzoeken"
          value={stats.open_dataverzoeken}
          accent="amber"
          sub={`${stats.aantal_wetgeving} wetgevingen gevolgd`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">
              Compliance per wetgeving
            </h2>
            <Link
              to="/wetgeving"
              className="text-sm text-brand-600 hover:underline"
            >
              Bekijk wetgeving →
            </Link>
          </div>
          <div className="space-y-4">
            {stats.compliance_per_wetgeving.map((w) => (
              <div key={w.code}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{w.code}</span>
                  <span className="text-slate-400 truncate ml-4 max-w-xs">
                    {w.naam}
                  </span>
                </div>
                <ProgressBar value={w.percentage} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Notificaties</h2>
          <div className="space-y-3">
            {notificaties.length === 0 && (
              <div className="text-sm text-slate-400">Geen notificaties.</div>
            )}
            {notificaties.map((n) => (
              <div
                key={n.id}
                className={`rounded-lg border p-3 text-sm ${
                  n.gelezen
                    ? "border-slate-200 bg-slate-50"
                    : "border-brand-100 bg-brand-50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-slate-800">
                  <span>
                    {n.type === "waarschuwing"
                      ? "⚠️"
                      : n.type === "succes"
                      ? "✅"
                      : n.type === "fout"
                      ? "❌"
                      : "ℹ️"}
                  </span>
                  {n.titel}
                </div>
                {n.bericht && (
                  <div className="text-slate-500 mt-1 text-xs leading-relaxed">
                    {n.bericht}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
