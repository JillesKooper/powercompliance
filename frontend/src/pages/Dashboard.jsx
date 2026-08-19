import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Card, StatCard, ProgressBar, Loading, ErrorBox, Button } from "../components/ui";
import { useNotificaties } from "../context/notificaties";
import { useTaal } from "../context/taal";
import { wetgevingCode, wetgevingNaam } from "../i18n/dataVertaling";
import NotificatieModal from "../components/NotificatieModal.jsx";
import ExportModal from "../components/ExportModal.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, taal } = useTaal();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [documenten, setDocumenten] = useState(null);
  const [toonExport, setToonExport] = useState(false);
  const { items: notificaties, ongelezen, markeerAllesGelezen } =
    useNotificaties();
  const [gekozenId, setGekozenId] = useState(null);
  const gekozen = notificaties.find((n) => n.id === gekozenId) || null;

  function laadStats() {
    api
      .dashboard()
      .then(setStats)
      .catch((e) => setError(e.message));
    api.verlopendeDocumenten().then(setDocumenten).catch(() => {});
  }

  useEffect(() => {
    laadStats();
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

      {toonExport && <ExportModal onClose={() => setToonExport(false)} />}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setToonExport(true)}>
          {t("dashboard.exporteerPim")}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("dashboard.gemiddeldeCompliance")}
          value={`${stats.gemiddelde_compliance}%`}
          accent={stats.gemiddelde_compliance >= 80 ? "green" : "amber"}
          sub={t("dashboard.overAlleProducten")}
          onClick={() => navigate("/producten")}
        />
        <StatCard
          label={t("dashboard.ontbrekendeVelden")}
          value={stats.aantal_ontbrekende_velden}
          accent="red"
          sub={t("dashboard.productenIncompleet", {
            n: stats.aantal_producten_incompleet,
          })}
          onClick={() => navigate("/ontbrekende-data")}
        />
        <StatCard
          label={t("dashboard.leveranciers")}
          value={stats.aantal_leveranciers}
          sub={t("dashboard.nProducten", { n: stats.aantal_producten })}
          onClick={() => navigate("/leveranciers")}
        />
        <StatCard
          label={t("dashboard.openDataverzoeken")}
          value={stats.open_dataverzoeken}
          accent="amber"
          sub={t("dashboard.wetgevingenGevolgd", { n: stats.aantal_wetgeving })}
          onClick={() => navigate("/instellingen#dataverzoeken")}
        />
      </div>

      {documenten &&
        (documenten.aantal_verlopen > 0 || documenten.aantal_binnenkort > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DocumentWidget
              titel={t("dashboard.verlopenDocumenten")}
              icoon="⛔"
              kleur="red"
              items={documenten.verlopen}
              leeg={t("dashboard.geenVerlopenDocumenten")}
              metDagen={(d) =>
                t("dashboard.dagenVerlopen", {
                  n: Math.abs(d.dagen_tot_verloop),
                })
              }
            />
            <DocumentWidget
              titel={t("dashboard.verlooptBinnenkort")}
              icoon="⏳"
              kleur="amber"
              items={documenten.verloopt_binnenkort}
              leeg={t("dashboard.nietsVerlooptBinnen60")}
              metDagen={(d) =>
                t("dashboard.nogNdagen", { n: d.dagen_tot_verloop })
              }
            />
          </div>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink">
              {t("dashboard.compliancePerWetgeving")}
            </h2>
            <Link
              to="/wetgeving"
              className="text-sm text-brandtext hover:underline"
            >
              {t("dashboard.bekijkWetgeving")}
            </Link>
          </div>
          <div className="space-y-1">
            {stats.compliance_per_wetgeving.map((w) => (
              <button
                key={w.code}
                type="button"
                onClick={() => navigate("/wetgeving", { state: { code: w.code } })}
                className="w-full text-left rounded-md -mx-2 px-2 py-2 cursor-pointer transition-colors hover:bg-hover"
              >
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-ink">
                    {wetgevingCode(w.code, taal)}
                  </span>
                  <span className="text-faint truncate ml-4 max-w-xs">
                    {wetgevingNaam(w.code, w.naam, taal)}
                  </span>
                </div>
                <ProgressBar value={w.percentage} />
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink">
              {t("dashboard.notificaties")}
              {ongelezen > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
                  {ongelezen}
                </span>
              )}
            </h2>
            {ongelezen > 0 && (
              <button
                onClick={markeerAllesGelezen}
                className="text-xs text-brandtext hover:underline"
              >
                {t("dashboard.allesGelezen")}
              </button>
            )}
          </div>
          <div className="space-y-3">
            {notificaties.length === 0 && (
              <div className="text-sm text-faint">
                {t("dashboard.geenNotificaties")}
              </div>
            )}
            {notificaties.map((n) => {
              // Ongelezen notificaties krijgen een zacht statusvlak per type
              // (geel/groen/rood/blauw). De soft/line-tokens flippen mee met
              // darkmode, dus text-ink houdt overal ≥ 4.5:1 contrast.
              const tint =
                n.type === "waarschuwing"
                  ? "border-warning-line bg-warning-soft"
                  : n.type === "succes"
                  ? "border-success-line bg-success-soft"
                  : n.type === "fout"
                  ? "border-danger-line bg-danger-soft"
                  : "border-info-line bg-info-soft";
              return (
              <button
                key={n.id}
                onClick={() => setGekozenId(n.id)}
                className={`w-full text-left rounded-lg border p-3 text-sm cursor-pointer transition-colors hover:border-brand-300 hover:bg-hover ${
                  n.gelezen ? "border-line bg-hover" : tint
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
                    className={`flex-1 text-ink ${
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
                  <div className="text-[11px] text-faint mt-1 ml-6">
                    {n.categorie}
                  </div>
                )}
                {n.bericht && (
                  <div className="text-muted mt-1 text-xs leading-relaxed ml-6 line-clamp-2">
                    {n.bericht}
                  </div>
                )}
              </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function DocumentWidget({ titel, icoon, kleur, items, leeg, metDagen }) {
  const { t } = useTaal();
  const tekstKleur = kleur === "red" ? "text-danger-text" : "text-warning-text";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-ink">
          <span className="mr-2">{icoon}</span>
          {titel}
        </h2>
        <span
          className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-xs font-semibold ${
            kleur === "red"
              ? "bg-danger-soft text-danger-text"
              : "bg-warning-soft text-warning-text"
          }`}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted">{leeg}</div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((d) => (
            <Link
              key={d.id}
              to={`/producten/${d.product_id}`}
              className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm hover:bg-hover"
            >
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">
                  {d.product_naam}
                </div>
                <div className="text-xs text-muted truncate">
                  {d.originele_naam}
                </div>
              </div>
              <span className={`text-xs shrink-0 ${tekstKleur}`}>
                {metDagen(d)}
              </span>
            </Link>
          ))}
          {items.length > 5 && (
            <div className="text-xs text-muted pt-1">
              {t("dashboard.nMeer", { n: items.length - 5 })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
