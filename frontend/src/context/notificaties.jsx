import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../api";

const Ctx = createContext(null);

export function NotificatiesProvider({ children }) {
  const [items, setItems] = useState([]);

  const reload = useCallback(() => {
    api.notificaties().then(setItems).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const markeerGelezen = useCallback(async (id) => {
    try {
      const bijgewerkt = await api.markeerNotificatieGelezen(id);
      setItems((prev) => prev.map((n) => (n.id === id ? bijgewerkt : n)));
      return bijgewerkt;
    } catch (_) {
      return null;
    }
  }, []);

  const markeerAllesGelezen = useCallback(async () => {
    try {
      await api.markeerAllesGelezen();
      setItems((prev) => prev.map((n) => ({ ...n, gelezen: true })));
    } catch (_) {}
  }, []);

  const ongelezen = items.filter((n) => !n.gelezen).length;

  return (
    <Ctx.Provider
      value={{ items, ongelezen, reload, markeerGelezen, markeerAllesGelezen }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useNotificaties() {
  return useContext(Ctx);
}

// Bepaal de gerelateerde-entiteit-link voor een notificatie.
// labelKey verwijst naar een vertaalsleutel; label blijft als NL-fallback.
export function relatieVoor(n) {
  if (!n) return null;
  if (n.entiteit_type === "product" && n.entiteit_id)
    return {
      to: `/producten/${n.entiteit_id}`,
      label: "Productdetail",
      labelKey: "modals.notificatie.relProduct",
    };
  if (n.entiteit_type === "leverancier" && n.entiteit_id)
    return {
      to: `/leveranciers/${n.entiteit_id}`,
      label: "Leveranciersdetail",
      labelKey: "modals.notificatie.relLeverancier",
    };
  if (n.entiteit_type === "dataverzoek")
    return {
      to: "/ontbrekende-data",
      label: "Ontbrekende data",
      labelKey: "modals.notificatie.relDataverzoek",
    };
  return null;
}
