import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/auth";
import { useLanguage } from "../context/language";
import { Card, Button, Badge, Loading, ErrorBox } from "../components/ui";

export default function Superadmin() {
  const { t } = useLanguage();
  const { impersoneer } = useAuth();
  const navigate = useNavigate();
  const [organisaties, setOrganisaties] = useState(null);
  const [fout, setFout] = useState(null);
  const [toonModal, setToonModal] = useState(false);
  const [bezigId, setBezigId] = useState(null);

  function laad() {
    api
      .organisaties()
      .then(setOrganisaties)
      .catch((e) => setFout(e.message));
  }

  useEffect(() => {
    laad();
  }, []);

  async function inloggenAls(org) {
    setBezigId(org.id);
    try {
      await impersoneer(org.id);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezigId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-ink mb-1">{t("superadmin.titel")}</h2>
            <p className="text-sm text-muted">{t("superadmin.omschrijving")}</p>
          </div>
          <Button onClick={() => setToonModal(true)}>
            {t("superadmin.nieuweOrg")}
          </Button>
        </div>

        {fout && <ErrorBox message={fout} />}
        {!organisaties ? (
          <Loading />
        ) : organisaties.length === 0 ? (
          <p className="text-sm text-faint">{t("superadmin.geenOrganisaties")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className="px-3 py-2 font-medium">{t("superadmin.kolomOrg")}</th>
                  <th className="px-3 py-2 font-medium">{t("superadmin.kolomSlug")}</th>
                  <th className="px-3 py-2 font-medium text-right">
                    {t("superadmin.kolomGebruikers")}
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    {t("superadmin.kolomProducten")}
                  </th>
                  <th className="px-3 py-2 font-medium">{t("superadmin.kolomStatus")}</th>
                  <th className="px-3 py-2 font-medium text-right">
                    {t("superadmin.kolomActies")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {organisaties.map((o) => (
                  <tr key={o.id} className="border-b border-line/60">
                    <td className="px-3 py-2 text-ink font-medium">{o.naam}</td>
                    <td className="px-3 py-2 text-muted">
                      <code className="text-xs">{o.slug}</code>
                    </td>
                    <td className="px-3 py-2 text-muted text-right">
                      {o.aantal_gebruikers}
                    </td>
                    <td className="px-3 py-2 text-muted text-right">
                      {o.aantal_producten}
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={o.actief ? "green" : "slate"}>
                        {o.actief ? t("superadmin.actief") : t("superadmin.inactief")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => inloggenAls(o)}
                        disabled={bezigId === o.id}
                        className="text-xs text-brandtext dark:text-brand-300 hover:underline disabled:opacity-50"
                      >
                        {t("superadmin.inloggenAls")} →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toonModal && (
        <NieuweOrgModal
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

function NieuweOrgModal({ onClose, onKlaar }) {
  const { t } = useLanguage();
  const [naam, setNaam] = useState("");
  const [domein, setDomein] = useState("");
  const [maxProducten, setMaxProducten] = useState(1000);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  async function verstuur(e) {
    e.preventDefault();
    if (bezig) return;
    setFout(null);
    setBezig(true);
    try {
      await api.maakOrganisatie({
        naam: naam.trim(),
        domein: domein.trim() || null,
        max_producten: Number(maxProducten) || 1000,
      });
      onKlaar();
    } catch (err) {
      setFout(err.message);
    } finally {
      setBezig(false);
    }
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
        <h3 className="font-semibold text-ink mb-4">{t("superadmin.modalTitel")}</h3>
        <form onSubmit={verstuur} className="space-y-4">
          {fout && (
            <div className="rounded-md bg-danger-soft border border-danger-line text-danger-text text-sm px-3 py-2">
              {fout}
            </div>
          )}
          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1">
              {t("superadmin.veldNaam")}
            </span>
            <input
              required
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1">
              {t("superadmin.veldDomein")}
            </span>
            <input
              value={domein}
              onChange={(e) => setDomein(e.target.value)}
              className="input"
              placeholder="bedrijf.nl"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1">
              {t("superadmin.veldMax")}
            </span>
            <input
              type="number"
              min="1"
              value={maxProducten}
              onChange={(e) => setMaxProducten(e.target.value)}
              className="input"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("actie.annuleren")}
            </Button>
            <Button type="submit" disabled={bezig}>
              {bezig ? t("actie.bezig") : t("superadmin.aanmaken")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
