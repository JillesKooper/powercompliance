"""Genereert dataverzoek-e-mails aan leveranciers.

- Verzamelt de ontbrekende compliance-velden per leverancier (gegroepeerd per
  wetgeving).
- Bouwt een Excel-bijlage met die ontbrekende velden.
- Genereert de mailtekst via de Anthropic API (model: claude-sonnet-4-6) op
  basis van de ontbrekende data en wetgeving. Zonder API-sleutel (of bij een
  fout) valt het terug op een net sjabloon, zodat de functionaliteit altijd
  werkt.
"""
import io
import os
from collections import defaultdict
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from . import models, compliance

CC_ADRES = "compliance@uwbedrijf.nl"
PORTAAL_BASIS = "https://portaal.powercompliance.nl/leverancier"
MODEL = "claude-sonnet-4-6"


# ---------- data verzamelen ----------
def verzamel_ontbrekend(
    db: Session, leverancier: models.Leverancier, wetgeving_code: Optional[str] = None
):
    """Geef (per_product, per_wetgeving) terug.

    per_product: lijst van (product, [ComplianceVeld]) met ontbrekende velden.
    per_wetgeving: dict wetgeving_code -> set van veldnamen.

    Met wetgeving_code worden alleen de ontbrekende velden van die ene wetgeving
    meegenomen (gericht uitvragen).
    """
    per_product = []
    per_wet = defaultdict(set)
    for product in leverancier.producten:
        ontbrekend = compliance.ontbrekende_velden_voor_product(db, product)
        if wetgeving_code:
            ontbrekend = [
                v
                for v in ontbrekend
                if v.wetgeving and v.wetgeving.code == wetgeving_code
            ]
        if ontbrekend:
            per_product.append((product, ontbrekend))
            for v in ontbrekend:
                code = v.wetgeving.code if v.wetgeving else "—"
                per_wet[code].add(v.naam)
    return per_product, dict(per_wet)


def leveranciers_met_ontbrekend_voor_wetgeving(db: Session, wetgeving_code: str):
    """Alle leveranciers die ontbrekende data hebben voor deze wetgeving."""
    result = []
    leveranciers = db.query(models.Leverancier).order_by(models.Leverancier.naam).all()
    for lev in leveranciers:
        per_product, _ = verzamel_ontbrekend(db, lev, wetgeving_code)
        aantal_velden = sum(len(velden) for _, velden in per_product)
        if aantal_velden > 0:
            result.append(
                {
                    "id": lev.id,
                    "naam": lev.naam,
                    "contactpersoon": lev.contactpersoon,
                    "email": lev.email,
                    "aantal_velden": aantal_velden,
                    "aantal_producten": len(per_product),
                }
            )
    return result


def portaal_link(leverancier: models.Leverancier) -> str:
    return f"{PORTAAL_BASIS}/{leverancier.id}/aanleveren"


def bijlage_naam(
    leverancier: models.Leverancier, wetgeving_code: Optional[str] = None
) -> str:
    veilig = "".join(
        c if c.isalnum() else "_" for c in leverancier.naam
    ).strip("_") or str(leverancier.id)
    if wetgeving_code:
        return f"ontbrekende_data_{veilig}_{wetgeving_code}.xlsx"
    return f"ontbrekende_data_{veilig}.xlsx"


# ---------- Excel-bijlage ----------
def bouw_excel(
    db: Session, leverancier: models.Leverancier, wetgeving_code: Optional[str] = None
) -> io.BytesIO:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    per_product, _ = verzamel_ontbrekend(db, leverancier, wetgeving_code)
    wb = Workbook()
    ws = wb.active
    ws.title = "Ontbrekende data"
    kop = [
        "Product",
        "Artikelnummer",
        "EAN",
        "Wetgeving",
        "Ontbrekend veld",
        "Veldtype",
        "Waarde (in te vullen)",
    ]
    ws.append(kop)
    for cel in ws[1]:
        cel.font = Font(bold=True)
    for product, velden in per_product:
        for v in velden:
            ws.append(
                [
                    product.naam,
                    product.artikelnummer or "",
                    product.ean or "",
                    v.wetgeving.code if v.wetgeving else "",
                    v.naam,
                    v.veld_type,
                    "",
                ]
            )
    breedtes = [28, 18, 16, 12, 32, 12, 24]
    for i, b in enumerate(breedtes, start=1):
        ws.column_dimensions[chr(64 + i)].width = b

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# ---------- onderwerp ----------
def maak_onderwerp(
    leverancier: models.Leverancier,
    per_wet: dict,
    taal: str,
    deadline: Optional[date] = None,
) -> str:
    """Onderwerp met leverancier + wetgeving + (optioneel) deadline."""
    codes = ", ".join(sorted(per_wet.keys())) if per_wet else ""
    if taal == "en":
        s = f"{leverancier.naam} – missing product compliance data"
        if codes:
            s += f" ({codes})"
        if deadline:
            s += f" – deadline {deadline.isoformat()}"
        return s
    s = f"{leverancier.naam} – ontbrekende productcompliance-data"
    if codes:
        s += f" ({codes})"
    if deadline:
        s += f" – deadline {deadline.isoformat()}"
    return s


# ---------- mailtekst (AI + fallback) ----------
def _samenvatting_tekst(per_wet: dict) -> str:
    regels = []
    for code, velden in sorted(per_wet.items()):
        regels.append(f"- {code}: {', '.join(sorted(velden))}")
    return "\n".join(regels)


SYSTEM_PROMPT = (
    "Je bent een compliance-medewerker bij een groothandel. Je schrijft korte, "
    "professionele en vriendelijke zakelijke e-mails aan leveranciers met het "
    "verzoek ontbrekende productdata aan te leveren in het kader van EU-wetgeving. "
    "Geef ALLEEN de tekst van de e-mail (begroeting t/m afsluiting), zonder "
    "onderwerpregel en zonder uitleg eromheen."
)


def _bouw_prompt(
    leverancier: models.Leverancier,
    per_wet: dict,
    deadline: Optional[date],
    taal: str,
    link: str,
    aantal_velden: int,
    aantal_producten: int,
) -> str:
    samenvatting = _samenvatting_tekst(per_wet)
    contact = leverancier.contactpersoon or ("Sir/Madam" if taal == "en" else "heer/mevrouw")
    deadline_str = deadline.isoformat() if deadline else None

    if taal == "en":
        return f"""Write a professional business email in ENGLISH to a supplier.

Supplier: {leverancier.naam}
Contact person: {contact}
Number of products with missing data: {aantal_producten}
Total missing fields: {aantal_velden}

Missing data, grouped by EU legislation:
{samenvatting}

Requirements for the email:
- Briefly explain that we need this data to stay compliant with the listed EU regulations (e.g. PPWR, Battery Regulation, REACH/CLP, CPR, GPSR, ErP).
- Mention that an Excel file listing the exact missing fields is attached.
- Offer the supplier TWO ways to deliver the data:
  1. Reply to this email with the data as plain text.
  2. Upload the data via our portal: {link}
- {"Ask them to deliver before the deadline: " + deadline_str if deadline_str else "Politely ask them to respond as soon as possible."}
- Keep it concise and friendly. Sign off as "The Compliance Team".
Return only the email body text."""

    return f"""Schrijf een professionele zakelijke e-mail in het NEDERLANDS aan een leverancier.

Leverancier: {leverancier.naam}
Contactpersoon: {contact}
Aantal producten met ontbrekende data: {aantal_producten}
Totaal ontbrekende velden: {aantal_velden}

Ontbrekende data, gegroepeerd per EU-wetgeving:
{samenvatting}

Eisen aan de e-mail:
- Leg kort uit dat we deze data nodig hebben om te voldoen aan de genoemde EU-wetgeving (zoals PPWR, Batterijverordening, REACH/CLP, CPR, GPSR, ErP).
- Vermeld dat een Excel-bestand met de exacte ontbrekende velden is bijgevoegd.
- Bied de leverancier TWEE manieren om de data aan te leveren:
  1. Reageer op deze e-mail met de data als platte tekst.
  2. Upload de data via ons portaal: {link}
- {"Vraag om aanlevering vóór de deadline: " + deadline_str if deadline_str else "Vraag vriendelijk om zo snel mogelijk te reageren."}
- Houd het beknopt en vriendelijk. Onderteken met "Het Compliance-team".
Geef alleen de tekst van de e-mail terug."""


def _fallback_tekst(
    leverancier: models.Leverancier,
    per_wet: dict,
    deadline: Optional[date],
    taal: str,
    link: str,
) -> str:
    samenvatting = _samenvatting_tekst(per_wet)
    contact = leverancier.contactpersoon
    deadline_str = deadline.isoformat() if deadline else None
    if taal == "en":
        aanhef = f"Dear {contact}," if contact else "Dear Sir/Madam,"
        deadline_zin = (
            f"Please deliver the data before {deadline_str}."
            if deadline_str
            else "Please respond at your earliest convenience."
        )
        return f"""{aanhef}

To keep our shared product range compliant with the relevant EU regulations, we are missing some product data from you. The missing fields, grouped by legislation, are:

{samenvatting}

A spreadsheet listing the exact missing fields is attached to this email.

You can deliver the data in either of two ways:
1. Reply to this email with the data as plain text.
2. Upload the data via our portal: {link}

{deadline_zin}

Thank you in advance for your cooperation.

Kind regards,
The Compliance Team"""
    aanhef = f"Beste {contact}," if contact else "Geachte heer/mevrouw,"
    deadline_zin = (
        f"Graag ontvangen wij de data vóór {deadline_str}."
        if deadline_str
        else "Wij ontvangen de data graag zo spoedig mogelijk."
    )
    return f"""{aanhef}

Om ons gezamenlijke productassortiment te laten voldoen aan de relevante EU-wetgeving, ontbreekt bij ons nog een aantal productgegevens van uw kant. De ontbrekende velden, gegroepeerd per wetgeving, zijn:

{samenvatting}

In de bijlage van deze e-mail vindt u een overzicht (Excel) met de exacte ontbrekende velden.

U kunt de data op twee manieren aanleveren:
1. Reageer op deze e-mail met de gegevens als platte tekst.
2. Upload de gegevens via ons portaal: {link}

{deadline_zin}

Alvast hartelijk dank voor uw medewerking.

Met vriendelijke groet,
Het Compliance-team"""


def genereer_tekst(
    leverancier: models.Leverancier,
    per_wet: dict,
    deadline: Optional[date],
    taal: str,
    link: str,
    aantal_velden: int,
    aantal_producten: int,
):
    """Geef (tekst, ai_gebruikt, ai_fout) terug."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return (
            _fallback_tekst(leverancier, per_wet, deadline, taal, link),
            False,
            "ANTHROPIC_API_KEY niet ingesteld — sjabloontekst gebruikt.",
        )
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        prompt = _bouw_prompt(
            leverancier, per_wet, deadline, taal, link, aantal_velden, aantal_producten
        )
        resp = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        tekst = "".join(b.text for b in resp.content if b.type == "text").strip()
        if not tekst:
            raise ValueError("Leeg antwoord van de API")
        return tekst, True, None
    except Exception as e:  # noqa: BLE001 — terugvallen op sjabloon bij elke fout
        return (
            _fallback_tekst(leverancier, per_wet, deadline, taal, link),
            False,
            f"AI-generatie mislukt ({type(e).__name__}): {e}",
        )
