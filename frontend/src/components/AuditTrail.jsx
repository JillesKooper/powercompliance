import { useEffect, useState } from "react";
import { api } from "../api";
import { useTaal } from "../context/taal";
import { Badge, Loading } from "./ui";

// Icoon + badgekleur per audit-actie.
const ACTIE_META = {
  compliance_gewijzigd: { icoon: "✏️", kleur: "blue" },
  leverancier_gewijzigd: { icoon: "🏭", kleur: "blue" },
  product_toegevoegd: { icoon: "➕", kleur: "green" },
  product_gewijzigd: { icoon: "✏️", kleur: "amber" },
  product_verwijderd: { icoon: "🗑️", kleur: "red" },
  wetgeving_gewijzigd: { icoon: "⚖️", kleur: "amber" },
  dataverzoek_verstuurd: { icoon: "📧", kleur: "blue" },
  bulkimport: { icoon: "📥", kleur: "green" },
  reply_verwerkt: { icoon: "📨", kleur: "green" },
};

export function actieLabel(t, actie) {
  return t(`activiteit.actie.${actie}`) || actie;
}

export function formatTijdstip(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Presentational: rendert de audit-rijen als tabel. Herbruikt door de
// Activiteit-pagina én de audit-tabbladen op de detailpagina's.
export function AuditTabel({ rows, leeg }) {
  const { t } = useTaal();
  if (!rows || rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-faint text-sm">
        {leeg || t("activiteit.geen")}
      </div>
    );
  }
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm table-zebra">
        <thead className="bg-hover text-muted text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2 font-medium whitespace-nowrap">
              {t("activiteit.kolTijdstip")}
            </th>
            <th className="text-left px-4 py-2 font-medium">
              {t("activiteit.kolActie")}
            </th>
            <th className="text-left px-4 py-2 font-medium">
              {t("activiteit.kolObject")}
            </th>
            <th className="text-left px-4 py-2 font-medium">
              {t("activiteit.kolWijziging")}
            </th>
            <th className="text-left px-4 py-2 font-medium whitespace-nowrap">
              {t("activiteit.kolGebruiker")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const meta = ACTIE_META[r.actie] || { icoon: "•", kleur: "slate" };
            return (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-2.5 text-muted whitespace-nowrap">
                  {formatTijdstip(r.tijdstip)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge color={meta.kleur}>
                    <span className="mr-1">{meta.icoon}</span>
                    {actieLabel(t, r.actie)}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-ink font-medium">
                  {r.object_naam || "—"}
                </td>
                <td className="px-4 py-2.5 text-muted">
                  <Wijziging oud={r.oude_waarde} nieuw={r.nieuwe_waarde} />
                </td>
                <td className="px-4 py-2.5 text-faint whitespace-nowrap">
                  {r.gebruiker}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Wijziging({ oud, nieuw }) {
  const { t } = useTaal();
  if (oud && nieuw) {
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span className="line-through text-faint">{oud}</span>
        <span className="text-faint">{t("activiteit.naar")}</span>
        <span className="text-ink">{nieuw}</span>
      </span>
    );
  }
  return <span className="text-ink">{nieuw || oud || "—"}</span>;
}

// Embeddable audit-lijst voor een specifiek object (product/leverancier),
// gebruikt in de tabbladen op de detailpagina's.
export default function AuditTrail({ leverancierId, productId }) {
  const { t } = useTaal();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = { per_page: 200 };
    if (productId) params.product_id = productId;
    if (leverancierId) params.leverancier_id = leverancierId;
    setRows(null);
    api
      .audit(params)
      .then((r) => setRows(r.items))
      .catch((e) => setError(e.message));
  }, [leverancierId, productId]);

  if (error)
    return <div className="text-sm text-danger-text px-4 py-4">{error}</div>;
  if (rows === null) return <Loading />;
  return <AuditTabel rows={rows} leeg={t("activiteit.geenItem")} />;
}
