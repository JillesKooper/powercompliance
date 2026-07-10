/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
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
        // Neutrale huisstijl-tinten
        ink: "#1a1a1a", // primaire tekst
        muted: "#666666", // secundaire tekst
        line: "#e0e0e0", // borders
        canvas: "#f5f5f5", // achtergrond
        hover: "#f0f0f0", // hover states
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
