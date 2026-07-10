"""E-maildemo: echte verzending via SendGrid + verwerking van inkomende replies.

Dit vult het bestaande ``email_generator`` (dat de mailtekst opstelt) aan met:

1. Echte verzending via SendGrid (gratis tier). Zonder ``SENDGRID_API_KEY`` of
   ``DEMO_EMAIL`` valt de verzending terug op een *gesimuleerde* aflevering,
   zodat de demo altijd werkt.
2. Het genereren van een realistische, gesimuleerde leveranciersreply (platte
   tekst met de ontbrekende waarden).
3. Het parsen van zo'n reply met de Anthropic API (model: claude-sonnet-4-6):
   de AI haalt de waarden uit de vrije tekst en koppelt ze aan de ontbrekende
   compliance-velden. Zonder API-sleutel valt het terug op een robuuste
   regel-parser.
"""
import json
import os
import re
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from . import email_generator, models

MODEL = "claude-sonnet-4-6"


# ---------------------------------------------------------------------------
# 1. Verzending via SendGrid
# ---------------------------------------------------------------------------
def _mail_config() -> dict:
    return {
        "api_key": os.environ.get("SENDGRID_API_KEY", "").strip(),
        "from_email": os.environ.get("MAIL_FROM", "compliance@powercompliance.nl").strip(),
        "from_naam": os.environ.get("MAIL_FROM_NAAM", "PowerCompliance").strip(),
        "demo_email": os.environ.get("DEMO_EMAIL", "").strip(),
    }


def verstuur_mail(
    onderwerp: str,
    tekst: str,
    aan_naam: Optional[str] = None,
    aan_email: Optional[str] = None,
) -> dict:
    """Verstuur een e-mail via SendGrid naar het configureerbare demo-adres.

    Tijdens de demo gaan alle mails naar ``DEMO_EMAIL`` (niet naar het echte
    leveranciersadres). Geeft een dict terug met de afleverstatus.
    """
    cfg = _mail_config()
    # De demo-ontvanger heeft voorrang; anders het echte leveranciersadres.
    ontvanger = cfg["demo_email"] or aan_email or ""

    if not cfg["api_key"] or not ontvanger:
        reden = (
            "SENDGRID_API_KEY niet ingesteld"
            if not cfg["api_key"]
            else "geen ontvanger (stel DEMO_EMAIL in)"
        )
        return {
            "verzonden": False,
            "kanaal": "gesimuleerd",
            "ontvanger": ontvanger or "—",
            "info": f"Gesimuleerde verzending — {reden}.",
            "status_code": None,
        }

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Content, Email, Mail, To

        bericht = Mail(
            from_email=Email(cfg["from_email"], cfg["from_naam"]),
            to_emails=To(ontvanger, aan_naam or None),
            subject=onderwerp,
            plain_text_content=Content("text/plain", tekst),
        )
        client = SendGridAPIClient(cfg["api_key"])
        resp = client.send(bericht)
        ok = 200 <= resp.status_code < 300
        return {
            "verzonden": ok,
            "kanaal": "sendgrid",
            "ontvanger": ontvanger,
            "info": (
                f"Verzonden via SendGrid naar {ontvanger}."
                if ok
                else f"SendGrid gaf status {resp.status_code}."
            ),
            "status_code": resp.status_code,
        }
    except Exception as e:  # noqa: BLE001 — nooit de flow breken op een mailfout
        return {
            "verzonden": False,
            "kanaal": "gesimuleerd",
            "ontvanger": ontvanger,
            "info": f"Verzending mislukt ({type(e).__name__}): {e}",
            "status_code": None,
        }


# ---------------------------------------------------------------------------
# 2. Kandidaten (ontbrekende (product, veld)-paren) + gesimuleerde reply
# ---------------------------------------------------------------------------
def ontbrekende_kandidaten(
    db: Session, leverancier: models.Leverancier, wetgeving_code: Optional[str] = None
) -> List[dict]:
    """Alle ontbrekende (product, compliance-veld)-paren voor deze leverancier.

    Elk paar krijgt een ``regel_id`` ("<product_id>:<veld_id>") zodat de reply
    ondubbelzinnig teruggekoppeld kan worden aan één product en veld.
    """
    per_product, _ = email_generator.verzamel_ontbrekend(db, leverancier, wetgeving_code)
    kandidaten = []
    for product, velden in per_product:
        for veld in velden:
            kandidaten.append(
                {
                    "regel_id": f"{product.id}:{veld.id}",
                    "product_id": product.id,
                    "product_naam": product.naam,
                    "artikelnummer": product.artikelnummer or "",
                    "compliance_veld_id": veld.id,
                    "veld_naam": veld.naam,
                    "veld_type": veld.veld_type,
                    "wetgeving_code": veld.wetgeving.code if veld.wetgeving else "—",
                    "veld": veld,
                    "product": product,
                }
            )
    return kandidaten


def genereer_reply_tekst(
    db: Session, leverancier: models.Leverancier, wetgeving_code: Optional[str] = None
) -> Tuple[str, List[dict]]:
    """Bouw een realistische, platte-tekst leveranciersreply met de ontbrekende
    waarden. Geeft (tekst, kandidaten-met-waarde) terug.
    """
    from .seed import _voorbeeld_waarde  # lazily: seed importeert zwaardere modules

    kandidaten = ontbrekende_kandidaten(db, leverancier, wetgeving_code)
    for k in kandidaten:
        k["waarde"] = _voorbeeld_waarde(k["veld"], k["product"])

    contact = leverancier.contactpersoon or "de leverancier"
    regels = [
        f"Beste compliance-team,",
        "",
        "Bedankt voor jullie verzoek. Hierbij leveren wij de gevraagde "
        "productgegevens aan. Zie hieronder per product de ontbrekende waarden:",
        "",
    ]
    # groepeer per product, in de volgorde waarin de kandidaten binnenkomen
    per_product: dict = {}
    for k in kandidaten:
        per_product.setdefault(k["product_id"], []).append(k)
    for pid, items in per_product.items():
        p = items[0]
        kop = p["product_naam"]
        if p["artikelnummer"]:
            kop += f" (art. {p['artikelnummer']})"
        regels.append(f"Product: {kop}")
        for k in items:
            regels.append(f"- {k['veld_naam']}: {k['waarde']}")
        regels.append("")

    regels += [
        "Mochten jullie nog aanvullende documentatie nodig hebben, dan horen "
        "wij het graag.",
        "",
        "Met vriendelijke groet,",
        contact,
        leverancier.naam,
    ]
    return "\n".join(regels), kandidaten


# ---------------------------------------------------------------------------
# 3. Reply parsen (AI + fallback) en verwerken
# ---------------------------------------------------------------------------
def _blokken(reply_tekst: str) -> List[Tuple[str, List[Tuple[str, str]]]]:
    """Splits de reply in productblokken.

    Geeft een lijst van (product-kop, [(label, waarde), ...]) terug. Regels vóór
    het eerste "Product:"-kopje komen in een blok met een lege kop.
    """
    blokken: List[Tuple[str, list]] = [("", [])]
    for lijn in reply_tekst.splitlines():
        kop = re.match(r"\s*product\s*:\s*(.+?)\s*$", lijn, re.IGNORECASE)
        if kop:
            blokken.append((kop.group(1).strip().lower(), []))
            continue
        paar = re.match(r"\s*[-*•]?\s*(.+?)\s*:\s*(.+?)\s*$", lijn)
        if paar:
            blokken[-1][1].append((paar.group(1).strip().lower(), paar.group(2).strip()))
    return blokken


def _match_in_regels(veld_naam: str, regels: List[Tuple[str, str]]) -> Optional[str]:
    doel = veld_naam.strip().lower()
    for label, waarde in regels:
        if label == doel or (len(doel) > 4 and doel in label):
            return waarde
    return None


def _fallback_parse(reply_tekst: str, kandidaten: List[dict]) -> dict:
    """Koppel per kandidaat een waarde op basis van "veldnaam: waarde"-regels.

    Respecteert de productblokken, zodat gelijknamige velden bij verschillende
    producten elk hun eigen waarde krijgen. Werkt gegarandeerd voor onze eigen
    gegenereerde replies en doet een best-effort match op willekeurige tekst.
    """
    blokken = _blokken(reply_tekst)
    alle_regels = [pr for _, regels in blokken for pr in regels]
    resultaat = {}
    for k in kandidaten:
        product = k["product_naam"].strip().lower()
        # zoek eerst in het blok van dit product
        waarde = None
        for kop, regels in blokken:
            if kop and (kop in product or product in kop):
                waarde = _match_in_regels(k["veld_naam"], regels)
                if waarde is not None:
                    break
        # anders: val terug op de eerste passende regel in de hele tekst
        if waarde is None:
            waarde = _match_in_regels(k["veld_naam"], alle_regels)
        if waarde is not None:
            resultaat[k["regel_id"]] = waarde
    return resultaat


def _ai_parse(reply_tekst: str, kandidaten: List[dict]) -> Tuple[dict, bool, Optional[str]]:
    """Laat de Anthropic API de waarden uit de vrije tekst halen.

    Geeft (mapping regel_id->waarde, ai_gebruikt, ai_fout) terug.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return (
            _fallback_parse(reply_tekst, kandidaten),
            False,
            "ANTHROPIC_API_KEY niet ingesteld — regel-parser gebruikt.",
        )
    try:
        import anthropic

        velden_json = json.dumps(
            [
                {
                    "regel_id": k["regel_id"],
                    "product": k["product_naam"],
                    "veld": k["veld_naam"],
                    "type": k["veld_type"],
                }
                for k in kandidaten
            ],
            ensure_ascii=False,
        )
        prompt = (
            "Je krijgt de tekst van een e-mailreply van een leverancier en een "
            "lijst met ontbrekende compliance-velden. Haal voor elk veld de "
            "aangeleverde waarde uit de e-mailtekst.\n\n"
            f"ONTBREKENDE VELDEN (JSON):\n{velden_json}\n\n"
            f"E-MAILREPLY:\n\"\"\"\n{reply_tekst}\n\"\"\"\n\n"
            "Geef UITSLUITEND een JSON-object terug dat elke gevonden regel_id "
            "koppelt aan de waarde als string, bijv. "
            '{\"12:34\": \"85\", \"12:35\": \"Karton (FSC-gecertificeerd)\"}. '
            "Laat velden weg die niet in de e-mail voorkomen. Geen uitleg."
        )
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        ruw = "".join(b.text for b in resp.content if b.type == "text").strip()
        # haal het JSON-object uit het antwoord (ook als er tekst omheen staat)
        m = re.search(r"\{.*\}", ruw, re.DOTALL)
        if not m:
            raise ValueError("Geen JSON in AI-antwoord")
        mapping = json.loads(m.group(0))
        geldige_ids = {k["regel_id"] for k in kandidaten}
        mapping = {
            str(rid): str(w)
            for rid, w in mapping.items()
            if str(rid) in geldige_ids and str(w).strip()
        }
        if not mapping:
            raise ValueError("AI vond geen bruikbare waarden")
        return mapping, True, None
    except Exception as e:  # noqa: BLE001 — terugvallen op de regel-parser
        return (
            _fallback_parse(reply_tekst, kandidaten),
            False,
            f"AI-parsing mislukt ({type(e).__name__}): {e} — regel-parser gebruikt.",
        )


def verwerk_reply(
    db: Session,
    leverancier: models.Leverancier,
    reply_tekst: str,
    wetgeving_code: Optional[str] = None,
) -> dict:
    """Parse de reply en vul de ontbrekende compliance-velden automatisch aan.

    Ingevulde waarden krijgen ``bron="reply"`` zodat de Voor/Na-vergelijking op
    de productdetailpagina precies weet welke velden via de reply zijn verrijkt.
    """
    kandidaten = ontbrekende_kandidaten(db, leverancier, wetgeving_code)
    kandidaat_op_id = {k["regel_id"]: k for k in kandidaten}
    mapping, ai_gebruikt, ai_fout = _ai_parse(reply_tekst, kandidaten)

    verwerkt = []
    geraakte_producten = set()
    for regel_id, waarde in mapping.items():
        k = kandidaat_op_id.get(regel_id)
        if not k:
            continue
        w = (
            db.query(models.ProductComplianceWaarde)
            .filter_by(product_id=k["product_id"], compliance_veld_id=k["compliance_veld_id"])
            .first()
        )
        if not w:
            w = models.ProductComplianceWaarde(
                product_id=k["product_id"],
                compliance_veld_id=k["compliance_veld_id"],
            )
            db.add(w)
        w.waarde = waarde
        w.ingevuld = True
        w.bron = "reply"
        w.geverifieerd = True
        w.twijfelachtig = False
        w.bijgewerkt_op = datetime.utcnow()
        geraakte_producten.add(k["product_id"])
        verwerkt.append(
            {
                "product_id": k["product_id"],
                "product_naam": k["product_naam"],
                "compliance_veld_id": k["compliance_veld_id"],
                "veld_naam": k["veld_naam"],
                "wetgeving_code": k["wetgeving_code"],
                "waarde": waarde,
            }
        )

    db.commit()

    # compliance-cache van de geraakte producten herberekenen
    from . import compliance_service

    for pid in geraakte_producten:
        product = db.get(models.Product, pid)
        if product:
            compliance_service.herbereken_product(db, product)
    db.commit()
    compliance_service.invalideer_dashboard()

    return {
        "aantal_ingevuld": len(verwerkt),
        "aantal_producten": len(geraakte_producten),
        "velden": verwerkt,
        "ai_gebruikt": ai_gebruikt,
        "ai_fout": ai_fout,
    }
