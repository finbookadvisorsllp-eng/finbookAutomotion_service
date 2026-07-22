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

TALLY_PROMPT = """
You are an expert Indian accounting assistant for Tally Prime.
You will receive a STRUCTURED DOCUMENT JSON extracted from an invoice/voucher.
Your task is to parse this structured document and return a clean accounting JSON.

Return ONLY valid JSON — no explanation, no markdown fences, no extra text.

## CRITICAL RULES — READ CAREFULLY:

### SECTION ROLES:
- "company_header": This is the ISSUING COMPANY (who printed/sent this document).
  - For a PURCHASE invoice: this is the SUPPLIER (the company we are buying from).
  - For a SALES invoice: this is OUR company (the company selling).
- "party_details": This is the RECEIVING PARTY.
  - For a PURCHASE invoice: this is OUR company (the company receiving the goods).
  - For a SALES invoice: this is the CUSTOMER (who is buying from us).
- "voucher_header": Contains invoice number, date, reference number.
- "line_items_table": Contains the product/service rows ONLY. Each row = one product or service.
- "tax_summary": Contains CGST, SGST, IGST totals and grand total.
- "footer": Contains bank details, terms, declarations.

### ITEM LINE RULES:
- "line_items" must contain ONLY actual products or services (for Sales/Purchase) or consolidated ledger transaction details (for Payment/Receipt).
- NEVER include CGST, SGST, IGST, round-off, subtotal, or total rows in "line_items".
- For Contra vouchers: "line_items" must be an EMPTY LIST [].
- For Payment and Receipt vouchers: Do NOT extract individual "Agst Ref", "New Ref", "Advance", or bill allocation details as separate entries in "line_items". Consolidate/group them by their main party/ledger account. The main ledger row under "line_items" should have the total amount paid/received (e.g., if the document lists "Supreme Food Products 2,50,000.00" followed by 8 Agst Ref lines, extract a single row with item_name="Supreme Food Products" and taxable_amount/total_amount=250000.00 in "line_items").
- Extract ALL detailed bill allocations (the Agst Ref lines) under the "bill_allocations" list. For each allocation, extract "bill_no" (the bill reference/invoice number, e.g., "FG-401/2024-25"), "allocation_amount" (e.g., 42985.24), and "bill_type" (typically "Against Ref" or "New Ref"). Do not skip any allocations.
- To keep the JSON output extremely compact and prevent credit limits issues: For Payment and Receipt vouchers, set "party_address" and "consignee_address" to null, and limit "narration" and "notes" to under 5 words.
- "gst_rate_percent" per item = the TOTAL GST percentage for that item.
  - If CGST 9% + SGST 9% are applied, then gst_rate_percent = 18.
  - If IGST 18% is applied, then gst_rate_percent = 18.
  - Do NOT use half rates. Always use the combined total GST percent.
- "taxable_amount" = the item amount BEFORE tax (quantity × rate after discount).
- "total_amount" = taxable_amount + tax for that item.

### PARTY DETECTION RULES:
- For SALES invoices:
  - "party_name" MUST be the billing customer / buyer entity listed under the "Buyer (Bill to)" or "Buyer's Name" section (e.g. "the Varun Enterprises").
  - "party_gstin" MUST be the GSTIN of that billing buyer entity.
  - "consignee_name" MUST be the shipping recipient entity listed under the "Consignee (Ship to)" or "Consignee" section (e.g. "S & N Shreefal Confectioner Pvt. Ltd") if it is different from the buyer name.
  - "consignee_gstin" MUST be the GSTIN of that consignee entity.
- For PURCHASE invoices:
  - "party_name" MUST be the supplier / seller entity listed under the "Supplier" or "Seller" or "Bill From" section.
  - "party_gstin" MUST be the GSTIN of that supplier entity.
  - "consignee_name" MUST be the shipping recipient (typically our company or branch if printed) if different from the supplier.
- For PAYMENT and RECEIPT vouchers:
  - "party_name" MUST be the payee (for Payment) or payer (for Receipt) entity (e.g., "Supreme Food Products" or "Salary & Wages"). Never use our company name ("Friends Grafix") as the party_name.
  - "bank_cash_ledger" MUST be the cash or bank account ledger printed under "Through", "Account", or "Paid From" (e.g., "AXIS BANK CC"). Never use our company name ("Friends Grafix") as the bank_cash_ledger.
- NEVER swap or mix up the Buyer/Seller and Cash/Bank Account fields. Read the labels "Buyer", "Consignee", "Supplier", "Through", and "Account" carefully on the document to make this distinction.

### VOUCHER TYPE DETECTION:
- "Purchase" → has items + GST + supplier sends the document to us.
- "Sales" → has items + GST + we send the document to customer.
- "Payment" → expense payment, salary, bill payment (where particulars/ledger entries are extracted in line_items).
- "Receipt" → money received from customer (where particulars/ledger entries are extracted in line_items).
- "Contra" → cash/bank transfer only, no items.

Our Company Name: {our_company_name}
Our Company GSTIN: {our_company_gstin}

Required JSON structure:
{{
  "voucher_type": "Purchase|Sales|Payment|Receipt|Contra",
  "bank_cash_ledger": "For Payment/Receipt/Contra: The exact printed cash/bank account ledger name (e.g. 'AXIS BANK CC' or 'Cash'). For Sales/Purchase, return null.",
  "is_item_wise": true,
  "voucher_number": "invoice or voucher number or null",
  "voucher_date": "DD-MM-YYYY or null",
  "due_date": "DD-MM-YYYY or null",
  "party_name": "For Sales: buyer name (Bill To / Buyer's Name section). For Purchase: supplier name (Bill From / Supplier section). Extract EXACT printed name.",
  "party_gstin": "GSTIN of the party_name entity or null",
  "party_address": "full address of the party_name entity or null",
  "consignee_name": "Ship-To / Consignee name ONLY if it is a DIFFERENT entity than party_name. If consignee section says 'same as buyer' or is identical to party_name, return null.",
  "consignee_gstin": "GSTIN of consignee entity if different from party; otherwise null",
  "consignee_address": "full address of consignee if different from party; otherwise null",
  "company_gstin": "GSTIN of our company or null",
  "place_of_supply": "state name or null",
  "currency": "INR",
  "line_items": [
    {{
      "sl_no": 1,
      "item_name": "exact product or service name as printed",
      "hsn_sac": "HSN or SAC code or null",
      "description": "additional description or null",
      "quantity": 0.0,
      "unit": "NOS/KGS/MTR/PCS/etc or null",
      "rate": 0.0,
      "discount_percent": 0.0,
      "discount_amount": 0.0,
      "taxable_amount": 0.0,
      "gst_rate_percent": 0.0,
      "cgst_percent": 0.0,
      "cgst_amount": 0.0,
      "sgst_percent": 0.0,
      "sgst_amount": 0.0,
      "igst_percent": 0.0,
      "igst_amount": 0.0,
      "cess_amount": 0.0,
      "total_amount": 0.0
    }}
  ],
  "summary": {{
    "subtotal": 0.0,
    "total_discount": 0.0,
    "total_taxable_value": 0.0,
    "total_cgst": 0.0,
    "total_sgst": 0.0,
    "total_igst": 0.0,
    "total_cess": 0.0,
    "round_off": 0.0,
    "grand_total": 0.0,
    "amount_in_words": "text or null"
  }},
  "bank_details": {{
    "bank_name": "null or name",
    "account_number": "null or number",
    "ifsc": "null or code"
  }},
  "bill_allocations": [
    {{
      "bill_no": "bill reference or invoice number or null",
      "allocation_amount": 0.0,
      "bill_type": "Against Ref/New Ref/Advance/On Account"
    }}
  ],
  "narration": "brief auto-generated narration for Tally",
  "notes": "any extra info"
}}

Use null for any field not found. All amounts must be numbers (float), not strings.

STRUCTURED DOCUMENT:
\"\"\"
{structured_doc}
\"\"\"
"""


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
        """Robust JSON parser that handles extra text, markdown fences, nested brackets and
        multiple JSON objects that LLMs sometimes emit after the main JSON block."""
        if not raw:
            return {}
        try:
            # Strip markdown code fences
            raw = raw.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```\s*$", "", raw)
            raw = raw.strip()

            # Strategy 1: Try direct parse first (fastest, handles clean responses)
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                pass

            # Strategy 2: Extract first bracket-balanced JSON object
            # Walk character-by-character to find the exact closing } for the first {
            start = raw.find("{")
            if start != -1:
                depth = 0
                in_str = False
                escape = False
                for i, ch in enumerate(raw[start:], start):
                    if escape:
                        escape = False
                        continue
                    if ch == "\\" and in_str:
                        escape = True
                        continue
                    if ch == '"':
                        in_str = not in_str
                        continue
                    if in_str:
                        continue
                    if ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            candidate = raw[start:i + 1]
                            try:
                                return json.loads(candidate)
                            except json.JSONDecodeError:
                                break

            # Strategy 3: Progressive truncation — strip chars from end until valid
            for end in range(len(raw), max(len(raw) - 200, 0), -1):
                try:
                    return json.loads(raw[:end])
                except json.JSONDecodeError:
                    continue

        except Exception as e:
            logger.warning(f"JSON parse failed in agent: {e}")
        return {}


# ─── Agent 1: Classification ──────────────────────────────────────────────────

class ClassificationAgent(BaseAgent):
    """Stage 1: Document Classification."""

    SYSTEM = """# AI Document Classification & Auto Voucher Routing System Prompt

You are an AI Accounting Document Classification Engine for an Accounting ERP similar to Tally Prime.

Your responsibility is to automatically identify the uploaded accounting document and route it to the correct voucher screen. The user should never have to manually select the voucher type if the confidence score is high.

## Step 1: OCR Processing

Receive OCR output from the uploaded PDF, Image, Scan, or Document.

Extract:
* Complete text
* Tables
* Header
* Footer
* Dates
* Voucher Number
* Invoice Number
* Ledger Names
* Party Name
* GSTIN
* PAN
* Amounts
* Debit/Credit Values
* Tax Details
* Bank Details
* Payment Reference
* Narration

Do not classify before OCR extraction is completed.

---

## Step 2: Identify Document Type

Classify the document using multiple layers.

### Layer 1 - Voucher Title Detection
Search for keywords:

Sales Voucher
Sales Invoice
Tax Invoice
Cash Memo
Retail Invoice
Commercial Invoice
Sales Invoice / Sales Voucher

Purchase Voucher
Purchase Invoice
Vendor Invoice
Supplier Invoice
Bill of Supply
Purchase Invoice / Purchase Voucher

Receipt Voucher
Receipt
Amount Received
Received From
Received By
Receipt Voucher

Payment Voucher
Payment
Paid To
Disbursement
Salary Payment
Expense Payment
Payment Voucher

Contra Voucher
Cash Deposit
Cash Withdrawal
Transfer Voucher
Bank Transfer
Contra Voucher

Journal Voucher
Journal
Adjustment Entry
JV
Adjustment Voucher
Journal Voucher

If a voucher title exists, assign the document type immediately.

---

### Layer 2 - Ledger Pattern Detection
If no title is available, classify using ledger names:

Customer Ledger, Debtor Ledger, Party Ledger :  Receipt or Sales
Supplier Ledger, Vendor Ledger, Creditor Ledger :Purchase or Payment
Expense Ledger, Salary, Rent, Electricity, Office Expense, Telephone, Bank Charges, Travelling, Professional Fees :Payment Voucher
Only Cash and Bank Ledgers, Cash, Cash in Hand, Bank, Axis Bank, ICICI, HDFC, SBI, Current Account, Savings Account :Contra Voucher

---

### Layer 3 - Tax Detection
If Item + GST + HSN + Quantity + Rate + Tax : Sales or Purchase
No GST, No Items, Expense Ledger :Payment
Only Bank and Cash :Contra
Customer Receipt :Receipt

---

### Layer 4 - AI Validation
Validate: Ledger Combination, Voucher Structure, Debit Credit, Amount Consistency, GST, Business Logic, Duplicate Voucher, Confidence Score.

---

## Step 3: Confidence Score
* Voucher Title: 60 Points
* Ledger Match: 20 Points
* Amount Pattern: 10 Points
* Tax Pattern: 5 Points
* Date and Voucher Number: 5 Points
Total: 100 Points

* If confidence >= 90% : Automatically select the voucher.
* If confidence is between 70% and 89% :Suggest the voucher type (suggested type).
* If confidence < 70% : Set as Needs User Confirmation.

---

## OUTPUT FORMAT
Return ONLY a valid JSON object matching this schema (do NOT return anything else, no markdown code blocks, no explanation):
{
    "documentType": "<Tax Invoice|Invoice|Retail Invoice|GST Invoice|Credit Note|Debit Note|Delivery Challan|Proforma Invoice|Quotation|Purchase Order|Sales Order|Receipt|Payment Advice|Expense Bill|Cash Memo|Transport Bill|E-Way Bill|Unknown>",
    "voucherType": "<Sales Invoice|Purchase Invoice|Credit Note|Debit Note|Delivery Challan|Quotation|Purchase Order|Sales Order|Receipt Voucher|Payment Voucher|Contra Voucher|Journal Voucher|Needs User Confirmation>",
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

        # ── Build Structured Document JSON from layout sections (sent to AI instead of raw text) ──
        structured_doc_parts = []
        if layout_result and layout_result.get("pages"):
            for p in layout_result.get("pages", []):
                company_sec = p.get("company_section") or p.get("header_section", "")
                buyer_sec   = p.get("buyer_section") or p.get("party_section", "")
                hdr_sec     = p.get("voucher_header_section") or p.get("header_section", "")
                summary_sec = p.get("summary_section", "")
                footer_sec  = p.get("footer_section", "")
                table_rows  = p.get("table_section", {}).get("rows", [])

                structured_doc_parts.append(
                    f"=== COMPANY HEADER (Issuing Company) ===\n{company_sec}\n"
                    f"=== PARTY DETAILS (Counterparty / Buyer) ===\n{buyer_sec}\n"
                    f"=== VOUCHER HEADER (Invoice#, Date, Ref) ===\n{hdr_sec}\n"
                    f"=== LINE ITEMS TABLE ===\n{json.dumps(table_rows, indent=2) if table_rows else 'See full text'}\n"
                    f"=== TAX SUMMARY & TOTALS ===\n{summary_sec}\n"
                    f"=== FOOTER (Bank, Terms) ===\n{footer_sec}\n"
                )

        # Check if the layout analysis actually extracted meaningful sections
        total_layout_chars = 0
        if layout_result and layout_result.get("pages"):
            for p in layout_result.get("pages", []):
                total_layout_chars += len(p.get("company_section", "") or p.get("header_section", ""))
                total_layout_chars += len(p.get("buyer_section", "") or p.get("party_section", ""))
                total_layout_chars += len(p.get("voucher_header_section", "") or p.get("header_section", ""))
                total_layout_chars += len(p.get("summary_section", ""))
                total_layout_chars += len(p.get("footer_section", ""))
                total_layout_chars += len(str(p.get("table_section", {}).get("rows", [])))

        if structured_doc_parts and total_layout_chars > 100:
            structured_doc_text = "\n".join(structured_doc_parts)[:14000]
        else:
            # Fallback: label sections heuristically from raw text
            lines = ocr_text.split("\n")
            total = len(lines)
            structured_doc_text = (
                f"=== COMPANY HEADER (Issuing Company) ===\n"
                + "\n".join(lines[:max(1, total // 4)]) + "\n"
                + f"=== PARTY DETAILS (Counterparty / Buyer) ===\n"
                + "\n".join(lines[max(1, total // 4):max(1, total // 2)]) + "\n"
                + f"=== VOUCHER HEADER & LINE ITEMS ===\n"
                + "\n".join(lines[max(1, total // 2):]) + "\n"
            )[:14000]

        # Try OpenRouter with upgraded TALLY_PROMPT — Gemini 2.5 Flash is priority 1
        flat_json = None
        openrouter_key = settings.OPENROUTER_API_KEY

        if openrouter_key:
            import requests
            # Priority order: best model first
            models = [
                "google/gemini-2.5-flash",
                "meta-llama/llama-3.3-70b-instruct:free",
                "qwen/qwen3-8b:free",
                "deepseek/deepseek-r1-0528-qwen3-8b:free",
                "meta-llama/llama-3.2-3b-instruct:free",
            ]
            prompt = TALLY_PROMPT.format(
                our_company_name=our_company_name or "Unknown",
                our_company_gstin=our_company_gstin or "Unknown",
                structured_doc=structured_doc_text
            )
            for model in models:
                logger.info(f"[AgentOrchestrator] Sending extraction task to OpenRouter ({model})")
                try:
                    headers = {
                        "Authorization": f"Bearer {openrouter_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://localhost",
                        "X-Title": "FinBook Tally Extractor"
                    }
                    payload = {
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.0,
                        "max_tokens": 1200
                    }
                    response = requests.post(
                        url="https://openrouter.ai/api/v1/chat/completions",
                        headers=headers,
                        json=payload,
                        timeout=90
                    )
                    if response.status_code == 402:
                        res_json = response.json()
                        msg = res_json.get("error", {}).get("message", "")
                        match = re.search(r"can only afford (\d+)", msg)
                        if match:
                            allowed_tokens = int(match.group(1))
                            retry_tokens = max(150, allowed_tokens - 10)
                            logger.warning(f"[AgentOrchestrator] 402 Credits warning. Retrying model {model} with max_tokens={retry_tokens}")
                            payload["max_tokens"] = retry_tokens
                            response = requests.post(
                                url="https://openrouter.ai/api/v1/chat/completions",
                                headers=headers,
                                json=payload,
                                timeout=90
                            )

                    if response.status_code == 200:
                        content = response.json()["choices"][0]["message"]["content"].strip()
                        content = re.sub(r"^```(?:json)?\s*", "", content)
                        content = re.sub(r"\s*```$", "", content)
                        try:
                            flat_json = json.loads(content)
                            logger.info(f"[AgentOrchestrator] Successfully parsed JSON from OpenRouter using model {model}")
                            break
                        except json.JSONDecodeError as je:
                            logger.warning(f"[AgentOrchestrator] JSON decode failed for {model}: {je}")
                    elif response.status_code == 429:
                        logger.warning(f"[AgentOrchestrator] Model {model} rate limited (429). Trying next...")
                    else:
                        logger.warning(f"[AgentOrchestrator] OpenRouter error {response.status_code} for {model}: {response.text[:300]}")
                except Exception as ex:
                    logger.error(f"[AgentOrchestrator] Request to {model} failed: {ex}")

        # Map flat_json to individual agent structures
        _cls_res_set = False
        if flat_json:
            logger.info("[AgentOrchestrator] Mapping OpenRouter flat JSON to specialized structures")
            _cls_res_set = True
            party_name = flat_json.get("party_name") or ""
            party_gstin = flat_json.get("party_gstin") or ""

            voucher_type = flat_json.get("voucher_type") or "Purchase"
            voucher_type_lower = voucher_type.lower()
            is_payment = "payment" in voucher_type_lower
            is_receipt = "receipt" in voucher_type_lower or "received" in voucher_type_lower
            is_contra = "contra" in voucher_type_lower

            if is_payment:
                vch_type_str = "Payment Voucher"
                is_sales = False
            elif is_receipt:
                vch_type_str = "Receipt Voucher"
                is_sales = False
            elif is_contra:
                vch_type_str = "Contra Voucher"
                is_sales = False
            else:
                # Invoice direction logic (Sales vs Purchase)
                is_sales = "sales" in voucher_type_lower

                # Direct GSTIN and Name-based classification (100% accurate)
                if our_company_gstin:
                    clean_our_gstin = re.sub(r"[^A-Z0-9]", "", our_company_gstin.strip().upper())
                    clean_party_gstin = re.sub(r"[^A-Z0-9]", "", (flat_json.get("party_gstin") or "").strip().upper())
                    clean_company_gstin = re.sub(r"[^A-Z0-9]", "", (flat_json.get("company_gstin") or "").strip().upper())

                    if clean_our_gstin:
                        if clean_party_gstin and clean_party_gstin == clean_our_gstin:
                            logger.info("[AgentOrchestrator] Counterparty GSTIN matches our company GSTIN — classifying as Purchase.")
                            is_sales = False
                        elif clean_company_gstin and clean_company_gstin == clean_our_gstin:
                            logger.info("[AgentOrchestrator] Issuer GSTIN matches our company GSTIN — classifying as Sales.")
                            is_sales = True
                
                # Name-based fallback if GSTIN is missing or not matched
                if our_company_name:
                    our_clean = re.sub(r"[^a-z0-9]", "", our_company_name.lower())
                    party_clean = re.sub(r"[^a-z0-9]", "", party_name.lower()) if party_name else ""
                    if our_clean and party_clean:
                        if our_clean in party_clean or party_clean in our_clean:
                            logger.info("[AgentOrchestrator] Counterparty Name matches our company Name — classifying as Purchase.")
                            is_sales = False

                vch_type_str = "Sales Invoice" if is_sales else "Purchase Invoice"

            # For non-invoice types, items must be cleared (they don't have item tables)
            # Exception: Payment and Receipt vouchers can have ledger entries mapped in line_items
            if is_contra:
                logger.info(f"[AgentOrchestrator] Voucher type '{vch_type_str}' — clearing line_items (not applicable for contra)")
                flat_json["line_items"] = []

            # Validate per-item GST rate — combine CGST+SGST if needed
            for item in flat_json.get("line_items", []):
                cgst_p = float(item.get("cgst_percent") or 0)
                sgst_p = float(item.get("sgst_percent") or 0)
                igst_p = float(item.get("igst_percent") or 0)
                existing_gst = float(item.get("gst_rate_percent") or 0)

                if existing_gst == 0:
                    if igst_p > 0:
                        item["gst_rate_percent"] = igst_p
                    elif cgst_p > 0 or sgst_p > 0:
                        item["gst_rate_percent"] = cgst_p + sgst_p
                elif existing_gst <= 14 and (cgst_p > 0 or sgst_p > 0) and igst_p == 0:
                    # LLM returned half-rate (e.g. 9 for CGST), combine it
                    item["gst_rate_percent"] = cgst_p + sgst_p if (cgst_p + sgst_p) > 0 else existing_gst * 2

                # Snap to standard GST rates
                standard_rates = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28]
                gst = float(item.get("gst_rate_percent") or 0)
                if gst > 0:
                    item["gst_rate_percent"] = min(standard_rates, key=lambda r: abs(r - gst))

            party_id = "customer" if is_sales else "supplier"

            cls_res = {
                "documentType": vch_type_str,
                "voucherType": vch_type_str,
                "confidence": 95,
                "issuer": our_company_name if is_sales else party_name,
                "partyRoles": {
                    "seller": our_company_name if is_sales else party_name,
                    "buyer": party_name if is_sales else our_company_name
                },
                "reason": ["Extracted via OpenRouter single-call JSON"],
                "requiresUserConfirmation": False
            }

            hdr_res = {
                "invoice_number": {"value": flat_json.get("voucher_number"), "confidence": 95},
                "invoice_date": {"value": flat_json.get("voucher_date"), "confidence": 95},
                "state": {"value": flat_json.get("place_of_supply"), "confidence": 95},
                "reference_number": {"value": flat_json.get("voucher_number"), "confidence": 95},
                "place_of_supply": {"value": flat_json.get("place_of_supply"), "confidence": 95},
                "payment_terms": {"value": flat_json.get("due_date"), "confidence": 95}
            }

            party_res = {
                "supplier_name": {"value": our_company_name if is_sales else party_name, "confidence": 95},
                "supplier_gstin": {"value": our_company_gstin if is_sales else party_gstin, "confidence": 95},
                "supplier_address": {"value": "" if is_sales else flat_json.get("party_address"), "confidence": 95},
                "supplier_state": {"value": flat_json.get("place_of_supply") if not is_sales else "", "confidence": 95},
                "customer_name": {"value": party_name if is_sales else our_company_name, "confidence": 95},
                "customer_gstin": {"value": party_gstin if is_sales else our_company_gstin, "confidence": 95},
                "customer_address": {"value": flat_json.get("party_address") if is_sales else "", "confidence": 95},
                "customer_state": {"value": flat_json.get("place_of_supply") if is_sales else "", "confidence": 95},
                "consignee_name": {"value": flat_json.get("consignee_name") or "", "confidence": 95},
                "consignee_gstin": {"value": flat_json.get("consignee_gstin") or "", "confidence": 95},
                "consignee_address": {"value": flat_json.get("consignee_address") or "", "confidence": 95}
            }

            raw_items = []
            for item in flat_json.get("line_items", []):
                raw_items.append({
                    "item_name": {"value": item.get("item_name"), "confidence": 95},
                    "hsn_code": {"value": item.get("hsn_sac") or item.get("hsn_code"), "confidence": 95},
                    "qty": {"value": item.get("quantity"), "confidence": 95},
                    "unit": {"value": item.get("unit"), "confidence": 95},
                    "rate": {"value": item.get("rate"), "confidence": 95},
                    "discount_percent": {"value": item.get("discount_percent") or 0.0, "confidence": 95},
                    "amount": {"value": item.get("taxable_amount") or item.get("total_amount") or 0.0, "confidence": 95},
                    "gst_rate": {"value": item.get("gst_rate_percent") or 18.0, "confidence": 95}
                })
            items_res = {"line_items": raw_items}

            taxes = []
            summary = flat_json.get("summary", {})
            if summary.get("total_cgst", 0) > 0:
                taxes.append({
                    "tax_ledger": "CGST",
                    "taxable_value": {"value": summary.get("total_taxable_value"), "confidence": 95},
                    "rate": {"value": (summary.get("gst_rate_percent") or 18.0) / 2.0, "confidence": 95},
                    "amount": {"value": summary.get("total_cgst"), "confidence": 95}
                })
            if summary.get("total_sgst", 0) > 0:
                taxes.append({
                    "tax_ledger": "SGST",
                    "taxable_value": {"value": summary.get("total_taxable_value"), "confidence": 95},
                    "rate": {"value": (summary.get("gst_rate_percent") or 18.0) / 2.0, "confidence": 95},
                    "amount": {"value": summary.get("total_sgst"), "confidence": 95}
                })
            if summary.get("total_igst", 0) > 0:
                taxes.append({
                    "tax_ledger": "IGST",
                    "taxable_value": {"value": summary.get("total_taxable_value"), "confidence": 95},
                    "rate": {"value": summary.get("gst_rate_percent") or 18.0, "confidence": 95},
                    "amount": {"value": summary.get("total_igst"), "confidence": 95}
                })
            tax_res = {"taxes": taxes}

            totals_res = {
                "totals": {
                    "subtotal": {"value": summary.get("subtotal"), "confidence": 95},
                    "taxable_value": {"value": summary.get("total_taxable_value"), "confidence": 95},
                    "round_off": {"value": summary.get("round_off"), "confidence": 95},
                    "invoice_total": {"value": summary.get("grand_total"), "confidence": 95},
                    "amount_in_words": {"value": summary.get("amount_in_words"), "confidence": 95}
                },
                "payment_details": {
                    "bank_name": {"value": flat_json.get("bank_details", {}).get("bank_name"), "confidence": 95},
                    "bank_account_number": {"value": flat_json.get("bank_details", {}).get("account_number"), "confidence": 95},
                    "bank_ifsc": {"value": flat_json.get("bank_details", {}).get("ifsc"), "confidence": 95}
                },
                "footer": {
                    "declaration": {"value": "", "confidence": 95},
                    "terms_and_conditions": {"value": "", "confidence": 95},
                    "signature_block": {"value": "", "confidence": 95}
                }
            }
        else:
            logger.warning("[AgentOrchestrator] OpenRouter fallback triggered. Using regex-based text extraction.")
            # ── Regex fallback: extract key fields from OCR text directly ──────────
            flat_json = {}
            txt = ocr_text or ""

            # Detect voucher type from title line and filename hint
            filename_lower = filename.lower() if filename else ""
            txt_lower = txt.lower()
            if "sales" in filename_lower:
                flat_json["voucher_type"] = "Sales"
            elif "purchase" in filename_lower or "expense" in filename_lower:
                flat_json["voucher_type"] = "Purchase"
            elif "receipt" in filename_lower:
                flat_json["voucher_type"] = "Receipt"
            elif "payment" in filename_lower:
                flat_json["voucher_type"] = "Payment"
            elif "contra" in filename_lower:
                flat_json["voucher_type"] = "Contra"
            else:
                # Text-based checks
                if "receipt voucher" in txt_lower:
                    flat_json["voucher_type"] = "Receipt"
                elif "payment voucher" in txt_lower:
                    flat_json["voucher_type"] = "Payment"
                elif "contra" in txt_lower:
                    flat_json["voucher_type"] = "Contra"
                else:
                    # Invoice type: check if our company is supplier (Sales) or buyer (Purchase)
                    is_sales_by_gstin = False
                    if our_company_gstin:
                        # Find where our GSTIN appears in OCR text
                        idx = txt.find(our_company_gstin)
                        if idx != -1 and idx < 1000:  # Top part of document
                            is_sales_by_gstin = True
                    
                    is_sales_by_name = False
                    if our_company_name:
                        # Clean company name
                        clean_our_name = re.sub(r"[^a-z0-9]", "", our_company_name.lower())
                        if clean_our_name:
                            # Search first 1000 chars for our company name
                            top_text = re.sub(r"[^a-z0-9]", "", txt[:1000].lower())
                            if clean_our_name in top_text:
                                is_sales_by_name = True
                    
                    if is_sales_by_gstin or is_sales_by_name:
                        flat_json["voucher_type"] = "Sales"
                    else:
                        flat_json["voucher_type"] = "Purchase"

            # Voucher date — handles both numeric (14-05-2025) and month-name (3-Jun-25) formats
            MONTH_MAP = {
                'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
                'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
            }
            vdate_raw = None
            # 1. Try numeric format first anywhere in the first few lines of text
            numeric_dates = re.findall(r'\b(\d{1,2})[\-/](\d{1,2})[\-/](\d{2,4})\b', txt)
            if numeric_dates:
                d, mo, y = numeric_dates[0]
                y = '20' + y if len(y) == 2 else y
                vdate_raw = f"{d.zfill(2)}-{mo.zfill(2)}-{y}"
            else:
                # 2. Try month-name format anywhere
                month_name_dates = re.findall(r'\b(\d{1,2})[\-/\s]([A-Za-z]{3,9})[\-/\s](\d{2,4})\b', txt)
                valid_dates = []
                for d, mo_str, y in month_name_dates:
                    mo_key = mo_str.lower()[:3]
                    if mo_key in MONTH_MAP:
                        mo = MONTH_MAP[mo_key]
                        y = '20' + y if len(y) == 2 else y
                        valid_dates.append(f"{d.zfill(2)}-{mo}-{y}")
                if valid_dates:
                    vdate_raw = valid_dates[0]
            flat_json["voucher_date"] = vdate_raw

            # Extract invoice number — handles both numeric (28) and alphanumeric (FG-06/2025-26)
            vno_val = None
            # 1. "Invoice No. Dated" two-column format (Tally/Friends Grafix layout)
            vno_m2 = re.search(r'Invoice\s+No\.?\s+Dated\s*[\n\r]+\s*([A-Za-z0-9][A-Za-z0-9\-/\.]+)', txt, re.I)
            if vno_m2:
                candidate = vno_m2.group(1).strip()
                if candidate.lower() not in ["dated", "date", "mode", "terms"]:
                    vno_val = candidate
            # 2. Standard "Invoice No.: VALUE" inline format
            if not vno_val:
                vno_m = re.search(r'(?:Invoice\s+No\.?|Inv\s+No\.?|Bill\s+No\.?|Voucher\s+No\.?)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/\.]+)', txt, re.I)
                if vno_m:
                    candidate = vno_m.group(1).strip()
                    if candidate.lower() not in ["dated", "date"]:
                        vno_val = candidate
            # 3. Fallback: first alphanumeric code with at least 2 digits/letters in first 1000 chars
            if not vno_val:
                codes_m = re.findall(r'\b([A-Za-z]{1,5}[-/]\d+[A-Za-z0-9/\-]*)\b|\b(\d{4,8})\b', txt[:1000])
                for g1, g2 in codes_m:
                    candidate = (g1 or g2).strip()
                    if candidate and candidate.lower() not in ["gstin", "state", "code", "dated"]:
                        vno_val = candidate
                        break
            flat_json["voucher_number"] = vno_val

            # Bank/cash ledger from "Through:" line
            through_m = re.search(r'Through\s*[:\-]?\s*([^\n]{3,60})', txt, re.I)
            if through_m:
                flat_json["bank_cash_ledger"] = through_m.group(1).strip()

            # Party name parsing (Supplier / Customer block checks)
            party_name_found = ""
            if flat_json.get("voucher_type") == "Purchase":
                sup_m = re.search(r'Supplier\s*\((?:Bill\s+from|from)?\)?\s*\n\s*([^\n]+)', txt, re.I)
                if sup_m:
                    party_name_found = sup_m.group(1).strip()
            else:
                cust_m = re.search(r'(?:Customer|Consignee)\s*\((?:Ship\s+to|to)?\)?\s*\n\s*([^\n]+)', txt, re.I)
                if cust_m:
                    party_name_found = cust_m.group(1).strip()
                    
            if not party_name_found:
                # Fallback to Account line
                acct_m = re.search(r'(?:Account|Particulars)\s*[:\-]?\s*\n([ \t]*([A-Z][^\n]{2,80}))', txt, re.MULTILINE)
                if acct_m:
                    party_name_found = re.sub(r'\s+[\d,]+\.\d+.*$', '', acct_m.group(2)).strip()
            flat_json["party_name"] = party_name_found

            # Extract GSTIN of the party
            party_gstin_found = ""
            gst_m = re.findall(r'\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b', txt)
            if gst_m:
                our_gst = our_company_gstin.upper() if our_company_gstin else ""
                filtered_gst = [g for g in gst_m if g.upper() != our_gst]
                if filtered_gst:
                    party_gstin_found = filtered_gst[0]
            flat_json["party_gstin"] = party_gstin_found

            # Grand total — multiple patterns across whole document
            grand_total = 0.0
            # Pattern 1: Tally totals row — "Total ... Rs/₹ amount"
            gt_m = re.search(
                r'(?:^|\n)\s*Total\b[^\n]*?([\d]{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)\s*(?:Cr|Dr)?\s*$',
                txt, re.I | re.MULTILINE
            )
            if gt_m:
                try:
                    grand_total = float(gt_m.group(1).replace(',', ''))
                except Exception:
                    pass
            # Pattern 2: explicit "Grand Total" label
            if not grand_total:
                ggt_m = re.search(r'(?:Grand\s+Total|Invoice\s+Total|Amount\s+Payable)[^\n]*?([\d]{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)', txt, re.I)
                if ggt_m:
                    try:
                        grand_total = float(ggt_m.group(1).replace(',', ''))
                    except Exception:
                        pass
            # Pattern 3: "Amount Chargeable (in words) INR Twenty Thousand..."
            if not grand_total:
                words_m = re.search(r'Amount\s+Chargeable.*?INR\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Only)', txt, re.I)
                if words_m:
                    pass  # words-to-number conversion not implemented; rely on other patterns
            # Pattern 4: last large number in document (fallback)
            if not grand_total:
                all_amounts = re.findall(r'\b(\d{1,3}(?:,\d{2,3})*\.\d{2})\b', txt)
                if all_amounts:
                    try:
                        grand_total = max(float(a.replace(',', '')) for a in all_amounts)
                    except Exception:
                        pass
            flat_json["grand_total"] = grand_total

            # Bill allocations — find all Tally bill rows:
            bill_allocs = []
            for m in re.finditer(
                r'(?:Agst\s*Ref|Against\s*Ref)\s+([\w\-/.]+)\s+([\d,]+\.?\d*)\s*(?:Cr|Dr)?',
                txt, re.I
            ):
                bill_allocs.append({
                    "bill_no": m.group(1).strip(),
                    "allocation_amount": float(m.group(2).replace(',', '')),
                    "bill_type": "Against Ref"
                })
            for m in re.finditer(
                r'^Advance\s+([\w\-/.]+)\s+([\d,]+\.?\d*)\s*(?:Cr|Dr)?',
                txt, re.I | re.MULTILINE
            ):
                bill_allocs.append({
                    "bill_no": m.group(1).strip(),
                    "allocation_amount": float(m.group(2).replace(',', '')),
                    "bill_type": "Advance"
                })
            for m in re.finditer(
                r'New\s*Ref\s+([\w\-/.]+)\s+([\d,]+\.?\d*)\s*(?:Cr|Dr)?',
                txt, re.I
            ):
                bill_allocs.append({
                    "bill_no": m.group(1).strip(),
                    "allocation_amount": float(m.group(2).replace(',', '')),
                    "bill_type": "New Ref"
                })
            flat_json["bill_allocations"] = bill_allocs

            if not grand_total and bill_allocs:
                grand_total = sum(b.get("allocation_amount", 0) for b in bill_allocs)
                flat_json["grand_total"] = grand_total

            # Determine if this is an invoice type (Sales or Purchase)
            is_invoice_type = flat_json.get("voucher_type") in ["Sales", "Purchase"]
            parsed_items = []
            total_cgst = 0.0
            total_sgst = 0.0
            total_igst = 0.0
            round_off = 0.0

            def is_valid_item_row(name_str):
                name_lower = name_str.lower().strip()
                skip_words = {'total', 'subtotal', 'cgst', 'sgst', 'igst', 'gst', 'tax', 'round off',
                              'rounded off', 'discount', 'disc', 'amount', 'chargeable', 'carrier',
                              'freight', 'delivery', 'transport', 'handling', 'loading', 'unloading',
                              'tcs', 'tds', 'cid'}
                if not name_lower or len(name_lower) < 2:
                    return False
                # Reject rows whose 'name' actually starts with a number or comma (tax/subtotal rows)
                if re.match(r'^[\d,]', name_str.strip()):
                    return False
                # Reject names that are >50% numeric/punctuation (catches garbled tax rows)
                alpha_count = sum(1 for c in name_str if c.isalpha())
                if len(name_str) > 5 and alpha_count < len(name_str) * 0.3:
                    return False
                return not any(w in name_lower for w in skip_words)

            if is_invoice_type:
                lines = txt.split('\n')
                # Multi-line GST invoice item parsing
                # Pattern: sl# description HSN qty unit rate amount (Tally/standard GST invoice layout)
                i = 0
                while i < len(lines):
                    line = lines[i].strip()

                    # 1. Serial-number row with HSN: "1 Description HSN qty unit rate amount"
                    m = re.match(
                        r'^(\d{1,3})\s+([A-Za-z0-9@%][A-Za-z0-9\s\(\)\-\/\&@#%\.]+?)\s+(\d{4,8})\s+(\d+[\d,]*\.?\d*)\s+([A-Za-z]+)\s+(\d+[\d,]*\.?\d*)\s+(?:[A-Za-z]+\s+)?([\d,]+\.\d{2})\s*$',
                        line
                    )
                    if m:
                        _, name, hsn, qty, unit, rate, amount = m.groups()
                        if is_valid_item_row(name):
                            # Collect continuation description lines (pure-text, no numbers)
                            j = i + 1
                            while j < len(lines) and j < i + 4:
                                nxt = lines[j].strip()
                                if nxt and not re.search(r'\d', nxt) and not re.match(r'^(CGST|SGST|IGST|Round|Total|Amount)', nxt, re.I):
                                    name = name + ' ' + nxt
                                    j += 1
                                else:
                                    break
                            i = j
                            parsed_items.append({
                                "item_name": name.strip(),
                                "qty": float(qty.replace(',', '')),
                                "quantity": float(qty.replace(',', '')),
                                "unit": unit.strip(),
                                "rate": float(rate.replace(',', '')),
                                "amount": float(amount.replace(',', '')),
                                "hsn_code": hsn,
                                "discount_percent": 0.0
                            })
                            continue

                    # 2. No serial number — name HSN qty unit rate amount
                    m2 = re.match(
                        r'^([A-Za-z][A-Za-z0-9\s\(\)\-\/\&@#%\.]+?)\s+(\d{4,8})\s+(\d+[\d,]*\.?\d*)\s+([A-Za-z]+)\s+(\d+[\d,]*\.?\d*)\s+([\d,]+\.\d{2})\s*$',
                        line
                    )
                    if m2:
                        name, hsn, qty, unit, rate, amount = m2.groups()
                        if is_valid_item_row(name):
                            parsed_items.append({
                                "item_name": name.strip(),
                                "qty": float(qty.replace(',', '')),
                                "quantity": float(qty.replace(',', '')),
                                "unit": unit.strip(),
                                "rate": float(rate.replace(',', '')),
                                "amount": float(amount.replace(',', '')),
                                "hsn_code": hsn,
                                "discount_percent": 0.0
                            })
                            i += 1
                            continue

                    # 3. Serial# + name + qty + rate + amount (no HSN column)
                    m3 = re.match(
                        r'^(\d{1,3})\s+([A-Za-z0-9][A-Za-z0-9\s\(\)\-\/\&@#%\.]+?)\s+(\d+[\d,]*\.?\d*)\s*([a-zA-Z\.]+)?\s+(\d+[\d,]*\.?\d*)\s*(?:[a-zA-Z\.]+)?\s+([\d,]+\.\d{2})\s*$',
                        line
                    )
                    if m3:
                        _, name, qty, unit, rate, amount = m3.groups()
                        if is_valid_item_row(name):
                            parsed_items.append({
                                "item_name": name.strip(),
                                "qty": float(qty.replace(',', '')),
                                "quantity": float(qty.replace(',', '')),
                                "unit": unit.strip() if unit else None,
                                "rate": float(rate.replace(',', '')),
                                "amount": float(amount.replace(',', '')),
                                "hsn_code": "",
                                "discount_percent": 0.0
                            })
                            i += 1
                            continue

                    # 4. Name and amount only (services / ledger / no qty)
                    m4 = re.match(
                        r'^\s*(?:\d+\s+)?([A-Za-z0-9][A-Za-z0-9\s\(\)\-\/\&@#\.\,\+%]+?)\s+([\d,]+\.\d{2})\s*$',
                        line
                    )
                    if m4:
                        name, amount = m4.groups()
                        if is_valid_item_row(name):
                            parsed_items.append({
                                "item_name": name.strip(),
                                "qty": 0.0,
                                "quantity": 0.0,
                                "unit": None,
                                "rate": 0.0,
                                "amount": float(amount.replace(',', '')),
                                "hsn_code": "",
                                "discount_percent": 0.0
                            })
                    i += 1

                # Parse taxes and round off from lines
                for line in lines:
                    line_lower = line.lower()
                    if "cgst" in line_lower:
                        mt = re.search(r'([\d,]+\.\d{2})', line)
                        if mt:
                            total_cgst = float(mt.group(1).replace(',', ''))
                    elif "sgst" in line_lower:
                        mt = re.search(r'([\d,]+\.\d{2})', line)
                        if mt:
                            total_sgst = float(mt.group(1).replace(',', ''))
                    elif "igst" in line_lower:
                        mt = re.search(r'([\d,]+\.\d{2})', line)
                        if mt:
                            total_igst = float(mt.group(1).replace(',', ''))
                    elif "round off" in line_lower or "rounded off" in line_lower:
                        mt = re.search(r'(-?[\d,]+\.\d{1,2})', line)
                        if mt:
                            round_off = float(mt.group(1).replace(',', ''))



            if is_invoice_type and parsed_items:
                taxable_value = sum(item["amount"] for item in parsed_items)
                total_tax = total_cgst + total_sgst + total_igst
                
                # Inferred GST rate
                inferred_gst_percent = 0.0
                if taxable_value > 0 and total_tax > 0:
                    raw_rate = (total_tax / taxable_value) * 100
                    standard_rates = [0, 5, 12, 18, 28]
                    inferred_gst_percent = min(standard_rates, key=lambda r: abs(r - raw_rate))

                for item in parsed_items:
                    item["gst_rate"] = inferred_gst_percent
                    item["gst_rate_percent"] = inferred_gst_percent
                    item["taxable_amount"] = item["amount"]
                    item["total_amount"] = item["amount"]

                flat_json["line_items"] = parsed_items
                flat_json["is_item_wise"] = True
                flat_json["summary"] = {
                    "subtotal": taxable_value,
                    "total_taxable_value": taxable_value,
                    "total_cgst": total_cgst,
                    "total_sgst": total_sgst,
                    "total_igst": total_igst,
                    "gst_rate_percent": inferred_gst_percent,
                    "round_off": round_off,
                    "grand_total": taxable_value + total_tax + round_off,
                    "amount_in_words": ""
                }
                # Only use computed total if document total was not already extracted
                if not flat_json.get("grand_total"):
                    flat_json["grand_total"] = taxable_value + total_tax + round_off
            else:
                flat_json["line_items"] = [{
                    "item_name": flat_json.get("party_name") or "",
                    "quantity": None, "unit": None, "rate": None,
                    "taxable_amount": grand_total, "total_amount": grand_total,
                    "gst_rate_percent": 0
                }] if flat_json.get("party_name") else []
                flat_json["is_item_wise"] = False

            flat_json["party_address"] = None
            flat_json["consignee_name"] = None
            flat_json["consignee_address"] = None
            flat_json["narration"] = ""



        # Re-run flat_json mapping path if regex fallback populated it (cls_res may be unset)
        if flat_json and not _cls_res_set:
            logger.info("[AgentOrchestrator] Mapping regex-fallback flat_json to specialized structures")
            party_name = flat_json.get("party_name") or ""
            party_gstin = flat_json.get("party_gstin") or ""
            voucher_type = flat_json.get("voucher_type") or "Purchase"
            voucher_type_lower = voucher_type.lower()
            is_payment = "payment" in voucher_type_lower
            is_receipt = "receipt" in voucher_type_lower
            is_contra = "contra" in voucher_type_lower
            if is_payment:
                vch_type_str = "Payment Voucher"; is_sales = False
            elif is_receipt:
                vch_type_str = "Receipt Voucher"; is_sales = False
            elif is_contra:
                vch_type_str = "Contra Voucher"; is_sales = False
            else:
                is_sales = "sales" in voucher_type_lower
                vch_type_str = "Sales Invoice" if is_sales else "Purchase Invoice"
            party_id = "customer" if is_sales else "supplier"
            cls_res = {"documentType": vch_type_str, "voucherType": vch_type_str, "confidence": 60,
                       "issuer": our_company_name or "", "partyRoles": {}, "reason": ["Regex fallback extraction"]}
            hdr_res = {
                "invoice_number": {"value": flat_json.get("voucher_number"), "confidence": 60},
                "invoice_date": {"value": flat_json.get("voucher_date"), "confidence": 60},
                "state": {"value": None, "confidence": 0},
                "reference_number": {"value": None, "confidence": 0},
                "place_of_supply": {"value": None, "confidence": 0},
                "payment_terms": {"value": None, "confidence": 0},
            }
            party_res = {
                "supplier_name": {"value": party_name, "confidence": 60},
                "supplier_gstin": {"value": party_gstin, "confidence": 60},
                "supplier_address": {"value": None, "confidence": 0},
                "customer_name": {"value": party_name, "confidence": 60},
                "customer_gstin": {"value": party_gstin, "confidence": 60},
                "customer_address": {"value": None, "confidence": 0},
                "consignee_name": {"value": None, "confidence": 0},
                "consignee_gstin": {"value": None, "confidence": 0},
            }
            items_res = {"line_items": [
                {k: {"value": v, "confidence": 60} if not isinstance(v, dict) else v
                 for k, v in item.items()}
                for item in flat_json.get("line_items", [])
            ]}
            tax_res = {"taxes": []}
            grand_total = flat_json.get("grand_total") or 0.0
            totals_res = {
                "totals": {
                    "subtotal": {"value": grand_total, "confidence": 60},
                    "taxable_value": {"value": grand_total, "confidence": 60},
                    "round_off": {"value": 0, "confidence": 60},
                    "invoice_total": {"value": grand_total, "confidence": 60},
                    "amount_in_words": {"value": None, "confidence": 0}
                },
                "payment_details": {
                    "bank_name": {"value": flat_json.get("bank_cash_ledger"), "confidence": 60},
                    "bank_account_number": {"value": None, "confidence": 0},
                    "bank_ifsc": {"value": None, "confidence": 0}
                },
                "footer": {}
            }

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
            
        is_invoice_doc = "purchase" in doc_type.lower() or "sales" in doc_type.lower()
        if is_invoice_doc:
            expected_total_val = round(taxable_val + tax_sum_items + round_off_val, 2)
            invoice_total_val  = extracted_total if (extracted_total > 0 and abs(extracted_total - expected_total_val) < 5.0) else expected_total_val
        else:
            invoice_total_val = extracted_total

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
                "customer_address": gv(party_res, "customer_address"),
                "consignee_name":    gv(party_res, "consignee_name") or "",
                "consignee_gstin":   gv(party_res, "consignee_gstin") or "",
                "consignee_address": gv(party_res, "consignee_address") or ""
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
            {"id": "consignee_name",   "key": "consignee_name",    "label": "Consignee Name",
             "type": "text",  "value": standardized_payload["Party"]["consignee_name"],
             "confidence": gc(party_res, "consignee_name") or 90, "required": False, "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "Consignee Name"},
            {"id": "consignee_gstin",  "key": "consignee_gstin",   "label": "Consignee GSTIN",
             "type": "text",  "value": standardized_payload["Party"]["consignee_gstin"],
             "confidence": gc(party_res, "consignee_gstin") or 90, "required": False, "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "Consignee GSTIN"},
        ]

        # Add fields for payment, receipt, contra vouchers mapping compatibility
        is_payment_receipt_contra = any(x in doc_type.lower() for x in ["payment", "receipt", "contra"])
        if is_payment_receipt_contra:
            voucher_fields.append({
                "id": "party_ledger", "key": "party_ledger", "label": "Party Ledger",
                "type": "text", "value": party_name,
                "confidence": 95, "required": True, "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "Party Ledger"
            })
            voucher_fields.append({
                "id": "bank_cash_ledger", "key": "bank_cash_ledger", "label": "Cash/Bank Ledger",
                "type": "text", "value": (flat_json.get("bank_cash_ledger") or flat_json.get("bank_details", {}).get("bank_name") or "") if flat_json else "",
                "confidence": 95, "required": True, "editable": True, "visible": True, "page": 1, "bbox": None, "placeholder": "Cash/Bank Ledger"
            })

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

        is_invoice = "purchase" in doc_type.lower() or "sales" in doc_type.lower()
        sections_list = [
            {
                "id": "voucher_details", "title": "Voucher Details",
                "order": 1, "visible": True,
                "fields": voucher_fields,
            },
            {
                "id": "line_items", "title": "Line Items" if is_invoice else "Ledger Entries",
                "order": 2, "visible": True,
                "fields": [line_items_field],
            }
        ]

        bill_allocs = flat_json.get("bill_allocations", []) if flat_json else []
        if bill_allocs:
            bill_alloc_rows = []
            for b in bill_allocs:
                bill_alloc_rows.append({
                    "bill_no": b.get("bill_no") or b.get("billNo") or "",
                    "allocation_amount": num(b.get("allocation_amount") or b.get("amount")),
                    "bill_type": b.get("bill_type") or "Against Ref"
                })
            
            bill_alloc_field = {
                "id": "bill_allocations", "label": "Bill Allocations", "type": "table",
                "value": None, "confidence": 90, "required": False,
                "editable": True, "visible": True, "page": 1, "bbox": None,
                "placeholder": "Bill Allocations",
                "columns": [
                    {"id": "bill_no", "label": "Bill Reference"},
                    {"id": "allocation_amount", "label": "Allocation Amount"},
                    {"id": "bill_type", "label": "Bill Type"}
                ],
                "rows": bill_alloc_rows
            }
            sections_list.append({
                "id": "bill_allocations", "title": "Bill Allocations",
                "order": 3, "visible": True,
                "fields": [bill_alloc_field]
            })

        sections_list.append({
            "id": "calculation_summary", "title": "Calculation Summary" if is_invoice else "Summary",
            "order": 4 if bill_allocs else 3, "visible": True,
            "fields": calc_fields,
        })

        # Determine entry_tab ("with_item" or "without_item")
        # Items present in extracted data always override the LLM is_item_wise flag
        if len(line_items_list) > 0:
            is_item_wise_flag = True
        elif flat_json:
            is_item_wise_flag = flat_json.get("is_item_wise")
            if is_item_wise_flag is None:
                is_item_wise_flag = False
        else:
            is_item_wise_flag = False
        entry_tab = "with_item" if is_item_wise_flag else "without_item"

        doc_type_lower = doc_type.lower()
        is_sales = "sales" in doc_type_lower or "credit" in doc_type_lower
        is_purchase = "purchase" in doc_type_lower or "debit" in doc_type_lower
        
        if is_sales:
            doc_type_normalized = "credit_note" if "credit" in doc_type_lower else "sales_invoice"
        elif is_purchase:
            doc_type_normalized = "debit_note" if "debit" in doc_type_lower else "purchase_invoice"
        elif "contra" in doc_type_lower:
            doc_type_normalized = "contra"
        elif "receipt" in doc_type_lower or "payment" in doc_type_lower:
            # Both Receipt and Payment use bank_payment/cash_payment type IDs in CreateFundFlow
            bank_kw = any(kw in (flat_json.get("bank_cash_ledger") or "").lower()
                          for kw in ["bank", "hdfc", "sbi", "axis", "icici", "kotak", "yes", "cc"])
            doc_type_normalized = "bank_payment" if bank_kw else "cash_payment"
        else:
            doc_type_normalized = "cash_payment"
            
        bank_cash_ledger = ""
        narration_text = ""
        contra_source = ""
        contra_dest = ""
        if flat_json:
            bank_cash_ledger = flat_json.get("bank_cash_ledger") or flat_json.get("bank_details", {}).get("bank_name") or ""
            narration_text = flat_json.get("narration") or ""

        # For Contra vouchers: extract source (From) and destination (To) accounts from OCR text
        if "contra" in doc_type_lower and ocr_text:
            # ── Tally Contra format ──────────────────────────────────────────
            # "To AXIS BANK CC  40,000.00"  → destination (debit side)
            # "Cash Dr           40,000.00"  → source (credit side)
            tally_dest_m = re.search(
                r'^To\s+([A-Za-z][A-Za-z0-9\s&()/\-\.]+?)\s+[\d,]+\.?\d*\s*$',
                ocr_text, re.M
            )
            tally_src_m = re.search(
                r'^([A-Za-z][A-Za-z0-9\s&()/\-\.]+?)\s+Dr\s+[\d,]+\.?\d*\s*$',
                ocr_text, re.M
            )
            if tally_dest_m:
                contra_dest = tally_dest_m.group(1).strip()
            if tally_src_m:
                contra_source = tally_src_m.group(1).strip()


            # ── Explicit label patterns (custom/modern layouts) ───────────────
            if not contra_source:
                src_m = re.search(r'(?:From\s+Account|Transfer\s+From|Source|From)[:\s]+([A-Za-z][A-Za-z0-9\s&()/\-]{2,50})', ocr_text, re.I)
                if src_m:
                    contra_source = src_m.group(1).strip().split('\n')[0].strip()
            if not contra_dest:
                dst_m = re.search(r'(?:To\s+Account|Transfer\s+To|Destination)[:\s]+([A-Za-z][A-Za-z0-9\s&()/\-]{2,50})', ocr_text, re.I)
                if dst_m:
                    contra_dest = dst_m.group(1).strip().split('\n')[0].strip()

            # ── Tally "Through:" payment line ─────────────────────────────────
            if not contra_source:
                through_m = re.search(r'Through[:\s]+([A-Za-z][A-Za-z0-9\s&()/\-]{2,50})', ocr_text, re.I)
                if through_m:
                    contra_source = through_m.group(1).strip().split('\n')[0].strip()

            # Final fallbacks
            if not contra_source and party_name:
                contra_source = party_name
            if not contra_dest and bank_cash_ledger:
                contra_dest = bank_cash_ledger


        schema = {
            "document_type": doc_type,
            "entry_tab": entry_tab,
            "confidence": cls_res.get("confidence", 0),
            "reasoning": cls_res.get("reasoning", ""),
            "sections": sections_list,
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
            "standardized_payload": standardized_payload,
            
            # --- FLAT TALLY-FIRST SCHEMA KEYS ---
            "voucherType": doc_type_normalized,
            "voucherNumber": standardized_payload["Header"]["invoice_number"],
            "voucherDate": standardized_payload["Header"]["invoice_date"],
            # For Contra: partyLedger = source account, bankCashLedger = destination account
            "partyLedger": contra_source if "contra" in doc_type_lower else party_name,
            "partyGstin": party_gstin,
            "gstRegistration": standardized_payload["Header"]["state"] or standardized_payload["Header"]["place_of_supply"],
            "productLines": [
                {
                    "id": item.get("id") or (i + 100),
                    "srNo": i + 1,
                    "stockItem": item.get("item_name") or "",
                    "description": item.get("description") or "",
                    "hsnSacCode": item.get("hsn_code") or "",
                    "billQuantity": item.get("qty") or 0,
                    "unit": item.get("unit") or "Nos",
                    "billRate": item.get("rate") or 0,
                    "discountPercent": item.get("discount_percent") or 0,
                    "amount": item.get("amount") or 0,
                    "gstRate": item.get("gst_rate") or 0,
                    "rcm": item.get("rcm") or False,
                    "taxabilityType": item.get("taxabilityType") or "Taxable"
                } for i, item in enumerate(line_items_list)
            ],
            "billRows": [
                {
                    "id": b.get("id") or (i + 500),
                    "billType": b.get("bill_type") or "Against Ref",
                    "billNo": b.get("bill_no") or "",
                    "allocationAmount": b.get("allocation_amount") or 0
                } for i, b in enumerate(bill_allocs)
            ] if bill_allocs else [],
            "baseTotal": taxable_val,
            "cgstTotal": cgst_total,
            "sgstTotal": sgst_total,
            "igstTotal": igst_total,
            "roundOff": round_off_val,
            "grandTotal": invoice_total_val,
            "entryTab": entry_tab,
            "bankCashLedger": contra_dest if "contra" in doc_type_lower else bank_cash_ledger,
            "amount": invoice_total_val,
            "narration": narration_text,
            # Contra-specific keys (read directly by UI)
            "sourceLedger": contra_source if "contra" in doc_type_lower else "",
            "destinationLedger": contra_dest if "contra" in doc_type_lower else "",
            "transferAmount": invoice_total_val if "contra" in doc_type_lower else 0,
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
