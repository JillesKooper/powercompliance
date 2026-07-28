import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
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
        api.productCompliance(id),
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
  }, [id]);

  async function startScrape() {
    setScrapeMelding("Scrapen gestart… (GS1 → Open Food Facts → fabrikant → web)");
    try {
      await api.scrapeProduct(id);
      // de scrape draait als achtergrondtaak; na een moment herladen
      setTimeout(async () => {
        await laad();
        setScrapeMelding("Scrape voltooid — resultaten bijgewerkt.");
        setTimeout(() => setScrapeMelding(null), 4000);
      }, 6000);
    } catch (e) {
      setScrapeMelding("Scrape mislukt: " + e.message);
    }
  }

  async function verifieer(veldId) {
    await api.verifieerWaarde(id, veldId);
    laad();
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
          ← Terug naar producten
        </Link>
        {product.aantal_ontbrekend > 0 && (
          <div className="flex items-center gap-2">
            {product.leverancier && (
              <Button variant="ghost" onClick={() => setMailCode("*")}>
                ✉️ Uitvraag voor dit product
              </Button>
            )}
            <Button variant="ghost" onClick={startScrape}>
              🔎 Scrape ontbrekende data
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
            <h2 className="text-xl font-bold text-slate-800">{product.naam}</h2>
            <div className="text-sm text-slate-500 mt-1 space-x-3">
              <span>Art.nr: {product.artikelnummer || "—"}</span>
              <span>EAN: {product.ean || "—"}</span>
            </div>
            <div className="flex gap-2 mt-3">
              {product.categorie && (
                <Badge color="blue">{product.categorie.naam}</Badge>
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
                toonVoor ? "text-red-500" : "text-slate-800"
              }`}
            >
              <AnimatedNumber value={pct} decimals={1} />%
            </div>
            <div className="text-xs text-slate-400 mb-2">compliance</div>
            <ProgressBar value={pct} />
            <div className="text-xs text-slate-500 mt-2">
              {ingevuldNu}/{totaalVelden} velden ·{" "}
              <span className="text-red-500">{ontbrekendNu} ontbreekt</span>
            </div>
          </div>
        </div>

        {heeftReply && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">Voor/Na-vergelijking</span>{" "}
              — zie het effect van de verwerkte leveranciersreply.
            </div>
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
              {[
                ["voor", "Voor reply"],
                ["na", "Na reply"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setWeergave(key)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    weergave === key
                      ? key === "voor"
                        ? "bg-red-500 text-white"
                        : "bg-emerald-500 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
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
          ["compliance", "Compliance"],
          ["documenten", "Documenten"],
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
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="font-semibold text-slate-800">
              ⚖️ {code}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {items.filter((i) => i.ingevuld).length}/{items.length} ingevuld
              </span>
            </div>
            {heeftOntbrekend && product.leverancier && (
              <Button variant="ghost" onClick={() => setMailCode(code)}>
                ✉️ Uitvragen ({code})
              </Button>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((r) => (
              <div
                key={`${weergave}-${r.compliance_veld_id}`}
                className={`px-5 py-3 flex items-center justify-between gap-3 text-sm ${
                  r._replyNieuw
                    ? "animate-flashGreen border-l-2 border-emerald-400"
                    : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-slate-700">
                    {r.veld_naam}
                    <span className="text-xs text-slate-400 ml-2">{r.veld_type}</span>
                    {r._replyNieuw && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
                        📥 via reply
                      </span>
                    )}
                  </div>
                  <VeldWaarde r={r} />
                </div>
                <VeldStatus r={r} onVerifieer={() => verifieer(r.compliance_veld_id)} />
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
            <span className="text-xs font-normal text-amber-500">(twijfelachtig)</span>
          </span>
        ) : (
          // 1. ingevulde waarde, direct zichtbaar
          <span className="font-medium text-slate-800">{ruwe}</span>
        )}
        {/* 2. automatisch gevonden via scraping: bron-URL als kleine link */}
        {automatisch && r.bron_url && (
          <a
            href={r.bron_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 hover:underline"
          >
            🔗 bron
          </a>
        )}
        {automatisch && !r.bron_url && (
          <span className="text-xs text-slate-400">automatisch gevonden</span>
        )}
      </div>
    );
  }

  // ingevuld gemarkeerd maar zonder waarde: toon "—"
  if (isIngevuld) {
    return <div className="mt-0.5 text-sm text-slate-400">—</div>;
  }

  // 4. ontbreekt: blijf "ontbreekt" in rood tonen
  if (r.status === "niet_gevonden_online") {
    return (
      <div className="mt-0.5 text-sm text-slate-400">niet online gevonden</div>
    );
  }
  return <div className="mt-0.5 text-sm text-red-500">ontbreekt</div>;
}

function VeldStatus({ r, onVerifieer }) {
  if (r.status === "ingevuld") {
    return (
      <Badge color="green">{r.geverifieerd ? "✓ geverifieerd" : "✓ ingevuld"}</Badge>
    );
  }
  if (r.status === "automatisch") {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <Badge color="amber">
          ✨ automatisch{r.twijfelachtig ? " · twijfelachtig" : ""}
        </Badge>
        <Button variant="ghost" onClick={onVerifieer}>
          Verifieer
        </Button>
      </div>
    );
  }
  if (r.status === "niet_gevonden_online") {
    return <Badge color="slate">niet online gevonden</Badge>;
  }
  return <Badge color="red">ontbreekt</Badge>;
}
