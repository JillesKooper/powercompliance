/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // 'class'-strategie: darkmode wordt aangestuurd door de .dark-class op
  // <html> (zie context/theme.jsx), niet door de OS-voorkeur.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // PowerSuite.ai primaire kleur — alleen voor actieve states en knoppen
        brand: {
          50: "#e8f0fe",
          100: "#d2e3fc",
          300: "#8ab4f8",
          500: "#1a73e8",
          600: "#1a73e8",
          700: "#1557b0",
        },
        // Neutrale huisstijl-tinten. Deze verwijzen naar CSS-variabelen
        // (zie index.css) zodat ze in één keer omklappen tussen licht en
        // donker. De rgb(var(--x) / <alpha-value>)-vorm houdt opacity-
        // utilities zoals text-muted/70 werkend.
        ink: "rgb(var(--kleur-ink) / <alpha-value>)", // primaire tekst
        muted: "rgb(var(--kleur-muted) / <alpha-value>)", // secundaire tekst
        faint: "rgb(var(--kleur-faint) / <alpha-value>)", // tertiaire tekst
        line: "rgb(var(--kleur-line) / <alpha-value>)", // borders
        canvas: "rgb(var(--kleur-canvas) / <alpha-value>)", // hoofd-achtergrond
        surface: "rgb(var(--kleur-surface) / <alpha-value>)", // kaarten/panelen
        sidebar: "rgb(var(--kleur-sidebar) / <alpha-value>)", // zijbalk
        hover: "rgb(var(--kleur-hover) / <alpha-value>)", // hover states
        // Merk-tekst voor links/accenten (flipt naar brand-300 in donkere modus)
        brandtext: "rgb(var(--kleur-brand-text) / <alpha-value>)",
        // Semantische statuskleuren (notificaties, badges, alerts, statuslabels).
        // Elk trio klapt in één keer om via de .dark-class (zie index.css).
        info: {
          soft: "rgb(var(--status-info-soft) / <alpha-value>)",
          line: "rgb(var(--status-info-line) / <alpha-value>)",
          text: "rgb(var(--status-info-text) / <alpha-value>)",
        },
        success: {
          soft: "rgb(var(--status-success-soft) / <alpha-value>)",
          line: "rgb(var(--status-success-line) / <alpha-value>)",
          text: "rgb(var(--status-success-text) / <alpha-value>)",
        },
        warning: {
          soft: "rgb(var(--status-warning-soft) / <alpha-value>)",
          line: "rgb(var(--status-warning-line) / <alpha-value>)",
          text: "rgb(var(--status-warning-text) / <alpha-value>)",
        },
        danger: {
          soft: "rgb(var(--status-danger-soft) / <alpha-value>)",
          line: "rgb(var(--status-danger-line) / <alpha-value>)",
          text: "rgb(var(--status-danger-text) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.06)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        flashGreen: {
          "0%": { backgroundColor: "rgba(16, 185, 129, 0)" },
          "30%": { backgroundColor: "rgba(16, 185, 129, 0.22)" },
          "100%": { backgroundColor: "rgba(16, 185, 129, 0)" },
        },
        pulseRing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(26, 115, 232, 0.35)" },
          "50%": { boxShadow: "0 0 0 6px rgba(26, 115, 232, 0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.4s ease-out both",
        flashGreen: "flashGreen 1.2s ease-out",
        pulseRing: "pulseRing 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
