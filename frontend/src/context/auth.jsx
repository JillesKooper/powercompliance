import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getToken, setToken, clearToken } from "../api";

// AuthContext: houdt de inlogstatus van de gebruiker bij.
//
// Gebruik in componenten:
//   const { gebruiker, isIngelogd, laden, login, logout } = useAuth();
//
// Het JWT-token wordt in localStorage bewaard (zie api.js). Bij het laden van de
// app valideren we een bestaand token via /api/auth/me; is het verlopen of
// ongeldig, dan wordt het opgeruimd en is de gebruiker uitgelogd.

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [gebruiker, setGebruiker] = useState(null);
  // laden = we controleren nog of een bestaand token geldig is
  const [laden, setLaden] = useState(!!getToken());

  // Bij mount: als er een token is, controleer of het nog geldig is.
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

  const logout = useCallback(() => {
    clearToken();
    setGebruiker(null);
  }, []);

  const value = useMemo(
    () => ({ gebruiker, isIngelogd: !!gebruiker, laden, login, logout }),
    [gebruiker, laden, login, logout]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth moet binnen <AuthProvider> gebruikt worden");
  return ctx;
}
