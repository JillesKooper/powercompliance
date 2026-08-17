import { useEffect, useState } from "react";
import { api } from "../api";
import { useTaal } from "../context/taal";
import { Badge, Button, Loading, ErrorBox } from "./ui";

const STATUS_KLEUR = {
  open: "amber",
  verzonden: "blue",
  ontvangen: "blue",
  afgerond: "green",
};

const STATUS_SLEUTEL = {
  open: "status.open",
  verzonden: "status.verzonden",
  ontvangen: "status.ontvangen",
  afgerond: "status.afgerond",
};

// Detailweergave van één dataverzoek: leverancier + contactgegevens, welke
// producten/velden zijn uitgevraagd, status, verzenddatum, de verstuurde mail
// en een eventuele ontvangen reply.
export default function DataverzoekModal({ id, onClose }) {
  const { t, taal } = useTaal();
  const [verzoek, setVerzoek] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    let actief = true;
    setVerzoek(null);
    setFout(null);
    api
      .dataverzoek(id, taal)
      .then((d) => actief && setVerzoek(d))
      .catch((e) => actief && setFout(e.message));
    return () => {
      actief = false;
    };
  }, [id, taal]);

  const datum = (waarde) =>
    waarde
      ? new Date(waarde).toLocaleString(taal === "en" ? "en-GB" : "nl-NL", {
          dateStyle: "long",
          timeStyle: "short",
        })
      : "—";

  const lev = verzoek?.leverancier;

  // Regels groeperen per product zodat we per product de velden tonen.
  const perProduct = [];
  if (verzoek?.regels?.length) {
    const index = new Map();
    for (const r of verzoek.regels) {
      const sleutel = r.product_id ?? `veld-${r.id}`;
      if (!index.has(sleutel)) {
        const groep = { naam: r.product_naam, velden: [] };
        index.set(sleutel, groep);
        perProduct.push(groep);
      }
      index.get(sleutel).velden.push(r);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-auto">
        <div className="flex items-start justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="font-semibold text-ink">
              {verzoek?.onderwerp || t("modals.dataverzoek.titel")}
            </h2>
            {verzoek && (
              <div className="mt-1">
                <Badge color={STATUS_KLEUR[verzoek.status] || "slate"}>
                  {STATUS_SLEUTEL[verzoek.status]
                    ? t(STATUS_SLEUTEL[verzoek.status])
                    : verzoek.status}
                </Badge>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-faint hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {fout ? (
            <ErrorBox message={fout} />
          ) : !verzoek ? (
            <Loading />
          ) : (
            <>
              {/* Leverancier + contactgegevens */}
              <div className="rounded-lg border border-line divide-y divide-line text-sm">
                <Rij label={t("modals.dataverzoek.leverancier")}>
                  {lev?.naam || "—"}
                </Rij>
                {lev?.contactpersoon && (
                  <Rij label={t("modals.dataverzoek.contactpersoon")}>
                    {lev.contactpersoon}
                  </Rij>
                )}
                {lev?.email && (
                  <Rij label={t("modals.dataverzoek.email")}>
                    <a
                      href={`mailto:${lev.email}`}
                      className="text-brand-700 hover:underline"
                    >
                      {lev.email}
                    </a>
                  </Rij>
                )}
                {lev?.telefoon && (
                  <Rij label={t("modals.dataverzoek.telefoon")}>{lev.telefoon}</Rij>
                )}
                {lev?.adres && (
                  <Rij label={t("modals.dataverzoek.adres")}>{lev.adres}</Rij>
                )}
                <Rij label={t("modals.dataverzoek.verstuurd")}>
                  {datum(verzoek.aangemaakt_op)}
                </Rij>
                <Rij label={t("modals.dataverzoek.deadline")}>
                  {verzoek.deadline || (
                    <span className="text-faint">
                      {t("modals.dataverzoek.geenDeadline")}
                    </span>
                  )}
                </Rij>
              </div>

              {/* Uitgevraagde producten & velden */}
              <Sectie titel={t("modals.dataverzoek.uitgevraagd")}>
                {perProduct.length === 0 ? (
                  <p className="text-sm text-faint">
                    {t("modals.dataverzoek.geenRegels")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {perProduct.map((groep, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-line px-4 py-3"
                      >
                        <div className="text-sm font-medium text-ink">
                          {groep.naam || "—"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {groep.velden.map((v) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center rounded-md bg-hover px-2 py-0.5 text-xs text-muted"
                              title={v.wetgeving_naam || v.wetgeving_code || ""}
                            >
                              {v.veld_naam || "—"}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Sectie>

              {/* Verstuurde mail */}
              <Sectie titel={t("modals.dataverzoek.verstuurdeMail")}>
                {verzoek.verzonden_bericht ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-ink rounded-lg border border-line bg-hover px-4 py-3">
                    {verzoek.verzonden_bericht}
                  </pre>
                ) : (
                  <p className="text-sm text-faint">
                    {t("modals.dataverzoek.geenMail")}
                  </p>
                )}
              </Sectie>

              {/* Ontvangen reply */}
              <Sectie titel={t("modals.dataverzoek.reply")}>
                {verzoek.reply_bericht ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-ink rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    {verzoek.reply_bericht}
                  </pre>
                ) : (
                  <p className="text-sm text-faint">
                    {t("modals.dataverzoek.geenReply")}
                  </p>
                )}
              </Sectie>
            </>
          )}
        </div>

        <div className="flex items-center px-6 py-4 border-t border-line">
          <div className="ml-auto">
            <Button variant="ghost" onClick={onClose}>
              {t("actie.sluiten")}
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
      <span className="w-32 shrink-0 text-faint">{label}</span>
      <div className="flex-1 text-ink break-words">{children}</div>
    </div>
  );
}

function Sectie({ titel, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint mb-2">
        {titel}
      </h3>
      {children}
    </div>
  );
}
