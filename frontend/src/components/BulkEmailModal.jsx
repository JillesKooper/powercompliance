import { useEffect, useState } from "react";
import { api } from "../api";
import { useTaal } from "../context/taal";
import {
  wetgevingCode as wetCodeLabel,
  wetgevingNaam as wetNaamLabel,
} from "../i18n/dataVertaling";
import { Button, Badge, Loading } from "./ui";
import EmailModal from "./EmailModal.jsx";

export default function BulkEmailModal({ wetgevingCode, wetgevingNaam, onClose }) {
  const { t, taal: appTaal } = useTaal();
  const [lijst, setLijst] = useState(null);
  const [geselecteerd, setGeselecteerd] = useState(new Set());
  // Verzendtaal volgt standaard de app-taal, maar mag per uitvraag afwijken.
  const [taal, setTaal] = useState(appTaal);
  const [deadline, setDeadline] = useState("");
  const [fout, setFout] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState(null);
  const [bekijk, setBekijk] = useState(null); // {id, naam}

  useEffect(() => {
    api
      .wetgevingUitvraagLeveranciers(wetgevingCode)
      .then((d) => {
        setLijst(d);
        setGeselecteerd(new Set(d.map((l) => l.id)));
      })
      .catch((e) => setFout(e.message));
  }, [wetgevingCode]);

  function toggle(id) {
    setGeselecteerd((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  async function verstuurAllen() {
    setBezig(true);
    setFout(null);
    try {
      const r = await api.uitvraagWetgeving({
        wetgeving_code: wetgevingCode,
        taal,
        deadline: deadline || null,
        leverancier_ids: [...geselecteerd],
      });
      setResultaat(r);
    } catch (e) {
      setFout(t("email.versturenFout", { fout: e.message }));
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      {bekijk && (
        <EmailModal
          leverancierId={bekijk.id}
          leverancierNaam={bekijk.naam}
          wetgevingCode={wetgevingCode}
          wetgevingNaam={wetgevingNaam}
          onClose={() => setBekijk(null)}
        />
      )}

      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-800">
              {t("email.bulkTitel", { code: wetCodeLabel(wetgevingCode, appTaal) })}
            </h2>
            <div className="text-xs text-slate-400">
              {wetNaamLabel(wetgevingCode, wetgevingNaam, appTaal)}
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
          {fout && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
              {fout}
            </div>
          )}

          {resultaat ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                {t("email.bulkResultaat", {
                  aantal: resultaat.aantal,
                  code: wetCodeLabel(resultaat.wetgeving_code, appTaal),
                })}
              </div>
              <ul className="text-sm text-slate-600 space-y-1 max-h-60 overflow-auto">
                {resultaat.leveranciers.map((l) => (
                  <li key={l.id}>📨 {l.naam}</li>
                ))}
              </ul>
              <div className="text-right">
                <Button onClick={onClose}>{t("actie.sluiten")}</Button>
              </div>
            </div>
          ) : !lijst ? (
            <Loading />
          ) : lijst.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">
              {t("email.bulkGeenLeveranciers", {
                code: wetCodeLabel(wetgevingCode, appTaal),
              })}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <span className="block text-xs font-medium text-slate-600 mb-1">
                    {t("email.taalLabel")}
                  </span>
                  <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                    {["nl", "en"].map((code) => (
                      <button
                        key={code}
                        onClick={() => setTaal(code)}
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
                    onChange={(e) => setDeadline(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="text-sm text-slate-600">
                {t("email.bulkAantalLeveranciers", {
                  aantal: lijst.length,
                  code: wetCodeLabel(wetgevingCode, appTaal),
                })}
              </div>

              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-auto">
                {lijst.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={geselecteerd.has(l.id)}
                      onChange={() => toggle(l.id)}
                    />
                    <span className="flex-1">
                      <span className="font-medium text-slate-800">{l.naam}</span>
                      <span className="text-slate-400">
                        {" "}
                        · {l.contactpersoon || "—"}
                      </span>
                    </span>
                    <Badge color="red">
                      {t("email.bulkVeldenBadge", { aantal: l.aantal_velden })}
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setBekijk({ id: l.id, naam: l.naam });
                      }}
                      className="text-brand-600 hover:underline text-xs"
                    >
                      {t("email.bulkBekijk")}
                    </button>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {!resultaat && lijst && lijst.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-200">
            <Button variant="ghost" onClick={onClose}>
              {t("actie.annuleren")}
            </Button>
            <div className="ml-auto">
              <Button
                onClick={verstuurAllen}
                disabled={bezig || geselecteerd.size === 0}
              >
                {bezig
                  ? t("email.versturen")
                  : geselecteerd.size === 1
                  ? t("email.bulkVerstuurNaarEen")
                  : t("email.bulkVerstuurNaarMeer", { aantal: geselecteerd.size })}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
