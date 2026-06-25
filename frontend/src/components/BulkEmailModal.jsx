import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, Badge, Loading } from "./ui";
import EmailModal from "./EmailModal.jsx";

export default function BulkEmailModal({ wetgevingCode, wetgevingNaam, onClose }) {
  const [lijst, setLijst] = useState(null);
  const [geselecteerd, setGeselecteerd] = useState(new Set());
  const [taal, setTaal] = useState("nl");
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
      setFout("Versturen mislukt: " + e.message);
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
              Uitvragen — {wetgevingCode}
            </h2>
            <div className="text-xs text-slate-400">{wetgevingNaam}</div>
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
                ✅ {resultaat.aantal} dataverzoek(en) verstuurd voor{" "}
                {resultaat.wetgeving_code}.
              </div>
              <ul className="text-sm text-slate-600 space-y-1 max-h-60 overflow-auto">
                {resultaat.leveranciers.map((l) => (
                  <li key={l.id}>📨 {l.naam}</li>
                ))}
              </ul>
              <div className="text-right">
                <Button onClick={onClose}>Sluiten</Button>
              </div>
            </div>
          ) : !lijst ? (
            <Loading />
          ) : lijst.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">
              Geen leveranciers met ontbrekende data voor {wetgevingCode}.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <span className="block text-xs font-medium text-slate-600 mb-1">
                    Taal
                  </span>
                  <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                    {["nl", "en"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTaal(t)}
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
                    onChange={(e) => setDeadline(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="text-sm text-slate-600">
                <span className="font-semibold">{lijst.length}</span> leverancier(s)
                met ontbrekende {wetgevingCode}-data:
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
                    <Badge color="red">{l.aantal_velden} velden</Badge>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setBekijk({ id: l.id, naam: l.naam });
                      }}
                      className="text-brand-600 hover:underline text-xs"
                    >
                      Bekijk
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
              Annuleren
            </Button>
            <div className="ml-auto">
              <Button
                onClick={verstuurAllen}
                disabled={bezig || geselecteerd.size === 0}
              >
                {bezig
                  ? "Versturen…"
                  : `Verstuur naar ${geselecteerd.size} leverancier${
                      geselecteerd.size === 1 ? "" : "s"
                    }`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
