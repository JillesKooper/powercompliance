import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, Badge, Loading } from "./ui";

export default function EmailModal({
  leverancierId,
  leverancierNaam,
  wetgevingCode = null,
  wetgevingNaam = null,
  onClose,
}) {
  const [taal, setTaal] = useState("nl");
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
    genereer("nl", "");
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
    const inhoud = `${data?.aan_naam ? "Aan: " + data.aan_naam : ""}${
      data?.aan_email ? " <" + data.aan_email + ">" : ""
    }\nCC: ${data?.cc}\nOnderwerp: ${onderwerp}\n\n${tekst}`;
    try {
      await navigator.clipboard.writeText(inhoud);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch (_) {
      setFout("Kopiëren naar klembord mislukt.");
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
      });
      setVerzonden(true);
      setAflevering(r?.mail || null);
      // iets langer tonen zodat het afleverkanaal zichtbaar is
      setTimeout(onClose, 2600);
    } catch (e) {
      setFout("Versturen mislukt: " + e.message);
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
              E-mail genereren
              {wetgevingCode ? ` — ${wetgevingCode}` : ""}
            </h2>
            <div className="text-xs text-slate-400">
              {leverancierNaam}
              {wetgevingNaam ? ` · ${wetgevingNaam}` : ""}
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
                Taal
              </span>
              <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                {["nl", "en"].map((t) => (
                  <button
                    key={t}
                    onClick={() => wisselTaal(t)}
                    className={`px-3 py-1.5 text-sm ${
                      taal === t
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t === "nl" ? "Nederlands" : "English"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1">
                Deadline
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
                {data.aantal_velden} velden · {data.aantal_producten} producten
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
                <Rij label="Aan">
                  {data.aan_naam || "—"}
                  {data.aan_email && (
                    <span className="text-slate-400"> &lt;{data.aan_email}&gt;</span>
                  )}
                </Rij>
                <Rij label="CC">{data.cc}</Rij>
                <Rij label="Onderwerp">
                  <input
                    value={onderwerp}
                    onChange={(e) => setOnderwerp(e.target.value)}
                    className="w-full bg-transparent focus:outline-none"
                  />
                </Rij>
                <Rij label="Bijlage">
                  <a
                    href={data.bijlage_url}
                    className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                    download
                  >
                    📎 {data.bestandsnaam}
                  </a>
                </Rij>
              </div>

              {/* AI-indicatie */}
              <div className="flex items-center gap-2 text-xs">
                {data.ai_gebruikt ? (
                  <Badge color="green">✨ Gegenereerd met AI (claude-sonnet-4-6)</Badge>
                ) : (
                  <Badge color="amber">Sjabloon gebruikt</Badge>
                )}
                {data.ai_fout && (
                  <span className="text-slate-400">{data.ai_fout}</span>
                )}
              </div>

              {/* mailtekst */}
              <div>
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  Mailtekst
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
            ✨ Hergenereer met AI
          </Button>
          <Button variant="ghost" onClick={kopieer} disabled={laden}>
            {gekopieerd ? "Gekopieerd ✓" : "Kopieer"}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {verzonden && (
              <span className="text-sm text-emerald-600">
                {aflevering?.kanaal === "sendgrid" && aflevering?.verzonden
                  ? `Verzonden via SendGrid → ${aflevering.ontvanger} ✓`
                  : "Verzonden ✓"}
              </span>
            )}
            <Button onClick={verstuur} disabled={laden || bezigVersturen || verzonden}>
              {bezigVersturen ? "Versturen…" : "Verstuur"}
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
