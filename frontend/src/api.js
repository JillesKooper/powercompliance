// Dunne API-client. In dev proxyt Vite /api naar de FastAPI-backend.
// In productie wijst VITE_API_URL naar de gedeployde backend (bv.
// "https://powercompliance-production.up.railway.app/api").
const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function upload(path, file) {
  const fd = new FormData();
  fd.append("file", file);
  // geen Content-Type zetten: de browser bepaalt de multipart-boundary zelf
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: fd });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

async function uploadForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: formData });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

// Haal een bestand op (blob) en bied het als download aan in de browser.
async function download(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  const blob = await res.blob();
  let naam = "download";
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/);
  if (match) naam = match[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = naam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { aantal: res.headers.get("X-Export-Aantal"), bestandsnaam: naam };
}

export const api = {
  dashboard: () => request("/dashboard"),
  leveranciers: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return request(`/leveranciers${qs ? `?${qs}` : ""}`);
  },
  leverancier: (id) => request(`/leveranciers/${id}`),
  leverancierActiviteit: (id) => request(`/leveranciers/${id}/activiteit`),
  maakLeverancier: (data) =>
    request("/leveranciers", { method: "POST", body: JSON.stringify(data) }),
  wijzigLeverancier: (id, data) =>
    request(`/leveranciers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  verwijderLeverancier: (id) =>
    request(`/leveranciers/${id}`, { method: "DELETE" }),

  producten: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return request(`/producten${qs ? `?${qs}` : ""}`);
  },
  product: (id) => request(`/producten/${id}`),
  productCompliance: (id, taal = "nl") =>
    request(`/producten/${id}/compliance${taal && taal !== "nl" ? `?taal=${taal}` : ""}`),
  scrapeProduct: (id) =>
    request(`/producten/${id}/scrape`, { method: "POST" }),
  verifieerWaarde: (productId, veldId) =>
    request(`/producten/${productId}/compliance/${veldId}/verifieer`, {
      method: "POST",
    }),
  maakProduct: (data) =>
    request("/producten", { method: "POST", body: JSON.stringify(data) }),
  wijzigProduct: (id, data) =>
    request(`/producten/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  verwijderProduct: (id) => request(`/producten/${id}`, { method: "DELETE" }),

  categorieen: () => request("/categorieen"),
  wetgeving: (taal = "nl") =>
    request(`/wetgeving${taal && taal !== "nl" ? `?taal=${taal}` : ""}`),
  wetgevingBeheer: () => request("/wetgeving/beheer"),
  zetWetgevingActief: (id, actief) =>
    request(`/wetgeving/${id}/actief`, {
      method: "POST",
      body: JSON.stringify({ actief }),
    }),
  // ---------- Wetgeving-refresh (AI + websearch) ----------
  verversWetgeving: (id, taal = "nl") =>
    request(
      `/wetgeving/${id}/ververs${taal && taal !== "nl" ? `?taal=${taal}` : ""}`,
      { method: "POST" }
    ),
  verversAlleWetgeving: () =>
    request("/wetgeving/ververs-alle", { method: "POST" }),
  wetgevingRefreshInstelling: () => request("/wetgeving/refresh-instelling"),
  zetWetgevingRefreshInstelling: (frequentie) =>
    request("/wetgeving/refresh-instelling", {
      method: "POST",
      body: JSON.stringify({ frequentie }),
    }),
  ontbrekendeData: (taal = "nl") =>
    request(`/ontbrekende-data${taal && taal !== "nl" ? `?taal=${taal}` : ""}`),
  dataverzoeken: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return request(`/dataverzoeken${qs ? `?${qs}` : ""}`);
  },
  bulkDataverzoeken: (data) =>
    request("/dataverzoeken/bulk", { method: "POST", body: JSON.stringify(data) }),
  notificaties: (taal = "nl") =>
    request(`/notificaties${taal && taal !== "nl" ? `?taal=${taal}` : ""}`),
  markeerNotificatieGelezen: (id, taal = "nl") =>
    request(
      `/notificaties/${id}/gelezen${taal && taal !== "nl" ? `?taal=${taal}` : ""}`,
      { method: "POST" }
    ),
  markeerAllesGelezen: () =>
    request("/notificaties/gelezen-alles", { method: "POST" }),

  importProducten: (file) => upload("/import/producten", file),
  importLeveranciers: (file) => upload("/import/leveranciers", file),

  genereerEmail: (data) =>
    request("/email/genereer", { method: "POST", body: JSON.stringify(data) }),
  verstuurEmail: (data) =>
    request("/email/verstuur", { method: "POST", body: JSON.stringify(data) }),
  bijlageUrl: (leverancierId) => `${BASE}/email/bijlage/${leverancierId}`,
  // Download de Excel-bijlage als blob via de API-basis (werkt ook cross-origin
  // in productie, waar een kaal /api-pad naar de frontend-host zou wijzen).
  downloadBijlage: (leverancierId, wetgeving = null, productId = null, taal = "nl") => {
    const qs = new URLSearchParams();
    if (wetgeving) qs.set("wetgeving", wetgeving);
    if (productId) qs.set("product", productId);
    if (taal && taal !== "nl") qs.set("taal", taal);
    const q = qs.toString();
    return download(`/email/bijlage/${leverancierId}${q ? `?${q}` : ""}`);
  },

  // ---------- Inkomende mailverwerking (reply → AI-parsing) ----------
  simuleerReply: (data) =>
    request("/mail/simuleer-reply", { method: "POST", body: JSON.stringify(data) }),
  mailInbound: (data) =>
    request("/mail/inbound", { method: "POST", body: JSON.stringify(data) }),

  // ---------- Demo-modus ----------
  demoStatus: () => request("/demo/status"),
  demoReset: () => request("/demo/reset", { method: "POST" }),

  // ---------- Sequences / reminders ----------
  sequences: () => request("/sequences"),
  sequence: (id) => request(`/sequences/${id}`),
  maakSequence: (data) =>
    request("/sequences", { method: "POST", body: JSON.stringify(data) }),
  wijzigSequence: (id, data) =>
    request(`/sequences/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  zetSequenceActief: (id, actief) =>
    request(`/sequences/${id}/actief`, {
      method: "POST",
      body: JSON.stringify({ actief }),
    }),
  verwijderSequence: (id) => request(`/sequences/${id}`, { method: "DELETE" }),
  runScheduler: () => request("/sequences/run-scheduler", { method: "POST" }),
  nuUitvragen: (id) =>
    request(`/sequences/${id}/nu-uitvragen`, { method: "POST" }),
  sequenceGenereerMail: (data) =>
    request("/sequences/genereer-mail", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  sequencePreviewMail: (data) =>
    request("/sequences/preview-mail", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  wetgevingUitvraagLeveranciers: (code) =>
    request(`/email/uitvraag-wetgeving/${encodeURIComponent(code)}/leveranciers`),
  uitvraagWetgeving: (data) =>
    request("/email/uitvraag-wetgeving", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ---------- PIM/ERP-export ----------
  exportOpties: (taal = "nl") =>
    request(`/export/opties${taal && taal !== "nl" ? `?taal=${taal}` : ""}`),
  exporteer: (data) =>
    download("/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  exporteerNaarPim: (data) =>
    request("/export/naar-pim", { method: "POST", body: JSON.stringify(data) }),
  exportHistorie: () => request("/export/historie"),
  webhooks: () => request("/export/webhook"),
  abonneerWebhook: (data) =>
    request("/export/webhook", { method: "POST", body: JSON.stringify(data) }),
  verwijderWebhook: (id) =>
    request(`/export/webhook/${id}`, { method: "DELETE" }),

  // ---------- Rapportages ----------
  rapportages: () => request("/rapportages"),
  exporteerRapportage: (soort, formaat) =>
    download(`/rapportages/${soort}/export?formaat=${formaat}`),

  // ---------- Documentbeheer ----------
  documenttypes: () => request("/documenten/types"),
  productDocumenten: (productId) =>
    request(`/producten/${productId}/documenten`),
  uploadDocument: (productId, formData) =>
    uploadForm(`/producten/${productId}/documenten`, formData),
  downloadDocument: (id) => download(`/documenten/${id}/download`),
  verwijderDocument: (id) =>
    request(`/documenten/${id}`, { method: "DELETE" }),
  leverancierDocumenten: (leverancierId) =>
    request(`/leveranciers/${leverancierId}/documenten`),
  verlopendeDocumenten: () => request("/documenten/verlopend"),
};
