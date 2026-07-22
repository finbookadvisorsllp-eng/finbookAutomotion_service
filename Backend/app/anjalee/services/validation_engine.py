"""
validation_engine.py
====================
Business Validation Engine for the enterprise document intelligence pipeline.

Validates extracted accounting data against:
  - Mathematical rules  (Qty × Rate = Amount, tax calculations)
  - GST rules           (CGST = SGST for intra-state, IGST for inter-state)
  - Round-off bounds    (< ±5.0)
  - Grand total         (taxable + tax + round_off = total)
  - GSTIN format        (Indian GST number structure)
  - Duplicate detection (file hash checked at upload time)
"""

import re
import logging

logger = logging.getLogger("validation_engine")

# Standard valid GST rates
VALID_GST_RATES = {0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28}


class ValidationEngine:

    def validate(self, schema: dict) -> dict:
        """
        Main entry point.  Accepts a fully assembled dynamic_schema dict and
        returns a validation result dict suitable for storage in the
        `validations` MongoDB collection.
        """
        errors   = []
        warnings = []
        checks   = {}

        sections = {s["id"]: s for s in schema.get("sections", [])}

        # Pull line items
        line_items = []
        li_section = sections.get("line_items", {})
        for field in li_section.get("fields", []):
            if field.get("type") == "table":
                line_items = field.get("rows", [])
                break

        # Pull calculation summary
        calc_map = {}
        calc_section = sections.get("calculation_summary", {})
        for field in calc_section.get("fields", []):
            calc_map[field.get("id")] = field.get("value")

        taxable_value = float(calc_map.get("taxable_value") or 0)
        cgst_total    = float(calc_map.get("cgst_total")    or 0)
        sgst_total    = float(calc_map.get("sgst_total")    or 0)
        igst_total    = float(calc_map.get("igst_total")    or 0)
        round_off     = float(calc_map.get("round_off")     or 0)
        total_amount  = float(calc_map.get("total_amount")  or 0)

        # ── Check 1: Line Item Math ────────────────────────────────────────────
        item_amount_sum = 0.0
        for idx, row in enumerate(line_items):
            qty    = float(row.get("qty")    or 0)
            rate   = float(row.get("rate")   or 0)
            disc   = float(row.get("discount_percent") or 0)
            amount = float(row.get("amount") or 0)

            if qty > 0 and rate > 0 and amount > 0:
                expected = round(qty * rate * (1 - disc / 100), 2)
                if abs(expected - amount) > 1.0:
                    errors.append({
                        "code":    "ITEM_MATH_MISMATCH",
                        "field":   f"line_items[{idx}]",
                        "message": f"Row {idx+1}: {qty} × {rate} = {expected}, but amount = {amount}",
                        "severity": "error"
                    })
                    checks["math_mismatch"] = True
                else:
                    checks.setdefault("math_mismatch", False)

            item_amount_sum += amount

        # ── Check 2: Taxable Value vs Line Item Sum ────────────────────────────
        if item_amount_sum > 0 and taxable_value > 0:
            if abs(item_amount_sum - taxable_value) > 2.0:
                warnings.append({
                    "code":    "TAXABLE_VALUE_MISMATCH",
                    "field":   "taxable_value",
                    "message": f"Sum of line items ({item_amount_sum:.2f}) ≠ taxable value ({taxable_value:.2f})",
                    "severity": "warning"
                })
                checks["taxable_value_match"] = False
            else:
                checks["taxable_value_match"] = True

        # ── Check 3: GST Symmetry (CGST = SGST for intra-state) ───────────────
        if cgst_total > 0 or sgst_total > 0:
            if abs(cgst_total - sgst_total) > 1.0:
                errors.append({
                    "code":    "GST_ASYMMETRY",
                    "field":   "cgst_total/sgst_total",
                    "message": f"CGST ({cgst_total}) ≠ SGST ({sgst_total}) for intra-state transaction",
                    "severity": "error"
                })
                checks["gst_symmetry"] = False
            else:
                checks["gst_symmetry"] = True

        # ── Check 4: IGST vs CGST/SGST mutual exclusivity ─────────────────────
        if igst_total > 0 and (cgst_total > 0 or sgst_total > 0):
            warnings.append({
                "code":    "GST_DUAL_MODE",
                "field":   "igst_total",
                "message": "Both IGST and CGST/SGST are non-zero — verify if interstate or intra-state",
                "severity": "warning"
            })
            checks["gst_mode_conflict"] = True

        # ── Check 5: Grand Total Reconciliation ───────────────────────────────
        expected_total = round(taxable_value + cgst_total + sgst_total + igst_total + round_off, 2)
        if total_amount > 0 and abs(expected_total - total_amount) > 2.0:
            errors.append({
                "code":    "GRAND_TOTAL_MISMATCH",
                "field":   "total_amount",
                "message": f"Calculated total ({expected_total:.2f}) ≠ invoice total ({total_amount:.2f})",
                "severity": "error"
            })
            checks["grand_total_match"] = False
        elif total_amount > 0:
            checks["grand_total_match"] = True

        # ── Check 6: Round-off Bounds ─────────────────────────────────────────
        if abs(round_off) >= 5.0:
            warnings.append({
                "code":    "ROUND_OFF_EXCESSIVE",
                "field":   "round_off",
                "message": f"Round-off value {round_off} is unusually large (expected < ±5.0)",
                "severity": "warning"
            })
            checks["round_off_valid"] = False
        else:
            checks["round_off_valid"] = True

        # ── Check 7: GSTIN Format Validation ─────────────────────────────────
        gstin_pattern = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
        voucher_fields = sections.get("voucher_details", {}).get("fields", [])
        for field in voucher_fields:
            if "gstin" in field.get("id", "").lower():
                gstin_val = str(field.get("value") or "").strip().upper()
                if gstin_val and not gstin_pattern.match(gstin_val):
                    warnings.append({
                        "code":    "GSTIN_FORMAT_INVALID",
                        "field":   field["id"],
                        "message": f"GSTIN '{gstin_val}' does not match standard 15-char Indian GST format",
                        "severity": "warning"
                    })
                    checks["gstin_valid"] = False
                elif gstin_val:
                    checks.setdefault("gstin_valid", True)

        # ── Check 8: GST Rates are standard values ────────────────────────────
        for idx, row in enumerate(line_items):
            gst_rate = float(row.get("gst_rate") or 0)
            if gst_rate > 0 and gst_rate not in VALID_GST_RATES:
                warnings.append({
                    "code":    "NON_STANDARD_GST_RATE",
                    "field":   f"line_items[{idx}].gst_rate",
                    "message": f"Row {idx+1}: GST rate {gst_rate}% is not a standard Indian GST rate",
                    "severity": "warning"
                })

        # Determine overall validation status (Stage 8 — Validation)
        has_errors   = any(e["severity"] == "error"   for e in errors)
        has_warnings = any(w["severity"] == "warning" for w in warnings)

        if has_errors:
            status = "Needs Review"
        elif has_warnings:
            status = "Validated with Warnings"
        else:
            status = "Validated"

        result = {
            "status":   status,
            "checks":   checks,
            "errors":   errors,
            "warnings": warnings,
            "summary": {
                "error_count":   len(errors),
                "warning_count": len(warnings),
                "line_items_validated": len(line_items),
                "taxable_value":  taxable_value,
                "cgst_total":     cgst_total,
                "sgst_total":     sgst_total,
                "igst_total":     igst_total,
                "round_off":      round_off,
                "total_amount":   total_amount,
            }
        }

        logger.info(
            f"ValidationEngine: status={status}, errors={len(errors)}, warnings={len(warnings)}"
        )
        return result


# Singleton
validation_engine = ValidationEngine()
