import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import { useLanguage } from "../context/language";

// Inlogscherm in PowerSuite-stijl: gecentreerde witte kaart op een lichte
// achtergrond, met het PowerCompliance-logomerk, e-mail- en wachtwoordvelden
// (met icoon) en een volle-breedte blauwe inlogknop.
export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState(null);
  const [bezig, setBezig] = useState(false);

  async function verstuur(e) {
    e.preventDefault();
    if (bezig) return;
    setFout(null);
    setBezig(true);
    try {
      await login(email.trim(), wachtwoord);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFout(err.message || t("auth.fout"));
    } finally {
      setBezig(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#f5f5f0" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo + naam */}
        <div className="flex flex-col items-center mb-8">
          <BrandLogo />
          <div className="mt-4 text-2xl text-[#1a1a1a] tracking-tight">
            Power<span className="font-bold">Compliance</span>
          </div>
          <p className="mt-1.5 text-sm text-[#666]">{t("auth.titel")}</p>
        </div>

        {/* Witte kaart met subtiele schaduw */}
        <form
          onSubmit={verstuur}
          className="bg-white rounded-xl border border-[#e5e5e0] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-7 space-y-5"
        >
          {fout && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {fout}
            </div>
          )}

          {/* E-mail */}
          <label className="block">
            <span className="block text-sm font-medium text-[#333] mb-1.5">
              {t("auth.email")}
            </span>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#999] pointer-events-none">
                <UserIcon />
              </span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-md border border-[#ddd] bg-white pl-10 pr-3 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#aaa] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>
          </label>

          {/* Wachtwoord */}
          <label className="block">
            <span className="block text-sm font-medium text-[#333] mb-1.5">
              {t("auth.wachtwoord")}
            </span>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#999] pointer-events-none">
                <LockIcon />
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={wachtwoord}
                onChange={(e) => setWachtwoord(e.target.value)}
                placeholder={t("auth.wachtwoordPlaceholder")}
                className="w-full rounded-md border border-[#ddd] bg-white pl-10 pr-3 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#aaa] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>
          </label>

          {/* Blauwe inlogknop, volle breedte */}
          <button
            type="submit"
            disabled={bezig}
            className="w-full rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {bezig ? t("auth.bezig") : t("auth.login")}
          </button>

          {/* Wachtwoord vergeten */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => alert(t("auth.wachtwoordVergetenMelding"))}
              className="text-sm text-[#2563eb] hover:underline"
            >
              {t("auth.wachtwoordVergeten")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// PowerSuite-stijl logomerk (zelfde bliksem-glyph als in de topbar), hier groter.
function BrandLogo() {
  return (
    <span className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] grid place-items-center shadow-md">
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

function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
