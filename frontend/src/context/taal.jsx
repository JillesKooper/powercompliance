import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { translations } from "../i18n/translations";

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

export function TaalProvider({ children }) {
  const [taal, setTaalState] = useState(leesBeginTaal);

  useEffect(() => {
    try {
      localStorage.setItem(OPSLAG_SLEUTEL, taal);
    } catch (_) {}
    // hou het lang-attribuut van het document gelijk aan de gekozen taal
    if (typeof document !== "undefined") document.documentElement.lang = taal;
  }, [taal]);

  const setTaal = useCallback((nieuw) => {
    setTaalState(GELDIGE_TALEN.includes(nieuw) ? nieuw : STANDAARD);
  }, []);

  // t("pad.naar.sleutel", { naam: "X" }) → vertaalde string met {plaatshouders}.
  // Valt terug op NL en dan op de sleutel zelf, zodat er nooit niets verschijnt.
  const t = useCallback(
    (sleutel, vars) => {
      let waarde = resolve(translations[taal], sleutel);
      if (waarde == null) waarde = resolve(translations[STANDAARD], sleutel);
      if (waarde == null) return sleutel;
      if (typeof waarde === "string" && vars) {
        return waarde.replace(/\{(\w+)\}/g, (m, k) =>
          k in vars ? String(vars[k]) : m
        );
      }
      return waarde;
    },
    [taal]
  );

  const value = useMemo(() => ({ taal, setTaal, t }), [taal, setTaal, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTaal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTaal moet binnen <TaalProvider> gebruikt worden");
  return ctx;
}
