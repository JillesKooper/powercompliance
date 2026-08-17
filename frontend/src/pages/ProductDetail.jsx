import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useTaal } from "../context/taal";
import { categorieNaam, wetgevingCode } from "../i18n/dataVertaling";
import {
  Card,
  ProgressBar,
  Badge,
  Loading,
  ErrorBox,
  Button,
  AnimatedNumber,
} from "../components/ui";
import EmailModal from "../components/EmailModal.jsx";
import ProductDocumenten from "../components/ProductDocumenten.jsx";

export default function ProductDetail() {
  const { t, taal } = useTaal();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [regels, setRegels] = useState(null);
  const [error, setError] = useState(null);
  const [mailCode, setMailCode] = useState(null);
  const [scrapeMelding, setScrapeMelding] = useState(null);
  const [tab, setTab] = useState("compliance");
  const [weergave, setWeergave] = useState("na"); // voor | na (Voor/Na-vergelijking)

  async function laad() {
    try {
      const [p, r] = await Promise.all([
        api.product(id),
        api.productCompliance(id, taal),
      ]);
      setProduct(p);
      setRegels(r);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    setProduct(null);
    setRegels(null);
    laad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, taal]);

  async function startScrape() {
    setScrapeMelding(t("productDetail.scrapeGestart"));
    try {
      await api.scrapeProduct(id);
      // de scrape draait als achtergrondtaak; na een moment herladen
      setTimeout(async () => {
        await laad();
        setScrapeMelding(t("productDetail.scrapeVoltooid"));
        setTimeout(() => setScrapeMelding(null), 4000);
      }, 6000);
    } catch (e) {
      setScrapeMelding(t("productDetail.scrapeMislukt", { fout: e.message }));
    }
  }

  async function verifieer(veldId) {
    await api.verifieerWaarde(id, veldId);
    laad();
  }

  // Verwerk een handmatig bewerkte compliance-waarde: werk de regel bij (de
  // score in de kop wordt afgeleid uit `regels` en volgt automatisch) en
  // ververs het producthoofd op de achtergrond (aantal_ontbrekend e.d.).
  function handleWaardeOpgeslagen(bijgewerkt) {
    setRegels((prev) =>
      prev.map((x) =>
        x.compliance_veld_id === bijgewerkt.compliance_veld_id
          ? { ...x, ...bijgewerkt }
          : x
      )
    );
    api.product(id).then(setProduct).catch(() => {});
  }

  if (error) return <ErrorBox message={error} />;
  if (!product || !regels) return <Loading />;

  // Velden die via een leveranciersreply zijn aangevuld (bron === "reply").
  const heeftReply = regels.some((r) => r.bron === "reply");
  const toonVoor = heeftReply && weergave === "voor";

  // Afgeleide regels voor de gekozen weergave: in "Voor" tonen we de via de
  // reply verrijkte velden weer als ontbrekend (rood).
  const toonRegels = regels.map((r) => {
    const isReply = r.bron === "reply";
    if (toonVoor && isReply) {
      return {
        ...r,
        ingevuld: false,
        waarde: null,
        bron: null,
        geverifieerd: false,
        twijfelachtig: false,
        status: "ontbreekt",
      };
    }
    return { ...r, _replyNieuw: heeftReply && !toonVoor && isReply };
  });

  // Afgeleide compliance-cijfers voor de gekozen weergave.
  const totaalVelden = regels.length;
  const ingevuldNu = toonRegels.filter((r) => r.ingevuld).length;
  const pct = totaalVelden
    ? Math.round((ingevuldNu / totaalVelden) * 1000) / 10
    : 100;
  const ontbrekendNu = totaalVelden - ingevuldNu;

  // groepeer regels per wetgeving
  const perWet = {};
  for (const r of toonRegels) (perWet[r.wetgeving_code] ??= []).push(r);

  return (
    <div className="space-y-6 max-w-4xl">
      {mailCode && product.leverancier && (
        <EmailModal
          leverancierId={product.leverancier.id}
          leverancierNaam={product.leverancier.naam}
          wetgevingCode={mailCode === "*" ? null : mailCode}
          wetgevingNaam={mailCode === "*" ? null : mailCode}
          productId={product.id}
          productNaam={product.naam}
          onClose={() => setMailCode(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <Link to="/producten" className="text-sm text-brand-600 hover:underline">
          {t("productDetail.terugNaarProducten")}
        </Link>
        {product.aantal_ontbrekend > 0 && (
          <div className="flex items-center gap-2">
            {product.leverancier && (
              <Button variant="ghost" onClick={() => setMailCode("*")}>
                {t("productDetail.uitvraagVoorProduct")}
              </Button>
            )}
            <Button variant="ghost" onClick={startScrape}>
              {t("productDetail.scrapeOntbrekendeData")}
            </Button>
          </div>
        )}
      </div>

      {scrapeMelding && (
        <div className="rounded-lg bg-brand-50 border border-brand-100 text-brand-700 px-4 py-2 text-sm">
          {scrapeMelding}
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-ink">{product.naam}</h2>
            <div className="text-sm text-muted mt-1 space-x-3">
              <span>{t("productDetail.artNr", { waarde: product.artikelnummer || "—" })}</span>
              <span>{t("productDetail.ean", { waarde: product.ean || "—" })}</span>
            </div>
            <div className="flex gap-2 mt-3">
              {product.categorie && (
                <Badge color="blue">{categorieNaam(product.categorie.naam, taal)}</Badge>
              )}
              {product.leverancier && (
                <Link to={`/leveranciers/${product.leverancier.id}`}>
                  <Badge color="slate">🏭 {product.leverancier.naam}</Badge>
                </Link>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 w-44">
            <div
              className={`text-3xl font-bold transition-colors duration-500 ${
                toonVoor ? "text-red-500" : "text-ink"
              }`}
            >
              <AnimatedNumber value={pct} decimals={1} />%
            </div>
            <div className="text-xs text-faint mb-2">{t("productDetail.compliance")}</div>
            <ProgressBar value={pct} />
            <div className="text-xs text-muted mt-2">
              {t("productDetail.veldenOverzicht", { ingevuld: ingevuldNu, totaal: totaalVelden })}
              <span className="text-red-500">
                {t("productDetail.ontbreektAantal", { aantal: ontbrekendNu })}
              </span>
            </div>
          </div>
        </div>

        {heeftReply && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-hover border border-line px-4 py-3">
            <div className="text-sm text-muted">
              <span className="font-medium text-ink">
                {t("productDetail.voorNaVergelijkingTitel")}
              </span>
              {t("productDetail.voorNaVergelijkingUitleg")}
            </div>
            <div className="inline-flex rounded-lg border border-line overflow-hidden shrink-0">
              {[
                ["voor", t("productDetail.voorReply")],
                ["na", t("productDetail.naReply")],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setWeergave(key)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    weergave === key
                      ? key === "voor"
                        ? "bg-red-500 text-white"
                        : "bg-emerald-500 text-white"
                      : "bg-surface text-muted hover:bg-hover"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-1 border-b border-line">
        {[
          ["compliance", t("productDetail.tabCompliance")],
          ["documenten", t("productDetail.tabDocumenten")],
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

      {tab === "documenten" && <ProductDocumenten productId={product.id} />}

      {tab === "compliance" &&
        Object.entries(perWet).map(([code, items]) => {
        const heeftOntbrekend = items.some((i) => !i.ingevuld);
        return (
        <Card key={code} className="overflow-hidden">
          <div className="px-5 py-3 bg-hover border-b border-line flex items-center justify-between">
            <div className="font-semibold text-ink">
              ⚖️ {wetgevingCode(code, taal)}
              <span className="ml-2 text-xs font-normal text-faint">
                {t("productDetail.ingevuldOverzicht", {
                  ingevuld: items.filter((i) => i.ingevuld).length,
                  totaal: items.length,
                })}
              </span>
            </div>
            {heeftOntbrekend && product.leverancier && (
              <Button variant="ghost" onClick={() => setMailCode(code)}>
                {t("productDetail.uitvragen", { code })}
              </Button>
            )}
          </div>
          <div className="divide-y divide-line">
            {items.map((r) => (
              <div
                key={`${weergave}-${r.compliance_veld_id}`}
                className={`px-5 py-3 flex items-center justify-between gap-3 text-sm ${
                  r._replyNieuw
                    ? "animate-flashGreen border-l-2 border-emerald-400"
                    : ""
                }`}
              >
                <ComplianceRij
                  r={r}
                  bewerkbaar={!toonVoor}
                  productId={product.id}
                  taal={taal}
                  onVerifieer={() => verifieer(r.compliance_veld_id)}
                  onOpgeslagen={handleWaardeOpgeslagen}
                />
              </div>
            ))}
          </div>
        </Card>
        );
      })}
    </div>
  );
}

function VeldWaarde({ r }) {
  const { t } = useTaal();
  const automatisch = r.bron === "automatisch" || r.status === "automatisch";
  // de echte waarde komt uit `waarde` (val terug op `waarde_tekst`)
  const ruwe = r.waarde ?? r.waarde_tekst ?? null;
  const heeftWaarde = ruwe !== null && String(ruwe).trim() !== "";
  const isIngevuld = r.ingevuld || r.status === "ingevuld" || automatisch;

  // 1 t/m 3: er is een waarde (handmatig ingevuld of automatisch gevonden)
  if (heeftWaarde) {
    return (
      <div className="mt-0.5 text-sm flex items-center gap-2 flex-wrap">
        {r.twijfelachtig ? (
          // 3. twijfelachtig: waarde in oranje met waarschuwingsicoon
          <span className="inline-flex items-center gap-1 font-medium text-amber-600">
            <span aria-hidden="true">⚠️</span>
            {ruwe}
            <span className="text-xs font-normal text-amber-500">
              {t("productDetail.twijfelachtig")}
            </span>
          </span>
        ) : (
          // 1. ingevulde waarde, direct zichtbaar
          <span className="font-medium text-ink">{ruwe}</span>
        )}
        {/* 2. automatisch gevonden via scraping: bron-URL als kleine link */}
        {automatisch && r.bron_url && (
          <a
            href={r.bron_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 hover:underline"
          >
            {t("productDetail.bron")}
          </a>
        )}
        {automatisch && !r.bron_url && (
          <span className="text-xs text-faint">
            {t("productDetail.automatischGevonden")}
          </span>
        )}
      </div>
    );
  }

  // ingevuld gemarkeerd maar zonder waarde: toon "—"
  if (isIngevuld) {
    return <div className="mt-0.5 text-sm text-faint">—</div>;
  }

  // 4. ontbreekt: blijf "ontbreekt" in rood tonen
  if (r.status === "niet_gevonden_online") {
    return (
      <div className="mt-0.5 text-sm text-faint">
        {t("productDetail.nietOnlineGevonden")}
      </div>
    );
  }
  return <div className="mt-0.5 text-sm text-red-500">{t("productDetail.ontbreekt")}</div>;
}

function VeldStatus({ r, onVerifieer }) {
  const { t } = useTaal();
  if (r.status === "ingevuld") {
    return (
      <Badge color="green">
        {r.geverifieerd
          ? t("productDetail.geverifieerd")
          : t("productDetail.ingevuld")}
      </Badge>
    );
  }
  if (r.status === "automatisch") {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <Badge color="amber">
          {r.twijfelachtig
            ? t("productDetail.automatischTwijfelachtig")
            : t("productDetail.automatisch")}
        </Badge>
        <Button variant="ghost" onClick={onVerifieer}>
          {t("productDetail.verifieer")}
        </Button>
      </div>
    );
  }
  if (r.status === "niet_gevonden_online") {
    return <Badge color="slate">{t("productDetail.nietOnlineGevonden")}</Badge>;
  }
  return <Badge color="red">{t("productDetail.ontbreekt")}</Badge>;
}

// Eén compliance-regel: toont de waarde + status, met inline bewerken van een
// ingevulde waarde (potlood → invoer → opslaan met ✓/Enter, annuleren met ✕/Esc).
function ComplianceRij({ r, bewerkbaar, productId, taal, onVerifieer, onOpgeslagen }) {
  const { t } = useTaal();
  const ruwe = r.waarde ?? r.waarde_tekst ?? null;
  const heeftWaarde = ruwe !== null && String(ruwe).trim() !== "";

  const [bewerken, setBewerken] = useState(false);
  const [concept, setConcept] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [opgeslagen, setOpgeslagen] = useState(false);

  function start() {
    setConcept(heeftWaarde ? String(ruwe) : "");
    setFout(null);
    setBewerken(true);
  }
  function annuleer() {
    setBewerken(false);
    setFout(null);
  }
  async function bewaar() {
    setBezig(true);
    setFout(null);
    try {
      const bijgewerkt = await api.wijzigComplianceWaarde(
        productId,
        r.compliance_veld_id,
        { waarde: concept },
        taal
      );
      onOpgeslagen(bijgewerkt);
      setBewerken(false);
      setOpgeslagen(true);
      setTimeout(() => setOpgeslagen(false), 2500);
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }
  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      bewaar();
    } else if (e.key === "Escape") {
      e.preventDefault();
      annuleer();
    }
  }

  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-ink">
          {r.veld_naam}
          <span className="text-xs text-faint ml-2">{r.veld_type}</span>
          {r._replyNieuw && (
            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
              {t("productDetail.viaReply")}
            </span>
          )}
          {opgeslagen && (
            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
              ✓ {t("productDetail.waardeOpgeslagen")}
            </span>
          )}
        </div>
        {bewerken ? (
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <input
              autoFocus
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={bezig}
              className="input py-1 text-sm w-full max-w-xs"
            />
            {fout && (
              <span className="text-xs text-red-500">
                {t("productDetail.opslaanMislukt")}: {fout}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <VeldWaarde r={r} />
            {bewerkbaar && heeftWaarde && (
              <button
                type="button"
                onClick={start}
                title={t("productDetail.bewerkWaarde")}
                aria-label={t("productDetail.bewerkWaarde")}
                className="text-faint hover:text-brand-600 transition-colors text-sm leading-none"
              >
                ✏️
              </button>
            )}
          </div>
        )}
      </div>

      {bewerken ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={bewaar}
            disabled={bezig}
            title={t("productDetail.opslaan")}
            aria-label={t("productDetail.opslaan")}
            className="grid h-8 w-8 place-items-center rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={annuleer}
            disabled={bezig}
            title={t("productDetail.annuleren")}
            aria-label={t("productDetail.annuleren")}
            className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted hover:bg-hover disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      ) : (
        <VeldStatus r={r} onVerifieer={onVerifieer} />
      )}
    </>
  );
}
