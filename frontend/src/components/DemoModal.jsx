import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Button, ProgressBar, AnimatedNumber } from "./ui";

const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

const STAPPEN = [
  { key: "start", titel: "Demo voorbereiden", icoon: "⚙️" },
  { key: "mail", titel: "Dataverzoek e-mailen", icoon: "✉️" },
  { key: "reply", titel: "Leverancier reply ontvangen", icoon: "📥" },
  { key: "verrijk", titel: "AI verrijkt de data", icoon: "✨" },
  { key: "score", titel: "Compliance-score omhoog", icoon: "📈" },
];

export default function DemoModal({ onClose }) {
  const [stap, setStap] = useState(-1);
  const [lev, setLev] = useState(null);
  const [emailInfo, setEmailInfo] = useState(null);
  const [reply, setReply] = useState(null);
  const [voorNa, setVoorNa] = useState({ voor: null, na: null });
  const [klaar, setKlaar] = useState(false);
  const [fout, setFout] = useState(null);
  const gestart = useRef(false);

  async function run() {
    setFout(null);
    setKlaar(false);
    setEmailInfo(null);
    setReply(null);
    setVoorNa({ voor: null, na: null });
    try {
      // Stap 0 — schone start: verwijder eerdere reply-verrijking.
      setStap(0);
      const st0 = await api.demoReset();
      if (!st0.leverancier) {
        setFout("Geen leverancier met ontbrekende data gevonden om te demonstreren.");
        return;
      }
      setLev(st0.leverancier);
      const basis = st0.compliance_na;
      setVoorNa({ voor: basis, na: basis });
      const lid = st0.leverancier.id;
      await wacht(800);

      // Stap 1 — genereer en verstuur het dataverzoek als échte e-mail.
      setStap(1);
      const gen = await api.genereerEmail({ leverancier_id: lid, taal: "nl" });
      const snd = await api.verstuurEmail({
        leverancier_id: lid,
        onderwerp: gen.onderwerp,
        tekst: gen.tekst,
        aan_naam: gen.aan_naam,
        aan_email: gen.aan_email,
      });
      setEmailInfo({
        ...snd.mail,
        onderwerp: gen.onderwerp,
        aantal_velden: gen.aantal_velden,
      });
      await wacht(1300);

      // Stap 2 — de leverancier reageert (gesimuleerde reply).
      setStap(2);
      await wacht(1000);
      const rep = await api.simuleerReply({ leverancier_id: lid });
      setReply(rep);
      await wacht(1300);

      // Stap 3 — de AI parseert de reply en vult de velden aan.
      setStap(3);
      await wacht(1400);

      // Stap 4 — de compliance-score gaat omhoog.
      setStap(4);
      const st1 = await api.demoStatus();
      setVoorNa({ voor: basis, na: st1.compliance_na });
      await wacht(700);
      setKlaar(true);
    } catch (e) {
      setFout(e.message);
    }
  }

  useEffect(() => {
    if (gestart.current) return;
    gestart.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bezig = stap >= 0 && !klaar && !fout;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-800">🚀 Demo — automatische dataverrijking</h2>
            <div className="text-xs text-slate-400">
              {lev ? `Leverancier: ${lev.naam}` : "Flow: mail → reply → AI → score"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-2">
          {fout && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm mb-2">
              {fout}
            </div>
          )}

          {STAPPEN.map((s, i) => {
            const toestand =
              klaar || i < stap ? "done" : i === stap ? "actief" : "wacht";
            return (
              <Stap key={s.key} s={s} toestand={toestand}>
                {s.key === "mail" && i <= stap && emailInfo && (
                  <div className="animate-fadeIn">
                    <div className="text-slate-600">“{emailInfo.onderwerp}”</div>
                    <div className="text-slate-500 mt-0.5">
                      {emailInfo.kanaal === "gmail" && emailInfo.verzonden ? (
                        <span className="text-emerald-600">
                          ✅ Echt verzonden via Gmail → {emailInfo.ontvanger}
                        </span>
                      ) : (
                        <span>
                          📨 Verzending gesimuleerd ({emailInfo.aantal_velden} ontbrekende velden)
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {s.key === "reply" && i <= stap && reply && (
                  <div className="animate-fadeIn rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-slate-600 whitespace-pre-line max-h-24 overflow-hidden">
                    {(reply.reply_tekst || "").split("\n").slice(0, 5).join("\n")}…
                  </div>
                )}
                {s.key === "verrijk" && i <= stap && reply && (
                  <div className="animate-fadeIn text-slate-600">
                    <span className="font-medium text-emerald-600">
                      {reply.aantal_ingevuld} velden
                    </span>{" "}
                    automatisch aangevuld over {reply.aantal_producten} producten{" "}
                    {reply.ai_gebruikt ? "met AI (claude-sonnet-4-6)" : "(regel-parser)"}.
                  </div>
                )}
                {s.key === "score" && i <= stap && voorNa.na != null && (
                  <div className="animate-fadeIn flex items-center gap-4 pt-1">
                    <div className="text-center">
                      <div className="text-xs text-slate-400">voor</div>
                      <div className="text-lg font-bold text-red-500">
                        {voorNa.voor?.toFixed(1)}%
                      </div>
                    </div>
                    <div className="flex-1">
                      <ProgressBar value={klaar ? voorNa.na : voorNa.voor} />
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-400">na</div>
                      <div className="text-lg font-bold text-emerald-600">
                        <AnimatedNumber
                          value={klaar ? voorNa.na : voorNa.voor}
                          decimals={1}
                        />
                        %
                      </div>
                    </div>
                  </div>
                )}
              </Stap>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-200">
          {klaar && lev && (
            <span className="text-sm text-emerald-600">
              ✓ Demo voltooid — {lev.naam} is nu volledig compliant.
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {(klaar || fout) && (
              <Button variant="ghost" onClick={run} disabled={bezig}>
                ↻ Opnieuw
              </Button>
            )}
            <Button onClick={onClose} disabled={bezig}>
              {bezig ? "Bezig…" : "Sluiten"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stap({ s, toestand, children }) {
  const bolStijl =
    toestand === "done"
      ? "bg-emerald-500 text-white"
      : toestand === "actief"
      ? "bg-brand-600 text-white animate-pulseRing"
      : "bg-slate-100 text-slate-400";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex items-center justify-center h-8 w-8 rounded-full text-sm shrink-0 transition-colors ${bolStijl}`}
        >
          {toestand === "done" ? "✓" : s.icoon}
        </div>
      </div>
      <div className="flex-1 pb-4 min-w-0">
        <div
          className={`text-sm font-medium ${
            toestand === "wacht" ? "text-slate-400" : "text-slate-800"
          }`}
        >
          {s.titel}
          {toestand === "actief" && (
            <span className="ml-2 text-xs text-brand-600">bezig…</span>
          )}
        </div>
        <div className="text-xs mt-1 space-y-1">{children}</div>
      </div>
    </div>
  );
}
