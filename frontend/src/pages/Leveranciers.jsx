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

const LEEG = { naam: "", contactpersoon: "", email: "", telefoon: "", land: "NL" };

export default function Leveranciers() {
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
      alert("Opslaan mislukt: " + err.message);
    }
  }

  async function verwijder(id) {
    if (!confirm("Leverancier en bijbehorende producten verwijderen?")) return;
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
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>{geselecteerd.size} geselecteerd</span>
            <Button onClick={() => setBulkOpen(true)}>
              ✉️ Bulk-dataverzoek
            </Button>
            <button
              onClick={() => setGeselecteerd(new Set())}
              className="text-xs text-slate-400 hover:underline"
            >
              wissen
            </button>
          </div>
        )}
        <div className="ml-auto flex gap-3">
          <Button variant="ghost" onClick={() => setToonImport(true)}>
            ⬆ Importeren
          </Button>
          <Button onClick={() => setToonForm((v) => !v)}>+ Nieuwe leverancier</Button>
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
              ["naam", "Naam *", true],
              ["contactpersoon", "Contactpersoon", false],
              ["email", "E-mail", false],
              ["telefoon", "Telefoon", false],
              ["land", "Land", false],
            ].map(([key, label, req]) => (
              <label key={key} className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">
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
              <Button type="submit">Opslaan</Button>
              <Button type="button" variant="ghost" onClick={() => setToonForm(false)}>
                Annuleren
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
                      <div className="text-xs text-slate-400">
                        {l.contactpersoon || "—"} · {l.land}
                      </div>
                    </div>
                  </div>
                  {l.actief ? (
                    <Badge color="green">Actief</Badge>
                  ) : (
                    <Badge color="slate">Inactief</Badge>
                  )}
                </div>
                {l.email && (
                  <div className="text-xs text-slate-500 mt-2">{l.email}</div>
                )}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{l.aantal_producten} producten</span>
                    <span>
                      {l.aantal_ontbrekend > 0
                        ? `${l.aantal_ontbrekend} ontbrekend`
                        : "compleet"}
                    </span>
                  </div>
                  <ProgressBar value={l.compliance_percentage} />
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                  <button
                    onClick={() => verwijder(l.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Verwijderen
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
  const [onderwerp, setOnderwerp] = useState("Verzoek om ontbrekende compliance-data");
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
      alert("Mislukt: " + e.message);
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">
            Bulk-dataverzoek ({ids.length} leveranciers)
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-4">
          {resultaat ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              ✅ {resultaat.aantal} dataverzoek(en) aangemaakt.
            </div>
          ) : (
            <>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  Onderwerp
                </span>
                <input
                  value={onderwerp}
                  onChange={(e) => setOnderwerp(e.target.value)}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  Bericht (optioneel)
                </span>
                <textarea
                  value={bericht}
                  onChange={(e) => setBericht(e.target.value)}
                  rows={3}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  Deadline
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
        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-200">
          {resultaat ? (
            <div className="ml-auto">
              <Button onClick={onKlaar}>Sluiten</Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Annuleren
              </Button>
              <div className="ml-auto">
                <Button onClick={verstuur} disabled={bezig}>
                  {bezig ? "Aanmaken…" : `Aanmaken voor ${ids.length}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
