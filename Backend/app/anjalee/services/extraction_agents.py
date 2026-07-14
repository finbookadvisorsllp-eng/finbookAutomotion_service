"""
extraction_agents.py
====================
Specialized AI extraction agents implementing:
  Stage 1 — ClassificationAgent  : Document type detection
  Stage 5 — LineItemAgent        : Inventory line items extraction
  Stage 6 — TaxAgent             : GST breakup values and rates
  Stage 7 — TotalsAgent          : Grand total, subtotal, round-off, payment details

All agents run in parallel and compile a standardized Document AI JSON payload
that is then mapped to the frontend's compatible dynamic_schema format.
"""

import json
import re
import logging
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI
from app.config import settings

logger = logging.getLogger("extraction_agents")

# Thread pool for specialized agents
_agent_executor = ThreadPoolExecutor(max_workers=6, thread_name_prefix="agent_")


# ─── Base Agent ───────────────────────────────────────────────────────────────

class BaseAgent:
    """
    Base class for all extraction agents.
    Provides OpenAI client connectivity and JSON utilities.
    """

    def __init__(self):
        self.client = OpenAI(
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
        )
        self.model = settings.LLM_MODEL

    def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
            max_tokens=2048,
        )
        return completion.choices[0].message.content

    def _parse_json(self, raw: str) -> dict:
        try:
            raw = raw.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            match = re.search(r"(\{.*\})", raw, re.DOTALL)
            if match:
                return json.loads(match.group(1))
        except Exception as e:
            logger.warning(f"JSON parse failed in agent: {e}")
        return {}


# ─── Agent 1: Classification ──────────────────────────────────────────────────

class ClassificationAgent(BaseAgent):
    """Stage 1: Document Classification."""

    SYSTEM = """You are an Enterprise Accounting Document Classification Agent.

Your task is ONLY to classify the uploaded accounting document.
Do NOT extract line items.
Do NOT calculate taxes.
Do NOT generate vouchers.

---------------------------------------------------------
STEP 1 : IDENTIFY DOCUMENT TYPE
---------------------------------------------------------
Identify the document type.
Possible values:
- Tax Invoice
- Invoice
- Retail Invoice
- GST Invoice
- Purchase Invoice
- Sales Invoice
- Credit Note
- Debit Note
- Delivery Challan
- Proforma Invoice
- Quotation
- Purchase Order
- Sales Order
- Receipt
- Payment Advice
- Expense Bill
- Cash Memo
- Transport Bill
- E-Way Bill
- Unknown

---------------------------------------------------------
STEP 2 : IDENTIFY ALL PARTY ROLES
---------------------------------------------------------
Extract every party if available.
Possible roles:
Seller, Supplier, Vendor, Manufacturer, Exporter, Importer, Bill From, Sold By, Buyer, Customer, Purchaser, Bill To, Ship To, Consignee, Dispatch From, Dispatch To, Receiver, Recipient, Pay To, Payee, Payer, Transporter, Warehouse, Branch, Company, Invoice Issuer, Authorised Signatory Company.
Store every detected party separately.
Never overwrite one role with another.

---------------------------------------------------------
STEP 3 : IDENTIFY INVOICE ISSUER
---------------------------------------------------------
Identify who actually issued the invoice.
Priority:
1. Company before Authorised Signatory
2. Company before "For <Company Name>"
3. Seller
4. Supplier
5. Bill From
6. Vendor
If multiple companies are found, calculate confidence.

---------------------------------------------------------
STEP 4 : DETERMINE BUSINESS DIRECTION
---------------------------------------------------------
Outgoing Transaction (Possible indicators: Seller, Sold By, Bill From, Company, Invoice Issuer, Exporter)
Incoming Transaction (Possible indicators: Supplier, Vendor, Purchase From, Bill To, Receiver, Recipient, Buyer)
Do NOT rely on only one keyword.
Note: If the Invoice Issuer or Seller matches the user's company (given in the prompt), it is Outgoing (Sales Invoice). If the Buyer/Customer/Bill To matches the user's company, it is Incoming (Purchase Invoice).

---------------------------------------------------------
STEP 5 : CLASSIFICATION RULES
---------------------------------------------------------
If Invoice Issuer matches Seller or Sold By -> Sales Invoice
If Invoice Issuer matches Supplier, Vendor, Bill From -> Purchase Invoice
If Document contains Credit Note -> Credit Note
If Document contains Debit Note -> Debit Note
If Document contains Delivery Challan -> Delivery Challan
If Document contains Quotation -> Quotation
If Document contains Purchase Order -> Purchase Order
If Document contains Sales Order -> Sales Order
If Document contains Receipt -> Receipt Voucher
If Document contains Payment Advice -> Payment Voucher

---------------------------------------------------------
STEP 6 : LOW CONFIDENCE
---------------------------------------------------------
If the voucher type cannot be identified with confidence above 90%, Never guess.
Return: Needs User Confirmation
Provide possible options: Sales Invoice, Purchase Invoice, Credit Note, Debit Note, Receipt, Payment, Expense, Journal, Other

---------------------------------------------------------
STEP 7 : CONFIDENCE
---------------------------------------------------------
Calculate confidence using multiple signals. Document Title, Seller, Supplier, Bill From, Buyer, Bill To, Ship To, Consignee, Footer, Authorised Signatory, GST Details, Company Information, Party Roles, Layout.
Never classify using only Tax Invoice, Invoice, Bill To, Bill From.

---------------------------------------------------------
OUTPUT FORMAT
---------------------------------------------------------
Return ONLY a valid JSON object matching this schema (do NOT return anything else, no markdown code blocks, no explanation):
{
    "documentType": "<Tax Invoice|Invoice|Retail Invoice|GST Invoice|Credit Note|Debit Note|Delivery Challan|Proforma Invoice|Quotation|Purchase Order|Sales Order|Receipt|Payment Advice|Expense Bill|Cash Memo|Transport Bill|E-Way Bill|Unknown>",
    "voucherType": "<Sales Invoice|Purchase Invoice|Credit Note|Debit Note|Delivery Challan|Quotation|Purchase Order|Sales Order|Receipt Voucher|Payment Voucher|Needs User Confirmation>",
    "confidence": <integer 0-100>,
    "issuer": "<Company name of issuer>",
    "partyRoles": {
        "seller": "<value or null>",
        "supplier": "<value or null>",
        "vendor": "<value or null>",
        "buyer": "<value or null>",
        "customer": "<value or null>",
        "billFrom": "<value or null>",
        "billTo": "<value or null>",
        "shipTo": "<value or null>",
        "consignee": "<value or null>",
        "receiver": "<value or null>",
        "recipient": "<value or null>",
        "dispatchFrom": "<value or null>",
        "dispatchTo": "<value or null>",
        "payer": "<value or null>",
        "payee": "<value or null>"
    },
    "reason": [
        "<reasons list>"
    ],
    "requiresUserConfirmation": <true|false>
}
"""

    def run(self, ocr_text: str, filename: str, our_company_name: str, our_company_gstin: str) -> dict:
        clean_name = re.sub(r"\s+FY\s+\d{4}-\d{2}", "", our_company_name, flags=re.IGNORECASE).strip()
        prompt = f"""Filename: {filename}
Our Company Name: {our_company_name} (may appear as "{clean_name}")
Our Company GSTIN: {our_company_gstin}

OCR Text:
{ocr_text[:4000]}"""
        try:
            raw = self._call_llm(self.SYSTEM, prompt)
            return self._parse_json(raw)
        except Exception as e:
            logger.error(f"ClassificationAgent error: {e}")
            return {
                "documentType": "Unknown",
                "voucherType": "Needs User Confirmation",
                "confidence": 0,
                "issuer": "",
                "partyRoles": {},
                "reason": [str(e)],
                "requiresUserConfirmation": True
            }


# ─── Agent 2: Header Agent ────────────────────────────────────────────────────

class HeaderAgent(BaseAgent):
    """Extracts Invoice Header details (number, date, place of supply, state)."""

    SYSTEM = """You are an expert at extracting invoice header details from OCR text.
Return ONLY this JSON structure:
{
  "invoice_number": {"value": "...", "confidence": <0-100>},
  "invoice_date": {"value": "YYYY-MM-DD", "confidence": <0-100>},
  "state": {"value": "...", "confidence": <0-100>},
  "reference_number": {"value": "...", "confidence": <0-100>},
  "place_of_supply": {"value": "...", "confidence": <0-100>},
  "payment_terms": {"value": "...", "confidence": <0-100>}
}
Rules:
- invoice_number must be the actual invoice reference number (e.g. "28" or "FG-06/2025-26"). It is NEVER a label (like "Invoice No.", "Dated", "Supplier Invoice No. & Date") and NEVER a company name (like "Friends Grafix").
- invoice_date must be in YYYY-MM-DD format.
Output ONLY the JSON."""

    def run(self, ocr_text: str, our_company_name: str = "", our_company_gstin: str = "") -> dict:
        prompt = f"""Our Company Name: {our_company_name}
Our Company GSTIN: {our_company_gstin}

OCR Header Block:
{ocr_text[:4000]}"""
        try:
            raw = self._call_llm(self.SYSTEM, prompt)
            return self._parse_json(raw)
        except Exception as e:
            logger.error(f"HeaderAgent error: {e}")
            return {}


# ─── Agent 3: Party Agent ─────────────────────────────────────────────────────

class PartyAgent(BaseAgent):
    """Extracts Supplier and Customer/Buyer details."""

    SYSTEM = """You are an expert at extracting supplier and customer information from Indian accounting OCR texts.
Use the provided "Our Company Name" and "Our Company GSTIN" to correctly identify which party is the Supplier (who sells/bills) and which is the Customer (who buys/is billed).
- If this is a Purchase Invoice: Customer is our company (Matches Our Company Name), Supplier is the other company.
- If this is a Sales Invoice: Supplier is our company (Matches Our Company Name), Customer is the other company.

Return ONLY this JSON structure:
{
  "supplier_name": {"value": "...", "confidence": <0-100>},
  "supplier_gstin": {"value": "...", "confidence": <0-100>},
  "supplier_address": {"value": "...", "confidence": <0-100>},
  "supplier_state": {"value": "...", "confidence": <0-100>},
  "customer_name": {"value": "...", "confidence": <0-100>},
  "customer_gstin": {"value": "...", "confidence": <0-100>},
  "customer_address": {"value": "...", "confidence": <0-100>},
  "customer_state": {"value": "...", "confidence": <0-100>}
}
Output ONLY the JSON."""

    def run(self, ocr_text: str, our_company_name: str = "", our_company_gstin: str = "") -> dict:
        prompt = f"""Our Company Name: {our_company_name}
Our Company GSTIN: {our_company_gstin}

OCR Party details block:
{ocr_text[:5000]}"""
        try:
            raw = self._call_llm(self.SYSTEM, prompt)
            return self._parse_json(raw)
        except Exception as e:
            logger.error(f"PartyAgent error: {e}")
            return {}


# ─── Agent 5: Line Item Agent ─────────────────────────────────────────────────

class LineItemAgent(BaseAgent):
    """Stage 5: Line Item Detection."""

    SYSTEM = """You are a production-grade Indian invoice line item parser.
You are given a structured table layout from a geometry table detector, along with the raw OCR text.
Clean and extract line items into the structured output.

CRITICAL RULES:
1. Strip commas from numbers: '18,315.00' = 18315.00.
2. NEVER modify or recalculate the rate or amount to force them to match. Extract the exact printed values as is.
3. Exclude tax breakup rows, subtotal rows, round off rows, and footers.
4. If a field is not present, set to null with confidence 0.

Return ONLY this JSON structure:
{
  "line_items": [
    {
      "item_name": {"value": "...", "confidence": <0-100>},
      "hsn_code": {"value": "...", "confidence": <0-100>},
      "qty": {"value": <number or null>, "confidence": <0-100>},
      "unit": {"value": "...", "confidence": <0-100>},
      "rate": {"value": <number or null>, "confidence": <0-100>},
      "discount_percent": {"value": <number or null>, "confidence": <0-100>},
      "amount": {"value": <number>, "confidence": <0-100>},
      "gst_rate": {"value": <number or null>, "confidence": <0-100>}
    }
  ]
}
Output ONLY the JSON."""

    def run(self, ocr_text: str, layout_table: list = None) -> dict:
        prompt = f"Raw OCR Text:\n{ocr_text[:6000]}"
        if layout_table:
            prompt += "\n\nStructured Table Rows from layout analysis:\n"
            prompt += json.dumps(layout_table, indent=2)
            
        try:
            raw = self._call_llm(self.SYSTEM, prompt)
            return self._parse_json(raw)
        except Exception as e:
            logger.error(f"LineItemAgent error: {e}")
            return {"line_items": []}


# ─── Agent 6: Tax Agent ───────────────────────────────────────────────────────

class TaxAgent(BaseAgent):
    """Stage 6: Tax Detection."""

    SYSTEM = """You are an expert at extracting CGST, SGST, IGST, and CESS tax breakups from Indian accounting OCR texts.
Return ONLY this JSON structure:
{
  "taxes": [
    {
      "tax_ledger": "<CGST|SGST|IGST|CESS>",
      "taxable_value": {"value": <number>, "confidence": <0-100>},
      "rate": {"value": <number>, "confidence": <0-100>},
      "amount": {"value": <number>, "confidence": <0-100>}
    }
  ]
}
Rules:
- Extract values separately. Do not mix them with inventory items.
Output ONLY the JSON."""

    def run(self, ocr_text: str) -> dict:
        try:
            raw = self._call_llm(self.SYSTEM, f"OCR Tax Summary Block:\n{ocr_text[:4000]}")
            return self._parse_json(raw)
        except Exception as e:
            logger.error(f"TaxAgent error: {e}")
            return {"taxes": []}


# ─── Agent 7: Totals Agent ────────────────────────────────────────────────────

class TotalsAgent(BaseAgent):
    """Stage 7: Totals & Footer/Payment Detection."""

    SYSTEM = """You are an expert at extracting totals, round-off, amount in words, and payment details from OCR text.
Return ONLY this JSON structure:
{
  "totals": {
    "subtotal": {"value": <number>, "confidence": <0-100>},
    "taxable_value": {"value": <number>, "confidence": <0-100>},
    "round_off": {"value": <number>, "confidence": <0-100>},
    "invoice_total": {"value": <number>, "confidence": <0-100>},
    "amount_in_words": {"value": "...", "confidence": <0-100>}
  },
  "payment_details": {
    "bank_name": {"value": "...", "confidence": <0-100>},
    "bank_account_number": {"value": "...", "confidence": <0-100>},
    "bank_ifsc": {"value": "...", "confidence": <0-100>}
  },
  "footer": {
    "declaration": {"value": "...", "confidence": <0-100>},
    "terms_and_conditions": {"value": "...", "confidence": <0-100>},
    "signature_block": {"value": "...", "confidence": <0-100>}
  }
}
Rules:
- subtotal and taxable_value must be the total value of items before tax (e.g. 3860.00). It is NOT a CGST/SGST tax amount (like 347.40).
- invoice_total must be the grand total of the invoice (e.g. 4555.00). It is NOT a row count or total quantity (like "2.00 PCS" or "2.0").
Output ONLY the JSON."""

    def run(self, ocr_text: str) -> dict:
        try:
            raw = self._call_llm(self.SYSTEM, f"OCR Summary & Footer Block:\n{ocr_text[:5000]}")
            return self._parse_json(raw)
        except Exception as e:
            logger.error(f"TotalsAgent error: {e}")
            return {}


# ─── Orchestrator: Runs stages and formats output JSON ────────────────────────

class AgentOrchestrator:
    """
    Coordinates Agent Classifications, header, party, line items, taxes, totals,
    and returns a standardized Document AI JSON payload.
    Maps this payload to the frontend review screen structure via an adapter.
    """

    def __init__(self):
        self.classifier = ClassificationAgent()
        self.header     = HeaderAgent()
        self.party      = PartyAgent()
        self.line_items = LineItemAgent()
        self.tax        = TaxAgent()
        self.totals     = TotalsAgent()

    def _run_parallel(self, tasks: list) -> list:
        futures = []
        for fn, args in tasks:
            futures.append(_agent_executor.submit(fn, *args))
        return [f.result() for f in futures]

    def extract(
        self,
        ocr_text: str,
        filename: str = "",
        our_company_name: str = "",
        our_company_gstin: str = "",
        layout_result: dict = None,
    ) -> dict:
        """
        Main extraction coordinator.
        Executes Specialized Agents on corresponding layouts sections.
        """
        logger.info(f"AgentOrchestrator.extract: filename={filename}")

        # Partition sections from layout result
        layout_table = []
        header_text = ocr_text
        party_text = ocr_text
        tax_text = ocr_text
        totals_text = ocr_text

        if layout_result and layout_result.get("pages"):
            layout_table = []
            header_blocks = []
            party_blocks = []
            summary_blocks = []
            footer_blocks = []
            for p in layout_result.get("pages", []):
                # Table rows
                t_sec = p.get("table_section", {})
                layout_table.extend(t_sec.get("rows", []))
                
                # Sections
                header_blocks.append(p.get("header_section", ""))
                party_blocks.append(p.get("party_section", ""))
                summary_blocks.append(p.get("summary_section", ""))
                footer_blocks.append(p.get("footer_section", ""))

            # Combine header and party blocks to ensure no critical lines are lost due to heuristic splits
            header_list = [b.strip() for b in header_blocks if b.strip()]
            party_list = [b.strip() for b in party_blocks if b.strip()]
            pre_table_text = "\n".join(header_list + party_list)

            header_text = pre_table_text if pre_table_text.strip() else ocr_text
            party_text  = pre_table_text if pre_table_text.strip() else ocr_text
            tax_text    = "\n".join(summary_blocks) or ocr_text
            totals_text = "\n".join(summary_blocks) + "\n" + "\n".join(footer_blocks)

        # Run specialized agents in parallel (using full OCR text to preserve context)
        tasks = [
            (self.classifier.run, (ocr_text, filename, our_company_name, our_company_gstin)),
            (self.header.run,     (ocr_text, our_company_name, our_company_gstin)),
            (self.party.run,      (ocr_text, our_company_name, our_company_gstin)),
            (self.line_items.run, (ocr_text, layout_table)),
            (self.tax.run,        (ocr_text,)),
            (self.totals.run,     (ocr_text,)),
        ]

        results = self._run_parallel(tasks)
        cls_res, hdr_res, party_res, items_res, tax_res, totals_res = results

        # ── Standardized Document AI JSON Format ───────────────────────────────
        doc_type = cls_res.get("voucherType") or cls_res.get("documentType") or cls_res.get("document_type") or "Unknown Document"
        # Standardize document direction classification
        is_sales = "purchase" not in doc_type.lower() and "debit" not in doc_type.lower() and "payment" not in doc_type.lower()
        party_id = "customer" if is_sales else "supplier"

        # Helpers
        def gv(d: dict, key: str, default=None):
            f = d.get(key, {})
            return f.get("value", default) if isinstance(f, dict) else (f if f is not None else default)

        def gc(d: dict, key: str) -> int:
            f = d.get(key, {})
            return int(f.get("confidence", 0)) if isinstance(f, dict) else 0

        def num(val, default=0.0) -> float:
            if val is None:
                return default
            try:
                cleaned = str(val).replace(",", "").strip()
                match = re.search(r"[-+]?[0-9]*\.?[0-9]+", cleaned)
                if match:
                    return float(match.group(0))
                return default
            except Exception:
                return default

        # Process Line Items (Clean duplicate description rows and back-calculate GST rate)
        line_items_list = []
        raw_items = items_res.get("line_items", [])
        tax_entries = tax_res.get("taxes", [])

        # 1. Map HSN code to tax rate
        hsn_rates = {}
        for tax in tax_entries:
            hsn_val = str(gv(tax, "hsn_code") or gv(tax, "hsn_sac") or gv(tax, "hsn") or "").strip()
            tx_rate = num(gv(tax, "rate"))
            ledger = str(tax.get("tax_ledger", "")).upper()
            if hsn_val and tx_rate > 0:
                if "CGST" in ledger or "SGST" in ledger:
                    hsn_rates[hsn_val] = hsn_rates.get(hsn_val, 0.0) + tx_rate
                else:
                    hsn_rates[hsn_val] = tx_rate

        # 2. Map taxable value to tax rate
        cgst_rates = {}
        sgst_rates = {}
        igst_rates = {}
        for tax in tax_entries:
            tx_val = round(num(gv(tax, "taxable_value")), 1)
            tx_rate = num(gv(tax, "rate"))
            ledger = str(tax.get("tax_ledger", "")).upper()
            if tx_val > 0 and tx_rate > 0:
                if "CGST" in ledger:
                    cgst_rates[tx_val] = tx_rate
                elif "SGST" in ledger:
                    sgst_rates[tx_val] = tx_rate
                elif "IGST" in ledger:
                    igst_rates[tx_val] = tx_rate

        tax_groups = {}
        all_tax_vals = set(list(cgst_rates.keys()) + list(sgst_rates.keys()) + list(igst_rates.keys()))
        for v in all_tax_vals:
            cg = cgst_rates.get(v, 0.0)
            sg = sgst_rates.get(v, 0.0)
            ig = igst_rates.get(v, 0.0)
            if ig > 0:
                tax_groups[v] = ig
            elif cg > 0 or sg > 0:
                tax_groups[v] = cg + sg

        # 3. Determine if transaction has IGST
        has_igst = any("IGST" in str(t.get("tax_ledger", "")).upper() for t in tax_entries)

        # 4. Global fallback rate
        total_items_amount = sum(num(gv(itm, "amount")) for itm in raw_items if num(gv(itm, "qty")) > 0 or num(gv(itm, "amount")) > 0)
        cgst_tot_val = sum(num(t.get("amount", {}).get("value", 0)) for t in tax_entries if "CGST" in str(t.get("tax_ledger")).upper())
        sgst_tot_val = sum(num(t.get("amount", {}).get("value", 0)) for t in tax_entries if "SGST" in str(t.get("tax_ledger")).upper())
        igst_tot_val = sum(num(t.get("amount", {}).get("value", 0)) for t in tax_entries if "IGST" in str(t.get("tax_ledger")).upper())
        total_tax_val = cgst_tot_val + sgst_tot_val + igst_tot_val
        global_inferred_rate = 0.0
        if total_items_amount > 0 and total_tax_val > 0:
            raw_rate = (total_tax_val / total_items_amount) * 100
            standard_rates = [0, 5, 12, 18, 28]
            global_inferred_rate = min(standard_rates, key=lambda r: abs(r - raw_rate))

        for item in raw_items:
            qty    = num(gv(item, "qty"))
            rate   = num(gv(item, "rate"))
            disc   = num(gv(item, "discount_percent"))
            amount = num(gv(item, "amount"))

            # Skip rows with no valid item name (filters out subtotal rows, totals, and tax/round-off lines)
            name_val = str(gv(item, "item_name") or "").strip()
            name_lower = name_val.lower()
            if (
                not name_val or 
                name_lower in ["total", "subtotal", "none", "null", "round off", "rounded off", "roundoff", "cgst", "sgst", "igst", "si", "ci"] or
                "cgst" in name_lower or
                "sgst" in name_lower or
                "igst" in name_lower or
                "round off" in name_lower or
                "rounded off" in name_lower or
                "tax details" in name_lower or
                "amount chargeable" in name_lower
            ):
                continue

            # Skip empty rows with no quantity and no amount
            if qty == 0.0 and amount == 0.0:
                continue

            # Infer GST rate if empty
            gst_rate_val = num(gv(item, "gst_rate"))
            hsn_val = str(gv(item, "hsn_code") or "").strip()
            
            if gst_rate_val == 0.0 or gst_rate_val is None:
                if hsn_val and hsn_val in hsn_rates:
                    gst_rate_val = hsn_rates[hsn_val]
                else:
                    rounded_amt = round(amount, 1)
                    if rounded_amt in tax_groups:
                        gst_rate_val = tax_groups[rounded_amt]
                    else:
                        closest_diff = 5.0
                        matched_rate = 0.0
                        for tx_val, tx_rate in tax_groups.items():
                            if abs(tx_val - amount) < closest_diff:
                                closest_diff = abs(tx_val - amount)
                                matched_rate = tx_rate
                        if matched_rate > 0:
                            gst_rate_val = matched_rate
                        elif global_inferred_rate > 0:
                            gst_rate_val = global_inferred_rate

            # Compute tax breakdown based on IGST flag
            if has_igst:
                cgst_amt = 0.0
                sgst_amt = 0.0
                igst_amt = round(amount * gst_rate_val / 100, 2)
            else:
                cgst_amt = round(amount * gst_rate_val / 200, 2)
                sgst_amt = round(amount * gst_rate_val / 200, 2)
                igst_amt = 0.0

            expected = round(qty * rate * (1 - disc / 100), 2)
            math_valid = abs(expected - amount) <= 1.5 if (qty > 0 and amount > 0) else True

            row_conf = [gc(item, "item_name"), gc(item, "qty"), gc(item, "rate"), gc(item, "amount")]
            row_avg  = int(sum(row_conf) / len(row_conf))

            line_items_list.append({
                "item_name":        gv(item, "item_name"),
                "hsn_code":         gv(item, "hsn_code") or hsn_val or None,
                "qty":              qty,
                "unit":             gv(item, "unit"),
                "rate":             rate,
                "discount_percent": disc,
                "amount":           amount,
                "gst_rate":         gst_rate_val,
                "cgst_amount":      cgst_amt,
                "sgst_amount":      sgst_amt,
                "igst_amount":      igst_amt,
                "uncertain":        not math_valid or row_avg < 60 or not gv(item, "item_name"),
                "confidence":       row_avg,
                "_confidence": {
                    "item_name": gc(item, "item_name"),
                    "qty":       gc(item, "qty"),
                    "rate":      gc(item, "rate"),
                    "amount":    gc(item, "amount"),
                }
            })

        # Calculate safe math totals
        items_sum = sum(item["amount"] for item in line_items_list)
        
        # Taxes sum from items
        cgst_sum_items = sum(item["cgst_amount"] for item in line_items_list)
        sgst_sum_items = sum(item["sgst_amount"] for item in line_items_list)
        igst_sum_items = sum(item["igst_amount"] for item in line_items_list)
        tax_sum_items = cgst_sum_items + sgst_sum_items + igst_sum_items
        
        extracted_subtotal = num(gv(totals_res.get("totals", {}), "subtotal"))
        extracted_taxable  = num(gv(totals_res.get("totals", {}), "taxable_value"))
        extracted_round_off = num(gv(totals_res.get("totals", {}), "round_off"))
        extracted_total    = num(gv(totals_res.get("totals", {}), "invoice_total"))
        
        # Apply validation/fallback limits to avoid LLM scaling/mapping errors
        subtotal_val = extracted_subtotal if (extracted_subtotal > 0 and abs(extracted_subtotal - items_sum) < 5.0) else items_sum
        taxable_val  = extracted_taxable if (extracted_taxable > 0 and abs(extracted_taxable - items_sum) < 5.0) else items_sum
        round_off_val = extracted_round_off if abs(extracted_round_off) < 5.0 else 0.0
        
        # Try to infer round_off if total is given
        if round_off_val == 0.0 and extracted_total > 0 and abs(extracted_total - (taxable_val + tax_sum_items)) < 5.0:
            round_off_val = round(extracted_total - (taxable_val + tax_sum_items), 2)
            
        expected_total_val = round(taxable_val + tax_sum_items + round_off_val, 2)
        invoice_total_val  = extracted_total if (extracted_total > 0 and abs(extracted_total - expected_total_val) < 5.0) else expected_total_val

        # Structured Payload
        standardized_payload = {
            "Document": {
                "document_type": doc_type,
                "confidence": cls_res.get("confidence", 0),
                "reasoning": " | ".join(cls_res.get("reason", [])) if isinstance(cls_res.get("reason"), list) else cls_res.get("reasoning", "")
            },
            "Header": {
                "invoice_number":   gv(hdr_res, "invoice_number"),
                "invoice_date":     gv(hdr_res, "invoice_date"),
                "reference_number": gv(hdr_res, "reference_number"),
                "place_of_supply":   gv(hdr_res, "place_of_supply"),
                "payment_terms":    gv(hdr_res, "payment_terms"),
                "state":            gv(hdr_res, "state") or gv(party_res, f"{party_id}_state")
            },
            "Party": {
                "supplier_name":    gv(party_res, "supplier_name"),
                "supplier_gstin":   gv(party_res, "supplier_gstin"),
                "supplier_address": gv(party_res, "supplier_address"),
                "customer_name":    gv(party_res, "customer_name"),
                "customer_gstin":   gv(party_res, "customer_gstin"),
                "customer_address": gv(party_res, "customer_address")
            },
            "Items": line_items_list,
            "Taxes": tax_res.get("taxes", []),
            "Charges": [],
            "Totals": {
                "subtotal":        subtotal_val,
                "taxable_value":   taxable_val,
                "round_off":       round_off_val,
                "invoice_total":   invoice_total_val,
                "amount_in_words": gv(totals_res.get("totals", {}), "amount_in_words")
            },
            "Footer": {
                "bank_name":           gv(totals_res.get("payment_details", {}), "bank_name"),
                "bank_account_number": gv(totals_res.get("payment_details", {}), "bank_account_number"),
                "bank_ifsc":           gv(totals_res.get("payment_details", {}), "bank_ifsc"),
                "declaration":         gv(totals_res.get("footer", {}), "declaration"),
                "terms_and_conditions":gv(totals_res.get("footer", {}), "terms_and_conditions"),
                "signature_block":      gv(totals_res.get("footer", {}), "signature_block")
            },
            "Metadata": {
                "filename": filename,
                "extracted_at": ""
            },
            "Unknown Fields": []
        }

        # ── Adapter Mapping Layer (For existing UI compatibility) ─────────────
        party_name  = gv(party_res, "customer_name" if is_sales else "supplier_name")
        party_gstin = gv(party_res, "customer_gstin" if is_sales else "supplier_gstin")
        party_label = "Customer" if is_sales else "Supplier"

        voucher_fields = [
            {"id": "invoice_number",   "key": "invoice_number",    "label": "Invoice Number",
             "type": "text",  "value": standardized_payload["Header"]["invoice_number"],
             "confidence": gc(hdr_res, "invoice_number"),  "required": True,  "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "Invoice Number"},
            {"id": "invoice_date",     "key": "invoice_date",      "label": "Invoice Date",
             "type": "date",  "value": standardized_payload["Header"]["invoice_date"],
             "confidence": gc(hdr_res, "invoice_date"),    "required": True,  "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "Invoice Date"},
            {"id": f"{party_id}_name", "key": f"{party_id}_name",  "label": f"{party_label} Name",
             "type": "text",  "value": party_name,
             "confidence": gc(party_res, f"{party_id}_name"), "required": True, "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": f"{party_label} Name"},
            {"id": f"{party_id}_gstin","key": f"{party_id}_gstin", "label": f"{party_label} GSTIN",
             "type": "text",  "value": party_gstin,
             "confidence": gc(party_res, f"{party_id}_gstin"), "required": True, "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": f"{party_label} GSTIN"},
            {"id": "state",            "key": "state",              "label": "State",
             "type": "text",  "value": standardized_payload["Header"]["state"],
             "confidence": gc(hdr_res, "state"),           "required": False, "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "State"},
        ]

        line_items_field = {
            "id": "line_items", "label": "Line Items", "type": "table",
            "value": None, "confidence": 90, "required": True,
            "editable": True, "visible": True, "page": 1, "bbox": None,
            "placeholder": "Line Items",
            "columns": [
                {"id": "item_name",     "label": "Item Name"},
                {"id": "hsn_code",      "label": "HSN/SAC"},
                {"id": "qty",           "label": "Quantity"},
                {"id": "unit",          "label": "Unit"},
                {"id": "rate",          "label": "Rate"},
                {"id": "discount_percent", "label": "Disc %"},
                {"id": "amount",        "label": "Amount"},
                {"id": "gst_rate",      "label": "GST %"},
                {"id": "cgst_amount",   "label": "CGST Amt"},
                {"id": "sgst_amount",   "label": "SGST Amt"},
                {"id": "igst_amount",   "label": "IGST Amt"},
            ],
            "rows": line_items_list,
        }

        # Tax Totals
        cgst_total = sum(num(t.get("amount", {}).get("value", 0)) for t in standardized_payload["Taxes"] if "CGST" in str(t.get("tax_ledger")).upper())
        sgst_total = sum(num(t.get("amount", {}).get("value", 0)) for t in standardized_payload["Taxes"] if "SGST" in str(t.get("tax_ledger")).upper())
        igst_total = sum(num(t.get("amount", {}).get("value", 0)) for t in standardized_payload["Taxes"] if "IGST" in str(t.get("tax_ledger")).upper())

        cgst_sum_items = sum(r["cgst_amount"] for r in line_items_list)
        sgst_sum_items = sum(r["sgst_amount"] for r in line_items_list)
        igst_sum_items = sum(r["igst_amount"] for r in line_items_list)

        # Fallback to items tax total if empty or scaled/mismatched by a lot
        if cgst_total == 0 or abs(cgst_total - cgst_sum_items) > 5.0:
            cgst_total = cgst_sum_items
        if sgst_total == 0 or abs(sgst_total - sgst_sum_items) > 5.0:
            sgst_total = sgst_sum_items
        if igst_total == 0 or abs(igst_total - igst_sum_items) > 5.0:
            igst_total = igst_sum_items

        calc_fields = [
            {"id": "taxable_value", "key": "taxable_value", "label": "Taxable Value",  "type": "number", "value": standardized_payload["Totals"]["taxable_value"] or sum(r["amount"] for r in line_items_list),  "confidence": gc(totals_res, "taxable_value"), "required": True,  "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "Taxable Value"},
            {"id": "cgst_total",    "key": "cgst_total",    "label": "CGST Total",     "type": "number", "value": cgst_total,   "confidence": gc(tax_res, "cgst_amount"),      "required": True,  "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "CGST Total"},
            {"id": "sgst_total",    "key": "sgst_total",    "label": "SGST Total",     "type": "number", "value": sgst_total,   "confidence": gc(tax_res, "sgst_amount"),      "required": True,  "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "SGST Total"},
            {"id": "igst_total",    "key": "igst_total",    "label": "IGST Total",     "type": "number", "value": igst_total,   "confidence": gc(tax_res, "igst_amount"),      "required": True,  "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "IGST Total"},
            {"id": "round_off",     "key": "round_off",     "label": "Round Off",      "type": "number", "value": standardized_payload["Totals"]["round_off"],    "confidence": gc(totals_res, "round_off"),     "required": False, "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "Round Off"},
            {"id": "total_amount",  "key": "total_amount",  "label": "Total Amount",   "type": "number", "value": standardized_payload["Totals"]["invoice_total"], "confidence": gc(totals_res, "total_amount"),  "required": True,  "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "Total Amount"},
        ]

        overall_confidence = int((
            cls_res.get("confidence", 0) +
            gc(hdr_res, "invoice_number") +
            gc(party_res, f"{party_id}_name") +
            (sum(r.get("confidence", 50) for r in line_items_list) // max(len(line_items_list), 1)) +
            gc(totals_res, "total_amount")
        ) / 5)

        schema = {
            "document_type": doc_type,
            "confidence": cls_res.get("confidence", 0),
            "reasoning": cls_res.get("reasoning", ""),
            "sections": [
                {
                    "id": "voucher_details", "title": "Voucher Details",
                    "order": 1, "visible": True,
                    "fields": voucher_fields,
                },
                {
                    "id": "line_items", "title": "Line Items",
                    "order": 2, "visible": True,
                    "fields": [line_items_field],
                },
                {
                    "id": "calculation_summary", "title": "Calculation Summary",
                    "order": 3, "visible": True,
                    "fields": calc_fields,
                },
            ],
            "agent_results": {
                "classification": cls_res,
                "header":         hdr_res,
                "party":          party_res,
                "line_items":     items_res,
                "tax":            tax_res,
                "totals":         totals_res,
            },
            "suggestions": [{"type": "success", "message": "Extracted using specialized agents."}],
            "overall_confidence": overall_confidence,
            "standardized_payload": standardized_payload
        }

        if any(r.get("uncertain") for r in line_items_list):
            schema["suggestions"].append({
                "type": "warning",
                "message": "Some line items have low confidence or math mismatches. Review details."
            })

        logger.info(f"AgentOrchestrator complete: doc_type={doc_type}, items={len(line_items_list)}")
        return schema


# Singleton
agent_orchestrator = AgentOrchestrator()
