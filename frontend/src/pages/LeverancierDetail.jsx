import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Card, ProgressBar, Badge, Loading, ErrorBox } from "../components/ui";

export default function LeverancierDetail() {
  const { id } = useParams();
  const [lev, setLev] = useState(null);
  const [producten, setProducten] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLev(null);
    setProducten(null);
    Promise.all([api.leverancier(id), api.producten({ leverancier_id: id })])
      .then(([l, p]) => {
        setLev(l);
        setProducten(p);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!lev || !producten) return <Loading />;

  const gem = producten.length
    ? Math.round(
        (producten.reduce((s, p) => s + p.compliance_percentage, 0) /
          producten.length) *
          10
      ) / 10
    : 100;
  const totaalOntbrekend = producten.reduce(
    (s, p) => s + p.aantal_ontbrekend,
    0
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/leveranciers" className="text-sm text-brand-600 hover:underline">
        ← Terug naar leveranciers
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{lev.naam}</h2>
            <div className="text-sm text-slate-500 mt-1">
              {lev.contactpersoon || "—"} · {lev.land}
            </div>
            {lev.email && (
              <div className="text-sm text-slate-500">{lev.email}</div>
            )}
            {lev.telefoon && (
              <div className="text-sm text-slate-500">{lev.telefoon}</div>
            )}
          </div>
          {lev.actief ? (
            <Badge color="green">Actief</Badge>
          ) : (
            <Badge color="slate">Inactief</Badge>
          )}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4">
          <Mini label="Producten" value={producten.length} />
          <Mini label="Ontbrekende velden" value={totaalOntbrekend} rood />
          <div>
            <div className="text-xs text-slate-500 mb-1">Gem. compliance</div>
            <ProgressBar value={gem} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-3 border-b border-slate-200 font-semibold text-slate-800">
          Producten van deze leverancier
        </div>
        <div className="divide-y divide-slate-100">
          {producten.map((p) => (
            <Link
              key={p.id}
              to={`/producten/${p.id}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
            >
              <div>
                <div className="font-medium text-slate-800">{p.naam}</div>
                <div className="text-xs text-slate-400">
                  {p.artikelnummer || "—"}
                  {p.categorie ? ` · ${p.categorie.naam}` : ""}
                </div>
              </div>
              <div className="w-40">
                <ProgressBar value={p.compliance_percentage} />
              </div>
            </Link>
          ))}
          {producten.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">
              Nog geen producten.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value, rood }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${rood ? "text-red-600" : "text-slate-800"}`}>
        {value}
      </div>
    </div>
  );
}
