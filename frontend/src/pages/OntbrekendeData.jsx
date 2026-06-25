import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Badge, Loading, ErrorBox } from "../components/ui";

export default function OntbrekendeData() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.ontbrekendeData().then(setItems).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!items) return <Loading />;

  // groepeer per leverancier
  const perLev = {};
  for (const p of items) {
    (perLev[p.leverancier_naam] ??= []).push(p);
  }
  const totaalVelden = items.reduce(
    (s, p) => s + p.ontbrekende_velden.length,
    0
  );

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center text-slate-500">
        🎉 Alle producten hebben volledige compliance-data.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-red-600">{totaalVelden}</span>{" "}
          ontbrekende velden verspreid over{" "}
          <span className="font-semibold">{items.length}</span> producten en{" "}
          <span className="font-semibold">{Object.keys(perLev).length}</span>{" "}
          leveranciers.
        </div>
      </Card>

      {Object.entries(perLev).map(([lev, producten]) => (
        <Card key={lev} className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
            <div className="font-semibold text-slate-800">🏭 {lev}</div>
            <Badge color="red">
              {producten.reduce((s, p) => s + p.ontbrekende_velden.length, 0)}{" "}
              velden
            </Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {producten.map((p) => (
              <div key={p.product_id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-slate-800">
                    {p.product_naam}
                  </span>
                  <span className="text-xs text-slate-400">
                    {p.artikelnummer}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.ontbrekende_velden.map((v) => (
                    <span
                      key={v.compliance_veld_id}
                      className="inline-flex items-center gap-1 rounded-md bg-red-50 text-red-700 px-2 py-1 text-xs"
                    >
                      <span className="font-semibold">{v.wetgeving_code}</span>
                      <span className="text-red-400">·</span>
                      {v.veld_naam}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
