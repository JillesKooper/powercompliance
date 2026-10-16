import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useNotificaties } from "../context/notificaties";
import { useLanguage } from "../context/language";
import { useTheme } from "../context/theme";
import { useAuth } from "../context/auth";

const NAV = [
  // Dashboard is bereikbaar via zowel "/" als "/dashboard" (login landt op
  // /dashboard), dus beide paden markeren het item als actief.
  {
    to: "/dashboard",
    labelKey: "nav.dashboard",
    icon: "dashboard",
    match: (p) => p === "/" || p === "/dashboard",
  },
  { to: "/producten", labelKey: "nav.producten", icon: "producten" },
  { to: "/leveranciers", labelKey: "nav.leveranciers", icon: "leveranciers" },
  { to: "/ontbrekende-data", labelKey: "nav.ontbrekendeData", icon: "waarschuwing" },
  { to: "/wetgeving", labelKey: "nav.wetgeving", icon: "wetgeving" },
  { to: "/sequences", labelKey: "nav.sequences", icon: "sequences" },
  { to: "/rapportages", labelKey: "nav.rapportages", icon: "rapportages" },
  { to: "/activiteit", labelKey: "nav.activiteit", icon: "activiteit" },
  { to: "/instellingen", labelKey: "nav.instellingen", icon: "instellingen" },
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { ongelezen } = useNotificaties();
  const { t } = useLanguage();
  const { gebruiker, logout, isBeheerder, isSuperadmin, impersonatie, stopImpersonatie } =
    useAuth();

  // Rol-afhankelijke navigatie: gebruikersbeheer voor beheerders, superadmin-
  // dashboard alleen voor de superadmin (tenzij die een organisatie impersoneert).
  const navItems = [...NAV];
  if (isBeheerder) {
    navItems.push({ to: "/gebruikers", labelKey: "nav.gebruikers", icon: "gebruikers" });
  }
  if (isSuperadmin && !impersonatie) {
    navItems.push({ to: "/superadmin", labelKey: "nav.superadmin", icon: "superadmin" });
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function handleStopImpersonatie() {
    await stopImpersonatie();
    navigate("/superadmin", { replace: true });
  }

  const isItemActief = (item) =>
    item.match
      ? item.match(location.pathname)
      : item.end
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);

  const huidig = navItems.find(isItemActief);
  const paginaNaam = huidig ? t(huidig.labelKey) : t("app.naam");

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Topbar: witte balk met de app-identiteit links en paginanaam + acties
          rechts. */}
      <header className="h-14 shrink-0 bg-surface border-b border-line flex items-center px-4 md:px-5">
        <Link
          to="/"
          aria-label={t("nav.dashboard")}
          className="flex items-center gap-2.5 rounded-md -mx-1 px-1 hover:opacity-80 transition-opacity"
        >
          <BrandLogo />
          <span className="text-[15px] text-ink tracking-tight">
            Power<span className="font-bold">Compliance</span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1.5 text-muted">
          <span className="hidden sm:block text-sm font-medium text-ink mr-1">
            {paginaNaam}
          </span>
          <span className="hidden sm:block h-5 w-px bg-line mr-1" aria-hidden="true" />
          <LanguageToggle />
          <ThemeToggle />
          <Link
            to="/instellingen"
            aria-label={t("nav.instellingen")}
            title={t("nav.instellingen")}
            className="h-9 w-9 grid place-items-center rounded-md hover:bg-hover hover:text-ink transition-colors"
          >
            <GearIcon />
          </Link>
          <AppMenu key={location.pathname} t={t} />
        </div>
      </header>

      {/* Impersonatie-banner: superadmin werkt tijdelijk in een organisatie. */}
      {impersonatie && (
        <div className="shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-5 py-2 flex items-center gap-3 text-sm">
          <span className="text-warning-text">
            🛡️ {t("impersonatie.banner", { org: impersonatie.naam })}
          </span>
          <button
            type="button"
            onClick={handleStopImpersonatie}
            className="ml-auto rounded-md border border-amber-500/40 px-3 py-1 text-xs font-medium text-warning-text hover:bg-amber-500/20 transition-colors"
          >
            {t("impersonatie.stop")}
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Zijbalk: smalle donkere icoon-rail (PowerSuite-stijl). Blijft donker
            in zowel licht als donker thema. */}
        <aside className="w-[68px] shrink-0 bg-sidebar flex flex-col items-center py-3">
          {/* Squadra-merkicoon bovenaan */}
          <Link
            to="/"
            aria-label="Squadra"
            title="Squadra"
            className="mb-4 hover:opacity-85 transition-opacity"
          >
            <SquadraMark />
          </Link>

          <nav className="flex-1 w-full flex flex-col items-center gap-1 px-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={t(item.labelKey)}
                aria-label={t(item.labelKey)}
                className={`relative grid place-items-center h-11 w-11 rounded-xl transition-colors ${
                  isItemActief(item)
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-neutral-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <NavIcon name={item.icon} />
                {item.icon === "dashboard" && ongelezen > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold ring-2 ring-[color:rgb(var(--kleur-sidebar))]">
                    {ongelezen}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Onderaan: uitloggen, gebruikersavatar en Squadra-footer */}
          <div className="w-full flex flex-col items-center gap-2 px-2 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              title={t("auth.uitloggen")}
              aria-label={t("auth.uitloggen")}
              className="grid place-items-center h-11 w-11 rounded-xl text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogoutIcon />
            </button>
            <div
              title={`${gebruiker?.naam || t("app.gebruiker")}${
                gebruiker?.bedrijf ? ` · ${gebruiker.bedrijf}` : ""
              }`}
              className="grid place-items-center h-9 w-9 rounded-full bg-brand-500 text-white text-xs font-semibold select-none ring-2 ring-white/10"
            >
              {initialen(gebruiker?.naam)}
            </div>
            <div className="mt-1 text-center leading-tight" title="PowerCompliance · powered by Squadra">
              <div className="text-[9px] font-semibold text-neutral-300">Power</div>
              <div className="text-[8px] text-neutral-500">by Squadra</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-auto p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink mb-6">
            {paginaNaam}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}

// Initialen uit de gebruikersnaam (max. twee letters) voor de avatar.
function initialen(naam) {
  if (!naam) return "?";
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return "?";
  if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
  return (delen[0][0] + delen[delen.length - 1][0]).toUpperCase();
}

// PowerSuite-stijl logomerk: afgerond vierkant in de merkkleur met een
// witte bliksem-glyph (het "Power"-motief dat de PowerSuite-apps delen).
function BrandLogo() {
  return (
    <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center shadow-sm">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

// Squadra-merkicoon voor bovenaan de donkere zijbalk: wit afgerond vierkant
// met een blauwe "S"-glyph zodat het merk op de donkere rail herkenbaar is.
function SquadraMark() {
  return (
    <span className="h-9 w-9 rounded-xl bg-white grid place-items-center shadow-sm">
      <span className="text-brand-500 font-extrabold text-lg leading-none">S</span>
    </span>
  );
}

// Compacte NL/EN-schakelaar, altijd zichtbaar in de topbar zodat de taal
// zonder omweg via Instellingen te wisselen is. Taalcodes (NL/EN) blijven
// bewust onvertaald.
function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const opties = ["nl", "en"];
  return (
    <div
      role="group"
      aria-label={t("nav.taalWissel")}
      className="inline-flex rounded-lg border border-line overflow-hidden text-xs font-semibold"
    >
      {opties.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={`px-2.5 py-1 transition-colors ${
            language === code
              ? "bg-brand-500 text-white"
              : "bg-surface text-muted hover:bg-hover hover:text-ink"
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Licht/donker-schakelaar: zon in donkere modus (klik → licht),
// maan in lichte modus (klik → donker).
function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Lichte modus" : "Donkere modus"}
      title={isDark ? "Lichte modus" : "Donkere modus"}
      className="h-9 w-9 grid place-items-center rounded-md hover:bg-hover hover:text-ink transition-colors"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// Grid/app-menu rechts in de topbar: toont de PowerSuite-apps (PowerCompliance
// is de actieve app). Sluit bij klik buiten het menu.
function AppMenu({ t }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="PowerSuite"
        aria-expanded={open}
        title="PowerSuite"
        className={`h-9 w-9 grid place-items-center rounded-md transition-colors ${
          open ? "bg-hover text-ink" : "hover:bg-hover hover:text-ink"
        }`}
      >
        <GridIcon />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-line bg-surface shadow-card z-50 overflow-hidden">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted border-b border-line">
              PowerSuite
            </div>
            <div className="p-1.5">
              <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 bg-brand-500/10">
                <span className="h-6 w-6 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" fill="white" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-ink">PowerCompliance</span>
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
              </div>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted border-t border-line">
              powered by <span className="font-semibold text-ink">Squadra</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Navigatie-iconen (lucide-stijl, 20px, stroke = currentColor) -------------

const ICON_PADEN = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  producten: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
    </>
  ),
  leveranciers: (
    <>
      <path d="M2 20h20M4 20V8l6-3v4l6-3v14M14 9l6-3v14M8 12h0M8 16h0M18 12h0M18 16h0" />
    </>
  ),
  waarschuwing: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  wetgeving: (
    <>
      <path d="M12 3v18M3 7h18M6 7l-3 6a4 4 0 0 0 6 0L6 7zM18 7l-3 6a4 4 0 0 0 6 0l-3-6zM8 21h8" />
    </>
  ),
  sequences: (
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  rapportages: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </>
  ),
  activiteit: (
    <>
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  instellingen: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  gebruikers: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  superadmin: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </>
  ),
};

function NavIcon({ name }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PADEN[name] || ICON_PADEN.dashboard}
    </svg>
  );
}

function GridIcon() {
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
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function SunIcon() {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function GearIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
