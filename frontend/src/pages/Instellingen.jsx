import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { Card, Badge, Button, Loading, ProgressBar } from "../components/ui";

const STATUS_KLEUR = {
  open: "amber",
  verzonden: "blue",
  ontvangen: "blue",
  afgerond: "green",
};

export default function Instellingen() {
  const location = useLocation();
  const [categorieen, setCategorieen] = useState([]);
  const [dataverzoeken, setDataverzoeken] = useState(null);
  const [wetgeving, setWetgeving] = useState(null);

  useEffect(() => {
    api.categorieen().then(setCategorieen).catch(() => {});
    api.dataverzoeken().then((d) => setDataverzoeken(d.items)).catch(() => {});
    api.wetgevingBeheer().then(setWetgeving).catch(() => {});
  }, []);

  // scroll naar de juiste sectie als er een hash is meegegeven (#dataverzoeken)
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, dataverzoeken]);

  async function toggleWetgeving(w) {
    const bijgewerkt = await api.zetWetgevingActief(w.id, !w.actief);
    setWetgeving((prev) =>
      prev.map((x) => (x.id === w.id ? bijgewerkt : x))
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="p-6">
        <h2 className="font-semibold text-slate-800 mb-1">Organisatie</h2>
        <p className="text-sm text-slate-500 mb-4">
          Algemene gegevens van uw groothandel.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Bedrijfsnaam
            </span>
            <input className="input" defaultValue="Mijn Groothandel B.V." />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">
              Contact e-mail
            </span>
            <input className="input" defaultValue="gvdmond@machine-learning.company" />
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-800 mb-1">Wetgevingsbeheer</h2>
        <p className="text-sm text-slate-500 mb-4">
          Zet wetgeving aan of uit. Uitgeschakelde wetgeving telt niet mee in
          compliance-berekeningen en dataverzoeken.
        </p>
        {!wetgeving ? (
          <Loading />
        ) : (
          <div className="space-y-2">
            {wetgeving.map((w) => (
              <div
                key={w.id}
                className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
                  w.actief ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{w.code}</span>
                    {w.aantal_producten === 0 && (
                      <Badge color="slate">geen producten</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{w.naam}</div>
                </div>
                <div className="w-28 text-xs text-slate-500 text-right shrink-0">
                  {w.aantal_producten} product
                  {w.aantal_producten === 1 ? "" : "en"}
                </div>
                <div className="w-32 shrink-0">
                  <ProgressBar value={w.compliance_percentage} />
                </div>
                <button
                  type="button"
                  onClick={() => toggleWetgeving(w)}
                  role="switch"
                  aria-checked={w.actief}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    w.actief ? "bg-brand-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      w.actief ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Productcategorieën</h2>
        <div className="flex flex-wrap gap-2">
          {categorieen.map((c) => (
            <Badge key={c.id} color="blue">
              {c.naam}
            </Badge>
          ))}
          {categorieen.length === 0 && (
            <span className="text-sm text-slate-400">Geen categorieën.</span>
          )}
        </div>
      </Card>

      <ExportKoppeling />

      <Card className="p-6" id="dataverzoeken">
        <h2 className="font-semibold text-slate-800 mb-4">Dataverzoeken</h2>
        {!dataverzoeken ? (
          <Loading />
        ) : dataverzoeken.length === 0 ? (
          <span className="text-sm text-slate-400">Geen dataverzoeken.</span>
        ) : (
          <div className="space-y-2">
            {dataverzoeken.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {d.onderwerp}
                  </div>
                  <div className="text-xs text-slate-400">
                    {d.leverancier?.naam}
                    {d.deadline ? ` · deadline ${d.deadline}` : ""}
                  </div>
                </div>
                <Badge color={STATUS_KLEUR[d.status] || "slate"}>
                  {d.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ExportKoppeling() {
  const [webhooks, setWebhooks] = useState(null);
  const [historie, setHistorie] = useState(null);
  const [url, setUrl] = useState("");
  const [beschrijving, setBeschrijving] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  function laad() {
    api.webhooks().then(setWebhooks).catch(() => setWebhooks([]));
    api.exportHistorie().then(setHistorie).catch(() => setHistorie([]));
  }

  useEffect(() => {
    laad();
  }, []);

  async function abonneer(e) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      await api.abonneerWebhook({ url, beschrijving: beschrijving || null });
      setUrl("");
      setBeschrijving("");
      laad();
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(id) {
    if (!confirm("Webhook-abonnement verwijderen?")) return;
    await api.verwijderWebhook(id);
    laad();
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-slate-800 mb-1">PIM/ERP-koppeling</h2>
      <p className="text-sm text-slate-500 mb-4">
        Abonneer een extern systeem op export-events. Bij elke export ontvangt de
        opgegeven URL een POST met een JSON-samenvatting van de geëxporteerde data.
      </p>

      <form onSubmit={abonneer} className="flex flex-wrap items-end gap-3 mb-4">
        <label className="block flex-1 min-w-[240px]">
          <span className="block text-xs font-medium text-muted mb-1">Webhook-URL</span>
          <input
            type="url"
            required
            placeholder="https://mijn-pim.example/webhooks/compliance"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input"
          />
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="block text-xs font-medium text-muted mb-1">
            Beschrijving (optioneel)
          </span>
          <input
            value={beschrijving}
            onChange={(e) => setBeschrijving(e.target.value)}
            className="input"
          />
        </label>
        <Button type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Abonneren"}
        </Button>
      </form>
      {fout && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {fout}
        </div>
      )}

      {webhooks && webhooks.length > 0 && (
        <div className="space-y-2 mb-6">
          {webhooks.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line px-4 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">{w.url}</div>
                <div className="text-xs text-muted">
                  {w.beschrijving ? `${w.beschrijving} · ` : ""}
                  {w.laatste_status
                    ? `laatste levering: ${w.laatste_status}`
                    : "nog niet afgeleverd"}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge color={w.actief ? "green" : "slate"}>
                  {w.actief ? "actief" : "uit"}
                </Badge>
                <button
                  onClick={() => verwijder(w.id)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  Verwijderen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-semibold text-ink mb-2">Exporthistorie</h3>
      {!historie ? (
        <Loading />
      ) : historie.length === 0 ? (
        <div className="text-sm text-muted">Nog geen exports uitgevoerd.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="px-3 py-2 font-medium">Bestand</th>
                <th className="px-3 py-2 font-medium">Formaat</th>
                <th className="px-3 py-2 font-medium">Producten</th>
                <th className="px-3 py-2 font-medium">Webhooks</th>
                <th className="px-3 py-2 font-medium">Wanneer</th>
              </tr>
            </thead>
            <tbody>
              {historie.map((h) => {
                let webhookInfo = "—";
                try {
                  const r = h.webhook_resultaat ? JSON.parse(h.webhook_resultaat) : [];
                  if (r.length) webhookInfo = `${r.length} afgeleverd`;
                } catch (_) {}
                return (
                  <tr key={h.id} className="border-b border-line/60">
                    <td className="px-3 py-2 text-ink">{h.bestandsnaam}</td>
                    <td className="px-3 py-2">
                      <Badge color="blue">{h.formaat.toUpperCase()}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted">{h.aantal_producten}</td>
                    <td className="px-3 py-2 text-muted">{webhookInfo}</td>
                    <td className="px-3 py-2 text-muted">
                      {new Date(h.aangemaakt_op).toLocaleString("nl-NL")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
