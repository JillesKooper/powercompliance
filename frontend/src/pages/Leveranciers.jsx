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
} from "../components/ui";
import ImportDialog from "../components/ImportDialog.jsx";

const LEEG = { naam: "", contactpersoon: "", email: "", telefoon: "", land: "NL" };

export default function Leveranciers() {
  const [leveranciers, setLeveranciers] = useState(null);
  const [error, setError] = useState(null);
  const [toonForm, setToonForm] = useState(false);
  const [toonImport, setToonImport] = useState(false);
  const [form, setForm] = useState(LEEG);

  async function laad() {
    try {
      setLeveranciers(await api.leveranciers());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    laad();
  }, []);

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
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => setToonImport(true)}>
          ⬆ Importeren
        </Button>
        <Button onClick={() => setToonForm((v) => !v)}>+ Nieuwe leverancier</Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {leveranciers.map((l) => (
            <Card key={l.id} className="p-5">
              <div className="flex items-start justify-between">
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
      )}
    </div>
  );
}
