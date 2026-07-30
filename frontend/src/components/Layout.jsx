import { NavLink, useLocation } from "react-router-dom";
import { useNotificaties } from "../context/notificaties";
import { useTaal } from "../context/taal";

const NAV = [
  { to: "/", labelKey: "nav.dashboard", icon: "📊", end: true },
  { to: "/producten", labelKey: "nav.producten", icon: "📦" },
  { to: "/leveranciers", labelKey: "nav.leveranciers", icon: "🏭" },
  { to: "/ontbrekende-data", labelKey: "nav.ontbrekendeData", icon: "⚠️" },
  { to: "/wetgeving", labelKey: "nav.wetgeving", icon: "⚖️" },
  { to: "/sequences", labelKey: "nav.sequences", icon: "🔁" },
  { to: "/rapportages", labelKey: "nav.rapportages", icon: "📈" },
  { to: "/instellingen", labelKey: "nav.instellingen", icon: "⚙️" },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { ongelezen } = useNotificaties();
  const { t } = useTaal();
  const huidig = NAV.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Topbar */}
      <header className="h-14 shrink-0 bg-white border-b border-line flex items-center px-5">
        <div className="flex items-center gap-2.5">
          {/* Blauw A-icoon (placeholder) */}
          <span className="h-7 w-7 rounded-full bg-brand-500 grid place-items-center text-white text-sm font-bold">
            A
          </span>
          <span className="text-[15px] text-ink tracking-tight">
            Power<span className="font-bold">Compliance</span>
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1 text-muted">
          <button
            type="button"
            aria-label={t("nav.instellingen")}
            className="h-9 w-9 grid place-items-center rounded-md hover:bg-hover hover:text-ink transition-colors"
          >
            <GearIcon />
          </button>
          <button
            type="button"
            aria-label={t("nav.apps")}
            className="h-9 w-9 grid place-items-center rounded-md hover:bg-hover hover:text-ink transition-colors"
          >
            <GridIcon />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-[210px] shrink-0 bg-white flex flex-col">
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
                      ? "bg-hover text-ink font-medium"
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
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
