import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { translations } from "../i18n/translations";

// LanguageContext: centrale taalvoorkeur (NL/EN) voor de hele app.
//
// Gebruik in componenten:
//   const { language, setLanguage, t } = useLanguage();
//   t("nav.dashboard")                        → vertaalde string
//   t("ui.resultaten", { van, tot, totaal })  → tekst met ingevulde waarden
//
// De taalvoorkeur wordt in localStorage bewaard (standaard: Nederlands),
// zodat de keuze bij een volgend bezoek behouden blijft.
//
// Backwards-compat: de context stelt ook de Nederlandstalige aliassen
// `taal`/`setTaal` beschikbaar (zie ./taal.jsx), zodat bestaande code
// ongewijzigd blijft werken.

const Ctx = createContext(null);

const OPSLAG_SLEUTEL = "powercompliance.taal";
const GELDIGE_TALEN = ["nl", "en"];
const STANDAARD = "nl";

function leesBeginTaal() {
  try {
    const opgeslagen = localStorage.getItem(OPSLAG_SLEUTEL);
    if (opgeslagen && GELDIGE_TALEN.includes(opgeslagen)) return opgeslagen;
  } catch (_) {}
  return STANDAARD;
}

// Haal een geneste sleutel ("a.b.c") op uit een object.
function resolve(obj, pad) {
  return pad.split(".").reduce((acc, deel) => (acc == null ? acc : acc[deel]), obj);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(leesBeginTaal);

  useEffect(() => {
    try {
      localStorage.setItem(OPSLAG_SLEUTEL, language);
    } catch (_) {}
    // hou het lang-attribuut van het document gelijk aan de gekozen taal
    if (typeof document !== "undefined") document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nieuw) => {
    setLanguageState(GELDIGE_TALEN.includes(nieuw) ? nieuw : STANDAARD);
  }, []);

  // t("pad.naar.sleutel", { naam: "X" }) → vertaalde string met {plaatshouders}.
  // Valt terug op NL en dan op de sleutel zelf, zodat er nooit niets verschijnt.
  const t = useCallback(
    (sleutel, vars) => {
      let waarde = resolve(translations[language], sleutel);
      if (waarde == null) waarde = resolve(translations[STANDAARD], sleutel);
      if (waarde == null) return sleutel;
      if (typeof waarde === "string" && vars) {
        return waarde.replace(/\{(\w+)\}/g, (m, k) =>
          k in vars ? String(vars[k]) : m
        );
      }
      return waarde;
    },
    [language]
  );

  const value = useMemo(
    // Zowel de Engelse (language/setLanguage) als de Nederlandse
    // (taal/setTaal) namen wijzen naar dezelfde waarde.
    () => ({ language, setLanguage, taal: language, setTaal: setLanguage, t }),
    [language, setLanguage, t]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useLanguage moet binnen <LanguageProvider> gebruikt worden");
  return ctx;
}

// Gedeelde context, zodat de Nederlandstalige alias-hook (./taal.jsx)
// exact dezelfde provider-waarde leest.
export const LanguageCtx = Ctx;
