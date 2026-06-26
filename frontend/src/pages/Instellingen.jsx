import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Badge, Loading, ProgressBar } from "../components/ui";

const STATUS_KLEUR = {
  open: "amber",
  verzonden: "blue",
  ontvangen: "blue",
  afgerond: "green",
};

export default function Instellingen() {
  const [categorieen, setCategorieen] = useState([]);
  const [dataverzoeken, setDataverzoeken] = useState(null);
  const [wetgeving, setWetgeving] = useState(null);

  useEffect(() => {
    api.categorieen().then(setCategorieen).catch(() => {});
    api.dataverzoeken().then((d) => setDataverzoeken(d.items)).catch(() => {});
    api.wetgevingBeheer().then(setWetgeving).catch(() => {});
  }, []);

  async function toggleWetgeving(w) {
    const bijgewerkt = await api.zetWetgevingActief(w.id, !w.actief);
    setWetgeving((prev) =>
      prev.map((x) => (x.id === w.id ? bijgewerkt : x))
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="p-6">
        <h2 className="font-semibold text-slate-800 mb-1">Organisatie</h2>
        <p className="text-sm text-slate-500 mb-4">
          Algemene gegevens van uw groothandel.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Bedrijfsnaam
            </span>
            <input className="input" defaultValue="Mijn Groothandel B.V." />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Contact e-mail
            </span>
            <input className="input" defaultValue="gvdmond@machine-learning.company" />
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-800 mb-1">Wetgevingsbeheer</h2>
        <p className="text-sm text-slate-500 mb-4">
          Zet wetgeving aan of uit. Uitgeschakelde wetgeving telt niet mee in
          compliance-berekeningen en dataverzoeken.
        </p>
        {!wetgeving ? (
          <Loading />
        ) : (
          <div className="space-y-2">
            {wetgeving.map((w) => (
              <div
                key={w.id}
                className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
                  w.actief ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{w.code}</span>
                    {w.aantal_producten === 0 && (
                      <Badge color="slate">geen producten</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{w.naam}</div>
                </div>
                <div className="w-28 text-xs text-slate-500 text-right shrink-0">
                  {w.aantal_producten} product
                  {w.aantal_producten === 1 ? "" : "en"}
                </div>
                <div className="w-32 shrink-0">
                  <ProgressBar value={w.compliance_percentage} />
                </div>
                <button
                  type="button"
                  onClick={() => toggleWetgeving(w)}
                  role="switch"
                  aria-checked={w.actief}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    w.actief ? "bg-brand-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      w.actief ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Productcategorieën</h2>
        <div className="flex flex-wrap gap-2">
          {categorieen.map((c) => (
            <Badge key={c.id} color="blue">
              {c.naam}
            </Badge>
          ))}
          {categorieen.length === 0 && (
            <span className="text-sm text-slate-400">Geen categorieën.</span>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Dataverzoeken</h2>
        {!dataverzoeken ? (
          <Loading />
        ) : dataverzoeken.length === 0 ? (
          <span className="text-sm text-slate-400">Geen dataverzoeken.</span>
        ) : (
          <div className="space-y-2">
            {dataverzoeken.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {d.onderwerp}
                  </div>
                  <div className="text-xs text-slate-400">
                    {d.leverancier?.naam}
                    {d.deadline ? ` · deadline ${d.deadline}` : ""}
                  </div>
                </div>
                <Badge color={STATUS_KLEUR[d.status] || "slate"}>
                  {d.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
