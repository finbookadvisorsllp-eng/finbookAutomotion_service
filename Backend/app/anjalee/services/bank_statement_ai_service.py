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
from app.anjalee.services.bank_pattern_engine import (
    NarrationNormalizationService,
    RulesBasedMatchingService,
    PartyLedgerResolutionService,
    AIPatternDiscoveryService,
    PatternFeedbackService,
)

logger = logging.getLogger("bank_statement_ai_service")

ocr_service = OcrService()


class BankStatementAIService:
    def __init__(self, db):
        self.db = db

    def extract_raw_statement_text(self, file_path: str, file_type: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Extract raw text / grid rows from PDF, Excel, or CSV statement files.
        Primary: High-accuracy structured multi-page PDF table parser (preserves exact columns & wrapped narrations).
        Fallback: RapidOCR via OcrService for scanned/image PDFs without digital tables.
        Returns (full_text_or_grid, raw_rows_structure).
        """
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in [".xlsx", ".xls"]:
            return self._extract_excel_statement(file_path)
        elif ext == ".csv":
            return self._extract_csv_statement(file_path)
        else:
            # 1. First try structured multi-page PDF table parser (100% accurate column mapping)
            try:
                pdf_txs = self.parse_pdf_statement_file(file_path)
                if pdf_txs and len(pdf_txs) > 0:
                    logger.info(f"Structured PDF table parser extracted {len(pdf_txs)} transactions across all pages!")
                    return "", pdf_txs
            except Exception as pe:
                logger.warning(f"Structured PDF table parser encountered error: {pe}. Falling back to RapidOCR.")

            # 2. Fallback to RapidOCR for scanned / image statements
            ocr_res = ocr_service.process_document(file_path, "pdf")
            pages = ocr_res.get("pages", [])
            full_text = "\n\n".join(
                f"[Page {p.get('page_number', i+1)}]\n{p.get('text', '')}"
                for i, p in enumerate(pages)
                if p.get("text", "").strip()
            )

            # Try structured line extraction from OCR pages if available
            structured_txs = self.extract_transactions_from_ocr_pages(pages)
            if structured_txs and len(structured_txs) > 0:
                logger.info(f"RapidOCR extracted {len(structured_txs)} transactions across all pages!")
                return full_text, structured_txs

            return full_text, []

    def extract_transactions_from_ocr_pages(self, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Extracts structured bank transaction rows across all pages directly from OCR words and coordinates.
        Groups words by line band and parses date, narration, debit/credit, amounts, and running balance.
        """
        import itertools
        date_pattern = re.compile(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b')
        amt_pattern = re.compile(r'(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})|\d+\.\d{2})')

        transactions = []
        for p in pages:
            p_num = p.get('page_number', 1)
            words = p.get('words', [])
            if not words:
                continue

            sorted_words = sorted(
                words,
                key=lambda w: (
                    round(w.get('box', [[0, 0]])[0][1] / 6) * 6,
                    w.get('box', [[0, 0]])[0][0]
                )
            )

            for _, g in itertools.groupby(sorted_words, key=lambda w: round(w.get('box', [[0, 0]])[0][1] / 6) * 6):
                group_words = list(g)
                row_text = ' '.join(str(w.get('text', '')) for w in group_words).strip()
                dm = date_pattern.search(row_text)
                if not dm:
                    continue

                amounts = amt_pattern.findall(row_text)
                if not amounts:
                    continue

                lower_line = row_text.lower()
                if any(h in lower_line for h in ['opening balance', 'closing balance', 'total debit', 'total credit', 'page ']):
                    continue

                raw_date_str = dm.group(1)
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

                nums = []
                for a in amounts:
                    val_str = a.replace(',', '')
                    try:
                        v = float(val_str)
                        if v > 0:
                            nums.append(v)
                    except ValueError:
                        pass

                if not nums:
                    continue

                is_credit = ' cr' in lower_line or 'credit' in lower_line or 'deposit' in lower_line
                tx_type = "credit" if is_credit else "debit"
                amt_val = nums[0]
                bal_val = nums[-1] if len(nums) > 1 else None

                ref_match = re.search(r'\b(UTR\w+|NEFT\w+|UPI\w+|INB\w+|CHQ\d+|\d{6,12})\b', row_text, re.IGNORECASE)
                ref_no = ref_match.group(1) if ref_match else None

                transactions.append({
                    "date": fmt_date,
                    "narration": row_text,
                    "debit": 0.0 if is_credit else round(amt_val, 2),
                    "credit": round(amt_val, 2) if is_credit else 0.0,
                    "amount": round(amt_val, 2),
                    "type": tx_type,
                    "balance": round(bal_val, 2) if bal_val else None,
                    "referenceNumber": ref_no,
                    "page": p_num
                })

        return transactions

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

    def extract_transaction_type(self, narration: str, tx: Optional[Dict[str, Any]] = None) -> str:
        """Extract clean transaction type code (UPI, NEFT, RTGS, IMPS, CLG, INFT, CHEQUE, CASH)."""
        if not narration:
            return "Bank Transfer"
        n = narration.upper()
        if n.startswith("UPI/") or "/UPI/" in n or "@" in n:
            return "UPI"
        if n.startswith("CLG/") or "/CLG/" in n:
            return "CLG"
        if "NEFT" in n:
            return "NEFT"
        if "RTGS" in n:
            return "RTGS"
        if "IMPS" in n:
            return "IMPS"
        if "INF/" in n or "INFT" in n:
            return "INFT"
        if "CHQ" in n or "CHEQUE" in n:
            return "CHEQUE"
        if "CASH" in n or "WDL" in n or "ATM" in n:
            return "CASH"
        if "CHG" in n or "CHARGE" in n or "FEE" in n:
            return "CHARGES"
        if "INT" in n or "INTEREST" in n:
            return "INTEREST"
        return "Bank Transfer"

    def extract_party_candidate(self, narration: str) -> Optional[str]:
        if not narration:
            return None
        from app.anjalee.services.bank_pattern_engine import RegexPositionalExtractor
        cand, _ = RegexPositionalExtractor.extract_party(narration)
        return cand

    @staticmethod
    def resolve_tally_bank_trans_type(channel_or_mode: str, payment_mode: Optional[str] = None) -> str:
        """
        Maps payment mode / channel code to verified Tally TRANSACTIONTYPE:
        - 'Inter Bank Transfer' (NEFT, RTGS, IMPS, UPI, INFT, online transfers)
        - 'Cheque/DD' (Cheque, DD, Clearing, CLG)
        - 'Same Bank Transfer' (Internal contra or transfer within same bank)
        - 'Others' (Cash deposit, ATM, Card, Charges, etc.)
        """
        combined = f"{channel_or_mode or ''} {payment_mode or ''}".upper().strip()
        if any(k in combined for k in ["UPI", "NEFT", "RTGS", "IMPS", "INFT", "INF", "E-TRANSFER", "NETBANKING", "IB"]):
            return "Inter Bank Transfer"
        if any(k in combined for k in ["CHQ", "CHEQUE", "DD", "CLG", "CLEARING"]):
            return "Cheque/DD"
        if any(k in combined for k in ["SAME BANK", "INTERNAL", "CONTRA"]):
            return "Same Bank Transfer"
        if any(k in combined for k in ["CASH", "ATM", "WDL", "CHG", "FEE", "CHARGE"]):
            return "Others"
        return "Inter Bank Transfer"

    @staticmethod
    def extract_clean_reference(narration: str, ref_no: Optional[str] = None) -> Optional[str]:
        """
        Extracts clean UTR, Cheque Number, or transaction reference from bank narration or existing ref_no.
        Avoids taking the full narration or internal voucher numbers as the reference.
        """
        if ref_no:
            ref_clean = str(ref_no).strip()
            if 3 <= len(ref_clean) <= 30 and ' ' not in ref_clean and not ref_clean.startswith("REC-") and not ref_clean.startswith("BS-"):
                return ref_clean

        if not narration:
            if ref_no and not str(ref_no).startswith("REC-") and not str(ref_no).startswith("BS-"):
                return str(ref_no).strip()
            return None

        text = str(narration).strip()
        utr_m = re.search(r'\bUTR[:/\-\s]*([A-Za-z0-9]{8,24})\b', text, re.I)
        if utr_m:
            return utr_m.group(1).strip()

        ref_m = re.search(r'\b(?:NEFT|RTGS|IMPS|CMS|INFT|IFT|TRF|IBT|TRANSFER)[/:\-\s]+([A-Za-z0-9]{8,24})\b', text, re.I)
        if ref_m:
            return ref_m.group(1).strip()

        upi_m = re.search(r'\b(?:UPI|RRN)[/:\-\s]*(\d{12})\b', text, re.I)
        if upi_m:
            return upi_m.group(1).strip()

        chq_m = re.search(r'\b(?:CHQ|CHEQUE|CLG)[/:\-\s]*(\d{6,8})\b', text, re.I)
        if chq_m:
            return chq_m.group(1).strip()

        # Match bank UTR pattern: 3 to 6 uppercase letters followed by 8 to 18 digits (e.g. ESFBH24402830890)
        gen_m = re.search(r'\b([A-Z]{3,6}\d{8,18})\b', text)
        if gen_m:
            return gen_m.group(1).strip()

        # Match alphanumeric reference tokens (10-24 chars containing both digits and letters)
        for token in re.split(r'[/:\-\s]+', text):
            t = token.strip()
            if 10 <= len(t) <= 24 and any(c.isdigit() for c in t) and any(c.isalpha() for c in t):
                if not any(stop in t.upper() for stop in ["ACCOUNT", "LIMITED", "PRIVATE", "TRANSFER", "PAYMENT"]):
                    return t

        if ref_no and not str(ref_no).startswith("REC-") and not str(ref_no).startswith("BS-"):
            return str(ref_no).strip()

        return None

    @staticmethod
    def classify_voucher_type(
        direction: str,
        counterpart_group: str,
        counterpart_name: str = "",
        narration: str = ""
    ) -> Tuple[str, bool, str]:
        """
        Determines 'Receipt', 'Payment', or 'Contra' based on accounting rules:
        1. Internal transfer between company's own Bank/Cash accounts -> Contra
        2. Sundry Debtors (customer) with deposit -> Receipt
        3. Sundry Creditors (supplier) with withdrawal -> Payment
        4. Expense accounts -> Payment
        5. Income accounts -> Receipt
        Returns (voucher_type, is_ambiguous, reason).
        """
        grp = (counterpart_group or "").lower()
        c_name = (counterpart_name or "").lower()
        is_deposit = (direction.lower() == "credit")

        # 1. Internal Bank/Cash Accounts -> Contra
        is_bank_or_cash = any(k in grp for k in ["bank accounts", "bank account", "bank occ", "bank od", "cash-in-hand", "cash in hand"]) or \
                          any(k in c_name for k in ["cash account", "petty cash"])
        if is_bank_or_cash:
            return "Contra", False, "Transfer between company's own Bank / Cash accounts (Contra)."

        # 2. Sundry Debtors (Customers)
        if "sundry debtors" in grp or "debtor" in grp:
            if is_deposit:
                return "Receipt", False, "Customer payment received into bank (Receipt)."
            else:
                return "Payment", True, "Debit transaction against customer ledger (Payment / Refund - Review Recommended)."

        # 3. Sundry Creditors (Vendors/Suppliers)
        if "sundry creditors" in grp or "creditor" in grp:
            if not is_deposit:
                return "Payment", False, "Supplier payment made from bank (Payment)."
            else:
                return "Receipt", True, "Credit transaction from supplier ledger (Receipt / Refund - Review Recommended)."

        # 4. Expense Accounts -> Payment
        if any(k in grp for k in ["expense", "charges", "expenditure", "loss"]):
            return "Payment", False, f"Bank expense allocated to '{counterpart_name}' (Payment)."

        # 5. Income Accounts -> Receipt
        if any(k in grp for k in ["income", "revenue", "interest", "gain"]):
            return "Receipt", False, f"Bank income allocated to '{counterpart_name}' (Receipt)."

        # Default fallback strictly by bank direction
        if is_deposit:
            return "Receipt", False, "Deposit into bank account (Receipt)."
        else:
            return "Payment", False, "Withdrawal from bank account (Payment)."

    def get_party_outstanding_bills(
        self,
        party_ledger: str,
        voucher_type: str,
        company_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves real outstanding bills for a party from:
        - sales_vouchers (for Receipt / Customers)
        - purchase_vouchers (for Payment / Suppliers)
        - vouchers (Tally synced Sales/Purchase records)
        """
        if not party_ledger:
            return []

        pending_bills = []
        seen_bills = set()
        v_type_lower = (voucher_type or "").lower()

        def calc_paid_amount(bill_ref: str) -> float:
            total_paid = 0.0
            try:
                v_cursor = self.db["vouchers"].find({
                    "status": {"$ne": "CANCELLED"},
                    "ledgerEntries.billAllocations.name": bill_ref
                })
                for vch in v_cursor:
                    for entry in vch.get("ledgerEntries") or []:
                        for b in entry.get("billAllocations") or []:
                            if b.get("name") == bill_ref:
                                total_paid += abs(float(b.get("amount") or 0.0))
            except Exception:
                pass
            return total_paid

        p_regex = {"$regex": f"^{re.escape(party_ledger)}$", "$options": "i"}

        if "receipt" in v_type_lower:
            try:
                cursor = self.db["sales_vouchers"].find({
                    "$or": [{"partyLedgerName": p_regex}, {"partyName": p_regex}, {"partyLedger": p_regex}],
                    "isDeleted": {"$ne": True}
                }).sort("createdAt", 1).limit(50)

                for sv in cursor:
                    bill_no = sv.get("voucherNumber") or sv.get("invoiceNumber") or ""
                    if not bill_no or bill_no in seen_bills:
                        continue
                    totals = sv.get("totals") or {}
                    bill_amt = float(totals.get("grandTotal") or totals.get("totalAmount") or sv.get("grandTotal") or sv.get("total_amount") or 0.0)
                    if bill_amt <= 0:
                        continue
                    paid_amt = sv.get("paid_amount") or sv.get("paidAmount")
                    if paid_amt is None:
                        paid_amt = calc_paid_amount(bill_no)
                    else:
                        paid_amt = float(paid_amt)

                    outstanding = round(bill_amt - paid_amt, 2)
                    if outstanding > 0.01:
                        seen_bills.add(bill_no)
                        pending_bills.append({
                            "name": bill_no,
                            "billNo": bill_no,
                            "date": sv.get("voucherDate") or str(sv.get("createdAt"))[:10],
                            "billAmount": bill_amt,
                            "paidAmount": paid_amt,
                            "pendingAmount": outstanding,
                            "billType": "Agst Ref",
                            "source": "sales_vouchers"
                        })
            except Exception as e:
                logger.warning(f"Error querying sales_vouchers for outstanding bills: {e}")

            try:
                tally_sales = self.db["vouchers"].find({
                    "$or": [{"partyLedgerName": p_regex}, {"partyName": p_regex}],
                    "voucherTypeName": {"$regex": "sale", "$options": "i"},
                    "isDeleted": {"$ne": True}
                }).sort("dates.date", 1).limit(50)

                for tv in tally_sales:
                    bill_no = tv.get("voucherNumber") or ""
                    if not bill_no or bill_no in seen_bills:
                        continue
                    totals = tv.get("totals") or {}
                    bill_amt = float(totals.get("grandTotal") or totals.get("totalAmount") or tv.get("amount") or 0.0)
                    if bill_amt <= 0:
                        continue
                    paid_amt = calc_paid_amount(bill_no)
                    outstanding = round(bill_amt - paid_amt, 2)
                    if outstanding > 0.01:
                        seen_bills.add(bill_no)
                        pending_bills.append({
                            "name": bill_no,
                            "billNo": bill_no,
                            "date": tv.get("dates", {}).get("voucherDate") if isinstance(tv.get("dates"), dict) else "",
                            "billAmount": bill_amt,
                            "paidAmount": paid_amt,
                            "pendingAmount": outstanding,
                            "billType": "Agst Ref",
                            "source": "vouchers"
                        })
            except Exception as e:
                logger.warning(f"Error querying vouchers for sales bills: {e}")
        else:
            try:
                cursor = self.db["purchase_vouchers"].find({
                    "$or": [{"partyLedger": p_regex}, {"partyLedgerName": p_regex}, {"partyName": p_regex}],
                    "isDeleted": {"$ne": True}
                }).sort("createdAt", 1).limit(50)

                for pv in cursor:
                    bill_no = pv.get("voucherNumber") or pv.get("invoiceNumber") or ""
                    if not bill_no or bill_no in seen_bills:
                        continue
                    totals = pv.get("totals") or {}
                    bill_amt = float(totals.get("grandTotal") or totals.get("totalAmount") or pv.get("grandTotal") or pv.get("total_amount") or 0.0)
                    if bill_amt <= 0:
                        continue
                    paid_amt = pv.get("paid_amount") or pv.get("paidAmount")
                    if paid_amt is None:
                        paid_amt = calc_paid_amount(bill_no)
                    else:
                        paid_amt = float(paid_amt)

                    outstanding = round(bill_amt - paid_amt, 2)
                    if outstanding > 0.01:
                        seen_bills.add(bill_no)
                        pending_bills.append({
                            "name": bill_no,
                            "billNo": bill_no,
                            "date": pv.get("voucherDate") or str(pv.get("createdAt"))[:10],
                            "billAmount": bill_amt,
                            "paidAmount": paid_amt,
                            "pendingAmount": outstanding,
                            "billType": "Agst Ref",
                            "source": "purchase_vouchers"
                        })
            except Exception as e:
                logger.warning(f"Error querying purchase_vouchers for outstanding bills: {e}")

            try:
                tally_pur = self.db["vouchers"].find({
                    "$or": [{"partyLedgerName": p_regex}, {"partyName": p_regex}],
                    "voucherTypeName": {"$regex": "purchase", "$options": "i"},
                    "isDeleted": {"$ne": True}
                }).sort("dates.date", 1).limit(50)

                for tv in tally_pur:
                    bill_no = tv.get("voucherNumber") or ""
                    if not bill_no or bill_no in seen_bills:
                        continue
                    totals = tv.get("totals") or {}
                    bill_amt = float(totals.get("grandTotal") or totals.get("totalAmount") or tv.get("amount") or 0.0)
                    if bill_amt <= 0:
                        continue
                    paid_amt = calc_paid_amount(bill_no)
                    outstanding = round(bill_amt - paid_amt, 2)
                    if outstanding > 0.01:
                        seen_bills.add(bill_no)
                        pending_bills.append({
                            "name": bill_no,
                            "billNo": bill_no,
                            "date": tv.get("dates", {}).get("voucherDate") if isinstance(tv.get("dates"), dict) else "",
                            "billAmount": bill_amt,
                            "paidAmount": paid_amt,
                            "pendingAmount": outstanding,
                            "billType": "Agst Ref",
                            "source": "vouchers"
                        })
            except Exception as e:
                logger.warning(f"Error querying vouchers for purchase bills: {e}")

        return pending_bills

    def match_bills_for_transaction(
        self,
        party_ledger: str,
        voucher_type: str,
        amount: float,
        narration: str = "",
        ref_no: Optional[str] = None,
        company_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Matches bank payment/receipt against party's outstanding bills.
        1. Reference Match (narration or ref_no mentions bill number)
        2. Exact Amount Match (single bill has exact matching pending amount)
        3. FIFO / Oldest First Allocation (partial / multi-bill settlement)
        4. On Account Fallback (if no bill found, avoids fake invoice numbers)
        """
        if not party_ledger or amount <= 0:
            return []

        if voucher_type.lower() == "contra":
            return []

        pending_bills = self.get_party_outstanding_bills(party_ledger, voucher_type, company_id=company_id)
        if not pending_bills:
            return [{
                "name": "On Account",
                "billType": "On Account",
                "amount": round(amount, 2)
            }]

        remaining_to_allocate = round(amount, 2)
        allocations = []

        # Strategy 1: Check if narration or ref_no directly mentions a bill number
        search_text = f"{narration} {ref_no or ''}".upper()
        for bill in pending_bills:
            b_name = bill["name"].upper()
            if b_name and len(b_name) >= 3 and b_name in search_text:
                alloc_amt = min(remaining_to_allocate, bill["pendingAmount"])
                allocations.append({
                    "name": bill["name"],
                    "billType": "Agst Ref",
                    "amount": round(alloc_amt, 2),
                    "pendingAmount": bill["pendingAmount"]
                })
                remaining_to_allocate = round(remaining_to_allocate - alloc_amt, 2)
                if remaining_to_allocate <= 0:
                    return allocations

        # Strategy 2: Exact Amount Match
        if not allocations:
            for bill in pending_bills:
                if abs(bill["pendingAmount"] - amount) < 0.01:
                    return [{
                        "name": bill["name"],
                        "billType": "Agst Ref",
                        "amount": round(amount, 2),
                        "pendingAmount": bill["pendingAmount"]
                    }]

        # Strategy 3: FIFO / Oldest First Allocation
        for bill in pending_bills:
            if any(a["name"] == bill["name"] for a in allocations):
                continue
            if remaining_to_allocate <= 0:
                break
            alloc_amt = min(remaining_to_allocate, bill["pendingAmount"])
            allocations.append({
                "name": bill["name"],
                "billType": "Agst Ref",
                "amount": round(alloc_amt, 2),
                "pendingAmount": bill["pendingAmount"]
            })
            remaining_to_allocate = round(remaining_to_allocate - alloc_amt, 2)

        # If any remaining amount after allocating all pending bills, put remaining On Account
        if remaining_to_allocate > 0.01:
            allocations.append({
                "name": "On Account",
                "billType": "On Account",
                "amount": round(remaining_to_allocate, 2)
            })

        return allocations

    def get_company_name(self, company_id: Optional[str] = None) -> str:
        """Resolves active Tally company name from MongoDB 'companies' collection."""
        try:
            if company_id and company_id != "default":
                comp_q = {
                    "$or": [
                        {"_id": ObjectId(company_id)} if ObjectId.is_valid(str(company_id)) else {"companyId": company_id},
                        {"companyId": company_id},
                        {"id": company_id}
                    ]
                }
                doc = self.db["companies"].find_one(comp_q)
                if doc:
                    return doc.get("companyName") or doc.get("name") or doc.get("basicCompantFormalName") or doc.get("formalName") or "Your Company Name"
            doc = self.db["companies"].find_one()
            if doc:
                return doc.get("companyName") or doc.get("name") or doc.get("basicCompantFormalName") or doc.get("formalName") or "Your Company Name"
        except Exception:
            pass
        return "Your Company Name"

    def generate_preview_xml(self, voucher_data: Dict[str, Any], company_name: str) -> str:
        """Generates real Tally XML preview for draft item using central VoucherMapper and TallyXmlGenerator."""
        try:
            from app.anjalee.services.tally.voucher_mapper import VoucherMapper
            from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
            tally_vch = VoucherMapper.map_to_tally_voucher(voucher_data, company_name)
            return TallyXmlGenerator.generate_xml(tally_vch)
        except Exception as e:
            logger.warning(f"Could not pre-generate XML preview: {e}")
            return ""

    def match_ledger_and_categorize(
        self,
        transaction: Dict[str, Any],
        bank_ledger: str,
        company_masters: List[Dict[str, Any]],
        match_cache: Optional[Dict[str, Any]] = None,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uses RulesBasedMatchingService (Engine A) and PartyLedgerResolutionService to categorize:
        1. voucherType ("Receipt", "Payment", "Contra") based on direction & counterpart group
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

        is_credit = credit_val > 0 or tx_type == "credit" or "received" in narration.lower()
        direction = "credit" if is_credit else "debit"
        initial_v_type = "Receipt" if is_credit else "Payment"

        cache_key = f"{direction}|{narration.lower()}"
        if match_cache is not None and cache_key in match_cache:
            return match_cache[cache_key]

        # ── Step 1: Check Deterministic Bank Mapping Rules First via Engine A ──
        try:
            rules_svc = RulesBasedMatchingService(self.db)
            applicable_rules = rules_svc.get_applicable_rules(bank_ledger, company_id)
            rule_match = rules_svc.match_transaction(narration, amt, is_credit, applicable_rules)

            if rule_match:
                sel_ledger = rule_match.get("partyLedger")
                counterpart_grp = ""
                for m in company_masters:
                    if (m.get("ledgerName") or m.get("name") or "").lower() == (sel_ledger or "").lower():
                        counterpart_grp = m.get("group") or ""
                        break

                rule_v_type = rule_match.get("voucherType")
                if not rule_v_type or rule_v_type.lower() == "auto":
                    classified_v_type, is_amb, class_reason = self.classify_voucher_type(direction, counterpart_grp, sel_ledger, narration)
                else:
                    classified_v_type = rule_v_type
                    is_amb = False
                    class_reason = f"Explicitly configured as {rule_v_type} in Bank Rule."

                has_conflict = rule_match.get("hasConflict", False)
                conf_val = float(rule_match.get("confidence", 100))
                if not has_conflict and conf_val >= 90:
                    is_amb = False

                # CRITICAL: If the rule matched only for voucher type (no partyLedger resolved),
                # the confidence must reflect this — it is NOT a complete match.
                # Cap confidence at 65% when no counterpart ledger is found via rule.
                if not sel_ledger:
                    conf_val = min(conf_val, 65.0)

                res_obj = {
                    "voucher_type": classified_v_type,
                    "selected_ledger": sel_ledger,
                    "confidence": conf_val,
                    "review_required": has_conflict or is_amb or not sel_ledger,
                    "review_reason": f"Conflicting rules: {', '.join(rule_match.get('conflictingLedgers', []))}" if rule_match.get("hasConflict") else (
                        f"Bank rule matched voucher type but party ledger not found. Please select counterpart ledger."
                        if not sel_ledger else class_reason
                    ),
                    "user_reasoning": rule_match.get("reasoning") or f"Rule match: '{rule_match.get('matchedPattern')}' -> '{sel_ledger}' ({classified_v_type})."
                }
                if match_cache is not None:
                    match_cache[cache_key] = res_obj
                return res_obj
        except Exception as e:
            logger.warning(f"Error checking bank rules via RulesBasedMatchingService: {e}")

        # ── Step 2: Master-First Reverse Token Matching & Party Extraction ──
        norm = NarrationNormalizationService.normalize_text(narration)
        channel, channel_conf = NarrationNormalizationService.detect_channel(narration)
        party_cand = None
        sel_ledger = None
        match_score = 0.0

        # Load known customer party aliases from DB
        known_aliases = {}
        try:
            alias_q = {"companyId": company_id} if company_id else {}
            for a in self.db["bank_party_aliases"].find(alias_q):
                p_name = (a.get("partyName") or "").strip().lower()
                r_ledger = (a.get("resolvedLedger") or "").strip()
                if p_name and r_ledger:
                    known_aliases[p_name] = r_ledger
        except Exception:
            pass

        # Dynamic Token Matching directly against Company Master Ledgers
        from app.anjalee.services.bank_pattern_engine import PatternDiscoveryEngine, RegexPositionalExtractor
        cand_seps = ['/', '-', ':', '|', ';']
        sep_counts = {s: norm.count(s) for s in cand_seps}
        best_sep = max(cand_seps, key=lambda s: sep_counts[s])
        sep = best_sep if sep_counts[best_sep] >= 2 else ('/' if '/' in norm else ('-' if '-' in norm else (' ' if ' ' in norm else '/')))
        raw_tokens = [t.strip() for t in (re.split(r'\s+', norm) if sep == ' ' else norm.split(sep)) if t.strip()]

        # Also get the positional party candidate from RegexPositionalExtractor first
        # This gives us the correct party position (index 1 in CLG/PARTY/CHEQUE/BANK_CODE narrations)
        positional_party_cand, positional_conf = RegexPositionalExtractor.extract_party(narration)

        for idx, t in enumerate(raw_tokens):
            m_res = PatternDiscoveryEngine.match_token_against_masters(
                t, company_masters=company_masters, known_aliases=known_aliases, bank_ledger=bank_ledger
            )
            if m_res:
                # Extra guard: make sure the matched token is not just a short bank code (3-4 chars)
                # that could be an IFSC prefix appearing at a non-party position in the narration.
                # Prefer the positional party candidate if it exists and is at an earlier index
                # than the matched token — positional extraction is more reliable for structured narrations.
                token_up = t.strip().upper()
                token_idx_in_narration = idx
                positional_idx = -1
                if positional_party_cand:
                    # Find what index the positional candidate appears at
                    for pi, pt in enumerate(raw_tokens):
                        if pt.strip().upper() == positional_party_cand.strip().upper():
                            positional_idx = pi
                            break

                # Skip this token match if it looks like a bank code (3-4 uppercase letters)
                # and positional extraction found a party at an earlier or valid position
                is_likely_bank_code = len(token_up) <= 4 and token_up.isalpha() and idx > 1
                if is_likely_bank_code and positional_party_cand and (positional_idx < 0 or positional_idx <= idx):
                    # Don't use this bank-code match; continue to find better token
                    continue

                sel_ledger = m_res["ledger"]
                party_cand = t.strip()
                match_score = float(m_res["score"])
                break

        resolution_svc = PartyLedgerResolutionService(self.db)
        if sel_ledger:
            # Use positional party candidate as extractedParty (the actual party name from narration)
            # rather than the raw matched token (which might be a bank code or truncated value)
            if positional_party_cand and positional_party_cand.strip().upper() != (party_cand or '').strip().upper():
                party_cand = positional_party_cand
            resolved = {"resolvedLedger": sel_ledger, "confidence": match_score, "isAmbiguous": False}
        else:
            # Fallback to positional candidate extractor and standard resolution
            party_cand = positional_party_cand
            if not party_cand:
                party_cand, extract_conf = NarrationNormalizationService.extract_party_candidate(narration)
            resolved = resolution_svc.resolve_party_ledger(party_cand, narration, company_id, company_masters, ref_number=ref_no)

        if resolved.get("resolvedLedger"):
            sel_ledger = resolved["resolvedLedger"]
            counterpart_grp = ""
            for m in company_masters:
                if (m.get("ledgerName") or m.get("name") or "").lower() == (sel_ledger or "").lower():
                    counterpart_grp = m.get("group") or ""
                    break

            classified_v_type, is_amb, class_reason = self.classify_voucher_type(direction, counterpart_grp, sel_ledger, narration)
            is_ambiguous = resolved.get("isAmbiguous", False)
            conf_val = float(resolved.get("confidence", 85.0))
            if not is_ambiguous and conf_val >= 90:
                is_amb = False

            review_reason = "Ambiguous matches: " + ", ".join(resolved.get("candidates", [])) if is_ambiguous else class_reason

            res_obj = {
                "voucher_type": classified_v_type,
                "selected_ledger": sel_ledger,
                "confidence": conf_val,
                "review_required": is_ambiguous or is_amb,
                "review_reason": review_reason,
                "user_reasoning": f"Extracted party '{party_cand or narration[:20]}' mapped to '{sel_ledger}' as {classified_v_type}. {class_reason}"
            }
            if match_cache is not None:
                match_cache[cache_key] = res_obj
            return res_obj

        # Fallback: Unmapped item requiring user review
        unmapped_reason = resolved.get("unmappedReason") or (
            f"Extracted party '{party_cand}' not found in Tally ledger master. Please select counterpart ledger."
            if party_cand else "No party entity could be identified from bank narration. Please select counterpart ledger."
        )
        res_obj = {
            "voucher_type": initial_v_type,
            "selected_ledger": None,
            "confidence": 45.0,
            "review_required": True,
            "review_reason": unmapped_reason,
            "user_reasoning": f"Channel '{channel}', extracted party '{party_cand or 'None'}'. {unmapped_reason}"
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
            party_cand = self.extract_party_candidate(narration)
            if not party_cand:
                party_cand, _ = NarrationNormalizationService.extract_party_candidate(narration)

            # Match ledger and determine voucher type with cache
            match_res = self.match_ledger_and_categorize(tx, bank_ledger, company_masters, match_cache, company_id=company_id)
            v_type = match_res["voucher_type"]
            sel_ledger = match_res["selected_ledger"]
            conf = match_res["confidence"]
            rev_req = match_res["review_required"]
            rev_reason = match_res["review_reason"]
            user_reasoning = match_res["user_reasoning"]

            # When a ledger was successfully resolved, use it as the extracted party candidate too
            # so that the frontend correctly shows the matched ledger in the party dropdown
            if sel_ledger and not party_cand:
                party_cand = sel_ledger

            # Cap confidence when no party ledger is mapped — rule-only match is incomplete
            if not sel_ledger and conf > 65.0:
                conf = 65.0
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
            elif not sel_ledger or conf < 90 or rev_req:
                status = "review_required"
                rev_req = True
                if not sel_ledger:
                    rev_reason = rev_reason or "Counterpart ledger not mapped; manual review required."
                review_cnt += 1
            else:
                status = "ready"
                rev_req = False
                ready_cnt += 1

            # Clean reference & instrument details
            clean_ref = self.extract_clean_reference(narration, ref_no)
            inst_date_str = tx_date.replace("-", "") if tx_date else datetime.now().strftime("%Y%m%d")
            tally_trans_type = self.resolve_tally_bank_trans_type(narration)

            # Bank Allocation
            bank_alloc_amount = -amt if v_type == "Receipt" else amt
            bank_allocations = [{
                "date": inst_date_str,
                "instrumentDate": inst_date_str,
                "transactionType": tally_trans_type,
                "instrumentNumber": clean_ref or "",
                "amount": round(bank_alloc_amount, 2)
            }]

            # Bill Allocations
            bill_allocations = []
            if sel_ledger and v_type in ["Receipt", "Payment"]:
                bill_allocations = self.match_bills_for_transaction(
                    party_ledger=sel_ledger,
                    voucher_type=v_type,
                    amount=amt,
                    narration=narration,
                    ref_no=clean_ref or ref_no,
                    company_id=company_id
                )

            # Pre-generate XML preview
            comp_name = self.get_company_name(company_id)
            preview_vch_data = {
                "voucherType": v_type,
                "voucherTypeName": v_type,
                "voucherDate": tx_date,
                "voucherNumber": f"BS-{datetime.now().year}-{str(idx+1).zfill(4)}",
                "narration": narration,
                "bankLedger": bank_ledger,
                "partyLedger": sel_ledger or "Unassigned",
                "amount": round(amt, 2),
                "instNumber": clean_ref or "",
                "referenceNumber": clean_ref or "",
                "transType": tally_trans_type,
                "bankAllocations": bank_allocations,
                "billAllocations": bill_allocations
            }
            preview_xml = self.generate_preview_xml(preview_vch_data, comp_name)

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
                "instNumber": clean_ref or ref_no or "",
                "referenceNumber": clean_ref or ref_no or "",
                "instDate": tx_date,
                "narration": narration,
                "transactionType": tally_trans_type,
                "extractedParty": party_cand or self.extract_party_candidate(narration) or "",
                "confidence": conf,
                "status": status,
                "review_required": rev_req,
                "review_reason": rev_reason,
                "user_reasoning": user_reasoning,
                "fingerprint": fingerprint,
                "source_document": file_name,
                "source": "bank_upload",
                "entryMode": "bank_upload",
                "bankAllocations": bank_allocations,
                "billAllocations": bill_allocations,
                "tallyXml": preview_xml,
                "tally_xml": preview_xml
            }
            processed_items.append(item_doc)

        batch_doc = {
            "_id": ObjectId(batch_id),
            "batch_id": batch_id,
            "company_id": company_id,
            "bank_ledger": bank_ledger,
            "file_name": file_name,
            "file_type": file_type,
            "file_path": file_path,
            "created_at": datetime.now(),
            "status": "draft_review",
            "summary": {
                "total_count": len(processed_items),
                "ready_count": ready_cnt,
                "review_required_count": review_cnt,
                "already_processed_count": dup_cnt,
                "saved_count": 0
            },
            "items": processed_items,
            "ledger_mappings": self.build_ledger_mapping_rows(processed_items, db=self.db, company_id=company_id)
        }

        self.db["bank_statement_drafts"].insert_one(batch_doc)

        # Automatic pattern recognition & discovery pipeline on statement upload
        try:
            from app.anjalee.services.bank_pattern_engine import PatternDiscoveryEngine
            discovery_svc = PatternDiscoveryEngine(self.db)
            discovered_patterns = discovery_svc.discover_patterns_from_transactions(
                batch_items=processed_items,
                bank_ledger=bank_ledger,
                company_id=company_id
            )
            for pat in discovered_patterns:
                pat_copy = dict(pat)
                if "created_at" in pat_copy and hasattr(pat_copy["created_at"], "isoformat"):
                    pat_copy["created_at"] = pat_copy["created_at"].isoformat()
                # Pop _id so MongoDB assigns a unique ObjectId or preserves existing _id without conflict
                pat_copy.pop("_id", None)
                self.db["bank_pattern_suggestions"].update_one(
                    {"pattern": pat["pattern"], "bankLedger": bank_ledger},
                    {"$set": pat_copy},
                    upsert=True
                )

            # Apply discovered pattern rules back into any remaining unmapped items in this batch
            items_updated = False
            for pat in discovered_patterns:
                p_pos = pat.get("partyPosition", -1)
                sep = pat.get("separator", "/")
                d_parties = pat.get("distinctParties", [])
                party_map = {dp["party"].lower().strip(): dp["mappedLedger"] for dp in d_parties if dp.get("mappedLedger") and dp["mappedLedger"] != "Unmapped"}

                if p_pos >= 0 and party_map:
                    for it in processed_items:
                        if not it.get("partyLedger") or it.get("status") == "review_required":
                            narr = it.get("narration") or ""
                            norm_it = NarrationNormalizationService.normalize_text(narr)
                            parts = re.split(r'\s+', norm_it) if sep == ' ' else norm_it.split(sep)
                            if 0 <= p_pos < len(parts):
                                cand_txt = parts[p_pos].strip()
                                cand_lower = cand_txt.lower()
                                if cand_lower in party_map:
                                    it["partyLedger"] = party_map[cand_lower]
                                    it["party"] = cand_txt
                                    it["extractedParty"] = cand_txt
                                    it["confidence"] = 95.0
                                    it["status"] = "ready"
                                    it["review_required"] = False
                                    it["review_reason"] = None
                                    it["reasoning"] = f"Auto-mapped via discovered pattern ({pat.get('patternId', 'AI Pattern')} at Index [{p_pos}])"
                                    items_updated = True

            if items_updated:
                ready_cnt = sum(1 for i in processed_items if i.get("status") in ["ready", "user_edited"])
                rev_cnt = sum(1 for i in processed_items if i.get("status") == "review_required")
                batch_doc["summary"]["ready_count"] = ready_cnt
                batch_doc["summary"]["review_required_count"] = rev_cnt
                batch_doc["items"] = processed_items
                batch_doc["ledger_mappings"] = self.build_ledger_mapping_rows(processed_items, db=self.db, company_id=company_id)
                self.db["bank_statement_drafts"].update_one(
                    {"_id": batch_doc["_id"]},
                    {"$set": {
                        "summary": batch_doc["summary"],
                        "items": batch_doc["items"],
                        "ledger_mappings": batch_doc["ledger_mappings"]
                    }}
                )
        except Exception as de:
            logger.warning(f"Automatic pattern discovery on statement upload notice: {de}")

        return serialize_doc(batch_doc)

    def get_batch_draft(self, batch_id: str) -> Optional[Dict[str, Any]]:
        query = {"_id": ObjectId(batch_id)} if len(str(batch_id)) == 24 else {"batch_id": batch_id}
        doc = self.db["bank_statement_drafts"].find_one(query)
        if not doc:
            return None
        items = doc.get("items") or []
        changed = False
        for it in items:
            c = float(it.get("confidence") or 0.0)
            pl = it.get("partyLedger")
            has_pl = bool(pl and str(pl).strip() and str(pl).strip() != "Unmapped")
            current_status = it.get("status")

            if current_status == "ready":
                if c < 90 or not has_pl:
                    it["status"] = "review_required"
                    it["review_required"] = True
                    changed = True
            elif current_status == "review_required":
                # Dynamic promotion: If confidence is >= 90% and counterpart ledger is accurately mapped, promote to ready
                if c >= 90 and has_pl:
                    it["status"] = "ready"
                    it["review_required"] = False
                    changed = True
        if changed:
            ready_cnt = sum(1 for i in items if i.get("status") in ["ready", "user_edited"])
            rev_cnt = sum(1 for i in items if i.get("status") == "review_required")
            already_cnt = sum(1 for i in items if i.get("status") == "already_processed")
            saved_cnt = sum(1 for i in items if i.get("status") == "saved")
            doc["summary"] = {
                "total_count": len(items),
                "ready_count": ready_cnt,
                "review_required_count": rev_cnt,
                "already_processed_count": already_cnt,
                "saved_count": saved_cnt
            }
            try:
                self.db["bank_statement_drafts"].update_one(
                    query,
                    {"$set": {"items": items, "summary": doc["summary"]}}
                )
            except Exception:
                pass
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

    def delete_batch(self, batch_id: str) -> bool:
        """
        Completely deletes a bank statement draft batch from MongoDB
        and removes the uploaded file from disk if present.
        """
        try:
            query = {"_id": ObjectId(batch_id)} if len(str(batch_id)) == 24 else {"batch_id": batch_id}
            doc = self.db["bank_statement_drafts"].find_one(query)
            if not doc:
                return False

            file_path = doc.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.info(f"Deleted local statement file {file_path}")
                except Exception as fe:
                    logger.warning(f"Could not remove statement file {file_path}: {fe}")

            result = self.db["bank_statement_drafts"].delete_one(query)
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting bank statement draft batch {batch_id}: {e}", exc_info=True)
            return False

    def update_draft_item(self, batch_id: str, item_id: str, updates: Dict[str, Any], propagate: bool = True) -> Optional[Dict[str, Any]]:
        doc = self.db["bank_statement_drafts"].find_one({"_id": ObjectId(batch_id)})
        if not doc:
            return None

        items = doc.get("items") or []
        updated_item = None
        target_party_key = None

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
                item["confidence"] = 100.0
                item["review_reason"] = "Manually verified & resolved by accountant."
                updated_item = item
                target_party_key = (item.get("extractedParty") or "").strip()
                break

        if updated_item:
            comp_id = doc.get("company_id") or doc.get("companyId")
            company_name = self.get_company_name(comp_id)

            def refresh_item_allocations(it: Dict[str, Any]):
                p_ledger = it.get("partyLedger") or ""
                v_type = it.get("voucherType") or "Receipt"
                a_val = float(it.get("amount") or 0.0)
                n_val = it.get("narration") or ""
                r_val = it.get("referenceNumber") or it.get("instNumber") or ""
                b_led = it.get("bankLedger") or doc.get("bank_ledger") or "Bank Account"
                c_ref = self.extract_clean_reference(n_val, r_val)
                t_type = self.resolve_tally_bank_trans_type(n_val, it.get("paymentMode"))
                i_date = (it.get("instDate") or it.get("voucherDate") or "").replace("-", "")

                b_amt = -a_val if v_type == "Receipt" else a_val
                it["bankAllocations"] = [{
                    "date": i_date or datetime.now().strftime("%Y%m%d"),
                    "instrumentDate": i_date or datetime.now().strftime("%Y%m%d"),
                    "transactionType": t_type,
                    "instrumentNumber": c_ref or "",
                    "amount": round(b_amt, 2)
                }]

                if p_ledger and v_type in ["Receipt", "Payment"]:
                    it["billAllocations"] = self.match_bills_for_transaction(
                        party_ledger=p_ledger,
                        voucher_type=v_type,
                        amount=a_val,
                        narration=n_val,
                        ref_no=c_ref or r_val,
                        company_id=comp_id
                    )
                else:
                    it["billAllocations"] = []

                pv_data = {
                    "voucherType": v_type,
                    "voucherTypeName": v_type,
                    "voucherDate": it.get("voucherDate"),
                    "voucherNumber": it.get("voucherNumber") or "AUTO",
                    "narration": n_val,
                    "bankLedger": b_led,
                    "partyLedger": p_ledger or "Unassigned",
                    "amount": round(a_val, 2),
                    "instNumber": c_ref or "",
                    "referenceNumber": c_ref or "",
                    "transType": t_type,
                    "bankAllocations": it["bankAllocations"],
                    "billAllocations": it["billAllocations"]
                }
                it["tallyXml"] = self.generate_preview_xml(pv_data, company_name)
                it["tally_xml"] = it["tallyXml"]

            refresh_item_allocations(updated_item)

            new_party_ledger = updates.get("partyLedger")
            affected_count = 1

            # Propagate mapping to all matching transactions in this draft without re-upload
            if propagate and new_party_ledger and str(new_party_ledger).strip() and target_party_key:
                for it in items:
                    if it.get("item_id") == item_id:
                        continue
                    if it.get("status") in ["saved", "already_processed"]:
                        continue

                    it_party = (it.get("extractedParty") or "").strip()
                    it_narr = (it.get("narration") or "").lower()
                    if (it_party and it_party.lower() == target_party_key.lower()) or (len(target_party_key) >= 4 and target_party_key.lower() in it_narr):
                        it["partyLedger"] = new_party_ledger
                        it["againstLedger"] = new_party_ledger
                        it["status"] = "user_edited"
                        it["review_required"] = False
                        it["confidence"] = 100.0
                        it["review_reason"] = f"Auto-resolved via mapping for party '{target_party_key}'."
                        refresh_item_allocations(it)
                        affected_count += 1

                # Learn alias permanently in bank_party_aliases for this company/tenant
                try:
                    alias_key = target_party_key.lower()
                    self.db["bank_party_aliases"].update_one(
                        {"companyId": comp_id, "alias": alias_key},
                        {
                            "$set": {
                                "companyId": comp_id,
                                "alias": alias_key,
                                "partyCandidate": target_party_key,
                                "ledgerName": new_party_ledger,
                                "updated_at": datetime.utcnow()
                            },
                            "$inc": {"verificationCount": 1}
                        },
                        upsert=True
                    )
                except Exception as ex:
                    logger.warning(f"Error saving alias in update_draft_item: {ex}")

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

            # Also keep ledger_mappings in sync
            ledger_maps = doc.get("ledger_mappings") or []
            if new_party_ledger:
                for lm in ledger_maps:
                    lm_party = (lm.get("extractedParty") or lm.get("partyText") or "").strip().lower()
                    if lm.get("item_id") == item_id or (target_party_key and lm_party == target_party_key.lower()):
                        lm["suggestedLedger"] = new_party_ledger
                        lm["confidence"] = 100.0
                        lm["mappingMethod"] = "User Confirmed"

            self.db["bank_statement_drafts"].update_one(
                {"_id": ObjectId(batch_id)},
                {"$set": {"items": items, "summary": summary, "ledger_mappings": ledger_maps, "updated_at": datetime.utcnow()}}
            )

            updated_item["affectedCount"] = affected_count

        return updated_item

    def reprocess_drafts_with_rule(self, rule_doc: Dict[str, Any], company_id: Optional[str] = None, target_batch_id: Optional[str] = None) -> int:
        """
        Idempotently re-evaluates all unmapped draft transactions across active drafts
        matching this newly approved rule, without requiring statement re-upload.
        Supports multi-party mappings from AI pattern discovery.
        """
        import re
        from datetime import datetime
        from app.anjalee.services.bank_pattern_engine import RulesBasedMatchingService, NarrationNormalizationService
        rules_svc = RulesBasedMatchingService(self.db)
        bank_ledger = rule_doc.get("bankLedger")
        b_id = target_batch_id or rule_doc.get("batch_id")

        # Build lookup from partyLedgerMappings and bank_party_aliases
        party_to_ledger = {}
        for pm in (rule_doc.get("partyLedgerMappings") or []):
            p = (pm.get("party") or "").strip().upper()
            ml = (pm.get("mappedLedger") or "").strip()
            if p and ml and ml != "Unmapped":
                party_to_ledger[p] = ml

        alias_filter = {}
        if company_id and company_id != "default":
            alias_filter["$or"] = [{"company_id": company_id}, {"companyId": company_id}]
        try:
            for al in self.db["bank_party_aliases"].find(alias_filter):
                p_name = (al.get("partyName") or "").strip().upper()
                r_led = (al.get("resolvedLedger") or "").strip()
                if p_name and r_led and r_led != "Unmapped" and p_name not in party_to_ledger:
                    party_to_ledger[p_name] = r_led
        except Exception:
            pass

        query: Dict[str, Any] = {"status": {"$ne": "completed"}}
        if company_id and company_id != "default":
            query["$or"] = [{"company_id": company_id}, {"companyId": company_id}]
        if bank_ledger:
            query["bank_ledger"] = bank_ledger

        total_reprocessed = 0
        batches = list(self.db["bank_statement_drafts"].find(query))

        if b_id:
            try:
                from bson import ObjectId
                b_query = {"_id": ObjectId(b_id)} if len(str(b_id)) == 24 else {"batch_id": str(b_id)}
                target_b = self.db["bank_statement_drafts"].find_one(b_query)
                if target_b and not any(b["_id"] == target_b["_id"] for b in batches):
                    batches.append(target_b)
            except Exception:
                pass

        party_pos = rule_doc.get("partyPosition")
        rule_channel = (rule_doc.get("transactionType") or "").upper()
        single_party = rule_doc.get("partyLedger") if rule_doc.get("partyLedger") != "Unmapped" else None

        for b in batches:
            items = b.get("items") or []
            batch_changed = False
            for it in items:
                if it.get("status") in ["saved", "already_processed"]:
                    continue
                # If unmapped or requiring review
                if not it.get("partyLedger") or it.get("status") == "review_required":
                    narr = it.get("narration") or ""
                    amt = float(it.get("amount") or it.get("credit") or it.get("debit") or 0.0)
                    is_cred = float(it.get("credit") or 0.0) > 0 or it.get("voucherType") == "Receipt"

                    resolved_party = None
                    matched_reason = ""

                    # 1. Check direct pattern rule match if single party ledger
                    if single_party:
                        matched = rules_svc.match_transaction(narr, amt, is_cred, [rule_doc])
                        if matched and matched.get("partyLedger"):
                            resolved_party = matched["partyLedger"]
                            matched_reason = f"Auto-resolved via approved pattern rule: '{rule_doc.get('pattern')}'."

                    # 2. Check multi-party pattern extraction
                    if not resolved_party and party_to_ledger:
                        # Check extractedParty field first
                        cand = (it.get("extractedParty") or "").strip().upper()
                        if cand and cand in party_to_ledger:
                            resolved_party = party_to_ledger[cand]
                            matched_reason = f"Auto-resolved via pattern mapping: '{cand}' -> '{resolved_party}'."

                        # If not matched, extract candidate from narration using partyPosition or standard separators
                        if not resolved_party and narr:
                            norm_narr = NarrationNormalizationService.normalize_text(narr)
                            # Try common delimiters: '/', '-', ' '
                            for sep in ['/', '-', ' ']:
                                parts = [t.strip() for t in (norm_narr.split(sep) if sep != ' ' else re.split(r'\s+', norm_narr)) if t.strip()]
                                if party_pos is not None and 0 <= party_pos < len(parts):
                                    tok = parts[party_pos].upper()
                                    if tok in party_to_ledger:
                                        resolved_party = party_to_ledger[tok]
                                        it["extractedParty"] = parts[party_pos]
                                        matched_reason = f"Auto-resolved via pattern token [{party_pos}]: '{tok}'."
                                        break
                                # Also check if any known party key exists as a token
                                for tok in parts:
                                    if tok.upper() in party_to_ledger:
                                        resolved_party = party_to_ledger[tok.upper()]
                                        it["extractedParty"] = tok
                                        matched_reason = f"Auto-resolved via matched alias: '{tok}'."
                                        break
                                if resolved_party:
                                    break

                        # Fallback: substring search of party keys in narration
                        if not resolved_party and narr:
                            upper_narr = narr.upper()
                            for p_key, p_led in party_to_ledger.items():
                                if len(p_key) >= 4 and p_key in upper_narr:
                                    resolved_party = p_led
                                    it["extractedParty"] = p_key
                                    matched_reason = f"Auto-resolved via narration text: '{p_key}'."
                                    break

                    if resolved_party:
                        it["partyLedger"] = resolved_party
                        it["againstLedger"] = resolved_party
                        it["status"] = "ready"
                        it["review_required"] = False
                        it["confidence"] = 98.0
                        it["review_reason"] = matched_reason
                        it["mappingMethod"] = "AI Pattern Applied"
                        total_reprocessed += 1
                        batch_changed = True

            if batch_changed:
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
                comp_id = b.get("company_id") or b.get("companyId") or company_id
                ledger_maps = self.build_ledger_mapping_rows(items, db=self.db, company_id=comp_id)
                self.db["bank_statement_drafts"].update_one(
                    {"_id": b["_id"]},
                    {"$set": {"items": items, "summary": summary, "ledger_mappings": ledger_maps, "updated_at": datetime.utcnow()}}
                )

        return total_reprocessed

    def validate_voucher_for_import(self, item: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Pre-import validation checks:
        1. Balanced totals (Dr == Cr)
        2. Bank allocation sum matches bank amount
        3. Bill allocation sum matches party amount (if billAllocations present)
        4. Valid non-empty ledger names
        """
        errors = []
        amt = round(float(item.get("amount") or 0.0), 2)
        if amt <= 0:
            errors.append(f"Voucher amount must be greater than zero (found: {amt})")

        bank_ledger = (item.get("bankLedger") or "").strip()
        party_ledger = (item.get("partyLedger") or item.get("againstLedger") or "").strip()

        if not bank_ledger:
            errors.append("Bank ledger name cannot be empty")
        if not party_ledger:
            errors.append("Party/Counterpart ledger name cannot be empty")

        # Bank Allocation validation
        bank_allocs = item.get("bankAllocations") or []
        if bank_allocs:
            sum_bank_alloc = round(sum(abs(float(b.get("amount") or 0.0)) for b in bank_allocs), 2)
            if abs(sum_bank_alloc - amt) > 0.02:
                errors.append(f"Bank allocation sum ({sum_bank_alloc}) does not match transaction amount ({amt})")

        # Bill Allocation validation
        bill_allocs = item.get("billAllocations") or []
        if bill_allocs:
            sum_bill_alloc = round(sum(abs(float(b.get("amount") or 0.0)) for b in bill_allocs), 2)
            if abs(sum_bill_alloc - amt) > 0.02:
                errors.append(f"Bill allocation sum ({sum_bill_alloc}) does not match transaction amount ({amt})")

        return (len(errors) == 0), errors

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
        batch_id_str = str(batch_id) if batch_id else ""
        query = {"$or": [{"_id": ObjectId(batch_id_str)}, {"batch_id": batch_id_str}]} if (batch_id_str and ObjectId.is_valid(batch_id_str)) else {"batch_id": batch_id_str}
        doc = self.db["bank_statement_drafts"].find_one(query)
        if not doc:
            return {"success": False, "error": "Batch draft not found"}

        items = doc.get("items") or []
        saved_vouchers = []
        validation_failed_items = []
        from app.anjalee.repositories.fundflow_repo import FundFlowRepository
        from app.anjalee.services.fundflow_service import FundFlowService
        from app.anjalee.schemas.fundflow_schemas import FundFlowTransactionCreate

        repo = FundFlowRepository(self.db)
        ff_service = FundFlowService(repo)

        for item in items:
            if item.get("item_id") in item_ids and item.get("status") != "saved":
                # Pre-import validation: balanced totals, allocations agreement, valid ledgers
                is_valid, val_errors = self.validate_voucher_for_import(item)
                if not is_valid:
                    item["status"] = "review_required"
                    item["review_required"] = True
                    item["review_reason"] = f"Validation failed: {'; '.join(val_errors)}"
                    validation_failed_items.append({"item_id": item.get("item_id"), "errors": val_errors})
                    continue

                raw_v_type = item.get("voucherType") or ("Payment" if (item.get("debit", 0) > 0 and not item.get("credit")) else "Receipt")
                is_payment = (raw_v_type == "Payment")

                amt = float(item.get("amount") or item.get("debit") or item.get("credit") or 0.0)
                bank_ledger = item.get("bankLedger") or "Bank Account"
                party_ledger = item.get("partyLedger") or item.get("againstLedger") or "Unassigned"

                company_id_val = ObjectId(company_id) if (company_id and ObjectId.is_valid(company_id)) else company_id
                v_guid = f"{uuid.uuid4()}-{str(uuid.uuid4())[:8]}"

                try:
                    parsed_dt = datetime.strptime(item.get("voucherDate"), "%Y-%m-%d")
                except Exception:
                    parsed_dt = datetime.now()

                dates_obj = {
                    "date": parsed_dt,
                    "voucherDate": item.get("voucherDate") or parsed_dt.strftime("%Y-%m-%d"),
                    "effectiveDate": parsed_dt
                }

                is_contra = (raw_v_type.lower() == "contra")
                party_bill_allocs = item.get("billAllocations") or []
                bank_allocs = item.get("bankAllocations") or []

                if is_contra:
                    is_bank_cr = (float(item.get("debit") or 0) > 0)
                    if is_bank_cr:
                        ledger_entries = [
                            {
                                "ledgerName": party_ledger,
                                "amount": -amt,
                                "isDeemedPositive": "Yes",
                                "drCrType": "Dr",
                                "bankAllocations": bank_allocs
                            },
                            {
                                "ledgerName": bank_ledger,
                                "amount": amt,
                                "isDeemedPositive": "No",
                                "drCrType": "Cr",
                                "bankAllocations": bank_allocs
                            }
                        ]
                    else:
                        ledger_entries = [
                            {
                                "ledgerName": bank_ledger,
                                "amount": -amt,
                                "isDeemedPositive": "Yes",
                                "drCrType": "Dr",
                                "bankAllocations": bank_allocs
                            },
                            {
                                "ledgerName": party_ledger,
                                "amount": amt,
                                "isDeemedPositive": "No",
                                "drCrType": "Cr",
                                "bankAllocations": bank_allocs
                            }
                        ]
                elif is_payment:
                    ledger_entries = [
                        {
                            "ledgerName": party_ledger,
                            "amount": -amt,
                            "isDeemedPositive": "Yes",
                            "drCrType": "Dr",
                            "billAllocations": party_bill_allocs
                        },
                        {
                            "ledgerName": bank_ledger,
                            "amount": amt,
                            "isDeemedPositive": "No",
                            "drCrType": "Cr",
                            "bankAllocations": bank_allocs
                        }
                    ]
                else:
                    # Receipt: Party Ledger (Credit) MUST be first, Bank Ledger (Debit) MUST be second
                    ledger_entries = [
                        {
                            "ledgerName": party_ledger,
                            "amount": amt,
                            "isDeemedPositive": "No",
                            "drCrType": "Cr",
                            "billAllocations": party_bill_allocs
                        },
                        {
                            "ledgerName": bank_ledger,
                            "amount": -amt,
                            "isDeemedPositive": "Yes",
                            "drCrType": "Dr",
                            "bankAllocations": bank_allocs
                        }
                    ]

                ff_payload = FundFlowTransactionCreate(
                    companyId=company_id_val,
                    voucherGuid=v_guid,
                    remoteId=v_guid,
                    voucherKey=str(int(datetime.now().timestamp() * 1000000000) % 1000000000000000),
                    voucherNumberSeries="Default",
                    numberingStyle="Auto Retain",
                    reference={
                        "reference": item.get("referenceNumber") or "",
                        "referenceDate": item.get("voucherDate") or parsed_dt.strftime("%Y-%m-%d")
                    },
                    voucherTypeName=raw_v_type,
                    voucherTypeOrigName=raw_v_type,
                    voucherCategory=raw_v_type,
                    voucherClass="ACCOUNTING",
                    objectView="Accounting Voucher View",
                    persistedView="Accounting Voucher View",
                    dates=dates_obj,
                    partyName=None,
                    partyLedgerName=party_ledger,
                    partyMailingName=None,
                    basicBuyerName=None,
                    basicBasePartyName=None,
                    partyPincode=None,
                    address="",
                    gstDetails={},
                    flags={
                        "isCancelled": False,
                        "isOptional": False,
                        "isDeleted": False
                    },
                    ledgerEntries=ledger_entries,
                    inventoryEntries=[],
                    invoiceOrderList=[],
                    ewayBillDetails=[],
                    dispatchDetails={},
                    totals={
                        "grandTotal": amt,
                        "totalAmount": amt
                    },
                    narration=item.get("narration") or "",
                    status="ACTIVE",
                    source="bank_upload",
                    entryMode="bank_upload",
                    createdVia="bank_upload",
                    fingerprint=item.get("fingerprint"),
                    source_document=item.get("source_document"),
                    batch_id=batch_id,
                    item_id=item.get("item_id"),
                    company=str(company_id) if company_id else None,
                    auditInfo={
                        "createdAt": datetime.now(),
                        "updatedAt": datetime.now(),
                        "source": "bank_upload",
                        "entryMode": "bank_upload"
                    },
                    bankAllocations=bank_allocs,
                    billAllocations=party_bill_allocs,
                    # FundFlow UI compatibility fields
                    voucherType=raw_v_type,
                    voucherDate=item.get("voucherDate"),
                    referenceNumber=item.get("referenceNumber") or "",
                    partyLedger=party_ledger,
                    againstLedger=party_ledger,
                    amount=amt,
                    drCrType="Dr" if is_payment else "Cr",
                    bankLedger=bank_ledger,
                    paymentMode=item.get("paymentMode") or "NEFT",
                    instType=item.get("instType") or item.get("paymentMode") or "NEFT",
                    instNumber=item.get("instNumber") or item.get("referenceNumber") or "",
                    instDate=item.get("instDate") or item.get("voucherDate"),
                    remarks=item.get("narration") or ""
                )

                # Centralized voucher creation and sequential numbering via FundFlowService
                saved_tx = ff_service.create_transaction(ff_payload, company_id=company_id)
                vch_no = saved_tx.get("voucherNumber")

                item["status"] = "saved"
                item["voucherNumber"] = vch_no
                item["saved_voucher_id"] = str(saved_tx.get("_id"))
                item["tallyXml"] = saved_tx.get("tallyXml")
                item["tally_xml"] = saved_tx.get("tally_xml")
                saved_vouchers.append(saved_tx)

        try:
            self.db["fund_flow_transactions"].update_many(
                {"batch_id": batch_id},
                {"$set": {"entryMode": "bank_upload", "source": "bank_upload", "createdVia": "bank_upload"}}
            )
            self.db["fund_flow_vouchers"].update_many(
                {"batch_id": batch_id},
                {"$set": {"entryMode": "bank_upload", "source": "bank_upload", "createdVia": "bank_upload"}}
            )
        except Exception:
            pass

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
            {"_id": doc["_id"]},
            {"$set": {"items": items, "summary": summary, "status": "completed" if saved_cnt == len(items) else "partially_saved"}}
        )

        return {
            "success": True,
            "saved_count": len(saved_vouchers),
            "saved_vouchers": [serialize_doc(v) for v in saved_vouchers],
            "validation_errors": validation_failed_items
        }

    def apply_rules_to_batch(self, batch_id: str, bank_ledger: str, company_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Applies saved bank mapping rules (Engine A) to the draft items of a batch.
        Evaluates rule priority, constraints, and conflict detection.
        Discovers new pattern candidates (Engine B) for remaining unmatched items.
        Returns transaction-level results and processing summary.
        """
        try:
            batch = self.db["bank_statement_drafts"].find_one({"_id": ObjectId(batch_id)})
            if not batch:
                return {"success": False, "error": "Batch draft not found", "matched_count": 0}

            eff_company_id = company_id or batch.get("company_id") or batch.get("companyId")

            rules_svc = RulesBasedMatchingService(self.db)
            rules = rules_svc.get_applicable_rules(bank_ledger, eff_company_id)

            items = batch.get("items", [])
            total_eligible = 0
            matched_count = 0
            conflicts_count = 0
            details = []

            for item in items:
                # Do not overwrite already saved vouchers
                if item.get("status") in ["saved", "already_processed"]:
                    continue

                total_eligible += 1
                narration = (item.get("narration") or "").strip()
                amt = float(item.get("amount") or item.get("credit") or item.get("debit") or 0.0)
                is_credit = float(item.get("credit") or 0.0) > 0 or item.get("voucherType") == "Receipt"

                rule_match = rules_svc.match_transaction(narration, amt, is_credit, rules)

                if rule_match:
                    matched_count += 1
                    target_p = rule_match.get("partyLedger")
                    has_conflict = rule_match.get("hasConflict", False)
                    if has_conflict:
                        conflicts_count += 1

                    item["partyLedger"] = target_p
                    item["againstLedger"] = target_p
                    item["confidence"] = rule_match.get("confidence", 100)
                    item["status"] = "review_required" if has_conflict else "ready"
                    item["review_required"] = has_conflict
                    item["review_reason"] = f"Conflicting rules: {', '.join(rule_match.get('conflictingLedgers', []))}" if has_conflict else f"Auto-mapped via Bank Rule '{rule_match.get('matchedPattern')}'"
                    item["user_reasoning"] = rule_match.get("reasoning")
                    
                    v_override = rule_match.get("voucherType")
                    if v_override in ["Payment", "Receipt"]:
                        item["voucherType"] = v_override

                    details.append({
                        "item_id": item.get("item_id"),
                        "narration": narration,
                        "matched": True,
                        "rule_name": rule_match.get("ruleName"),
                        "scope": rule_match.get("scope"),
                        "party_ledger": target_p,
                        "voucher_type": item.get("voucherType"),
                        "has_conflict": has_conflict
                    })
                else:
                    details.append({
                        "item_id": item.get("item_id"),
                        "narration": narration,
                        "matched": False,
                        "party_ledger": item.get("partyLedger"),
                        "voucher_type": item.get("voucherType"),
                        "has_conflict": False
                    })

            # Auto-run Engine B: Discover recurring patterns for remaining unmatched transactions
            discovery_svc = AIPatternDiscoveryService(self.db)
            discovered_suggestions = discovery_svc.cluster_and_discover(items, bank_ledger, eff_company_id)

            # Recalculate summary stats
            ready_cnt = sum(1 for i in items if i.get("status") in ["ready", "user_edited"])
            rev_cnt = sum(1 for i in items if i.get("status") == "review_required")
            already_cnt = sum(1 for i in items if i.get("status") == "already_processed")
            saved_cnt = sum(1 for i in items if i.get("status") == "saved")
            mapped_cnt = sum(1 for i in items if i.get("partyLedger"))

            summary = {
                "total_count": len(items),
                "total_eligible": total_eligible,
                "matched_count": matched_count,
                "ledger_mapped_count": mapped_cnt,
                "ready_count": ready_cnt,
                "review_required_count": rev_cnt,
                "already_processed_count": already_cnt,
                "saved_count": saved_cnt,
                "conflicts_count": conflicts_count,
                "discovered_patterns_count": len(discovered_suggestions)
            }

            self.db["bank_statement_drafts"].update_one(
                {"_id": ObjectId(batch_id)},
                {"$set": {"items": items, "summary": summary, "updated_at": datetime.now()}}
            )

            updated_batch = self.db["bank_statement_drafts"].find_one({"_id": ObjectId(batch_id)})
            return {
                "success": True,
                "matched_count": matched_count,
                "conflicts_count": conflicts_count,
                "discovered_count": len(discovered_suggestions),
                "summary": summary,
                "details": details[:50],  # Sample item details
                "message": f"Applied rules successfully! {matched_count} transaction(s) auto-mapped, {len(discovered_suggestions)} new pattern candidate(s) discovered.",
                "data": serialize_doc(updated_batch)
            }
        except Exception as e:
            logger.error(f"Error applying bank rules to batch {batch_id}: {e}", exc_info=True)
            return {"success": False, "error": str(e), "matched_count": 0}


    @classmethod
    def build_ledger_mapping_rows(
        cls,
        items: List[Dict[str, Any]],
        db: Optional[Any] = None,
        company_id: Optional[str] = None,
        company_masters: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        from app.anjalee.services.bank_pattern_engine import (
            RegexPositionalExtractor,
            PartyLedgerResolutionService,
            PatternDiscoveryEngine
        )

        resolution_svc = None
        if db is not None:
            try:
                resolution_svc = PartyLedgerResolutionService(db)
                if company_masters is None:
                    company_masters = resolution_svc.get_company_master_ledgers(company_id)
            except Exception as e:
                logger.warning(f"Error initializing PartyLedgerResolutionService in build_ledger_mapping_rows: {e}")

        result_rows = []
        for it in items:
            narration = it.get("narration") or ""
            cur_party = (it.get("extractedParty") or "").strip()
            
            # Check if current extractedParty is invalid, raw unparsed narration, a channel code, or empty
            is_bad_party = (
                not cur_party or
                cur_party.upper() in RegexPositionalExtractor.STOP_SEGMENTS or
                cur_party.isdigit() or
                len(cur_party) < 3 or
                "/" in cur_party or
                ":" in cur_party or
                cur_party.upper().startswith(("CLG/", "UPI/", "NEFT/", "RTGS/", "IMPS/", "INFT/", "INF/", "CHQ/", "CHEQUE/", "REJECT:")) or
                (narration and len(cur_party) >= 25 and cur_party == narration[:len(cur_party)])
            )

            clean_cand = None
            master_match_info = None

            if is_bad_party and narration:
                # Reverse-index match: test each token of narration against company master ledgers
                analysis = PatternDiscoveryEngine.analyze_narration_tokens(
                    narration,
                    company_masters=company_masters,
                    bank_ledger=it.get("bankLedger") or ""
                )
                if analysis.get("master_match") and analysis["master_match"].get("token"):
                    clean_cand = analysis["master_match"]["token"]
                    master_match_info = analysis["master_match"]
                elif analysis.get("party_val") and "/" not in str(analysis["party_val"]):
                    clean_cand = analysis["party_val"]
                else:
                    party_ext, _ = RegexPositionalExtractor.extract_party(narration)
                    clean_cand = party_ext
            else:
                clean_cand = cur_party

            # Sanitize extracted candidate: strip any accidental slashes, channel prefixes, or delimiters
            if clean_cand:
                if "/" in clean_cand:
                    segs = [s.strip() for s in clean_cand.split('/') if s.strip()]
                    valid_segs = [
                        s for s in segs 
                        if s.upper() not in RegexPositionalExtractor.STOP_SEGMENTS and 
                           not s.isdigit() and 
                           any(c.isalpha() for c in s) and 
                           len(s) >= 3
                    ]
                    clean_cand = valid_segs[0] if valid_segs else (segs[0] if segs else clean_cand)
                clean_cand = re.sub(r'^(CLG|UPI|NEFT|RTGS|IMPS|CHQ|INFT|INF)[/:\s-]+', '', clean_cand, flags=re.I).strip()

            if not clean_cand or len(clean_cand) < 2 or clean_cand.upper() in RegexPositionalExtractor.STOP_SEGMENTS:
                party_ext, _ = RegexPositionalExtractor.extract_party(narration) if narration else (None, 0.0)
                clean_cand = party_ext or "Unidentified Party"

            # Sync cleaned party candidate back to item dict
            it["extractedParty"] = clean_cand

            suggested = (it.get("partyLedger") or it.get("againstLedger") or "").strip()
            item_id = str(it.get("item_id") or uuid.uuid4())
            it_status = it.get("status")

            # If master_match was directly found during token analysis, prioritize it
            if master_match_info and (not suggested or suggested == "Unmapped") and it_status not in ["user_edited", "saved"]:
                suggested = master_match_info.get("ledger") or suggested

            # If unmapped or user hasn't confirmed, try resolving against company master ledgers
            resolved_info = None
            if resolution_svc and company_masters and it_status not in ["user_edited", "saved"] and (not suggested or suggested == "Unmapped"):
                resolved_info = resolution_svc.resolve_party_ledger(
                    clean_cand, narration, company_id=company_id, company_masters=company_masters
                )
                if resolved_info.get("resolvedLedger") and resolved_info["resolvedLedger"] != "Unmapped":
                    suggested = resolved_info["resolvedLedger"]

            is_exact = False
            if suggested and clean_cand:
                if clean_cand.strip().upper() == suggested.strip().upper():
                    is_exact = True
                elif re.sub(r'[^A-Za-z0-9]', '', clean_cand.lower()) == re.sub(r'[^A-Za-z0-9]', '', suggested.lower()):
                    is_exact = True

            if is_exact:
                conf = 100.0
                method = "System • Exact Match"
            elif it_status in ["user_edited", "saved"]:
                conf = 100.0
                method = "User Confirmed"
            elif master_match_info and suggested and suggested == master_match_info.get("ledger"):
                conf = float(master_match_info.get("score") or 96.0)
                method = "System • Exact Match" if master_match_info.get("matchType") in ["exact", "alnum"] else f"AI Resolved ({master_match_info.get('matchType')})"
            elif resolved_info and resolved_info.get("resolvedLedger"):
                conf = float(resolved_info.get("confidence") or 90.0)
                m_method = resolved_info.get("matchMethod", "fuzzy")
                method = "System • Exact Match" if m_method in ["exact", "alnum_exact"] else f"AI Resolved ({m_method})"
            elif suggested:
                conf = float(it.get("confidence") or 85.0)
                method = it.get("mappingMethod") or "AI Suggested"
            else:
                conf = 50.0
                method = "Unmapped"

            item_row = {
                "patternId": item_id,
                "item_id": item_id,
                "batch_id": str(it.get("batch_id") or ""),
                "date": it.get("voucherDate") or "",
                "amount": float(it.get("amount") or 0.0),
                "voucherType": it.get("voucherType") or "Payment",
                "narration": narration,
                "referenceNumber": it.get("referenceNumber") or it.get("instNumber") or "—",
                "extractedParty": clean_cand,
                "partyText": clean_cand,
                "extractedPattern": clean_cand,
                "channel": it.get("paymentMode") or "",
                "sampleNarration": narration,
                "suggestedLedger": suggested,
                "confidence": conf,
                "mappingMethod": method,
                "transactionCount": 1,
                "transactions": [it]
            }
            result_rows.append(item_row)

        result_rows.sort(key=lambda r: (1 if r["suggestedLedger"] else 0, r.get("date") or ""))
        return result_rows

    def get_ledger_mappings(
        self,
        bank_ledger: str,
        company_id: Optional[str] = None,
        batch_id: Optional[str] = None,
        search: Optional[str] = None,
        filter_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Returns the pre-prepared ledger mappings list directly for instant display on click.
        """
        # 1. Query batches for this bank ledger
        batches = []
        if batch_id:
            query = {"_id": ObjectId(batch_id)} if len(str(batch_id)) == 24 else {"batch_id": batch_id}
            batches = list(self.db["bank_statement_drafts"].find(query).sort("created_at", -1))

        if not batches and bank_ledger:
            clean_bl = bank_ledger.strip()
            batches = list(self.db["bank_statement_drafts"].find({
                "bank_ledger": re.compile(f"^{re.escape(clean_bl)}$", re.I)
            }).sort("created_at", -1))

            if not batches:
                batches = list(self.db["bank_statement_drafts"].find({
                    "bank_ledger": re.compile(f"{re.escape(clean_bl)}", re.I)
                }).sort("created_at", -1))

        if not batches:
            batches = list(self.db["bank_statement_drafts"].find({}).sort("created_at", -1).limit(1))
        else:
            batches = batches[:1]
        
        # Collect all items from the latest active batch
        raw_items = []
        for b in batches:
            b_id = str(b.get("_id") or b.get("batch_id"))
            for it in (b.get("items") or []):
                it_copy = dict(it)
                it_copy["batch_id"] = b_id
                raw_items.append(it_copy)

        if not raw_items:
            return []

        company_masters = self.get_company_master_ledgers(company_id)
        all_rows = self.build_ledger_mapping_rows(
            raw_items,
            db=self.db,
            company_id=company_id,
            company_masters=company_masters
        )
        if len(batches) == 1:
            try:
                self.db["bank_statement_drafts"].update_one(
                    {"_id": batches[0]["_id"]},
                    {"$set": {"ledger_mappings": all_rows}}
                )
            except Exception:
                pass

        if not search and (not filter_type or filter_type == "all"):
            return all_rows

        result_rows = []
        for item_row in all_rows:
            clean_cand = item_row.get("extractedParty", "")
            suggested = item_row.get("suggestedLedger", "")
            narration = item_row.get("narration", "")
            method = item_row.get("mappingMethod", "")
            is_exact = "Exact" in method

            # Filter search
            if search:
                s_lower = search.lower().strip()
                cand_match = s_lower in clean_cand.lower()
                led_match = s_lower in suggested.lower()
                narr_match = s_lower in narration.lower()
                ref_match = s_lower in str(item_row.get("referenceNumber", "")).lower()
                if not (cand_match or led_match or narr_match or ref_match):
                    continue

            # Filter type
            if filter_type and filter_type != "all":
                if filter_type == "mapped" and not suggested:
                    continue
                if filter_type == "unmapped" and suggested:
                    continue
                if filter_type == "confirmed" and "User" not in method and not is_exact:
                    continue

            result_rows.append(item_row)

        return result_rows

    def confirm_ledger_mapping(
        self,
        bank_ledger: str,
        pattern: str,
        selected_ledger: str,
        transaction_ids: Optional[List[str]] = None,
        company_id: Optional[str] = None,
        create_rule: bool = True
    ) -> Dict[str, Any]:
        """
        Confirms or changes party ledger mapping for an extracted pattern:
        1. Updates all matching draft items across statements to selected_ledger with 'User Confirmed'.
        2. Learns customer party alias in 'bank_party_aliases'.
        3. Creates/updates customer-specific rule in 'bank_mapping_rules' if requested.
        4. Logs audit trail in 'bank_pattern_feedback'.
        """
        from app.anjalee.services.bank_pattern_engine import PatternFeedbackService

        updated_count = 0

        # Update draft transactions in MongoDB
        query: Dict[str, Any] = {}
        if company_id and company_id != "default":
            query["$or"] = [{"company_id": company_id}, {"companyId": company_id}]
        if bank_ledger:
            query["bank_ledger"] = bank_ledger

        batches = list(self.db["bank_statement_drafts"].find(query))
        clean_pat = pattern.split(" / ")[-1].strip() if " / " in pattern else pattern.strip()

        for b in batches:
            b_id = b["_id"]
            items = b.get("items") or []
            changed = False
            for it in items:
                # Match by explicit ID or pattern match
                it_id = it.get("item_id")
                is_target = False
                if transaction_ids:
                    is_target = it_id in transaction_ids
                elif clean_pat:
                    is_target = clean_pat.lower() in (it.get("narration") or "").lower() or clean_pat.lower() in (it.get("extractedParty") or "").lower()

                if is_target:
                    it["partyLedger"] = selected_ledger
                    it["againstLedger"] = selected_ledger
                    it["status"] = "ready"
                    it["review_required"] = False
                    it["confidence"] = 100.0
                    it["mappingMethod"] = "User Confirmed"
                    it["user_reasoning"] = f"Confirmed mapping: '{pattern}' -> '{selected_ledger}'"
                    updated_count += 1
                    changed = True

            if changed:
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
                ledger_maps = b.get("ledger_mappings") or []
                for lm in ledger_maps:
                    target_ids = transaction_ids or []
                    if lm.get("item_id") in target_ids or lm.get("patternId") in target_ids:
                        lm["suggestedLedger"] = selected_ledger
                        lm["confidence"] = 100.0
                        lm["mappingMethod"] = "User Confirmed"

                self.db["bank_statement_drafts"].update_one(
                    {"_id": b_id},
                    {"$set": {"items": items, "summary": summary, "ledger_mappings": ledger_maps}}
                )

        # 2. Learn customer party alias
        feedback_svc = PatternFeedbackService(self.db)
        feedback_svc.record_feedback(
            transaction_id=transaction_ids[0] if transaction_ids else "group_confirm",
            narration=pattern,
            bank_ledger=bank_ledger,
            corrected_ledger=selected_ledger,
            company_id=company_id
        )

        # 3. Create or update rule if requested
        if create_rule:
            rule_pattern = clean_pat if len(clean_pat) >= 3 else pattern
            rule_doc = {
                "name": f"Rule: {rule_pattern} -> {selected_ledger}",
                "scope": "customer_specific",
                "bankLedger": bank_ledger,
                "company_id": company_id,
                "companyId": company_id,
                "pattern": rule_pattern,
                "matchType": "contains",
                "partyLedger": selected_ledger,
                "voucherType": "Auto",
                "direction": "any",
                "status": "active",
                "confidenceThreshold": 100.0,
                "source": "customer_custom",
                "updatedAt": datetime.utcnow()
            }
            self.db["bank_mapping_rules"].update_one(
                {"company_id": company_id, "bankLedger": bank_ledger, "pattern": rule_pattern},
                {"$set": rule_doc, "$setOnInsert": {"createdAt": datetime.utcnow()}},
                upsert=True
            )

        return {
            "success": True,
            "updated_count": updated_count,
            "pattern": pattern,
            "selected_ledger": selected_ledger,
            "message": f"Successfully mapped '{pattern}' to '{selected_ledger}' across {updated_count} transaction(s)."
        }

BankStatementAiService = BankStatementAIService

