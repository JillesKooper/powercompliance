import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/auth";
import { useLanguage } from "../context/language";

// Publieke pagina: een uitgenodigde gebruiker stelt via de e-maillink een
// wachtwoord in en wordt daarna direct ingelogd. Zelfde PowerSuite-stijl als het
// inlogscherm.
export default function UitnodigingAccepteren() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { voltooiUitnodiging } = useAuth();
  const { t } = useLanguage();

  const [info, setInfo] = useState(null); // { email, organisatie_naam, geldig }
  const [ladenInfo, setLadenInfo] = useState(true);
  const [naam, setNaam] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [fout, setFout] = useState(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    let actief = true;
    api
      .uitnodigingInfo(token)
      .then((d) => {
        if (!actief) return;
        setInfo(d);
        if (d?.naam) setNaam(d.naam);
      })
      .catch(() => actief && setInfo({ geldig: false }))
      .finally(() => actief && setLadenInfo(false));
    return () => {
      actief = false;
    };
  }, [token]);

  async function verstuur(e) {
    e.preventDefault();
    if (bezig) return;
    setFout(null);
    if (wachtwoord.length < 8) {
      setFout(t("uitnodiging.wachtwoordKort"));
      return;
    }
    if (wachtwoord !== herhaal) {
      setFout(t("uitnodiging.wachtwoordenNietGelijk"));
      return;
    }
    setBezig(true);
    try {
      await voltooiUitnodiging(token, wachtwoord, naam.trim() || null);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFout(err.message || t("uitnodiging.ongeldig"));
    } finally {
      setBezig(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#f0f2f5" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo />
          <div className="mt-4 text-2xl text-[#1a2333] tracking-tight">
            Power<span className="font-bold">Compliance</span>
          </div>
          <p className="mt-1.5 text-sm text-[#6b7280]">{t("uitnodiging.titel")}</p>
        </div>

        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-7">
          {ladenInfo ? (
            <p className="text-sm text-[#6b7280] text-center">…</p>
          ) : !info?.geldig ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-red-700">{t("uitnodiging.ongeldig")}</p>
              <Link to="/login" className="text-sm text-[#1a6ef0] hover:underline">
                {t("uitnodiging.naarLogin")}
              </Link>
            </div>
          ) : (
            <form onSubmit={verstuur} className="space-y-5">
              <p className="text-sm text-[#4b5563]">
                {info.organisatie_naam
                  ? t("uitnodiging.welkom", { org: info.organisatie_naam })
                  : t("uitnodiging.welkomAlgemeen")}
                {info.email ? (
                  <span className="block mt-1 font-medium text-[#1a2333]">
                    {info.email}
                  </span>
                ) : null}
              </p>

              {fout && (
                <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                  {fout}
                </div>
              )}

              <Veld
                label={t("uitnodiging.veldNaam")}
                value={naam}
                onChange={setNaam}
                type="text"
                autoComplete="name"
              />
              <Veld
                label={t("uitnodiging.veldWachtwoord")}
                value={wachtwoord}
                onChange={setWachtwoord}
                type="password"
                autoComplete="new-password"
                required
              />
              <Veld
                label={t("uitnodiging.veldWachtwoordHerhaal")}
                value={herhaal}
                onChange={setHerhaal}
                type="password"
                autoComplete="new-password"
                required
              />

              <button
                type="submit"
                disabled={bezig}
                className="w-full rounded-md bg-[#1a6ef0] hover:bg-[#1560d6] text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-60"
              >
                {bezig ? t("uitnodiging.bezig") : t("uitnodiging.activeren")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Veld({ label, value, onChange, type, autoComplete, required }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[#1a2333] mb-1.5">{label}</span>
      <input
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[#e2e8f0] bg-[#f9fafb] px-3 py-2.5 text-sm text-[#1a2333] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#1a6ef0] focus:ring-2 focus:ring-[#1a6ef0]/20"
      />
    </label>
  );
}

function BrandLogo() {
  return (
    <span className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#1a6ef0] to-[#1560d6] grid place-items-center shadow-md">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"
          fill="white"
          stroke="white"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
