import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Badge, Button, Loading } from "./ui";

function statusBadge(d) {
  if (d.verloop_status === "verlopen")
    return <Badge color="red">verlopen ({Math.abs(d.dagen_tot_verloop)} d)</Badge>;
  if (d.verloop_status === "verloopt_binnenkort")
    return <Badge color="amber">nog {d.dagen_tot_verloop} dagen</Badge>;
  if (d.verloop_status === "geldig")
    return <Badge color="green">geldig</Badge>;
  return <Badge color="slate">geen verloopdatum</Badge>;
}

function formaatGrootte(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ProductDocumenten({ productId }) {
  const [documenten, setDocumenten] = useState(null);
  const [types, setTypes] = useState({});
  const [documenttype, setDocumenttype] = useState("veiligheidsblad");
  const [verloopdatum, setVerloopdatum] = useState("");
  const [bestand, setBestand] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const inputRef = useRef(null);

  function laad() {
    api.productDocumenten(productId).then(setDocumenten).catch((e) => setFout(e.message));
  }

  useEffect(() => {
    api.documenttypes().then(setTypes).catch(() => {});
    laad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function upload(e) {
    e.preventDefault();
    if (!bestand) {
      setFout("Kies een bestand om te uploaden.");
      return;
    }
    setBezig(true);
    setFout(null);
    try {
      const fd = new FormData();
      fd.append("documenttype", documenttype);
      if (verloopdatum) fd.append("verloopdatum", verloopdatum);
      fd.append("file", bestand);
      await api.uploadDocument(productId, fd);
      setBestand(null);
      setVerloopdatum("");
      if (inputRef.current) inputRef.current.value = "";
      laad();
    } catch (e) {
      setFout(e.message);
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(id) {
    if (!confirm("Dit document verwijderen?")) return;
    await api.verwijderDocument(id);
    laad();
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={upload}
        className="rounded-lg border border-line bg-white p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <label className="block md:col-span-1">
          <span className="block text-xs font-medium text-muted mb-1">Documenttype</span>
          <select
            value={documenttype}
            onChange={(e) => setDocumenttype(e.target.value)}
            className="input bg-white"
          >
            {Object.entries(types).map(([sleutel, label]) => (
              <option key={sleutel} value={sleutel}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted mb-1">
            Verloopdatum (optioneel)
          </span>
          <input
            type="date"
            value={verloopdatum}
            onChange={(e) => setVerloopdatum(e.target.value)}
            className="input"
          />
        </label>
        <label className="block md:col-span-1">
          <span className="block text-xs font-medium text-muted mb-1">Bestand (PDF)</span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setBestand(e.target.files?.[0] || null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-hover file:px-3 file:py-2 file:text-sm file:text-ink hover:file:bg-line"
          />
        </label>
        <div>
          <Button type="submit" disabled={bezig}>
            {bezig ? "Uploaden…" : "⬆ Upload"}
          </Button>
        </div>
        {fout && (
          <div className="md:col-span-4 rounded-md bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {fout}
          </div>
        )}
      </form>

      {!documenten ? (
        <Loading />
      ) : documenten.length === 0 ? (
        <div className="text-sm text-muted py-6 text-center">
          Nog geen documenten gekoppeld aan dit product.
        </div>
      ) : (
        <div className="divide-y divide-line/70">
          {documenten.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink truncate">
                    📄 {d.originele_naam}
                  </span>
                  {statusBadge(d)}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {types[d.documenttype] || d.documenttype} · {formaatGrootte(d.grootte)}
                  {d.verloopdatum ? ` · verloopt ${d.verloopdatum}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => api.downloadDocument(d.id)}
                  className="text-brand-600 hover:underline text-xs"
                >
                  Download
                </button>
                <button
                  onClick={() => verwijder(d.id)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  Verwijderen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
