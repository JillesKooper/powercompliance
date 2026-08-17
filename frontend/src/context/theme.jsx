import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// ThemeContext: licht/donker-voorkeur voor de hele app.
//
// Gebruik in componenten:
//   const { theme, toggleTheme, isDark } = useTheme();
//
// De voorkeur wordt in localStorage bewaard. Zonder opgeslagen keuze volgt
// de app de OS-voorkeur (prefers-color-scheme). De .dark-class op <html>
// stuurt Tailwind's darkmode aan (zie tailwind.config.js).

const Ctx = createContext(null);

const OPSLAG_SLEUTEL = "powercompliance.thema";
const GELDIGE_THEMAS = ["light", "dark"];

function leesBeginThema() {
  try {
    const opgeslagen = localStorage.getItem(OPSLAG_SLEUTEL);
    if (opgeslagen && GELDIGE_THEMAS.includes(opgeslagen)) return opgeslagen;
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
  } catch (_) {}
  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(leesBeginThema);

  useEffect(() => {
    try {
      localStorage.setItem(OPSLAG_SLEUTEL, theme);
    } catch (_) {}
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  const setTheme = useCallback((nieuw) => {
    setThemeState(GELDIGE_THEMAS.includes(nieuw) ? nieuw : "light");
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((huidig) => (huidig === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, isDark: theme === "dark" }),
    [theme, setTheme, toggleTheme]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useTheme moet binnen <ThemeProvider> gebruikt worden");
  return ctx;
}
