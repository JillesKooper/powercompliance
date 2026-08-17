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
import { useTaal } from "../context/taal";

const LEEG = { naam: "", contactpersoon: "", email: "", telefoon: "", land: "NL" };

export default function Leveranciers() {
  const { t } = useTaal();
  const [pagina, setPagina] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [toonForm, setToonForm] = useState(false);
  const [toonImport, setToonImport] = useState(false);
  const [form, setForm] = useState(LEEG);
  const [geselecteerd, setGeselecteerd] = useState(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const leveranciers = pagina?.items ?? null;

  async function laad() {
    try {
      setPagina(await api.leveranciers({ page, per_page: 50 }));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    laad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function toggleSel(id) {
    setGeselecteerd((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  async function opslaan(e) {
    e.preventDefault();
    try {
      await api.maakLeverancier(form);
      setForm(LEEG);
      setToonForm(false);
      laad();
    } catch (err) {
      alert(t("leveranciers.opslaanMislukt", { fout: err.message }));
    }
  }

  async function verwijder(id) {
    if (!confirm(t("leveranciers.bevestigVerwijderen"))) return;
    await api.verwijderLeverancier(id);
    laad();
  }

  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-5">
      {bulkOpen && (
        <BulkDataverzoekModal
          ids={[...geselecteerd]}
          onClose={() => setBulkOpen(false)}
          onKlaar={() => {
            setBulkOpen(false);
            setGeselecteerd(new Set());
          }}
        />
      )}

      <div className="flex items-center gap-3">
        {geselecteerd.size > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>{t("leveranciers.geselecteerd", { n: geselecteerd.size })}</span>
            <Button onClick={() => setBulkOpen(true)}>
              ✉️ {t("leveranciers.bulkDataverzoek")}
            </Button>
            <button
              onClick={() => setGeselecteerd(new Set())}
              className="text-xs text-faint hover:underline"
            >
              {t("leveranciers.wissen")}
            </button>
          </div>
        )}
        <div className="ml-auto flex gap-3">
          <Button variant="ghost" onClick={() => setToonImport(true)}>
            ⬆ {t("leveranciers.importeren")}
          </Button>
          <Button onClick={() => setToonForm((v) => !v)}>+ {t("leveranciers.nieuweLeverancier")}</Button>
        </div>
      </div>

      {toonImport && (
        <ImportDialog
          soort="leveranciers"
          onClose={() => setToonImport(false)}
          onKlaar={laad}
        />
      )}

      {toonForm && (
        <Card className="p-5">
          <form onSubmit={opslaan} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ["naam", t("leveranciers.naam"), true],
              ["contactpersoon", t("leveranciers.contactpersoon"), false],
              ["email", t("leveranciers.email"), false],
              ["telefoon", t("leveranciers.telefoon"), false],
              ["land", t("leveranciers.land"), false],
            ].map(([key, label, req]) => (
              <label key={key} className="block">
                <span className="block text-xs font-medium text-muted mb-1">
                  {label}
                </span>
                <input
                  required={req}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="input"
                />
              </label>
            ))}
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit">{t("actie.opslaan")}</Button>
              <Button type="button" variant="ghost" onClick={() => setToonForm(false)}>
                {t("actie.annuleren")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!leveranciers ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {leveranciers.map((l) => (
              <Card key={l.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={geselecteerd.has(l.id)}
                      onChange={() => toggleSel(l.id)}
                    />
                    <div>
                      <Link
                        to={`/leveranciers/${l.id}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        {l.naam}
                      </Link>
                      <div className="text-xs text-faint">
                        {l.contactpersoon || "—"} · {l.land}
                      </div>
                    </div>
                  </div>
                  {l.actief ? (
                    <Badge color="green">{t("leveranciers.actief")}</Badge>
                  ) : (
                    <Badge color="slate">{t("leveranciers.inactief")}</Badge>
                  )}
                </div>
                {l.email && (
                  <div className="text-xs text-muted mt-2">{l.email}</div>
                )}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>{t("leveranciers.aantalProducten", { n: l.aantal_producten })}</span>
                    <span>
                      {l.aantal_ontbrekend > 0
                        ? t("leveranciers.aantalOntbrekend", { n: l.aantal_ontbrekend })
                        : t("leveranciers.compleet")}
                    </span>
                  </div>
                  <ProgressBar value={l.compliance_percentage} />
                </div>
                <div className="mt-4 pt-3 border-t border-line text-right">
                  <button
                    onClick={() => verwijder(l.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    {t("actie.verwijderen")}
                  </button>
                </div>
              </Card>
            ))}
          </div>
          <Paginatie pagina={pagina} onPagina={setPage} />
        </>
      )}
    </div>
  );
}

function BulkDataverzoekModal({ ids, onClose, onKlaar }) {
  const { t } = useTaal();
  const [onderwerp, setOnderwerp] = useState(() => t("leveranciers.standaardOnderwerp"));
  const [bericht, setBericht] = useState("");
  const [deadline, setDeadline] = useState("");
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState(null);

  async function verstuur() {
    setBezig(true);
    try {
      const r = await api.bulkDataverzoeken({
        leverancier_ids: ids,
        onderwerp,
        bericht: bericht || null,
        deadline: deadline || null,
      });
      setResultaat(r);
    } catch (e) {
      alert(t("leveranciers.mislukt", { fout: e.message }));
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-semibold text-ink">
            {t("leveranciers.bulkTitel", { n: ids.length })}
          </h2>
          <button
            onClick={onClose}
            className="text-faint hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-4">
          {resultaat ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              ✅ {t("leveranciers.aangemaakt", { n: resultaat.aantal })}
            </div>
          ) : (
            <>
              <label className="block">
                <span className="block text-xs font-medium text-muted mb-1">
                  {t("leveranciers.onderwerp")}
                </span>
                <input
                  value={onderwerp}
                  onChange={(e) => setOnderwerp(e.target.value)}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted mb-1">
                  {t("leveranciers.bericht")}
                </span>
                <textarea
                  value={bericht}
                  onChange={(e) => setBericht(e.target.value)}
                  rows={3}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted mb-1">
                  {t("leveranciers.deadline")}
                </span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="input"
                />
              </label>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 px-6 py-4 border-t border-line">
          {resultaat ? (
            <div className="ml-auto">
              <Button onClick={onKlaar}>{t("actie.sluiten")}</Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                {t("actie.annuleren")}
              </Button>
              <div className="ml-auto">
                <Button onClick={verstuur} disabled={bezig}>
                  {bezig
                    ? t("leveranciers.aanmakenBezig")
                    : t("leveranciers.aanmakenVoor", { n: ids.length })}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
