"""
VoucherGroupingEngine
=====================
Groups spreadsheet rows containing multi-item invoice rows into unified accounting vouchers.

Composite grouping key:
  Company + Voucher Type + Voucher/Invoice Number + Date + Party Ledger

Rule: Multiple item rows with the same invoice number must become ONE accounting voucher.
Do not create separate invoices for each item line.
"""

import re
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger("voucher_grouping_engine")


class VoucherGroupingEngine:
    """
    Groups tabular spreadsheet rows into structured accounting vouchers with nested item lines.
    """

    @staticmethod
    def group_rows(rows: List[List[Any]], col_idx: Dict[str, int], default_doc_type: str = "Sales Voucher") -> List[Dict[str, Any]]:
        """
        Groups raw normalized grid rows (skipping header rows) into structured vouchers.
        rows[0] is assumed to be alphabet headers ['A', 'B'...], rows[1] column headers, data starts at row 2.
        """
        data_rows = rows[2:] if len(rows) >= 3 and rows[0] and rows[0][0] == 'A' else (rows[1:] if len(rows) >= 2 else [])
        start_row_num = 3 if len(rows) >= 3 and rows[0] and rows[0][0] == 'A' else 2

        groups: Dict[str, Dict[str, Any]] = {}
        grouped_order: List[str] = []

        def get_val(row, field):
            ci = col_idx.get(field, -1)
            if ci == -1 or ci >= len(row):
                return ""
            v = row[ci]
            if isinstance(v, (datetime)):
                return v.strftime("%d/%m/%Y")
            return str(v or "").strip()

        def parse_num(v):
            if not v:
                return 0.0
            try:
                clean = re.sub(r'[^\d.-]', '', str(v))
                return float(clean) if clean else 0.0
            except (ValueError, TypeError):
                return 0.0

        is_bank_or_fundflow = any(k in default_doc_type.lower() for k in ['bank', 'statement', 'payment', 'receipt', 'contra', 'fundflow'])

        for idx, row in enumerate(data_rows):
            row_num = start_row_num + idx

            # Skip blank rows
            if not any(str(c or "").strip() for c in row):
                continue

            inv_no = get_val(row, "Voucher No") or get_val(row, "Ref No") or get_val(row, "Chq / Ref No")
            inv_date = get_val(row, "Date")
            party = get_val(row, "Counterpart Ledger") or get_val(row, "Party Name") or get_val(row, "Paid To / Account (Dr)") or get_val(row, "Received From / Account (Cr)") or get_val(row, "Ledger") or get_val(row, "Narration") or "Unspecified Party"
            gstin = get_val(row, "GSTIN")
            item_name = get_val(row, "Item Name")
            item_desc = get_val(row, "Remarks") or get_val(row, "Narration") or get_val(row, "Status")
            debit = parse_num(get_val(row, "Debit"))
            credit = parse_num(get_val(row, "Credit"))
            qty = parse_num(get_val(row, "Quantity"))
            rate = parse_num(get_val(row, "Rate"))
            amount = parse_num(get_val(row, "Amount")) or debit or credit
            gst_rate = parse_num(get_val(row, "GST Rate").replace("%", ""))
            taxable = parse_num(get_val(row, "Taxable Value")) or (qty * rate if qty and rate else amount)

            # Determine dynamic voucher type for Bank Statement rows
            if is_bank_or_fundflow:
                if credit > 0 and debit == 0:
                    v_type = "Receipt Voucher"
                elif debit > 0 and credit == 0:
                    v_type = "Payment Voucher"
                else:
                    v_type = default_doc_type if default_doc_type in ["Payment Voucher", "Receipt Voucher", "Contra Voucher"] else ("Receipt Voucher" if credit > 0 else "Payment Voucher")
                # Bank Statements: EVERY ROW IS AN INDIVIDUAL 1:1 VOUCHER! Do NOT group into multi-item stock invoices!
                key = f"{v_type.upper()}|ROW-{row_num}"
            elif inv_no:
                v_type = default_doc_type
                key = f"{v_type.upper()}|{inv_no.upper()}|{party.upper()}"
            else:
                v_type = default_doc_type
                key = f"{v_type.upper()}|ROW-{row_num}|{party.upper()}"

            if key not in groups:
                grouped_order.append(key)
                groups[key] = {
                    "voucher_id": f"VCH-GRP-{len(grouped_order)}",
                    "voucher_type": v_type,
                    "invoice_number": inv_no or f"AUTO-{row_num:04d}",
                    "invoice_date": inv_date,
                    "party_ledger": party,
                    "party_gstin": gstin,
                    "row_indices": [row_num],
                    "items": [],
                    "totals": {
                        "taxable_value": 0.0,
                        "cgst": 0.0,
                        "sgst": 0.0,
                        "igst": 0.0,
                        "total_amount": 0.0
                    },
                    "is_bank_statement": is_bank_or_fundflow,
                    "status": "VALID"
                }

            v_group = groups[key]
            if not is_bank_or_fundflow and row_num not in v_group["row_indices"]:
                v_group["row_indices"].append(row_num)

            # Append Item Line (only if invoice mode or explicit stock item exists)
            if not is_bank_or_fundflow and (item_name or amount > 0):
                v_group["items"].append({
                    "row_num": row_num,
                    "item_name": item_name or "General Accounting Item",
                    "description": item_desc,
                    "quantity": qty if qty > 0 else 1,
                    "rate": rate if rate > 0 else (amount if amount > 0 else 0.0),
                    "amount": amount if amount > 0 else taxable,
                    "taxable_value": taxable,
                    "gst_rate": gst_rate
                })

            # Accumulate totals
            v_group["totals"]["taxable_value"] += taxable
            v_group["totals"]["total_amount"] += amount if amount > 0 else taxable

        result = [groups[k] for k in grouped_order]
        return result
