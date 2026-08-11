// Nederlandstalige alias voor de LanguageContext (./language.jsx).
//
// De echte implementatie staat in ./language.jsx (LanguageProvider /
// useLanguage). Dit bestand houdt de bestaande `TaalProvider` / `useTaal`
// API in stand, zodat oudere imports blijven werken. Beide verwijzen naar
// exact dezelfde context, dus taal wisselen werkt overal hetzelfde.
//
// Nieuwe code gebruikt bij voorkeur useLanguage() uit ./language.jsx.
import { useContext } from "react";
import { LanguageProvider, LanguageCtx } from "./language";

export const TaalProvider = LanguageProvider;

export function useTaal() {
  const ctx = useContext(LanguageCtx);
  if (!ctx) throw new Error("useTaal moet binnen <TaalProvider> gebruikt worden");
  return ctx;
}
