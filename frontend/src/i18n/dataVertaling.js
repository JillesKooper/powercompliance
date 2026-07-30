// Vertalingen van DB-inhoud die tóch mee moet met de interfacetaal:
// wetgevingsnamen/-samenvattingen en productcategorieën.
//
// Keys zijn stabiel: wetgeving op `code` (PPWR, REACH, …), categorie op de
// Nederlandse naam. De wetgevingsCODE zelf blijft altijd onvertaald.
// Ontbreekt een vertaling, dan valt alles terug op de originele (NL-)waarde.

const WETGEVING_NAAM_EN = {
  PPWR: "Packaging and Packaging Waste Regulation",
  CSRD: "Corporate Sustainability Reporting Directive",
  BATTERIJ: "Battery Regulation (EU) 2023/1542",
  REACH: "REACH/CLP — Substances & labelling",
  CPR: "Construction Products Regulation",
  GPSR: "General Product Safety Regulation",
  ERP: "Ecodesign / ErP Directive (Energy-related Products)",
  ESPR: "Ecodesign for Sustainable Products Regulation",
  EUDR: "EU Deforestation Regulation",
  TEXTIEL: "Textile Regulation (EU)",
  SPEELGOED: "Toy Safety Directive 2009/48/EC",
  MDR: "Medical Devices Regulation (MDR 2017/745)",
  COSMETICA: "Cosmetics Regulation (EC) 1223/2009",
};

// Korte beschrijving per wetgeving (getoond op de Wetgeving-pagina).
const WETGEVING_BESCHRIJVING_EN = {
  PPWR: "EU Regulation 2025/40 on packaging and packaging waste.",
  CSRD: "Sustainability reporting obligation for large companies (ESG).",
  BATTERIJ: "Requirements for sustainability, carbon footprint and the battery passport.",
  REACH: "Registration and restriction of chemical substances and labelling.",
  CPR: "Declaration of Performance (DoP) and CE marking for construction products.",
  GPSR: "EU 2023/988: safety warnings and traceability.",
  ERP: "Ecodesign requirements and energy labels for energy-related products.",
  ESPR: "EU 2024/1781: ecodesign requirements and a digital product passport for sustainable products.",
  EUDR: "EU 2023/1115: deforestation-free supply chains for wood, paper, soy, cocoa and palm oil, among others.",
  TEXTIEL: "Labelling, fibre composition and digital product passport for textiles.",
  SPEELGOED: "Safety requirements for toys (CE, age, EN 71).",
  MDR: "Requirements for medical devices: UDI, risk class, CE certificate.",
  COSMETICA: "Requirements for cosmetics: INCI, CPNP notification, responsible person.",
};

// Langere samenvatting per wetgeving (uitklapbaar/prominente tekst).
const WETGEVING_SAMENVATTING_EN = {
  PPWR: "Sets requirements for recyclability, recycled content and labelling of packaging. Applies to virtually all packaged products and is phased in from August 2026.",
  BATTERIJ: "Regulates sustainability, carbon footprint, recycled content and the digital battery passport. Applies to portable, industrial and EV batteries.",
  REACH: "Requires registration and restriction of chemical substances and correct labelling (CLP). Affects chemicals, textiles, cosmetics and many other product groups.",
  CPR: "Requires a Declaration of Performance (DoP) and CE marking for construction products, so their performance is comparable within the EU.",
  GPSR: "General Product Safety Regulation: safety warnings, traceability and a responsible economic operator in the EU for consumer products.",
  ERP: "Ecodesign framework directive with requirements for energy efficiency and energy labels for energy-related products.",
  ESPR: "Successor to the ErP Directive: broader ecodesign requirements and a digital product passport for sustainable products. Introduced per product group.",
  EUDR: "Prohibits placing products linked to deforestation on the market (incl. wood, paper, soy, cocoa, palm oil). Requires due diligence with origin and geolocation.",
  CSRD: "Requires large companies to provide extensive sustainability reporting (ESG) according to the ESRS standards.",
  TEXTIEL: "Regulates textile fibre names and the labelling of the fibre composition of textile products.",
  SPEELGOED: "Sets safety requirements for toys (CE marking, age classification, warnings and EN 71 tests).",
  MDR: "Medical Devices Regulation: requirements for UDI, risk class, CE certification and clinical evaluation.",
  COSMETICA: "Regulates the safety of cosmetics: INCI ingredient list, CPNP notification, a responsible person in the EU and a PIF.",
};

const CATEGORIE_EN = {
  Bouwmaterialen: "Construction materials",
  Chemie: "Chemicals",
  Cosmetica: "Cosmetics",
  Elektronica: "Electronics",
  Medisch: "Medical",
  Meubels: "Furniture",
  Speelgoed: "Toys",
  Textiel: "Textiles",
  Verpakkingen: "Packaging",
  Voedsel: "Food",
};

// Vertaal een wetgevingsnaam op basis van de code. `fallback` is de originele naam.
export function wetgevingNaam(code, fallback, taal) {
  if (taal === "en" && code && WETGEVING_NAAM_EN[code]) return WETGEVING_NAAM_EN[code];
  return fallback;
}

// Vertaal een categorienaam. `naam` is de originele (NL-)naam.
export function categorieNaam(naam, taal) {
  if (taal === "en" && naam && CATEGORIE_EN[naam]) return CATEGORIE_EN[naam];
  return naam;
}

// Vertaal de korte beschrijving van een wetgeving (op basis van code).
export function wetgevingBeschrijving(code, fallback, taal) {
  if (taal === "en" && code && WETGEVING_BESCHRIJVING_EN[code])
    return WETGEVING_BESCHRIJVING_EN[code];
  return fallback;
}

// Vertaal de langere samenvatting van een wetgeving (op basis van code).
export function wetgevingSamenvatting(code, fallback, taal) {
  if (taal === "en" && code && WETGEVING_SAMENVATTING_EN[code])
    return WETGEVING_SAMENVATTING_EN[code];
  return fallback;
}
