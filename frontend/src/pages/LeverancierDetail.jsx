import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { Card, ProgressBar, Badge, Loading, ErrorBox, Button } from "../components/ui";
import ActiviteitTijdlijn from "../components/ActiviteitTijdlijn.jsx";
import AuditTrail from "../components/AuditTrail.jsx";
import { useTaal } from "../context/taal";

export default function LeverancierDetail() {
  const { t } = useTaal();
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
            setBevestiging(t("leverancierDetail.contactgegevensOpgeslagen"));
          }}
        />
      )}

      <Link to="/leveranciers" className="text-sm text-brandtext hover:underline">
        {t("leverancierDetail.terug")}
      </Link>

      {bevestiging && (
        <div className="rounded-lg bg-success-soft border border-success-line text-success-text px-4 py-3 text-sm flex items-center justify-between">
          <span>✅ {bevestiging}</span>
          <button
            onClick={() => setBevestiging(null)}
            className="text-success-text/70 hover:text-success-text"
          >
            ×
          </button>
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">{lev.naam}</h2>
            <div className="text-sm text-muted mt-1">
              {lev.contactpersoon || "—"} · {lev.land}
            </div>
            {lev.email && (
              <div className="text-sm text-muted">{lev.email}</div>
            )}
            {lev.telefoon && (
              <div className="text-sm text-muted">{lev.telefoon}</div>
            )}
            {lev.adres && (
              <div className="text-sm text-muted">{lev.adres}</div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lev.actief ? (
              <Badge color="green">{t("leverancierDetail.actief")}</Badge>
            ) : (
              <Badge color="slate">{t("leverancierDetail.inactief")}</Badge>
            )}
            <Button variant="ghost" onClick={() => setBewerken(true)}>
              {t("leverancierDetail.bewerken")}
            </Button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4">
          <Mini label={t("leverancierDetail.producten")} value={producten.length} />
          <Mini label={t("leverancierDetail.ontbrekendeVelden")} value={totaalOntbrekend} rood />
          <div>
            <div className="text-xs text-muted mb-1">{t("leverancierDetail.gemCompliance")}</div>
            <ProgressBar value={gem} />
          </div>
        </div>
      </Card>

      {/* tabs */}
      <div className="flex items-center gap-1 border-b border-line">
        {[
          ["overzicht", t("leverancierDetail.tabOverzicht")],
          ["activiteit", t("leverancierDetail.tabActiviteit")],
          ["audit", t("activiteit.tabAudit")],
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

      {tab === "audit" && (
        <Card className="overflow-hidden">
          <AuditTrail leverancierId={id} />
        </Card>
      )}

      {tab === "overzicht" && (
      <>
      <Card>
        <div className="px-5 py-3 border-b border-line font-semibold text-ink">
          {t("leverancierDetail.productenVanLeverancier")}
        </div>
        <div className="divide-y divide-line">
          {producten.map((p) => (
            <Link
              key={p.id}
              to={`/producten/${p.id}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-hover"
            >
              <div>
                <div className="font-medium text-ink">{p.naam}</div>
                <div className="text-xs text-faint">
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
            <div className="px-5 py-8 text-center text-faint text-sm">
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
                    className="font-medium text-brandtext hover:underline"
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
                    className="text-brandtext hover:underline text-xs"
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
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-2xl font-bold ${rood ? "text-danger-text" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function LeverancierBewerkModal({ leverancier, onClose, onOpgeslagen }) {
  const { t } = useTaal();
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
      setFout(t("leverancierDetail.geefNaam"));
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
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-semibold text-ink">
            {t("leverancierDetail.contactgegevensBewerken")}
          </h2>
          <button
            onClick={onClose}
            className="text-faint hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {fout && (
            <div className="rounded-lg bg-danger-soft border border-danger-line text-danger-text px-4 py-2 text-sm">
              {fout}
            </div>
          )}
          <Veld label={t("leverancierDetail.veldNaam")}>
            <input value={naam} onChange={(e) => setNaam(e.target.value)} className="input" />
          </Veld>
          <Veld label={t("leverancierDetail.veldContactpersoon")}>
            <input
              value={contactpersoon}
              onChange={(e) => setContactpersoon(e.target.value)}
              className="input"
            />
          </Veld>
          <Veld label={t("leverancierDetail.veldEmail")}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Veld>
          <Veld label={t("leverancierDetail.veldTelefoon")}>
            <input
              value={telefoon}
              onChange={(e) => setTelefoon(e.target.value)}
              className="input"
            />
          </Veld>
          <Veld label={t("leverancierDetail.veldAdres")}>
            <input value={adres} onChange={(e) => setAdres(e.target.value)} className="input" />
          </Veld>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line">
          <Button variant="ghost" onClick={onClose}>
            {t("actie.annuleren")}
          </Button>
          <Button onClick={opslaan} disabled={bezig}>
            {bezig ? t("leverancierDetail.opslaanBezig") : t("leverancierDetail.opslaan")}
          </Button>
        </div>
      </div>
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
