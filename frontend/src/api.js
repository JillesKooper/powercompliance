// Dunne API-client. In dev proxyt Vite /api naar de FastAPI-backend.
const BASE = "/api";

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
  productCompliance: (id) => request(`/producten/${id}/compliance`),
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
  wetgeving: () => request("/wetgeving"),
  wetgevingBeheer: () => request("/wetgeving/beheer"),
  zetWetgevingActief: (id, actief) =>
    request(`/wetgeving/${id}/actief`, {
      method: "POST",
      body: JSON.stringify({ actief }),
    }),
  ontbrekendeData: () => request("/ontbrekende-data"),
  dataverzoeken: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return request(`/dataverzoeken${qs ? `?${qs}` : ""}`);
  },
  bulkDataverzoeken: (data) =>
    request("/dataverzoeken/bulk", { method: "POST", body: JSON.stringify(data) }),
  notificaties: () => request("/notificaties"),
  markeerNotificatieGelezen: (id) =>
    request(`/notificaties/${id}/gelezen`, { method: "POST" }),
  markeerAllesGelezen: () =>
    request("/notificaties/gelezen-alles", { method: "POST" }),

  importProducten: (file) => upload("/import/producten", file),
  importLeveranciers: (file) => upload("/import/leveranciers", file),

  genereerEmail: (data) =>
    request("/email/genereer", { method: "POST", body: JSON.stringify(data) }),
  verstuurEmail: (data) =>
    request("/email/verstuur", { method: "POST", body: JSON.stringify(data) }),
  bijlageUrl: (leverancierId) => `/api/email/bijlage/${leverancierId}`,
  wetgevingUitvraagLeveranciers: (code) =>
    request(`/email/uitvraag-wetgeving/${encodeURIComponent(code)}/leveranciers`),
  uitvraagWetgeving: (data) =>
    request("/email/uitvraag-wetgeving", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ---------- PIM/ERP-export ----------
  exportOpties: () => request("/export/opties"),
  exporteer: (data) =>
    download("/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
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
