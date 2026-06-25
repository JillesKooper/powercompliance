import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Badge, Loading } from "../components/ui";

const STATUS_KLEUR = {
  open: "amber",
  verzonden: "blue",
  ontvangen: "blue",
  afgerond: "green",
};

export default function Instellingen() {
  const [categorieen, setCategorieen] = useState([]);
  const [dataverzoeken, setDataverzoeken] = useState(null);

  useEffect(() => {
    api.categorieen().then(setCategorieen).catch(() => {});
    api.dataverzoeken().then(setDataverzoeken).catch(() => {});
  }, []);

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
