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

export const api = {
  dashboard: () => request("/dashboard"),
  leveranciers: () => request("/leveranciers"),
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
  maakProduct: (data) =>
    request("/producten", { method: "POST", body: JSON.stringify(data) }),
  wijzigProduct: (id, data) =>
    request(`/producten/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  verwijderProduct: (id) => request(`/producten/${id}`, { method: "DELETE" }),

  categorieen: () => request("/categorieen"),
  wetgeving: () => request("/wetgeving"),
  ontbrekendeData: () => request("/ontbrekende-data"),
  dataverzoeken: () => request("/dataverzoeken"),
  notificaties: () => request("/notificaties"),

  importProducten: (file) => upload("/import/producten", file),
  importLeveranciers: (file) => upload("/import/leveranciers", file),
};
