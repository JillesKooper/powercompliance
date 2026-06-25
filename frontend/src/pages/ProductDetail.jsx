import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Card, ProgressBar, Badge, Loading, ErrorBox } from "../components/ui";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [regels, setRegels] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setProduct(null);
    setRegels(null);
    Promise.all([api.product(id), api.productCompliance(id)])
      .then(([p, r]) => {
        setProduct(p);
        setRegels(r);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!product || !regels) return <Loading />;

  // groepeer regels per wetgeving
  const perWet = {};
  for (const r of regels) (perWet[r.wetgeving_code] ??= []).push(r);

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/producten" className="text-sm text-brand-600 hover:underline">
        ← Terug naar producten
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{product.naam}</h2>
            <div className="text-sm text-slate-500 mt-1 space-x-3">
              <span>Art.nr: {product.artikelnummer || "—"}</span>
              <span>EAN: {product.ean || "—"}</span>
            </div>
            <div className="flex gap-2 mt-3">
              {product.categorie && (
                <Badge color="blue">{product.categorie.naam}</Badge>
              )}
              {product.leverancier && (
                <Link to={`/leveranciers/${product.leverancier.id}`}>
                  <Badge color="slate">🏭 {product.leverancier.naam}</Badge>
                </Link>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 w-44">
            <div className="text-3xl font-bold text-slate-800">
              {product.compliance_percentage}%
            </div>
            <div className="text-xs text-slate-400 mb-2">compliance</div>
            <ProgressBar value={product.compliance_percentage} />
            <div className="text-xs text-slate-500 mt-2">
              {product.aantal_ingevuld}/{product.aantal_velden} velden ·{" "}
              <span className="text-red-500">
                {product.aantal_ontbrekend} ontbreekt
              </span>
            </div>
          </div>
        </div>
      </Card>

      {Object.entries(perWet).map(([code, items]) => (
        <Card key={code} className="overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
            ⚖️ {code}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {items.filter((i) => i.ingevuld).length}/{items.length} ingevuld
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((r) => (
              <div
                key={r.compliance_veld_id}
                className="px-5 py-3 flex items-center justify-between text-sm"
              >
                <div>
                  <div className="text-slate-700">{r.veld_naam}</div>
                  <div className="text-xs text-slate-400">{r.veld_type}</div>
                </div>
                {r.ingevuld ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs max-w-[200px] truncate">
                      {r.waarde}
                    </span>
                    <Badge color="green">✓ ingevuld</Badge>
                  </div>
                ) : (
                  <Badge color="red">ontbreekt</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
