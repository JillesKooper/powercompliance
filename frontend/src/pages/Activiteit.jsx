import { useEffect, useState } from "react";
import { api } from "../api";
import { useTaal } from "../context/taal";
import { Card, Loading, ErrorBox, Button, Paginatie } from "../components/ui";
import { AuditTabel, actieLabel } from "../components/AuditTrail.jsx";

const LEEG_FILTER = {
  van: "",
  tot: "",
  actie: "",
  leverancier_id: "",
  zoek: "",
};

export default function Activiteit() {
  const { t } = useTaal();
  const [filter, setFilter] = useState(LEEG_FILTER);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [opties, setOpties] = useState({ acties: [], leveranciers: [] });
  const [error, setError] = useState(null);
  const [exporteren, setExporteren] = useState(false);

  useEffect(() => {
    api.auditFilters().then(setOpties).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api
      .audit({ ...filter, page, per_page: 50 })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [filter, page]);

  function wijzig(veld, waarde) {
    setPage(1);
    setFilter((f) => ({ ...f, [veld]: waarde }));
  }

  async function exporteerExcel() {
    setExporteren(true);
    try {
      await api.exporteerAudit(filter);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporteren(false);
    }
  }

  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted -mt-3">{t("activiteit.ondertitel")}</p>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <Veld label={t("activiteit.filterDatumVan")}>
            <input
              type="date"
              value={filter.van}
              onChange={(e) => wijzig("van", e.target.value)}
              className="input py-1.5"
            />
          </Veld>
          <Veld label={t("activiteit.filterDatumTot")}>
            <input
              type="date"
              value={filter.tot}
              onChange={(e) => wijzig("tot", e.target.value)}
              className="input py-1.5"
            />
          </Veld>
          <Veld label={t("activiteit.filterActie")}>
            <select
              value={filter.actie}
              onChange={(e) => wijzig("actie", e.target.value)}
              className="input py-1.5"
            >
              <option value="">{t("activiteit.alleActies")}</option>
              {opties.acties.map((a) => (
                <option key={a} value={a}>
                  {actieLabel(t, a)}
                </option>
              ))}
            </select>
          </Veld>
          <Veld label={t("activiteit.filterLeverancier")}>
            <select
              value={filter.leverancier_id}
              onChange={(e) => wijzig("leverancier_id", e.target.value)}
              className="input py-1.5"
            >
              <option value="">{t("activiteit.alleLeveranciers")}</option>
              {opties.leveranciers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.naam}
                </option>
              ))}
            </select>
          </Veld>
          <Veld label={t("activiteit.filterZoek")}>
            <input
              type="text"
              value={filter.zoek}
              onChange={(e) => wijzig("zoek", e.target.value)}
              className="input py-1.5"
            />
          </Veld>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setFilter(LEEG_FILTER)}>
              {t("activiteit.wissen")}
            </Button>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button
            variant="ghost"
            onClick={exporteerExcel}
            disabled={exporteren || !data || data.total === 0}
          >
            {t("activiteit.exporteren")}
          </Button>
        </div>
      </Card>

      {/* Tijdlijn */}
      <Card className="overflow-hidden">
        {data === null ? (
          <Loading />
        ) : (
          <>
            <AuditTabel rows={data.items} />
            <div className="px-4 border-t border-line">
              <Paginatie pagina={data} onPagina={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Veld({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}
