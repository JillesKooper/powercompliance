import { useEffect, useRef, useState } from "react";
import { useTaal } from "../context/taal";

export function Card({ children, className = "", onClick, ...rest }) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface rounded-xl border border-line shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// Kleine blauwe uppercase sectiekop (PowerSuite-stijl), bijv. boven een groep
// velden of een kaart-sectie.
export function SectionLabel({ children, className = "" }) {
  return <div className={`section-label ${className}`}>{children}</div>;
}

export function StatCard({ label, value, sub, accent = "brand", onClick }) {
  const accents = {
    brand: "text-brandtext",
    green: "text-success-text",
    amber: "text-warning-text",
    red: "text-danger-text",
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
    green: "bg-success-soft text-success-text",
    amber: "bg-warning-soft text-warning-text",
    red: "bg-danger-soft text-danger-text",
    blue: "bg-info-soft text-info-text",
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
  const { t } = useTaal();
  return (
    <div className="text-muted text-sm py-12 text-center">{t("ui.laden")}</div>
  );
}

export function ErrorBox({ message }) {
  const { t } = useTaal();
  return (
    <div className="rounded-md bg-danger-soft border border-danger-line text-danger-text px-4 py-3 text-sm">
      {t("ui.fout")}
      {message}
    </div>
  );
}

export function Paginatie({ pagina, onPagina }) {
  const { t } = useTaal();
  if (!pagina || pagina.pages <= 1) {
    return pagina ? (
      <div className="text-xs text-muted px-1 py-2">
        {t("ui.resultaten", {
          van: pagina.total ? 1 : 0,
          tot: pagina.total,
          totaal: pagina.total,
        })}
      </div>
    ) : null;
  }
  const { page, pages, total, per_page } = pagina;
  const van = (page - 1) * per_page + 1;
  const tot = Math.min(page * per_page, total);
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm">
      <span className="text-muted">
        {t("ui.resultaten", { van, tot, totaal: total })}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPagina(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-line px-3 py-1 text-ink disabled:opacity-40 hover:bg-hover"
        >
          {t("ui.vorige")}
        </button>
        <span className="text-muted">
          {page} / {pages}
        </span>
        <button
          onClick={() => onPagina(page + 1)}
          disabled={page >= pages}
          className="rounded-md border border-line px-3 py-1 text-ink disabled:opacity-40 hover:bg-hover"
        >
          {t("ui.volgende")}
        </button>
      </div>
    </div>
  );
}

// Hero-banner bovenaan een pagina: lichtblauw verloop met decoratieve
// zwevende vormen, grote bold titel + grijze subtitel links en een vrije
// actiezone (knoppen, avatar) rechts.
export function PageHero({ title, subtitle, right }) {
  return (
    <div className="page-hero relative overflow-hidden rounded-2xl border border-line/60 px-6 py-6 md:px-8 md:py-7 mb-6">
      <HeroShapes />
      <div className="relative flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] md:text-[32px] leading-tight font-extrabold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-muted max-w-2xl">{subtitle}</p>
          )}
        </div>
        {right && (
          <div className="relative shrink-0 flex items-center gap-2">{right}</div>
        )}
      </div>
    </div>
  );
}

// Decoratieve geometrische vormen (afgeronde rechthoeken/vierkanten) die los
// over de hero-banner zweven. Puur visueel; aria-hidden.
function HeroShapes() {
  const shapes = [
    "absolute top-4 right-[18%] h-10 w-10 rounded-lg rotate-12 bg-[rgb(var(--hero-shape-blue))]/10",
    "absolute -top-3 right-[6%] h-16 w-16 rounded-xl -rotate-6 bg-[rgb(var(--hero-shape-blue))]/[0.07]",
    "absolute bottom-3 right-[30%] h-7 w-7 rounded-md rotate-45 bg-[rgb(var(--hero-shape-gray))]/10",
    "absolute top-1/2 right-[12%] h-5 w-14 rounded-md -rotate-12 bg-[rgb(var(--hero-shape-blue))]/[0.08]",
    "absolute bottom-2 right-[2%] h-9 w-9 rounded-lg rotate-6 bg-[rgb(var(--hero-shape-gray))]/[0.08]",
    "absolute -bottom-4 left-[42%] h-12 w-12 rounded-xl rotate-12 bg-[rgb(var(--hero-shape-blue))]/[0.06]",
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {shapes.map((c, i) => (
        <span key={i} className={c} />
      ))}
    </div>
  );
}

export function Button({ children, variant = "primary", ...props }) {
  const variants = {
    primary: "bg-brand-500 hover:bg-brand-600 text-white",
    ghost: "bg-surface hover:bg-hover text-ink border border-line",
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
