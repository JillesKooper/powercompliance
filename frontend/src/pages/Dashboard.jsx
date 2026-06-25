import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, StatCard, ProgressBar, Loading, ErrorBox } from "../components/ui";
import { useNotificaties } from "../context/notificaties";
import NotificatieModal from "../components/NotificatieModal.jsx";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const { items: notificaties, ongelezen, markeerAllesGelezen } =
    useNotificaties();
  const [gekozenId, setGekozenId] = useState(null);
  const gekozen = notificaties.find((n) => n.id === gekozenId) || null;

  useEffect(() => {
    api
      .dashboard()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <Loading />;

  return (
    <div className="space-y-6">
      {gekozen && (
        <NotificatieModal
          notificatie={gekozen}
          onClose={() => setGekozenId(null)}
        />
      )}

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">
              Notificaties
              {ongelezen > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
                  {ongelezen}
                </span>
              )}
            </h2>
            {ongelezen > 0 && (
              <button
                onClick={markeerAllesGelezen}
                className="text-xs text-brand-600 hover:underline"
              >
                Alles gelezen
              </button>
            )}
          </div>
          <div className="space-y-3">
            {notificaties.length === 0 && (
              <div className="text-sm text-slate-400">Geen notificaties.</div>
            )}
            {notificaties.map((n) => (
              <button
                key={n.id}
                onClick={() => setGekozenId(n.id)}
                className={`w-full text-left rounded-lg border p-3 text-sm transition-colors hover:border-brand-300 ${
                  n.gelezen
                    ? "border-slate-200 bg-slate-50"
                    : "border-brand-100 bg-brand-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>
                    {n.type === "waarschuwing"
                      ? "⚠️"
                      : n.type === "succes"
                      ? "✅"
                      : n.type === "fout"
                      ? "❌"
                      : "ℹ️"}
                  </span>
                  <span
                    className={`flex-1 text-slate-800 ${
                      n.gelezen ? "font-medium" : "font-bold"
                    }`}
                  >
                    {n.titel}
                  </span>
                  {!n.gelezen && (
                    <span className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                  )}
                </div>
                {n.categorie && (
                  <div className="text-[11px] text-slate-400 mt-1 ml-6">
                    {n.categorie}
                  </div>
                )}
                {n.bericht && (
                  <div className="text-slate-500 mt-1 text-xs leading-relaxed ml-6 line-clamp-2">
                    {n.bericht}
                  </div>
                )}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
