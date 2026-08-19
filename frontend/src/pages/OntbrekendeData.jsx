import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, Badge, Loading, ErrorBox, Button } from "../components/ui";
import EmailModal from "../components/EmailModal.jsx";
import { useTaal } from "../context/taal";
import { wetgevingCode } from "../i18n/dataVertaling";

export default function OntbrekendeData() {
  const { t, taal } = useTaal();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  // {leverancierId, leverancierNaam, productId?, productNaam?}
  const [mail, setMail] = useState(null);
  const [replyBezig, setReplyBezig] = useState(null); // leverancier_id
  const [replyResultaat, setReplyResultaat] = useState(null);

  function laad() {
    api.ontbrekendeData(taal).then(setItems).catch((e) => setError(e.message));
  }

  useEffect(() => {
    laad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taal]);

  async function simuleerReply(groep) {
    setReplyBezig(groep.id);
    setReplyResultaat(null);
    try {
      const r = await api.simuleerReply({ leverancier_id: groep.id });
      setReplyResultaat({
        naam: groep.naam,
        aantal: r.aantal_ingevuld,
        producten: r.aantal_producten,
        ai: r.ai_gebruikt,
      });
      laad();
    } catch (e) {
      setError(e.message);
    } finally {
      setReplyBezig(null);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!items) return <Loading />;

  // groepeer per leverancier (op id, zodat we de mail kunnen genereren)
  const perLev = {};
  for (const p of items) {
    (perLev[p.leverancier_id] ??= {
      id: p.leverancier_id,
      naam: p.leverancier_naam,
      producten: [],
    }).producten.push(p);
  }
  const groepen = Object.values(perLev);
  const totaalVelden = items.reduce(
    (s, p) => s + p.ontbrekende_velden.length,
    0
  );

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center text-muted">
        🎉 {t("ontbrekendeData.geenOntbrekend")}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {mail && (
        <EmailModal
          leverancierId={mail.leverancierId}
          leverancierNaam={mail.leverancierNaam}
          productId={mail.productId || null}
          productNaam={mail.productNaam || null}
          onClose={() => setMail(null)}
        />
      )}

      <Card className="p-5">
        <div className="text-sm text-muted">
          <span className="font-semibold text-danger-text">{totaalVelden}</span>{" "}
          {t("ontbrekendeData.samenvattingVelden")}{" "}
          <span className="font-semibold">{items.length}</span>{" "}
          {t("ontbrekendeData.samenvattingProducten")}{" "}
          <span className="font-semibold">{groepen.length}</span>{" "}
          {t("ontbrekendeData.samenvattingLeveranciers")}
        </div>
      </Card>

      {replyResultaat && (
        <div className="rounded-lg bg-success-soft border border-success-line text-success-text px-4 py-3 text-sm">
          ✅{" "}
          {t("ontbrekendeData.replyVerwerkt", {
            naam: replyResultaat.naam,
            aantal: replyResultaat.aantal,
            producten: replyResultaat.producten,
          })}{" "}
          {replyResultaat.ai
            ? t("ontbrekendeData.replyAiParsing")
            : t("ontbrekendeData.replyRegelParser")}
        </div>
      )}

      {groepen.map((groep) => (
        <Card key={groep.id} className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-hover border-b border-line">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-ink">🏭 {groep.naam}</span>
              <Badge color="red">
                {groep.producten.reduce(
                  (s, p) => s + p.ontbrekende_velden.length,
                  0
                )}{" "}
                {t("ontbrekendeData.velden")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() =>
                  setMail({
                    leverancierId: groep.id,
                    leverancierNaam: groep.naam,
                  })
                }
              >
                ✉️ {t("ontbrekendeData.emailAlleProducten")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => simuleerReply(groep)}
                disabled={replyBezig === groep.id}
              >
                {replyBezig === groep.id
                  ? `⏳ ${t("ontbrekendeData.verwerken")}`
                  : `📥 ${t("ontbrekendeData.simuleerReply")}`}
              </Button>
            </div>
          </div>
          <div className="divide-y divide-line">
            {groep.producten.map((p) => (
              <div key={p.product_id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Link
                    to={`/producten/${p.product_id}`}
                    className="font-medium text-brandtext hover:underline"
                  >
                    {p.product_naam}
                  </Link>
                  <span className="text-xs text-faint">
                    {p.artikelnummer}
                  </span>
                  <button
                    onClick={() =>
                      setMail({
                        leverancierId: groep.id,
                        leverancierNaam: groep.naam,
                        productId: p.product_id,
                        productNaam: p.product_naam,
                      })
                    }
                    className="ml-auto shrink-0 text-xs text-brandtext hover:underline"
                  >
                    ✉️ {t("ontbrekendeData.uitvraagDitProduct")}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.ontbrekende_velden.map((v) => (
                    <span
                      key={v.compliance_veld_id}
                      className="inline-flex items-center gap-1 rounded-md bg-danger-soft text-danger-text px-2 py-1 text-xs"
                    >
                      <span className="font-semibold">
                        {wetgevingCode(v.wetgeving_code, taal)}
                      </span>
                      <span className="text-danger-text">·</span>
                      {v.veld_naam}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
