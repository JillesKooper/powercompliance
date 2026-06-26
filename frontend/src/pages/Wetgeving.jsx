import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Badge, Loading, ErrorBox, Button } from "../components/ui";
import BulkEmailModal from "../components/BulkEmailModal.jsx";

const STATUS_KLEUR = {
  "van kracht": "green",
  aankomend: "amber",
  concept: "slate",
};

export default function Wetgeving() {
  const [wetten, setWetten] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [uitvraag, setUitvraag] = useState(null); // {code, naam}

  useEffect(() => {
    api.wetgeving().then(setWetten).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!wetten) return <Loading />;

  return (
    <div className="space-y-4">
      {uitvraag && (
        <BulkEmailModal
          wetgevingCode={uitvraag.code}
          wetgevingNaam={uitvraag.naam}
          onClose={() => setUitvraag(null)}
        />
      )}

      {wetten.map((w) => (
        <Card key={w.id} className="overflow-hidden">
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-brand-100 text-brand-700 grid place-items-center font-bold">
              ⚖️
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpen(open === w.id ? null : w.id)}
              onKeyDown={(e) =>
                e.key === "Enter" && setOpen(open === w.id ? null : w.id)
              }
              className="flex-1 min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">{w.code}</span>
                <Badge color={STATUS_KLEUR[w.status] || "slate"}>
                  {w.status}
                </Badge>
                {w.actief === false && (
                  <Badge color="slate">uitgeschakeld</Badge>
                )}
                {w.van_kracht_vanaf && (
                  <span className="text-xs text-slate-400">
                    vanaf {w.van_kracht_vanaf}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-600 mt-0.5">{w.naam}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="ghost"
                onClick={() => setUitvraag({ code: w.code, naam: w.naam })}
              >
                ✉️ Uitvragen
              </Button>
              <button
                onClick={() => setOpen(open === w.id ? null : w.id)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                {w.compliance_velden.length} velden {open === w.id ? "▲" : "▼"}
              </button>
            </div>
          </div>

          {open === w.id && (
            <div className="px-5 pb-5 border-t border-slate-100">
              {w.beschrijving && (
                <p className="text-sm text-slate-500 mt-3 mb-4 leading-relaxed">
                  {w.beschrijving}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {w.compliance_velden.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex items-center justify-between"
                  >
                    <span className="text-slate-700">{v.naam}</span>
                    <Badge color="slate">{v.veld_type}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
