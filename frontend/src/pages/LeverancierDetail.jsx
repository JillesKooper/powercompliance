import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Card, ProgressBar, Badge, Loading, ErrorBox, Button } from "../components/ui";
import ActiviteitTijdlijn from "../components/ActiviteitTijdlijn.jsx";

export default function LeverancierDetail() {
  const { id } = useParams();
  const [lev, setLev] = useState(null);
  const [producten, setProducten] = useState(null);
  const [documenten, setDocumenten] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overzicht");
  const [bewerken, setBewerken] = useState(false);
  const [bevestiging, setBevestiging] = useState(null);

  useEffect(() => {
    setLev(null);
    setProducten(null);
    setDocumenten(null);
    setTab("overzicht");
    Promise.all([
      api.leverancier(id),
      api.producten({ leverancier_id: id, per_page: 1000 }),
    ])
      .then(([l, p]) => {
        setLev(l);
        setProducten(p.items);
      })
      .catch((e) => setError(e.message));
    api.leverancierDocumenten(id).then(setDocumenten).catch(() => {});
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
      {bewerken && (
        <LeverancierBewerkModal
          leverancier={lev}
          onClose={() => setBewerken(false)}
          onOpgeslagen={(bijgewerkt) => {
            setLev(bijgewerkt);
            setBewerken(false);
            setBevestiging("Contactgegevens opgeslagen.");
          }}
        />
      )}

      <Link to="/leveranciers" className="text-sm text-brand-600 hover:underline">
        ← Terug naar leveranciers
      </Link>

      {bevestiging && (
        <div className="rounded-lg bg-green-50 border border-green-100 text-green-800 px-4 py-3 text-sm flex items-center justify-between">
          <span>✅ {bevestiging}</span>
          <button
            onClick={() => setBevestiging(null)}
            className="text-green-700/70 hover:text-green-900"
          >
            ×
          </button>
        </div>
      )}

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
            {lev.adres && (
              <div className="text-sm text-slate-500">{lev.adres}</div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lev.actief ? (
              <Badge color="green">Actief</Badge>
            ) : (
              <Badge color="slate">Inactief</Badge>
            )}
            <Button variant="ghost" onClick={() => setBewerken(true)}>
              ✎ Bewerken
            </Button>
          </div>
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

      {/* tabs */}
      <div className="flex items-center gap-1 border-b border-line">
        {[
          ["overzicht", "Overzicht"],
          ["activiteit", "Activiteit"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-brand-500 text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "activiteit" && (
        <Card className="p-5">
          <ActiviteitTijdlijn leverancierId={id} />
        </Card>
      )}

      {tab === "overzicht" && (
      <>
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

      <Card>
        <div className="px-5 py-3 border-b border-line font-semibold text-ink flex items-center justify-between">
          <span>Documenten</span>
          {documenten && (
            <span className="text-xs font-normal text-muted">
              {documenten.length} document{documenten.length === 1 ? "" : "en"}
            </span>
          )}
        </div>
        <div className="divide-y divide-line/70">
          {documenten === null ? (
            <div className="px-5 py-6 text-sm text-muted">Laden…</div>
          ) : documenten.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted text-sm">
              Nog geen documenten voor producten van deze leverancier.
            </div>
          ) : (
            documenten.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    to={`/producten/${d.product_id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {d.product_naam}
                  </Link>
                  <div className="text-xs text-muted truncate">
                    📄 {d.originele_naam}
                    {d.verloopdatum ? ` · verloopt ${d.verloopdatum}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {d.verloop_status === "verlopen" && (
                    <Badge color="red">verlopen</Badge>
                  )}
                  {d.verloop_status === "verloopt_binnenkort" && (
                    <Badge color="amber">nog {d.dagen_tot_verloop} d</Badge>
                  )}
                  {d.verloop_status === "geldig" && (
                    <Badge color="green">geldig</Badge>
                  )}
                  <button
                    onClick={() => api.downloadDocument(d.id)}
                    className="text-brand-600 hover:underline text-xs"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
      </>
      )}
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

function LeverancierBewerkModal({ leverancier, onClose, onOpgeslagen }) {
  const [naam, setNaam] = useState(leverancier.naam || "");
  const [contactpersoon, setContactpersoon] = useState(
    leverancier.contactpersoon || ""
  );
  const [email, setEmail] = useState(leverancier.email || "");
  const [telefoon, setTelefoon] = useState(leverancier.telefoon || "");
  const [adres, setAdres] = useState(leverancier.adres || "");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  async function opslaan() {
    if (!naam.trim()) {
      setFout("Geef de leverancier een naam.");
      return;
    }
    setBezig(true);
    setFout(null);
    try {
      const bijgewerkt = await api.wijzigLeverancier(leverancier.id, {
        naam: naam.trim(),
        contactpersoon: contactpersoon.trim() || null,
        email: email.trim() || null,
        telefoon: telefoon.trim() || null,
        adres: adres.trim() || null,
      });
      onOpgeslagen(bijgewerkt);
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Contactgegevens bewerken</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {fout && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
              {fout}
            </div>
          )}
          <Veld label="Naam">
            <input value={naam} onChange={(e) => setNaam(e.target.value)} className="input" />
          </Veld>
          <Veld label="Contactpersoon">
            <input
              value={contactpersoon}
              onChange={(e) => setContactpersoon(e.target.value)}
              className="input"
            />
          </Veld>
          <Veld label="E-mailadres">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Veld>
          <Veld label="Telefoonnummer">
            <input
              value={telefoon}
              onChange={(e) => setTelefoon(e.target.value)}
              className="input"
            />
          </Veld>
          <Veld label="Adres">
            <input value={adres} onChange={(e) => setAdres(e.target.value)} className="input" />
          </Veld>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button onClick={opslaan} disabled={bezig}>
            {bezig ? "Opslaan…" : "Opslaan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Veld({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
