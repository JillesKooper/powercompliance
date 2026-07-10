import { useEffect, useRef, useState } from "react";

export function Card({ children, className = "", onClick, ...rest }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-line shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, accent = "brand", onClick }) {
  const accents = {
    brand: "text-brand-600",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  const klikbaar = typeof onClick === "function";
  return (
    <Card
      onClick={onClick}
      className={`p-5 ${
        klikbaar
          ? "cursor-pointer transition-colors hover:bg-hover hover:border-brand-300"
          : ""
      }`}
    >
      <div className="text-sm text-muted">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${accents[accent]}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </Card>
  );
}

export function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color =
    v >= 90 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-hover overflow-hidden">
        <div
          className={`h-full ${color} transition-[width,background-color] duration-700 ease-out`}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted w-10 text-right">
        {v}%
      </span>
    </div>
  );
}

// Telt vloeiend naar de nieuwe waarde toe (voor de Voor/Na- en demo-animaties).
export function AnimatedNumber({ value, decimals = 0, duration = 700 }) {
  const [weergave, setWeergave] = useState(value ?? 0);
  const vanRef = useRef(value ?? 0);

  useEffect(() => {
    const start = vanRef.current;
    const eind = value ?? 0;
    if (start === eind) {
      setWeergave(eind);
      return;
    }
    let raf;
    const t0 = performance.now();
    const stap = (nu) => {
      const p = Math.min(1, (nu - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setWeergave(start + (eind - start) * eased);
      if (p < 1) raf = requestAnimationFrame(stap);
      else vanRef.current = eind;
    };
    raf = requestAnimationFrame(stap);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{weergave.toFixed(decimals)}</>;
}

export function Badge({ children, color = "slate" }) {
  const colors = {
    slate: "bg-hover text-muted",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-brand-50 text-brand-700",
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
  return <div className="text-muted text-sm py-12 text-center">Laden…</div>;
}

export function ErrorBox({ message }) {
  return (
    <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
      Fout: {message}
    </div>
  );
}

export function Paginatie({ pagina, onPagina }) {
  if (!pagina || pagina.pages <= 1) {
    return pagina ? (
      <div className="text-xs text-muted px-1 py-2">
        {pagina.total} resultaten
      </div>
    ) : null;
  }
  const { page, pages, total, per_page } = pagina;
  const van = (page - 1) * per_page + 1;
  const tot = Math.min(page * per_page, total);
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm">
      <span className="text-muted">
        {van}–{tot} van {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPagina(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-line px-3 py-1 text-ink disabled:opacity-40 hover:bg-hover"
        >
          ← Vorige
        </button>
        <span className="text-muted">
          {page} / {pages}
        </span>
        <button
          onClick={() => onPagina(page + 1)}
          disabled={page >= pages}
          className="rounded-md border border-line px-3 py-1 text-ink disabled:opacity-40 hover:bg-hover"
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
    ghost: "bg-white hover:bg-hover text-ink border border-line",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${variants[variant]}`}
      {...props}
    >
      {children}
    </button>
  );
}
