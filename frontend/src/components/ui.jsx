export function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, accent = "brand" }) {
  const accents = {
    brand: "text-brand-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${accents[accent]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </Card>
  );
}

export function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color =
    v >= 90 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600 w-10 text-right">
        {v}%
      </span>
    </div>
  );
}

export function Badge({ children, color = "slate" }) {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-brand-100 text-brand-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}
    >
      {children}
    </span>
  );
}

export function Loading() {
  return <div className="text-slate-400 text-sm py-12 text-center">Laden…</div>;
}

export function ErrorBox({ message }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
      Fout: {message}
    </div>
  );
}

export function Paginatie({ pagina, onPagina }) {
  if (!pagina || pagina.pages <= 1) {
    return pagina ? (
      <div className="text-xs text-slate-400 px-1 py-2">
        {pagina.total} resultaten
      </div>
    ) : null;
  }
  const { page, pages, total, per_page } = pagina;
  const van = (page - 1) * per_page + 1;
  const tot = Math.min(page * per_page, total);
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm">
      <span className="text-slate-500">
        {van}–{tot} van {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPagina(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
        >
          ← Vorige
        </button>
        <span className="text-slate-500">
          {page} / {pages}
        </span>
        <button
          onClick={() => onPagina(page + 1)}
          disabled={page >= pages}
          className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40 hover:bg-slate-50"
        >
          Volgende →
        </button>
      </div>
    </div>
  );
}

export function Button({ children, variant = "primary", ...props }) {
  const variants = {
    primary: "bg-brand-600 hover:bg-brand-700 text-white",
    ghost: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${variants[variant]}`}
      {...props}
    >
      {children}
    </button>
  );
}
