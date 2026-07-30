// Centraal vertaalbestand (NL/EN) voor PowerCompliance.
//
// Alle UI-teksten staan hier, verdeeld over per-scherm "parts" in ./parts/*.
// Elk part exporteert { nl: { <namespace>: {...} }, en: { <namespace>: {...} } }
// met een unieke namespace, zodat de delen zonder botsingen samengevoegd worden.
//
// Gebruik in componenten:
//   const { t } = useTaal();
//   t("nav.dashboard")            → "Dashboard" / "Dashboard"
//   t("ui.resultaten", { van, tot, totaal })  → tekst met ingevulde waarden
//
// NIET vertaald: eigennamen (leveranciers, producten, contactgegevens),
// wetgevingscodes (PPWR, REACH, …) en e-mailadressen.
import common from "./parts/common";
import dashboard from "./parts/dashboard";
import instellingen from "./parts/instellingen";
import wetgeving from "./parts/wetgeving";
import rapportages from "./parts/rapportages";
import producten from "./parts/producten";
import productDetail from "./parts/productDetail";
import leveranciers from "./parts/leveranciers";
import leverancierDetail from "./parts/leverancierDetail";
import ontbrekendeData from "./parts/ontbrekendeData";
import sequences from "./parts/sequences";
import email from "./parts/email";
import modals from "./parts/modals";
import widgets from "./parts/widgets";

const parts = [
  common,
  dashboard,
  instellingen,
  wetgeving,
  rapportages,
  producten,
  productDetail,
  leveranciers,
  leverancierDetail,
  ontbrekendeData,
  sequences,
  email,
  modals,
  widgets,
];

function voegSamen(taal) {
  return Object.assign({}, ...parts.map((p) => (p && p[taal]) || {}));
}

export const translations = {
  nl: voegSamen("nl"),
  en: voegSamen("en"),
};
