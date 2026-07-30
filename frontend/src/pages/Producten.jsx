import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  Card,
  ProgressBar,
  Badge,
  Loading,
  ErrorBox,
  Button,
  Paginatie,
} from "../components/ui";
import ImportDialog from "../components/ImportDialog.jsx";
import ExportModal from "../components/ExportModal.jsx";
import { useTaal } from "../context/taal";

const LEEG = {
  naam: "",
  artikelnummer: "",
  ean: "",
  leverancier_id: "",
  categorie_id: "",
};

export default function Producten() {
  const { t } = useTaal();
  const [pagina, setPagina] = useState(null);
  const [leveranciers, setLeveranciers] = useState([]);
  const [categorieen, setCategorieen] = useState([]);
  const [error, setError] = useState(null);
  const [zoek, setZoek] = useState("");
  const [filterLev, setFilterLev] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [toonForm, setToonForm] = useState(false);
  const [toonImport, setToonImport] = useState(false);
  const [toonExport, setToonExport] = useState(false);
  const [form, setForm] = useState(LEEG);

  const producten = pagina?.items ?? null;

  async function laad() {
    try {
      const data = await api.producten({
        zoek,
        leverancier_id: filterLev || undefined,
        compliance_status: filterStatus || undefined,
        page,
        per_page: 50,
      });
      setPagina(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    api.leveranciers({ per_page: 1000 }).then((d) => setLeveranciers(d.items)).catch(() => {});
    api.categorieen().then(setCategorieen).catch(() => {});
  }, []);

  // filterwijziging -> terug naar pagina 1
  useEffect(() => {
    setPage(1);
  }, [zoek, filterLev, filterStatus]);

  useEffect(() => {
    const t = setTimeout(laad, 250);
    return () => clearTimeout(t);
  }, [zoek, filterLev, filterStatus, page]);

  async function opslaan(e) {
    e.preventDefault();
    try {
      await api.maakProduct({
        ...form,
        leverancier_id: Number(form.leverancier_id),
        categorie_id: form.categorie_id ? Number(form.categorie_id) : null,
      });
      setForm(LEEG);
      setToonForm(false);
      laad();
    } catch (err) {
      alert(t("producten.opslaanMislukt", { msg: err.message }));
    }
  }

  async function verwijder(id) {
    if (!confirm(t("producten.bevestigVerwijderen"))) return;
    await api.verwijderProduct(id);
    laad();
  }

  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder={t("producten.zoekPlaceholder")}
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          className="flex-1 min-w-[220px] rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        <select
          value={filterLev}
          onChange={(e) => setFilterLev(e.target.value)}
          className="rounded-md border border-line px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">{t("producten.alleLeveranciers")}</option>
          {leveranciers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.naam}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-line px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">{t("producten.alleStatussen")}</option>
          <option value="compliant">{t("producten.statusCompliant")}</option>
          <option value="gedeeltelijk">{t("producten.statusGedeeltelijk")}</option>
          <option value="incompleet">{t("producten.statusIncompleet")}</option>
        </select>
        <Button variant="ghost" onClick={() => setToonImport(true)}>
          {t("producten.importeren")}
        </Button>
        <Button variant="ghost" onClick={() => setToonExport(true)}>
          {t("producten.exporteerPim")}
        </Button>
        <Button onClick={() => setToonForm((v) => !v)}>{t("producten.nieuwProduct")}</Button>
      </div>

      {toonExport && <ExportModal onClose={() => setToonExport(false)} />}

      {toonImport && (
        <ImportDialog
          soort="producten"
          onClose={() => setToonImport(false)}
          onKlaar={laad}
        />
      )}

      {toonForm && (
        <Card className="p-5">
          <form onSubmit={opslaan} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Veld label={t("producten.labelNaam")}>
              <input
                required
                value={form.naam}
                onChange={(e) => setForm({ ...form, naam: e.target.value })}
                className="input"
              />
            </Veld>
            <Veld label={t("producten.labelArtikelnummer")}>
              <input
                value={form.artikelnummer}
                onChange={(e) =>
                  setForm({ ...form, artikelnummer: e.target.value })
                }
                className="input"
              />
            </Veld>
            <Veld label={t("producten.labelEan")}>
              <input
                value={form.ean}
                onChange={(e) => setForm({ ...form, ean: e.target.value })}
                className="input"
              />
            </Veld>
            <Veld label={t("producten.labelLeverancier")}>
              <select
                required
                value={form.leverancier_id}
                onChange={(e) =>
                  setForm({ ...form, leverancier_id: e.target.value })
                }
                className="input bg-white"
              >
                <option value="">{t("producten.kiesLeverancier")}</option>
                {leveranciers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.naam}
                  </option>
                ))}
              </select>
            </Veld>
            <Veld label={t("producten.labelCategorie")}>
              <select
                value={form.categorie_id}
                onChange={(e) =>
                  setForm({ ...form, categorie_id: e.target.value })
                }
                className="input bg-white"
              >
                <option value="">{t("producten.geenCategorie")}</option>
                {categorieen.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.naam}
                  </option>
                ))}
              </select>
            </Veld>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">{t("actie.opslaan")}</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setToonForm(false)}
              >
                {t("actie.annuleren")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {!producten ? (
          <Loading />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="px-5 py-3 font-medium">{t("producten.kolomProduct")}</th>
                <th className="px-5 py-3 font-medium">{t("producten.kolomLeverancier")}</th>
                <th className="px-5 py-3 font-medium">{t("producten.kolomCategorie")}</th>
                <th className="px-5 py-3 font-medium w-56">{t("producten.kolomCompliance")}</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {producten.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <Link
                      to={`/producten/${p.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {p.naam}
                    </Link>
                    <div className="text-xs text-slate-400">
                      {p.artikelnummer || "—"}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {p.leverancier?.naam || "—"}
                  </td>
                  <td className="px-5 py-3">
                    {p.categorie ? (
                      <Badge color="blue">{p.categorie.naam}</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <ProgressBar value={p.compliance_percentage} />
                    {p.aantal_ontbrekend > 0 && (
                      <div className="text-xs text-red-500 mt-1">
                        {t("producten.veldenOntbreken", { n: p.aantal_ontbrekend })}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => verwijder(p.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      {t("actie.verwijderen")}
                    </button>
                  </td>
                </tr>
              ))}
              {producten.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    {t("producten.geenProducten")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Paginatie pagina={pagina} onPagina={setPage} />
    </div>
  );
}

function Veld({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
