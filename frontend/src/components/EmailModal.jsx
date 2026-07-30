import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, Badge, Loading } from "./ui";
import { useTaal } from "../context/taal";
import { wetgevingCode as wetCodeLabel } from "../i18n/dataVertaling";

export default function EmailModal({
  leverancierId,
  leverancierNaam,
  wetgevingCode = null,
  wetgevingNaam = null,
  productId = null,
  productNaam = null,
  onClose,
}) {
  const { taal: appTaal, t } = useTaal();
  const [taal, setTaal] = useState(appTaal);
  const [deadline, setDeadline] = useState("");
  const [data, setData] = useState(null);
  const [onderwerp, setOnderwerp] = useState("");
  const [tekst, setTekst] = useState("");
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);
  const [bezigVersturen, setBezigVersturen] = useState(false);
  const [verzonden, setVerzonden] = useState(false);
  const [aflevering, setAflevering] = useState(null);
  const [gekopieerd, setGekopieerd] = useState(false);

  async function genereer(huidigeTaal = taal, huidigeDeadline = deadline) {
    setLaden(true);
    setFout(null);
    try {
      const r = await api.genereerEmail({
        leverancier_id: leverancierId,
        taal: huidigeTaal,
        deadline: huidigeDeadline || null,
        wetgeving_code: wetgevingCode,
        product_id: productId,
      });
      setData(r);
      setOnderwerp(r.onderwerp);
      setTekst(r.tekst);
    } catch (e) {
      setFout(e.message);
    } finally {
      setLaden(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    genereer(appTaal, "");
  }, []);

  function wisselTaal(nieuw) {
    if (nieuw === taal) return;
    setTaal(nieuw);
    genereer(nieuw, deadline);
  }

  function wijzigDeadline(waarde) {
    setDeadline(waarde);
    genereer(taal, waarde);
  }

  async function kopieer() {
    const inhoud = `${data?.aan_naam ? t("email.veldAan") + ": " + data.aan_naam : ""}${
      data?.aan_email ? " <" + data.aan_email + ">" : ""
    }\n${t("email.veldCc")}: ${data?.cc}\n${t("email.veldOnderwerp")}: ${onderwerp}\n\n${tekst}`;
    try {
      await navigator.clipboard.writeText(inhoud);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch (_) {
      setFout(t("email.kopieerFout"));
    }
  }

  async function verstuur() {
    setBezigVersturen(true);
    try {
      const r = await api.verstuurEmail({
        leverancier_id: leverancierId,
        onderwerp,
        tekst,
        aan_naam: data?.aan_naam || null,
        aan_email: data?.aan_email || null,
        deadline: deadline || null,
        taal,
        wetgeving_code: wetgevingCode,
        product_id: productId,
      });
      setVerzonden(true);
      setAflevering(r?.mail || null);
      // iets langer tonen zodat het afleverkanaal zichtbaar is
      setTimeout(onClose, 2600);
    } catch (e) {
      setFout(t("email.versturenFout", { fout: e.message }));
    } finally {
      setBezigVersturen(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-800">
              {t("email.titel")}
              {wetgevingCode ? ` — ${wetCodeLabel(wetgevingCode, appTaal)}` : ""}
            </h2>
            <div className="text-xs text-slate-400">
              {leverancierNaam}
              {wetgevingNaam ? ` · ${wetgevingNaam}` : ""}
            </div>
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[11px] font-medium">
                {productId
                  ? productNaam
                    ? t("email.scopeProductNaam", { naam: productNaam })
                    : t("email.scopeProduct")
                  : wetgevingCode
                  ? t("email.scopeWetgeving", {
                      code: wetCodeLabel(wetgevingCode, appTaal),
                    })
                  : t("email.scopeLeverancier")}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* kop: taal + deadline */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t("email.taalLabel")}
              </span>
              <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                {["nl", "en"].map((code) => (
                  <button
                    key={code}
                    onClick={() => wisselTaal(code)}
                    className={`px-3 py-1.5 text-sm ${
                      taal === code
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {code === "nl" ? t("email.taalNl") : t("email.taalEn")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1">
                {t("email.deadlineLabel")}
              </span>
              <input
                type="date"
                value={deadline}
                onChange={(e) => wijzigDeadline(e.target.value)}
                className="input"
              />
            </div>
            {data && (
              <div className="text-xs text-slate-500 ml-auto">
                {t("email.metaVeldenProducten", {
                  velden: data.aantal_velden,
                  producten: data.aantal_producten,
                })}
              </div>
            )}
          </div>

          {fout && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
              {fout}
            </div>
          )}

          {laden ? (
            <Loading />
          ) : data ? (
            <>
              {/* adresvelden */}
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
                <Rij label={t("email.veldAan")}>
                  {data.aan_naam || "—"}
                  {data.aan_email && (
                    <span className="text-slate-400"> &lt;{data.aan_email}&gt;</span>
                  )}
                </Rij>
                <Rij label={t("email.veldCc")}>{data.cc}</Rij>
                <Rij label={t("email.veldOnderwerp")}>
                  <input
                    value={onderwerp}
                    onChange={(e) => setOnderwerp(e.target.value)}
                    className="w-full bg-transparent focus:outline-none"
                  />
                </Rij>
                <Rij label={t("email.veldBijlage")}>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.downloadBijlage(
                          leverancierId,
                          wetgevingCode,
                          productId,
                          taal
                        );
                      } catch (e) {
                        setFout(t("email.bijlageDownloadFout", { fout: e.message }));
                      }
                    }}
                    className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                  >
                    📎 {data.bestandsnaam}
                  </button>
                </Rij>
              </div>

              {/* AI-indicatie */}
              <div className="flex items-center gap-2 text-xs">
                {data.ai_gebruikt ? (
                  <Badge color="green">
                    {t("email.aiGegenereerd", { model: "claude-sonnet-4-6" })}
                  </Badge>
                ) : (
                  <Badge color="amber">{t("email.sjabloonGebruikt")}</Badge>
                )}
                {data.ai_fout && (
                  <span className="text-slate-400">{data.ai_fout}</span>
                )}
              </div>

              {/* mailtekst */}
              <div>
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  {t("email.mailtekst")}
                </span>
                <textarea
                  value={tekst}
                  onChange={(e) => setTekst(e.target.value)}
                  rows={14}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </div>
            </>
          ) : null}
        </div>

        {/* acties */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-200">
          <Button variant="ghost" onClick={() => genereer(taal, deadline)} disabled={laden}>
            {t("email.hergenereer")}
          </Button>
          <Button variant="ghost" onClick={kopieer} disabled={laden}>
            {gekopieerd ? `${t("actie.gekopieerd")} ✓` : t("actie.kopieer")}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {verzonden && (
              <span className="text-sm text-emerald-600">
                {aflevering?.kanaal === "gmail" && aflevering?.verzonden
                  ? t("email.verzondenGmail", { ontvanger: aflevering.ontvanger })
                  : t("email.verzonden")}
              </span>
            )}
            <Button onClick={verstuur} disabled={laden || bezigVersturen || verzonden}>
              {bezigVersturen ? t("email.versturen") : t("actie.verstuur")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Rij({ label, children }) {
  return (
    <div className="flex items-start px-4 py-2.5">
      <span className="w-24 shrink-0 text-slate-400">{label}</span>
      <div className="flex-1 text-slate-700">{children}</div>
    </div>
  );
}
