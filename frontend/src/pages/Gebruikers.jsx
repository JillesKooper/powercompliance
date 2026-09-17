import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/auth";
import { useLanguage } from "../context/language";
import { Card, Button, Badge, Loading, ErrorBox } from "../components/ui";

const ROL_KLEUR = {
  superadmin: "blue",
  owner: "blue",
  admin: "green",
  user: "slate",
};

function formatDatum(iso, taal) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(taal === "en" ? "en-GB" : "nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Gebruikers() {
  const { gebruiker: ik, isSuperadmin } = useAuth();
  const { t, taal } = useLanguage();
  const [gebruikers, setGebruikers] = useState(null);
  const [fout, setFout] = useState(null);
  const [toonModal, setToonModal] = useState(false);

  // Owner mag de owner-rol toekennen; admin niet.
  const rolOpties = ik?.rol === "owner" || isSuperadmin
    ? ["user", "admin", "owner"]
    : ["user", "admin"];

  function laad() {
    api
      .gebruikers()
      .then(setGebruikers)
      .catch((e) => setFout(e.message));
  }

  useEffect(() => {
    laad();
  }, []);

  async function wijzigRol(u, rol) {
    const bijgewerkt = await api.wijzigGebruiker(u.id, { rol });
    setGebruikers((prev) => prev.map((x) => (x.id === u.id ? bijgewerkt : x)));
  }

  async function toggleActief(u) {
    const bijgewerkt = await api.wijzigGebruiker(u.id, { actief: !u.actief });
    setGebruikers((prev) => prev.map((x) => (x.id === u.id ? bijgewerkt : x)));
  }

  async function verwijder(u) {
    if (!confirm(t("gebruikers.verwijderBevestig"))) return;
    await api.verwijderGebruiker(u.id);
    setGebruikers((prev) => prev.filter((x) => x.id !== u.id));
  }

  function statusBadge(u) {
    if (u.uitnodiging_openstaand)
      return <Badge color="amber">{t("gebruikers.statusUitgenodigd")}</Badge>;
    return u.actief ? (
      <Badge color="green">{t("gebruikers.statusActief")}</Badge>
    ) : (
      <Badge color="slate">{t("gebruikers.statusInactief")}</Badge>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-ink mb-1">{t("gebruikers.titel")}</h2>
            <p className="text-sm text-muted">{t("gebruikers.omschrijving")}</p>
          </div>
          <Button onClick={() => setToonModal(true)}>
            {t("gebruikers.uitnodigen")}
          </Button>
        </div>

        {fout && <ErrorBox message={fout} />}
        {!gebruikers ? (
          <Loading />
        ) : gebruikers.length === 0 ? (
          <p className="text-sm text-faint">{t("gebruikers.geenGebruikers")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className="px-3 py-2 font-medium">{t("gebruikers.kolomNaam")}</th>
                  <th className="px-3 py-2 font-medium">{t("gebruikers.kolomEmail")}</th>
                  <th className="px-3 py-2 font-medium">{t("gebruikers.kolomRol")}</th>
                  <th className="px-3 py-2 font-medium">
                    {t("gebruikers.kolomLaatsteLogin")}
                  </th>
                  <th className="px-3 py-2 font-medium">{t("gebruikers.kolomStatus")}</th>
                  <th className="px-3 py-2 font-medium text-right">
                    {t("gebruikers.kolomActies")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {gebruikers.map((u) => {
                  const zelf = u.id === ik?.id;
                  return (
                    <tr key={u.id} className="border-b border-line/60">
                      <td className="px-3 py-2 text-ink">{u.naam || "—"}</td>
                      <td className="px-3 py-2 text-muted">{u.email}</td>
                      <td className="px-3 py-2">
                        {zelf ? (
                          <Badge color={ROL_KLEUR[u.rol] || "slate"}>
                            {t(`rol.${u.rol}`)}
                          </Badge>
                        ) : (
                          <select
                            value={u.rol}
                            onChange={(e) => wijzigRol(u, e.target.value)}
                            className="input py-1 text-xs w-28"
                          >
                            {rolOpties.map((r) => (
                              <option key={r} value={r}>
                                {t(`rol.${r}`)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {formatDatum(u.laatste_login, taal) ||
                          t("gebruikers.nooitIngelogd")}
                      </td>
                      <td className="px-3 py-2">{statusBadge(u)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-3">
                          {!zelf && (
                            <>
                              <button
                                onClick={() => toggleActief(u)}
                                className="text-xs text-muted hover:text-ink"
                              >
                                {u.actief
                                  ? t("gebruikers.deactiveren")
                                  : t("gebruikers.activeren")}
                              </button>
                              <button
                                onClick={() => verwijder(u)}
                                className="text-xs text-danger-text hover:underline"
                              >
                                {t("gebruikers.verwijderen")}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toonModal && (
        <UitnodigenModal
          rolOpties={rolOpties}
          onClose={() => setToonModal(false)}
          onKlaar={() => {
            setToonModal(false);
            laad();
          }}
        />
      )}
    </div>
  );
}

function UitnodigenModal({ rolOpties, onClose, onKlaar }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [naam, setNaam] = useState("");
  const [rol, setRol] = useState("user");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [resultaat, setResultaat] = useState(null);
  const [gekopieerd, setGekopieerd] = useState(false);

  async function verstuur(e) {
    e.preventDefault();
    if (bezig) return;
    setFout(null);
    setBezig(true);
    try {
      const res = await api.nodigGebruikerUit({ email: email.trim(), naam: naam.trim() || null, rol });
      setResultaat(res);
    } catch (err) {
      setFout(t("gebruikers.fout", { fout: err.message }));
    } finally {
      setBezig(false);
    }
  }

  function kopieer() {
    navigator.clipboard?.writeText(resultaat.uitnodiging_link).then(() => {
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface border border-line shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-ink mb-4">{t("gebruikers.modalTitel")}</h3>

        {resultaat ? (
          <div className="space-y-4">
            <div className="rounded-md bg-success-soft border border-success-line text-success-text text-sm px-3 py-2">
              {t("gebruikers.uitnodigingVerzonden", {
                email: resultaat.gebruiker.email,
              })}
            </div>
            {!resultaat.mail_verzonden && (
              <div className="rounded-md bg-warning-soft border border-warning-line text-warning-text text-sm px-3 py-2">
                {t("gebruikers.mailNietVerzonden")}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={resultaat.uitnodiging_link}
                className="input text-xs flex-1"
                onFocus={(e) => e.target.select()}
              />
              <Button variant="ghost" onClick={kopieer}>
                {gekopieerd
                  ? t("gebruikers.linkGekopieerd")
                  : t("gebruikers.kopieerLink")}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={onKlaar}>{t("actie.sluiten")}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={verstuur} className="space-y-4">
            {fout && (
              <div className="rounded-md bg-danger-soft border border-danger-line text-danger-text text-sm px-3 py-2">
                {fout}
              </div>
            )}
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1">
                {t("gebruikers.veldEmail")}
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="collega@bedrijf.nl"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1">
                {t("gebruikers.veldNaam")}
              </span>
              <input
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1">
                {t("gebruikers.veldRol")}
              </span>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                className="input"
              >
                {rolOpties.map((r) => (
                  <option key={r} value={r}>
                    {t(`rol.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("actie.annuleren")}
              </Button>
              <Button type="submit" disabled={bezig}>
                {bezig ? t("actie.bezig") : t("gebruikers.versturen")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
