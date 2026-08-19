import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useTaal } from "../context/taal";
import { Badge, Button, Loading } from "./ui";

function statusBadge(d, t) {
  if (d.verloop_status === "verlopen")
    return <Badge color="red">{t("widgets.documenten.status.verlopen", { n: Math.abs(d.dagen_tot_verloop) })}</Badge>;
  if (d.verloop_status === "verloopt_binnenkort")
    return <Badge color="amber">{t("widgets.documenten.status.nogDagen", { n: d.dagen_tot_verloop })}</Badge>;
  if (d.verloop_status === "geldig")
    return <Badge color="green">{t("widgets.documenten.status.geldig")}</Badge>;
  return <Badge color="slate">{t("widgets.documenten.status.geenVerloopdatum")}</Badge>;
}

function formaatGrootte(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ProductDocumenten({ productId }) {
  const { t } = useTaal();
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
      setFout(t("widgets.documenten.kiesBestand"));
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
    if (!confirm(t("widgets.documenten.bevestigVerwijder"))) return;
    await api.verwijderDocument(id);
    laad();
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={upload}
        className="rounded-lg border border-line bg-surface p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <label className="block md:col-span-1">
          <span className="block text-xs font-medium text-muted mb-1">{t("widgets.documenten.documenttype")}</span>
          <select
            value={documenttype}
            onChange={(e) => setDocumenttype(e.target.value)}
            className="input bg-surface"
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
            {t("widgets.documenten.verloopdatumOptioneel")}
          </span>
          <input
            type="date"
            value={verloopdatum}
            onChange={(e) => setVerloopdatum(e.target.value)}
            className="input"
          />
        </label>
        <label className="block md:col-span-1">
          <span className="block text-xs font-medium text-muted mb-1">{t("widgets.documenten.bestandPdf")}</span>
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
            {bezig ? t("widgets.documenten.uploaden") : `⬆ ${t("widgets.documenten.upload")}`}
          </Button>
        </div>
        {fout && (
          <div className="md:col-span-4 rounded-md bg-danger-soft border border-danger-line text-danger-text px-3 py-2 text-sm">
            {fout}
          </div>
        )}
      </form>

      {!documenten ? (
        <Loading />
      ) : documenten.length === 0 ? (
        <div className="text-sm text-muted py-6 text-center">
          {t("widgets.documenten.geenDocumenten")}
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
                  {statusBadge(d, t)}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {types[d.documenttype] || d.documenttype} · {formaatGrootte(d.grootte)}
                  {d.verloopdatum ? ` · ${t("widgets.documenten.verloopt", { datum: d.verloopdatum })}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => api.downloadDocument(d.id)}
                  className="text-brandtext hover:underline text-xs"
                >
                  {t("actie.download")}
                </button>
                <button
                  onClick={() => verwijder(d.id)}
                  className="text-danger-text hover:text-danger-text text-xs"
                >
                  {t("actie.verwijderen")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
