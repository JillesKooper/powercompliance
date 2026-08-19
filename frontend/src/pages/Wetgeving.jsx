import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { useTaal } from "../context/taal";
import {
  wetgevingCode,
  wetgevingNaam,
  wetgevingBeschrijving,
  wetgevingSamenvatting,
} from "../i18n/dataVertaling";
import { Card, Badge, Loading, ErrorBox, Button } from "../components/ui";
import BulkEmailModal from "../components/BulkEmailModal.jsx";

const STATUS_KLEUR = {
  "van kracht": "green",
  aankomend: "amber",
  concept: "slate",
};

// backend-statuswaarde → vertaalsleutel
const STATUS_SLEUTEL = {
  "van kracht": "status.vanKracht",
  aankomend: "status.aankomend",
  concept: "status.concept",
};

function formatDatum(iso, taal) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(taal === "en" ? "en-GB" : "nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Wetgeving() {
  const location = useLocation();
  const { t, taal } = useTaal();
  const [wetten, setWetten] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [uitvraag, setUitvraag] = useState(null); // {code, naam}
  const [bezigId, setBezigId] = useState(null); // wetgeving die nu ververst
  const [bezigAlle, setBezigAlle] = useState(false);
  const [melding, setMelding] = useState(null); // {type, tekst}

  useEffect(() => {
    api.wetgeving(taal).then(setWetten).catch((e) => setError(e.message));
  }, [taal]);

  async function vernieuwEen(w) {
    setBezigId(w.id);
    setMelding(null);
    try {
      const bijgewerkt = await api.verversWetgeving(w.id, taal);
      setWetten((prev) =>
        prev.map((x) => (x.id === bijgewerkt.id ? bijgewerkt : x))
      );
      const gewijzigd =
        (bijgewerkt.samenvatting || "") !== (w.samenvatting || "") ||
        bijgewerkt.status !== w.status ||
        bijgewerkt.van_kracht_vanaf !== w.van_kracht_vanaf;
      setMelding({
        type: "succes",
        tekst: gewijzigd
          ? t("wetgeving.vernieuwdEenGewijzigd", { code: w.code })
          : t("wetgeving.vernieuwdEen", { code: w.code }),
      });
    } catch (e) {
      setMelding({ type: "fout", tekst: t("wetgeving.vernieuwenFout", { fout: e.message }) });
    } finally {
      setBezigId(null);
    }
  }

  async function vernieuwAlle() {
    setBezigAlle(true);
    setMelding(null);
    try {
      const res = await api.verversAlleWetgeving();
      const verse = await api.wetgeving(taal);
      setWetten(verse);
      setMelding({
        type: "succes",
        tekst: t("wetgeving.vernieuwdKlaar", {
          aantal: res.aantal_ververst,
          gewijzigd: res.aantal_gewijzigd,
        }),
      });
    } catch (e) {
      setMelding({ type: "fout", tekst: t("wetgeving.vernieuwenFout", { fout: e.message }) });
    } finally {
      setBezigAlle(false);
    }
  }

  // vanuit het dashboard kan een wetgeving-code worden meegegeven om die
  // direct uit te vouwen en in beeld te scrollen
  useEffect(() => {
    const code = location.state?.code;
    if (!code || !wetten) return;
    const wet = wetten.find((w) => w.code === code);
    if (!wet) return;
    setOpen(wet.id);
    const el = document.getElementById(`wet-${wet.code}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [wetten, location.state]);

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

      <div className="flex items-center justify-end gap-3">
        {melding && (
          <span
            className={`text-sm ${
              melding.type === "succes" ? "text-success-text" : "text-danger-text"
            }`}
          >
            {melding.tekst}
          </span>
        )}
        <Button variant="ghost" onClick={vernieuwAlle} disabled={bezigAlle}>
          {bezigAlle ? t("wetgeving.vernieuwenBezig") : t("wetgeving.vernieuwAlle")}
        </Button>
      </div>

      {wetten.map((w) => (
        <div key={w.id} id={`wet-${w.code}`}>
        <Card className="overflow-hidden">
          <div className="px-5 py-4 flex items-start gap-4">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-info-soft text-info-text grid place-items-center font-bold">
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
                <span className="font-semibold text-ink">
                  {wetgevingCode(w.code, taal)}
                </span>
                <Badge color={STATUS_KLEUR[w.status] || "slate"}>
                  {STATUS_SLEUTEL[w.status] ? t(STATUS_SLEUTEL[w.status]) : w.status}
                </Badge>
                {w.actief === false && (
                  <Badge color="slate">{t("status.uitgeschakeld")}</Badge>
                )}
                {w.van_kracht_vanaf && (
                  <span className="text-xs text-faint">
                    {t("wetgeving.vanaf", { datum: w.van_kracht_vanaf })}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted mt-0.5">
                {wetgevingNaam(w.code, w.naam, taal)}
              </div>
              {w.samenvatting && (
                <p className="text-sm text-muted mt-2 leading-relaxed max-w-3xl">
                  {wetgevingSamenvatting(w.code, w.samenvatting, taal)}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-3">
                {w.info_url && (
                  <a
                    href={w.info_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-hover"
                  >
                    {t("wetgeving.officieleTekst")}
                  </a>
                )}
                <Button
                  variant="ghost"
                  onClick={() => setUitvraag({ code: w.code, naam: w.naam })}
                >
                  {t("wetgeving.uitvragen")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => vernieuwEen(w)}
                  disabled={bezigId === w.id || bezigAlle}
                >
                  {bezigId === w.id
                    ? t("wetgeving.vernieuwenBezig")
                    : t("wetgeving.vernieuwen")}
                </Button>
              </div>
              <span className="text-xs text-faint">
                {w.laatst_bijgewerkt_op
                  ? t("wetgeving.laatstBijgewerkt", {
                      datum: formatDatum(w.laatst_bijgewerkt_op, taal),
                    })
                  : t("wetgeving.nooitBijgewerkt")}
              </span>
              <button
                onClick={() => setOpen(open === w.id ? null : w.id)}
                className="text-xs text-faint hover:text-muted"
              >
                {t("wetgeving.veldenTelling", {
                  aantal: w.compliance_velden.length,
                  pijl: open === w.id ? "▲" : "▼",
                })}
              </button>
            </div>
          </div>

          {open === w.id && (
            <div className="px-5 pb-5 border-t border-line">
              {w.beschrijving && (
                <p className="text-sm text-muted mt-3 mb-4 leading-relaxed">
                  {wetgevingBeschrijving(w.code, w.beschrijving, taal)}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {w.compliance_velden.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-line px-3 py-2 text-sm flex items-center justify-between"
                  >
                    <span className="text-ink">{v.naam}</span>
                    <Badge color="slate">{v.veld_type}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        </div>
      ))}
    </div>
  );
}
