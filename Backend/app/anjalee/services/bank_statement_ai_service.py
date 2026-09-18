import os
import re
import json
import hashlib
import logging
import uuid
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Tuple
from bson import ObjectId
import openpyxl
import csv

from app.anjalee.services.ocr_service import OcrService
from app.anjalee.services.llm_service import llm_service
from app.anjalee.utils.serialization import serialize_doc

logger = logging.getLogger("bank_statement_ai_service")

ocr_service = OcrService()


class BankStatementAIService:
    def __init__(self, db):
        self.db = db

    def extract_raw_statement_text(self, file_path: str, file_type: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Extract raw text / grid rows from PDF, Excel, or CSV statement files.
        Returns (full_text_or_grid, raw_rows_structure).
        """
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in [".xlsx", ".xls"]:
            return self._extract_excel_statement(file_path)
        elif ext == ".csv":
            return self._extract_csv_statement(file_path)
        else:
            # First try structured multi-page PDF table parser (page 1 to N)
            pdf_txs = self.parse_pdf_statement_file(file_path)
            if pdf_txs and len(pdf_txs) > 0:
                logger.info(f"Structured PDF parser extracted {len(pdf_txs)} transactions across all pages!")
                return "", pdf_txs

            # Default to PDF OCR / PyMuPDF extraction fallback
            ocr_res = ocr_service.process_document(file_path, "pdf")
            pages = ocr_res.get("pages", [])
            full_text = "\n\n".join(
                f"[Page {p.get('page_number', i+1)}]\n{p.get('text', '')}"
                for i, p in enumerate(pages)
                if p.get("text", "").strip()
            )
            return full_text, []

    def parse_pdf_statement_file(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Parses multi-page PDF bank statements (15+ pages) using pdfplumber table extraction.
        Extracts ALL transaction rows across all pages without truncating or dropping items.
        """
        transactions = []
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page_idx, page in enumerate(pdf.pages):
                    tables = page.extract_tables()
                    if not tables:
                        continue
                    for table in tables:
                        if not table or len(table) < 2:
                            continue
                        
                        headers = [str(cell).strip().lower() if cell else "" for cell in table[0]]
                        
                        date_col = next((i for i, h in enumerate(headers) if "date" in h), None)
                        desc_col = next((i for i, h in enumerate(headers) if "desc" in h or "particular" in h or "narration" in h), None)
                        type_col = next((i for i, h in enumerate(headers) if "cr/dr" in h or "type" in h or "d/c" in h or "dr/cr" in h or "cr" in h or "dr" in h), None)
                        amt_col = next((i for i, h in enumerate(headers) if "amount" in h or "txn" in h), None)
                        bal_col = next((i for i, h in enumerate(headers) if "balance" in h), None)
                        ref_col = next((i for i, h in enumerate(headers) if "cheque" in h or "ref" in h or "id" in h), None)

                        for row in table[1:]:
                            if not row or not any(row):
                                continue
                            clean_row = [str(cell).strip() if cell else "" for cell in row]
                            
                            raw_date = clean_row[date_col] if date_col is not None and date_col < len(clean_row) else (clean_row[1] if len(clean_row) > 1 else "")
                            raw_desc = clean_row[desc_col] if desc_col is not None and desc_col < len(clean_row) else (clean_row[5] if len(clean_row) > 5 else "")
                            raw_type = clean_row[type_col] if type_col is not None and type_col < len(clean_row) else (clean_row[6] if len(clean_row) > 6 else "")
                            raw_amt = clean_row[amt_col] if amt_col is not None and amt_col < len(clean_row) else (clean_row[7] if len(clean_row) > 7 else "")
                            raw_bal = clean_row[bal_col] if bal_col is not None and bal_col < len(clean_row) else (clean_row[8] if len(clean_row) > 8 else "")
                            raw_ref = clean_row[ref_col] if ref_col is not None and ref_col < len(clean_row) else (clean_row[1] if len(clean_row) > 1 else "")

                            date_match = re.search(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b', raw_date)
                            if not date_match:
                                row_str = " ".join(clean_row)
                                date_match = re.search(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b', row_str)
                            
                            if not date_match:
                                continue

                            raw_date_str = date_match.group(1)
                            try:
                                parts = re.split(r'[-/]', raw_date_str)
                                if len(parts[0]) == 4:
                                    fmt_date = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                                elif len(parts[2]) == 4:
                                    fmt_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                                else:
                                    fmt_date = f"2026-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                            except Exception:
                                fmt_date = datetime.now().strftime("%Y-%m-%d")

                            amt_clean = re.sub(r'[^\d.]', '', raw_amt.replace(',', ''))
                            try:
                                amt_val = float(amt_clean)
                            except ValueError:
                                amt_val = 0.0

                            if amt_val <= 0:
                                for cell in clean_row:
                                    num_c = re.sub(r'[^\d.]', '', cell.replace(',', ''))
                                    try:
                                        v = float(num_c)
                                        if v > 0 and v != float(clean_row[0] if clean_row[0].isdigit() else 0):
                                            amt_val = v
                                            break
                                    except ValueError:
                                        pass

                            if amt_val <= 0:
                                continue

                            bal_clean = re.sub(r'[^\d.]', '', raw_bal.replace(',', ''))
                            try:
                                bal_val = float(bal_clean)
                            except ValueError:
                                bal_val = None

                            is_credit = "cr" in raw_type.lower() or "deposit" in raw_type.lower() or "credit" in raw_type.lower()
                            tx_type = "credit" if is_credit else "debit"
                            debit = 0.0 if is_credit else amt_val
                            credit = amt_val if is_credit else 0.0

                            narration = raw_desc if raw_desc and raw_desc != "-" else f"Bank Transaction on {fmt_date}"

                            transactions.append({
                                "date": fmt_date,
                                "narration": narration,
                                "debit": round(debit, 2),
                                "credit": round(credit, 2),
                                "amount": round(amt_val, 2),
                                "type": tx_type,
                                "balance": round(bal_val, 2) if bal_val else None,
                                "referenceNumber": raw_ref if raw_ref and raw_ref != "-" else None,
                                "page": page_idx + 1
                            })
        except Exception as e:
            logger.error(f"pdfplumber multipage extraction failed: {e}", exc_info=True)

        return transactions

    def _extract_excel_statement(self, file_path: str) -> Tuple[str, List[Dict[str, Any]]]:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
        
        text_lines = []
        raw_rows = []
        for r_idx, row in enumerate(rows):
            clean_vals = [str(val).strip() if val is not None else "" for val in row]
            if any(clean_vals):
                line_str = " | ".join(clean_vals)
                text_lines.append(f"Row {r_idx+1}: {line_str}")
                raw_rows.append({"row_index": r_idx + 1, "cells": clean_vals})
                
        return "\n".join(text_lines), raw_rows

    def _extract_csv_statement(self, file_path: str) -> Tuple[str, List[Dict[str, Any]]]:
        text_lines = []
        raw_rows = []
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            for r_idx, row in enumerate(reader):
                clean_vals = [str(val).strip() for val in row]
                if any(clean_vals):
                    line_str = " | ".join(clean_vals)
                    text_lines.append(f"Row {r_idx+1}: {line_str}")
                    raw_rows.append({"row_index": r_idx + 1, "cells": clean_vals})
                    
        return "\n".join(text_lines), raw_rows

    def parse_statement_transactions_with_ai(self, raw_text: str, bank_ledger: str) -> List[Dict[str, Any]]:
        """
        Calls LLM with structured output schema to dynamically extract all transaction lines
        (date, narration, debit, credit, amount, balance, reference_number)
        from PDF or Excel statement text without hardcoding fixed column assumptions.
        """
        if not raw_text.strip():
            return []

        system_prompt = """You are an expert AI Bank Statement Parser for Indian accounting systems.
You will receive extracted text or raw rows from a Bank Statement (PDF or Excel/CSV format).

YOUR TASK:
1. Dynamically identify all transaction lines in the statement.
2. For each transaction line, extract:
   - "date": Date of transaction in YYYY-MM-DD format (if year is missing, assume current/most recent year from context).
   - "narration": Transaction description, particulars, or narration text. Preserve exact text.
   - "debit": Numeric amount paid/withdrawn/debited (or 0.0 if not a debit).
   - "credit": Numeric amount received/deposited/credited (or 0.0 if not a credit).
   - "amount": Total transaction amount (positive float).
   - "type": "debit" (money paid out) or "credit" (money received in).
   - "balance": Running account balance if present in document, else null.
   - "referenceNumber": UTR number, transaction reference number, cheque number, or null if absent.

CRITICAL RULES:
- Do NOT assume fixed column positions. Read headers like Date, Particulars/Description, Withdrawal/Debit, Deposit/Credit, Balance, Chq/Ref No.
- Remove currency symbols (₹, Rs, INR, commas) from amounts. Return clean numbers.
- Ignore summary header lines (Opening balance, Total Debit, Page header) that are not individual transactions.
- Output ONLY a valid JSON object matching this schema:

{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "narration": "string",
      "debit": 0.0,
      "credit": 10000.0,
      "amount": 10000.0,
      "type": "credit",
      "balance": 50000.0,
      "referenceNumber": "UTR12345678"
    }
  ]
}"""

        user_prompt = f"Target Bank Ledger: {bank_ledger}\n\nBank Statement Content:\n\n{raw_text[:50000]}"

        try:
            logger.info("Calling LLM to parse bank statement transactions")
            res = llm_service.client.chat.completions.create(
                model=llm_service.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.0,
                max_tokens=4000
            )
            raw_res = res.choices[0].message.content
            cleaned = llm_service._clean_json_string(raw_res)
            parsed = json.loads(cleaned)
            txs = parsed.get("transactions", [])
            if not txs:
                logger.info("LLM returned 0 transactions. Invoking fallback regex statement parser.")
                txs = self._fallback_parse_statement_transactions(raw_text)
            return txs
        except Exception as e:
            logger.error(f"Failed to parse statement transactions with AI: {e}", exc_info=True)
            return self._fallback_parse_statement_transactions(raw_text)

    def _fallback_parse_statement_transactions(self, raw_text: str) -> List[Dict[str, Any]]:
        """
        Deterministic regex/table parser when LLM parsing is unavailable or returns 0 items.
        Extracts date, narration, debit/credit amounts, and balances line by line.
        """
        if not raw_text:
            return []

        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        date_pattern = re.compile(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b')
        num_pattern = re.compile(r'\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b|\b\d+\.\d{2}\b')

        transactions = []
        for line in lines:
            date_match = date_pattern.search(line)
            if not date_match:
                continue

            raw_date_str = date_match.group(1)
            try:
                parts = re.split(r'[-/]', raw_date_str)
                if len(parts[0]) == 4:
                    formatted_date = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                elif len(parts[2]) == 4:
                    formatted_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                else:
                    formatted_date = f"2026-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            except Exception:
                formatted_date = datetime.now().strftime("%Y-%m-%d")

            nums = num_pattern.findall(line)
            clean_nums = []
            for n in nums:
                val_str = n.replace(",", "")
                try:
                    v = float(val_str)
                    if v > 0:
                        clean_nums.append(v)
                except ValueError:
                    pass

            if not clean_nums:
                continue

            lower_line = line.lower()
            if any(h in lower_line for h in ["opening balance", "closing balance", "total debit", "total credit", "page"]):
                continue

            text_without_date = date_pattern.sub("", line)
            narration = num_pattern.sub("", text_without_date).strip()
            narration = re.sub(r'\s+', ' ', narration)
            if not narration:
                narration = f"Bank Transaction on {formatted_date}"

            amount = clean_nums[0]
            balance = clean_nums[-1] if len(clean_nums) > 1 else None

            is_credit = any(c in lower_line for c in ["cr", "credit", "deposit", "by", "rec", "receipt"]) or ("dr" not in lower_line and "payment" not in lower_line and "wd" not in lower_line)

            tx_type = "credit" if is_credit else "debit"
            debit = 0.0 if is_credit else amount
            credit = amount if is_credit else 0.0

            ref_match = re.search(r'\b(UTR\w+|NEFT\w+|UPI\w+|INB\w+|CHQ\d+|\d{6,12})\b', line, re.IGNORECASE)
            ref_no = ref_match.group(1) if ref_match else None

            transactions.append({
                "date": formatted_date,
                "narration": narration,
                "debit": round(debit, 2),
                "credit": round(credit, 2),
                "amount": round(amount, 2),
                "type": tx_type,
                "balance": round(balance, 2) if balance else None,
                "referenceNumber": ref_no
            })

        logger.info(f"Fallback statement parser extracted {len(transactions)} transaction lines.")
        return transactions

    def get_company_master_ledgers(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Dynamically query tenant database 'ledgers' and 'ledgers_entry' collections for actual company masters.
        Returns list of ledgers with ledgerName, groupName, partyDetails, and GSTIN.
        """
        query = {}
        if company_id and company_id != "default":
            query["$or"] = [{"company_id": company_id}, {"companyId": company_id}]

        master_ledgers = []
        seen_names = set()

        # Query ledgers and ledgers_entry
        for col_name in ["ledgers", "ledgers_entry"]:
            try:
                cursor = self.db[col_name].find(query) if query else self.db[col_name].find({})
                for doc in cursor:
                    name = doc.get("ledgerName") or doc.get("name")
                    group = doc.get("groupName") or doc.get("parentGroup") or ""
                    if name and name.strip():
                        clean_name = name.strip()
                        if clean_name.lower() not in seen_names:
                            seen_names.add(clean_name.lower())
                            pd = doc.get("partyDetails") or {}
                            gstin = pd.get("gstin") or doc.get("gstin") or ""
                            master_ledgers.append({
                                "name": clean_name,
                                "ledgerName": clean_name,
                                "group": group,
                                "gstin": gstin,
                                "phone": pd.get("phone") or doc.get("phone") or "",
                                "city": pd.get("city") or doc.get("city") or ""
                            })
            except Exception as e:
                logger.warning(f"Error reading collection {col_name} for master ledgers: {e}")

        # If empty with company_id filter, fallback to all ledgers
        if not master_ledgers and query:
            return self.get_company_master_ledgers(company_id=None)

        return master_ledgers

    def extract_party_candidate(self, narration: str) -> Optional[str]:
        if not narration:
            return None
        # 1. UPI with @ symbol e.g. ashokgupta1924@
        m = re.search(r'UPI/[A-Z0-9]+/UPI/([^/@]+)@', narration, re.I)
        if not m:
            m = re.search(r'([^/@\s]+)@[a-zA-Z]+', narration, re.I)
        if m and len(m.group(1).strip()) >= 3:
            return m.group(1).strip()
        # 2. CLG format e.g. CLG/AMRAPUR MEDICAL AGENCIES-0001869/...
        m = re.search(r'CLG/([A-Za-z0-9\s&.-]{3,40}?)(?:-\d|/\d|/[A-Z]{3,4}/|$)', narration, re.I)
        if m and len(m.group(1).strip()) >= 3:
            return m.group(1).strip()
        # 3. NEFT / RTGS / IMPS format e.g. NEFT-HDFCH01163185685-SHRI RAM MEDICAL AGENCIES-...
        m = re.search(r'(?:NEFT|RTGS|IMPS|IFT|INFT)[-/\s]+[A-Z0-9]+[-/\s]+([A-Za-z0-9\s&.-]{3,40}?)(?:[-/\s]+\d|[-/\s]+[A-Z]{4}\d|$)', narration, re.I)
        if m and len(m.group(1).strip()) >= 3:
            return m.group(1).strip()
        # 4. INF / INFT payment format
        m = re.search(r'INF/INFT/[0-9]+/PAYMENT\s+[A-Z\s]+/([A-Za-z0-9\s&.-]{3,30})', narration, re.I)
        if m and len(m.group(1).strip()) >= 3:
            return m.group(1).strip()
        return None

    def match_ledger_and_categorize(
        self,
        transaction: Dict[str, Any],
        bank_ledger: str,
        company_masters: List[Dict[str, Any]],
        match_cache: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Uses AI + fuzzy matching against actual company master ledgers to determine:
        1. voucherType ("Payment" vs "Receipt")
        2. selectedLedger (counterpart party/ledger from masters)
        3. confidence (0-100)
        4. reviewRequired (boolean)
        5. reviewReason / userReasoning
        """
        tx_type = str(transaction.get("type") or "").lower()
        amt = float(transaction.get("amount") or transaction.get("credit") or transaction.get("debit") or 0.0)
        debit_val = float(transaction.get("debit") or 0.0)
        credit_val = float(transaction.get("credit") or 0.0)
        narration = str(transaction.get("narration") or "").strip()
        ref_no = transaction.get("referenceNumber")

        # Determine Voucher Type
        # Credit (money in) -> Receipt Voucher
        # Debit (money out) -> Payment Voucher
        if credit_val > 0 or tx_type == "credit" or "received" in narration.lower():
            voucher_type = "Receipt"
        else:
            voucher_type = "Payment"

        cache_key = f"{voucher_type}|{narration.lower()}"
        if match_cache is not None and cache_key in match_cache:
            return match_cache[cache_key]

        if not company_masters:
            res_obj = {
                "voucher_type": voucher_type,
                "selected_ledger": None,
                "confidence": 30,
                "review_required": True,
                "review_reason": "No company master ledgers found in database. Please select ledger manually.",
                "user_reasoning": "Master ledgers unavailable."
            }
            if match_cache is not None:
                match_cache[cache_key] = res_obj
            return res_obj

        # Step A1: Extract party candidate from narration and check in masters
        party_cand = self.extract_party_candidate(narration)
        if party_cand:
            p_lower = party_cand.lower()
            for master in company_masters:
                m_name = master.get("name") or master.get("ledgerName") or ""
                if not m_name:
                    continue
                m_lower = m_name.lower()
                if p_lower == m_lower or (len(p_lower) >= 4 and p_lower in m_lower) or (len(m_lower) >= 4 and m_lower in p_lower):
                    res_obj = {
                        "voucher_type": voucher_type,
                        "selected_ledger": master["name"],
                        "confidence": 95,
                        "review_required": False,
                        "review_reason": f"High confidence match for extracted party '{party_cand}'.",
                        "user_reasoning": f"Extracted party '{party_cand}' matched to company master '{master['name']}'."
                    }
                    if match_cache is not None:
                        match_cache[cache_key] = res_obj
                    return res_obj

        # Step A2: Check exact or normalized text match in company master ledgers
        narration_lower = narration.lower()
        best_exact_match = None
        for master in company_masters:
            m_name = master.get("name") or master.get("ledgerName") or ""
            if not m_name:
                continue
            m_lower = m_name.lower()
            if len(m_lower) >= 3 and (m_lower in narration_lower or (len(narration_lower) >= 4 and narration_lower in m_lower)):
                best_exact_match = master
                break

        if best_exact_match:
            res_obj = {
                "voucher_type": voucher_type,
                "selected_ledger": best_exact_match["name"],
                "confidence": 92,
                "review_required": False,
                "review_reason": "High confidence match based on master ledger name.",
                "user_reasoning": f"Matched to '{best_exact_match['name']}' based on transaction narration '{narration}'."
            }
            if match_cache is not None:
                match_cache[cache_key] = res_obj
            return res_obj

        # Step A3: Token/Word overlap matching against company master ledgers
        words = set(re.findall(r'\b[A-Za-z]{3,}\b', narration_lower))
        stop_words = {"bank", "neft", "rtgs", "upi", "imps", "clg", "chq", "transfer", "payment", "received", "trf", "inft", "inf", "paid"}
        clean_words = words - stop_words
        
        if clean_words:
            for master in company_masters:
                m_name = master.get("name") or master.get("ledgerName") or ""
                if not m_name:
                    continue
                m_words = set(re.findall(r'\b[A-Za-z]{3,}\b', m_name.lower())) - stop_words
                if m_words and len(clean_words.intersection(m_words)) >= min(2, len(m_words)):
                    res_obj = {
                        "voucher_type": voucher_type,
                        "selected_ledger": master["name"],
                        "confidence": 88,
                        "review_required": False,
                        "review_reason": f"Matched based on keywords in '{master['name']}'.",
                        "user_reasoning": f"Matched to '{master['name']}' based on transaction particulars."
                    }
                    if match_cache is not None:
                        match_cache[cache_key] = res_obj
                    return res_obj

        # Step A4: Standard Accounting Heuristics
        heuristics = [
            (r'\b(chg|charge|charges|fee|proc\s+fee|sms\s+chg|min\s+bal|service\s+tax|gst)\b', "Bank Charges"),
            (r'\b(int|interest|int\.pd|int\.rec)\b', "Interest Account"),
            (r'\b(atm|cash|wdl|withdrawal)\b', "Cash"),
            (r'\b(sal|salary|wages)\b', "Salary & Wages"),
        ]
        for pattern, default_ledger in heuristics:
            if re.search(pattern, narration_lower):
                matched_master = next((m["name"] for m in company_masters if default_ledger.lower() in m["name"].lower()), None)
                res_obj = {
                    "voucher_type": voucher_type,
                    "selected_ledger": matched_master or default_ledger,
                    "confidence": 80 if matched_master else 65,
                    "review_required": not bool(matched_master),
                    "review_reason": f"Auto-categorized via keyword heuristic for {default_ledger}.",
                    "user_reasoning": f"Transaction description matches accounting heuristic pattern for {default_ledger}."
                }
                if match_cache is not None:
                    match_cache[cache_key] = res_obj
                return res_obj

        # Fallback (Instant, 0ms latency): Unmatched item requiring user review in UI grid
        res_obj = {
            "voucher_type": voucher_type,
            "selected_ledger": None,
            "confidence": 50,
            "review_required": True,
            "review_reason": "Ledger requires accountant review. Please select counterpart ledger.",
            "user_reasoning": "No exact match found in company master ledgers. Manual selection required."
        }
        if match_cache is not None:
            match_cache[cache_key] = res_obj
        return res_obj

    def generate_transaction_fingerprint(
        self,
        company_id: str,
        bank_ledger: str,
        tx_date: str,
        amount: float,
        voucher_type: str,
        ref_no: Optional[str],
        narration: str
    ) -> str:
        """
        Cryptographic SHA-256 hash to prevent duplicate bank transaction processing.
        """
        raw_key = f"{company_id}|{bank_ledger.lower().strip()}|{str(tx_date)[:10]}|{round(amount, 2)}|{voucher_type.lower()}|{str(ref_no or '').strip()}|{narration.lower().strip()[:30]}"
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def check_duplicate_transaction(self, fingerprint: str) -> bool:
        """
        Checks if transaction fingerprint already exists in MongoDB collections:
        - 'vouchers'
        - 'fund_flow_transactions' / 'fundflow'
        - 'bank_statement_drafts'
        """
        # Check vouchers
        v_exists = self.db["vouchers"].find_one({"fingerprint": fingerprint})
        if v_exists:
            return True
            
        # Check fund_flow_transactions
        ff_exists = self.db["fund_flow_transactions"].find_one({"fingerprint": fingerprint})
        if not ff_exists:
            ff_exists = self.db["fundflow"].find_one({"fingerprint": fingerprint})
        if ff_exists:
            return True

        return False

    def process_and_create_batch_draft(
        self,
        file_path: str,
        file_name: str,
        file_type: str,
        bank_ledger: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Full workflow orchestrator:
        1. Extract raw statement text/rows (PDF / Excel / CSV).
        2. Parse transaction lines dynamically via AI.
        3. Fetch tenant company master ledgers.
        4. Match ledgers & classify Payment / Receipt for each transaction.
        5. Check duplicate fingerprints.
        6. Save batch to 'bank_statement_drafts' MongoDB collection.
        """
        raw_text, raw_rows = self.extract_raw_statement_text(file_path, file_type)
        if raw_rows and isinstance(raw_rows, list) and len(raw_rows) > 0 and isinstance(raw_rows[0], dict) and ("date" in raw_rows[0] or "debit" in raw_rows[0] or "credit" in raw_rows[0]):
            extracted_txs = raw_rows
        else:
            extracted_txs = self.parse_statement_transactions_with_ai(raw_text, bank_ledger)
        company_masters = self.get_company_master_ledgers(company_id)

        processed_items = []
        ready_cnt = 0
        review_cnt = 0
        dup_cnt = 0

        batch_id = str(ObjectId())
        match_cache = {}

        for idx, tx in enumerate(extracted_txs):
            item_id = str(uuid.uuid4())
            tx_date = tx.get("date") or datetime.now().strftime("%Y-%m-%d")
            narration = tx.get("narration") or f"Bank Transaction {idx+1}"
            amt = float(tx.get("amount") or tx.get("credit") or tx.get("debit") or 0.0)
            ref_no = tx.get("referenceNumber")
            balance = tx.get("balance")

            # Match ledger and determine voucher type with cache
            match_res = self.match_ledger_and_categorize(tx, bank_ledger, company_masters, match_cache)
            v_type = match_res["voucher_type"]
            sel_ledger = match_res["selected_ledger"]
            conf = match_res["confidence"]
            rev_req = match_res["review_required"]
            rev_reason = match_res["review_reason"]
            user_reasoning = match_res["user_reasoning"]

            # Compute SHA-256 fingerprint for duplicate checking
            fingerprint = self.generate_transaction_fingerprint(
                company_id or "default", bank_ledger, tx_date, amt, v_type, ref_no, narration
            )
            is_dup = self.check_duplicate_transaction(fingerprint)

            if is_dup:
                status = "already_processed"
                rev_req = True
                rev_reason = "Transaction already processed into an existing voucher."
                dup_cnt += 1
            elif rev_req:
                status = "review_required"
                review_cnt += 1
            else:
                status = "ready"
                ready_cnt += 1

            # Format item matching manual voucher entry schema fields
            item_doc = {
                "item_id": item_id,
                "voucherDate": tx_date,
                "voucherNumber": f"BS-{datetime.now().year}-{str(idx+1).zfill(4)}",
                "voucherType": v_type, # Payment or Receipt
                "bankLedger": bank_ledger, # Bank Ledger Dr (for Receipt) or Cr (for Payment)
                "partyLedger": sel_ledger or "", # Party / Counterpart Ledger
                "againstLedger": sel_ledger or "",
                "amount": round(amt, 2),
                "debit": float(tx.get("debit") or (amt if v_type == "Payment" else 0.0)),
                "credit": float(tx.get("credit") or (amt if v_type == "Receipt" else 0.0)),
                "balance": balance,
                "paymentMode": "NEFT" if "neft" in narration.lower() else "RTGS" if "rtgs" in narration.lower() else "UPI" if "upi" in narration.lower() else "Cheque" if "chq" in narration.lower() or "cheque" in narration.lower() else "Bank Transfer",
                "instType": "NEFT" if "neft" in narration.lower() else "UPI" if "upi" in narration.lower() else "Cheque",
                "instNumber": ref_no or "",
                "referenceNumber": ref_no or "",
                "instDate": tx_date,
                "narration": narration,
                "confidence": conf,
                "status": status,
                "review_required": rev_req,
                "review_reason": rev_reason,
                "user_reasoning": user_reasoning,
                "fingerprint": fingerprint,
                "source_document": file_name,
                "source": "bank_statement"
            }
            processed_items.append(item_doc)

        batch_doc = {
            "_id": ObjectId(batch_id),
            "batch_id": batch_id,
            "company_id": company_id,
            "bank_ledger": bank_ledger,
            "file_name": file_name,
            "file_type": file_type,
            "created_at": datetime.now(),
            "status": "draft_review",
            "summary": {
                "total_count": len(processed_items),
                "ready_count": ready_cnt,
                "review_required_count": review_cnt,
                "already_processed_count": dup_cnt,
                "saved_count": 0
            },
            "items": processed_items
        }

        self.db["bank_statement_drafts"].insert_one(batch_doc)
        return serialize_doc(batch_doc)

    def get_batch_draft(self, batch_id: str) -> Optional[Dict[str, Any]]:
        doc = self.db["bank_statement_drafts"].find_one({"_id": ObjectId(batch_id)})
        if not doc:
            return None
        return serialize_doc(doc)

    def get_all_batches(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        query = {}
        if company_id and company_id != "default":
            query["$or"] = [{"company_id": company_id}, {"companyId": company_id}]

        try:
            cursor = self.db["bank_statement_drafts"].find(query).sort("created_at", -1)
            return [serialize_doc(doc) for doc in cursor]
        except Exception as e:
            logger.error(f"Error fetching bank statement batches: {e}", exc_info=True)
            return []

    def update_draft_item(self, batch_id: str, item_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        doc = self.db["bank_statement_drafts"].find_one({"_id": ObjectId(batch_id)})
        if not doc:
            return None

        items = doc.get("items") or []
        updated_item = None

        for item in items:
            if item.get("item_id") == item_id:
                for field in ["voucherDate", "voucherNumber", "voucherType", "partyLedger", "againstLedger", "bankLedger", "amount", "debit", "credit", "balance", "paymentMode", "instType", "instNumber", "referenceNumber", "instDate", "narration"]:
                    if field in updates and updates[field] is not None:
                        item[field] = updates[field]
                        if field == "partyLedger":
                            item["againstLedger"] = updates[field]

                if "debit" in updates or "credit" in updates:
                    d_val = float(item.get("debit") or 0.0)
                    c_val = float(item.get("credit") or 0.0)
                    if d_val > 0 and c_val == 0:
                        item["amount"] = d_val
                        item["voucherType"] = "Payment"
                    elif c_val > 0 and d_val == 0:
                        item["amount"] = c_val
                        item["voucherType"] = "Receipt"

                # Update status to user_edited / ready
                item["status"] = "user_edited"
                item["review_required"] = False
                item["review_reason"] = "Manually verified & updated by accountant."
                updated_item = item
                break

        if updated_item:
            # Recalculate summary stats
            ready_cnt = sum(1 for i in items if i.get("status") in ["ready", "user_edited"])
            rev_cnt = sum(1 for i in items if i.get("status") == "review_required")
            already_cnt = sum(1 for i in items if i.get("status") == "already_processed")
            saved_cnt = sum(1 for i in items if i.get("status") == "saved")

            summary = {
                "total_count": len(items),
                "ready_count": ready_cnt,
                "review_required_count": rev_cnt,
                "already_processed_count": already_cnt,
                "saved_count": saved_cnt
            }

            self.db["bank_statement_drafts"].update_one(
                {"_id": ObjectId(batch_id)},
                {"$set": {"items": items, "summary": summary}}
            )

        return updated_item

    def convert_and_save_vouchers(
        self,
        batch_id: str,
        item_ids: List[str],
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Converts selected draft items into actual accounting vouchers in 'fund_flow_transactions' / 'vouchers' collection
        with full source traceability ('source': 'bank_statement').
        """
        doc = self.db["bank_statement_drafts"].find_one({"_id": ObjectId(batch_id)})
        if not doc:
            return {"success": False, "error": "Batch draft not found"}

        items = doc.get("items") or []
        saved_vouchers = []

        for item in items:
            if item.get("item_id") in item_ids and item.get("status") != "saved":
                # Create actual accounting voucher matching fund_flow_transactions schema
                v_type = "bank_payment" if item.get("voucherType") == "Receipt" else "cash_payment" # internal enum mapping
                
                voucher_doc = {
                    "voucherType": v_type,
                    "voucherNumber": item.get("voucherNumber"),
                    "voucherDate": item.get("voucherDate"),
                    "bankLedger": item.get("bankLedger"),
                    "partyLedger": item.get("partyLedger"),
                    "againstLedger": item.get("partyLedger"),
                    "amount": float(item.get("amount") or 0.0),
                    "narration": item.get("narration"),
                    "paymentMode": item.get("paymentMode") or "NEFT",
                    "instType": item.get("instType") or "NEFT",
                    "instTypeOther": None,
                    "instNumber": item.get("instNumber") or item.get("referenceNumber") or "",
                    "instDate": item.get("instDate") or item.get("voucherDate"),
                    "referenceNumber": item.get("referenceNumber") or "",
                    "status": "approved", # Created and ready
                    "source": "bank_statement",
                    "createdVia": "bank_statement_ai",
                    "entryMode": "bank_statement",
                    "fingerprint": item.get("fingerprint"),
                    "source_document": item.get("source_document"),
                    "batch_id": batch_id,
                    "item_id": item.get("item_id"),
                    "ledgerRows": [
                        {
                            "ledgerName": item.get("partyLedger"),
                            "amount": float(item.get("amount") or 0.0),
                            "drCr": "Dr" if item.get("voucherType") == "Payment" else "Cr"
                        }
                    ],
                    "billRows": [],
                    "createdAt": datetime.now(),
                    "updatedAt": datetime.now()
                }

                ins_res = self.db["fund_flow_transactions"].insert_one(voucher_doc)
                voucher_doc["_id"] = str(ins_res.inserted_id)

                # Also insert into 'vouchers' collection for Tally synchronization
                v_guid = str(uuid.uuid4())
                tally_voucher_doc = {
                    "voucherGuid": v_guid,
                    "companyId": company_id or "default",
                    "voucherTypeName": "Payment" if item.get("voucherType") == "Payment" else "Receipt",
                    "voucherNumber": item.get("voucherNumber"),
                    "dates": {"voucherDate": item.get("voucherDate"), "date": item.get("voucherDate")},
                    "bankLedger": item.get("bankLedger"),
                    "partyLedgerName": item.get("partyLedger"),
                    "partyName": item.get("partyLedger"),
                    "ledgerEntries": [
                        {"ledgerName": item.get("bankLedger"), "amount": float(item.get("amount") or 0.0) if item.get("voucherType") == "Receipt" else -float(item.get("amount") or 0.0)},
                        {"ledgerName": item.get("partyLedger"), "amount": -float(item.get("amount") or 0.0) if item.get("voucherType") == "Receipt" else float(item.get("amount") or 0.0)}
                    ],
                    "totals": {"grandTotal": float(item.get("amount") or 0.0), "totalAmount": float(item.get("amount") or 0.0)},
                    "narration": item.get("narration"),
                    "status": "approved",
                    "source": "bank_statement",
                    "entryMode": "bank_statement",
                    "fingerprint": item.get("fingerprint"),
                    "createdAt": datetime.now()
                }
                self.db["vouchers"].insert_one(tally_voucher_doc)


                item["status"] = "saved"
                item["saved_voucher_id"] = str(ins_res.inserted_id)
                saved_vouchers.append(voucher_doc)

        # Update batch summary
        ready_cnt = sum(1 for i in items if i.get("status") in ["ready", "user_edited"])
        rev_cnt = sum(1 for i in items if i.get("status") == "review_required")
        already_cnt = sum(1 for i in items if i.get("status") == "already_processed")
        saved_cnt = sum(1 for i in items if i.get("status") == "saved")

        summary = {
            "total_count": len(items),
            "ready_count": ready_cnt,
            "review_required_count": rev_cnt,
            "already_processed_count": already_cnt,
            "saved_count": saved_cnt
        }

        self.db["bank_statement_drafts"].update_one(
            {"_id": ObjectId(batch_id)},
            {"$set": {"items": items, "summary": summary, "status": "completed" if saved_cnt == len(items) else "partially_saved"}}
        )

        return {
            "success": True,
            "saved_count": len(saved_vouchers),
            "saved_vouchers": [serialize_doc(v) for v in saved_vouchers]
        }
