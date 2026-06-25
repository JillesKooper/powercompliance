import { NavLink, useLocation } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/producten", label: "Producten", icon: "📦" },
  { to: "/leveranciers", label: "Leveranciers", icon: "🏭" },
  { to: "/ontbrekende-data", label: "Ontbrekende data", icon: "⚠️" },
  { to: "/wetgeving", label: "Wetgeving", icon: "⚖️" },
  { to: "/instellingen", label: "Instellingen", icon: "⚙️" },
];

export default function Layout({ children }) {
  const location = useLocation();
  const huidig = NAV.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-700/60">
          <div className="text-lg font-bold tracking-tight">
            ⚡ Power<span className="text-brand-500">Compliance</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Compliance voor groothandels
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 text-xs text-slate-500 border-t border-slate-700/60">
          v0.1.0 · EU-compliance
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8">
          <h1 className="text-lg font-semibold text-slate-800">
            {huidig?.label ?? "PowerCompliance"}
          </h1>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">gvdmond@machine-learning.company</span>
            <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-semibold">
              G
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
