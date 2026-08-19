import { useNavigate, Link } from "react-router-dom";
import { Button, Badge } from "./ui";
import { useNotificaties, relatieVoor } from "../context/notificaties";
import { useTaal } from "../context/taal";

const TYPE_KLEUR = {
  info: "blue",
  waarschuwing: "amber",
  fout: "red",
  succes: "green",
};
const TYPE_ICOON = {
  info: "ℹ️",
  waarschuwing: "⚠️",
  fout: "❌",
  succes: "✅",
};

export default function NotificatieModal({ notificatie, onClose }) {
  const navigate = useNavigate();
  const { markeerGelezen } = useNotificaties();
  const { t, taal } = useTaal();
  const n = notificatie;
  const rel = relatieVoor(n);

  const datum = n.aangemaakt_op
    ? new Date(n.aangemaakt_op).toLocaleString(taal === "en" ? "en-GB" : "nl-NL", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "—";

  function gaNaar() {
    if (!rel) return;
    markeerGelezen(n.id);
    onClose();
    navigate(rel.to);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-start justify-between px-6 py-4 border-b border-line">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">
              {TYPE_ICOON[n.type] || "ℹ️"}
            </span>
            <div>
              <h2 className="font-semibold text-ink">{n.titel}</h2>
              <div className="flex items-center gap-2 mt-1">
                {n.categorie && (
                  <Badge color={TYPE_KLEUR[n.type] || "slate"}>
                    {n.categorie}
                  </Badge>
                )}
                {!n.gelezen && (
                  <span className="inline-flex items-center gap-1 text-xs text-brandtext">
                    <span className="h-2 w-2 rounded-full bg-brand-500" />
                    {t("modals.notificatie.ongelezen")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-faint hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-ink leading-relaxed">{n.bericht}</p>

          <div className="rounded-lg border border-line divide-y divide-line text-sm">
            <Rij label={t("modals.notificatie.datumTijd")}>{datum}</Rij>
            <Rij label={t("modals.notificatie.type")}>
              {n.categorie || n.type}
            </Rij>
            <Rij label={t("modals.notificatie.gerelateerd")}>
              {rel ? (
                <Link
                  to={rel.to}
                  onClick={() => {
                    markeerGelezen(n.id);
                    onClose();
                  }}
                  className="text-brandtext hover:underline"
                >
                  {t(rel.labelKey)} →
                </Link>
              ) : (
                <span className="text-faint">
                  {t("modals.notificatie.geenOnderdeel")}
                </span>
              )}
            </Rij>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-line">
          <Button
            variant="ghost"
            onClick={() => markeerGelezen(n.id)}
            disabled={n.gelezen}
          >
            {n.gelezen
              ? t("modals.notificatie.gelezen")
              : t("modals.notificatie.markeerGelezen")}
          </Button>
          <div className="ml-auto">
            <Button onClick={gaNaar} disabled={!rel}>
              {t("modals.notificatie.gaNaar")}
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
      <span className="w-28 shrink-0 text-faint">{label}</span>
      <div className="flex-1 text-ink">{children}</div>
    </div>
  );
}
