import { useEffect, useState } from "react";
import { api } from "../api";
import { useTaal } from "../context/taal";
import { Loading, ErrorBox } from "./ui";

const TYPES = {
  mail_verstuurd: { icoon: "✉️", labelKey: "widgets.activiteit.type.mailVerstuurd", kleur: "bg-info-soft text-info-text border-info-line", stip: "bg-brand-500" },
  reply_ontvangen: { icoon: "📥", labelKey: "widgets.activiteit.type.replyOntvangen", kleur: "bg-success-soft text-success-text border-success-line", stip: "bg-emerald-500" },
  data_aangevuld: { icoon: "✨", labelKey: "widgets.activiteit.type.dataAangevuld", kleur: "bg-success-soft text-success-text border-success-line", stip: "bg-emerald-500" },
  status_gewijzigd: { icoon: "🔄", labelKey: "widgets.activiteit.type.statusGewijzigd", kleur: "bg-warning-soft text-warning-text border-warning-line", stip: "bg-amber-500" },
  notificatie: { icoon: "🔔", labelKey: "widgets.activiteit.type.notificatie", kleur: "bg-hover text-muted border-line", stip: "bg-faint" },
};

function formatteerDatum(iso) {
  if (!iso) return "";
  // backend slaat UTC op zonder tijdzone-indicatie; als 'Z' behandelen
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  return d.toLocaleString("nl-NL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ActiviteitTijdlijn({ leverancierId }) {
  const { t } = useTaal();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState({}); // id -> bool

  useEffect(() => {
    setItems(null);
    api
      .leverancierActiviteit(leverancierId)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [leverancierId]);

  if (error) return <ErrorBox message={error} />;
  if (!items) return <Loading />;

  if (items.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-faint text-sm">
        {t("widgets.activiteit.geenInteracties")}
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* verticale lijn */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-line" />
      <div className="space-y-4">
        {items.map((a) => {
          const cfg = TYPES[a.type] || TYPES.notificatie;
          const heeftDetail = a.detail && a.detail.trim() !== "";
          const isOpen = !!open[a.id];
          return (
            <div key={a.id} className="relative animate-fadeIn">
              {/* stip */}
              <span
                className={`absolute -left-6 top-1.5 h-[13px] w-[13px] rounded-full border-2 border-surface ${cfg.stip}`}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.kleur}`}
                >
                  <span>{cfg.icoon}</span>
                  {t(cfg.labelKey)}
                </span>
                <span className="text-xs text-faint">
                  {formatteerDatum(a.aangemaakt_op)}
                </span>
              </div>
              <div className="mt-1 text-sm text-ink">{a.omschrijving}</div>
              {heeftDetail && (
                <div className="mt-1">
                  <button
                    onClick={() =>
                      setOpen((o) => ({ ...o, [a.id]: !o[a.id] }))
                    }
                    className="text-xs text-brandtext hover:underline"
                  >
                    {isOpen ? `▲ ${t("widgets.activiteit.verbergDetails")}` : `▼ ${t("widgets.activiteit.toonDetails")}`}
                  </button>
                  {isOpen && (
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-hover px-3 py-2 text-xs text-muted font-sans leading-relaxed max-h-72 overflow-auto">
                      {a.detail}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
