import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getToken, setToken, clearToken } from "../api";

// AuthContext: houdt de inlogstatus, rol en organisatie van de gebruiker bij.
//
// Gebruik in componenten:
//   const { gebruiker, isIngelogd, isSuperadmin, isBeheerder, laden,
//           login, logout, impersonatie, impersoneer, stopImpersonatie } = useAuth();
//
// Het JWT-token staat in localStorage (zie api.js). Bij impersonatie bewaren we
// het superadmin-token apart zodat we er weer naar terug kunnen schakelen.

const Ctx = createContext(null);

const SUPER_TOKEN_SLEUTEL = "powercompliance.super_token";
const IMPERSONATIE_SLEUTEL = "powercompliance.impersonatie";

const BEHEER_ROLLEN = ["superadmin", "owner", "admin"];

function leesImpersonatie() {
  try {
    const ruw = localStorage.getItem(IMPERSONATIE_SLEUTEL);
    return ruw ? JSON.parse(ruw) : null;
  } catch (_) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [gebruiker, setGebruiker] = useState(null);
  const [laden, setLaden] = useState(!!getToken());
  // impersonatie = de organisatie waarin een superadmin nu werkt (of null)
  const [impersonatie, setImpersonatie] = useState(leesImpersonatie);

  useEffect(() => {
    let actief = true;
    if (!getToken()) {
      setLaden(false);
      return;
    }
    api
      .me()
      .then((g) => {
        if (actief) setGebruiker(g);
      })
      .catch(() => {
        if (actief) {
          clearToken();
          setGebruiker(null);
        }
      })
      .finally(() => {
        if (actief) setLaden(false);
      });
    return () => {
      actief = false;
    };
  }, []);

  const login = useCallback(async (email, wachtwoord) => {
    const resultaat = await api.login(email, wachtwoord);
    setToken(resultaat.token);
    setGebruiker(resultaat.gebruiker);
    return resultaat.gebruiker;
  }, []);

  // Wachtwoord instellen via uitnodiging → direct ingelogd.
  const voltooiUitnodiging = useCallback(async (token, wachtwoord, naam) => {
    const resultaat = await api.uitnodigingAccepteren(token, wachtwoord, naam);
    setToken(resultaat.token);
    setGebruiker(resultaat.gebruiker);
    return resultaat.gebruiker;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    try {
      localStorage.removeItem(SUPER_TOKEN_SLEUTEL);
      localStorage.removeItem(IMPERSONATIE_SLEUTEL);
    } catch (_) {}
    setImpersonatie(null);
    setGebruiker(null);
  }, []);

  // Superadmin logt in als een organisatie (support). Bewaar het eigen token.
  const impersoneer = useCallback(async (organisatieId) => {
    const huidig = getToken();
    const resultaat = await api.impersonateOrganisatie(organisatieId);
    try {
      if (huidig) localStorage.setItem(SUPER_TOKEN_SLEUTEL, huidig);
      localStorage.setItem(
        IMPERSONATIE_SLEUTEL,
        JSON.stringify(resultaat.organisatie)
      );
    } catch (_) {}
    setToken(resultaat.token);
    setImpersonatie(resultaat.organisatie);
    const g = await api.me();
    setGebruiker(g);
    return g;
  }, []);

  const stopImpersonatie = useCallback(async () => {
    let superTok = null;
    try {
      superTok = localStorage.getItem(SUPER_TOKEN_SLEUTEL);
      localStorage.removeItem(SUPER_TOKEN_SLEUTEL);
      localStorage.removeItem(IMPERSONATIE_SLEUTEL);
    } catch (_) {}
    setImpersonatie(null);
    if (superTok) {
      setToken(superTok);
      const g = await api.me().catch(() => null);
      setGebruiker(g);
    }
  }, []);

  const value = useMemo(
    () => ({
      gebruiker,
      isIngelogd: !!gebruiker,
      isSuperadmin: gebruiker?.rol === "superadmin",
      isBeheerder: BEHEER_ROLLEN.includes(gebruiker?.rol),
      laden,
      login,
      logout,
      voltooiUitnodiging,
      impersonatie,
      impersoneer,
      stopImpersonatie,
    }),
    [
      gebruiker,
      laden,
      login,
      logout,
      voltooiUitnodiging,
      impersonatie,
      impersoneer,
      stopImpersonatie,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth moet binnen <AuthProvider> gebruikt worden");
  return ctx;
}
