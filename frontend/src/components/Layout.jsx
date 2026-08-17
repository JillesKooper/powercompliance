import { Link, NavLink, useLocation } from "react-router-dom";
import { useNotificaties } from "../context/notificaties";
import { useLanguage } from "../context/language";
import { useTheme } from "../context/theme";

const NAV = [
  { to: "/", labelKey: "nav.dashboard", icon: "📊", end: true },
  { to: "/producten", labelKey: "nav.producten", icon: "📦" },
  { to: "/leveranciers", labelKey: "nav.leveranciers", icon: "🏭" },
  { to: "/ontbrekende-data", labelKey: "nav.ontbrekendeData", icon: "⚠️" },
  { to: "/wetgeving", labelKey: "nav.wetgeving", icon: "⚖️" },
  { to: "/sequences", labelKey: "nav.sequences", icon: "🔁" },
  { to: "/rapportages", labelKey: "nav.rapportages", icon: "📈" },
  { to: "/activiteit", labelKey: "nav.activiteit", icon: "🕓" },
  { to: "/instellingen", labelKey: "nav.instellingen", icon: "⚙️" },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { ongelezen } = useNotificaties();
  const { t } = useLanguage();
  const huidig = NAV.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Topbar */}
      <header className="h-14 shrink-0 bg-surface border-b border-line flex items-center px-5">
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
        <div className="ml-auto flex items-center gap-2 text-muted">
          <LanguageToggle />
          <ThemeToggle />
          <Link
            to="/instellingen"
            aria-label={t("nav.instellingen")}
            className="h-9 w-9 grid place-items-center rounded-md hover:bg-hover hover:text-ink transition-colors"
          >
            <GearIcon />
          </Link>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-[210px] shrink-0 bg-sidebar border-r border-line flex flex-col">
          <div className="px-4 py-4">
            <div className="text-sm font-bold text-ink leading-tight">
              {t("app.gebruiker")}
            </div>
            <div className="text-xs text-muted mt-0.5">{t("app.bedrijf")}</div>
          </div>
          <nav className="flex-1 px-2 space-y-0.5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-brand-500/10 text-brand-700 dark:text-brand-300 font-medium"
                      : "text-muted hover:bg-hover hover:text-ink"
                  }`
                }
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{t(item.labelKey)}</span>
                {item.to === "/" && ongelezen > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[11px] font-semibold">
                    {ongelezen}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          {/* Footer in de zijbalk */}
          <div className="px-4 py-3 border-t border-line text-[11px] text-muted">
            <span className="text-ink font-medium">PowerCompliance</span>
            <span className="mx-1 text-faint">|</span>
            powered by <span className="font-medium">Squadra</span>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-auto p-8">
          <h1 className="text-xl font-semibold text-ink mb-6">
            {huidig ? t(huidig.labelKey) : t("app.naam")}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}

// PowerSuite-stijl logomerk: afgerond vierkant in de merkkleur met een
// witte bliksem-glyph (het "Power"-motief dat de PowerSuite-apps delen).
function BrandLogo() {
  return (
    <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center shadow-sm">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
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
      className="inline-flex rounded-md border border-line overflow-hidden text-xs font-semibold"
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
