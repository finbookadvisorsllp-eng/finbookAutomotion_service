"""GST reports — Output (GSTR-1 basis), ITC, Net payable (GSTR-3B), HSN summary.

Tax ledgers are identified by group:
    'Output'     -> output tax (CGST/SGST/IGST Output) on sales
    'GST INPUT'  -> input tax credit on purchases
Taxable turnover by slab comes from the sales ledgers named 'GST Sales 12/18%'.
"""
import re

from app.aman.core.serializers import money, parse_qty
from app.aman.repositories import ledger_repo, voucher_repo, stock_repo
from app.aman.services.financial_year import fy_label

_SLAB_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")
SALES_TYPES = ["Sales"]
CREDIT_TYPES = ["Credit Note"]
PURCHASE_TYPES = ["Purchase"]


def _slab_from_name(name: str):
    m = _SLAB_RE.search(name or "")
    return float(m.group(1)) if m else None


def _group_ledger_names(db, group_names):
    return {l["ledgerName"] for l in ledger_repo.ledgers_in_groups(db, group_names, {"ledgerName": 1})}


def _movement_for(db, fy, ledger_names):
    movement = voucher_repo.ledger_movement(db, fy)
    return {n: movement.get(n, {"debit": 0.0, "credit": 0.0}) for n in ledger_names}


def summary(db, fy: str) -> dict:
    output_names = _group_ledger_names(db, ["Output"])
    input_names = _group_ledger_names(db, ["GST INPUT"])
    out_mov = _movement_for(db, fy, output_names)
    in_mov = _movement_for(db, fy, input_names)

    output_tax = money(sum(m["credit"] - m["debit"] for m in out_mov.values()))
    itc = money(sum(m["debit"] - m["credit"] for m in in_mov.values()))
    net_payable = money(output_tax - itc)

    # split output by component
    def comp(names_filter):
        return money(sum((out_mov[n]["credit"] - out_mov[n]["debit"])
                         for n in output_names if names_filter(n.upper())))
    cgst = comp(lambda u: "CGST" in u)
    sgst = comp(lambda u: "SGST" in u)
    igst = comp(lambda u: "IGST" in u)

    return {
        "fy": fy, "label": fy_label(fy),
        "outputTax": output_tax, "inputTaxCredit": itc, "netPayable": net_payable,
        "components": {"cgst": cgst, "sgst": sgst, "igst": igst,
                       "cess": money(output_tax - cgst - sgst - igst)},
    }


def rate_breakdown(db, fy: str) -> list[dict]:
    """Taxable turnover + tax per slab, derived from sales tax-rate ledgers."""
    movement = voucher_repo.ledger_movement(db, fy)
    sales_names = _group_ledger_names(db, ["Sales Accounts"])
    slabs: dict[float, dict] = {}
    for name in sales_names:
        slab = _slab_from_name(name)
        if slab is None:
            continue
        mov = movement.get(name, {"debit": 0.0, "credit": 0.0})
        taxable = mov["credit"] - mov["debit"]  # net credit = turnover
        rec = slabs.setdefault(slab, {"rate": f"{slab:g}%", "taxable": 0.0, "tax": 0.0})
        rec["taxable"] = money(rec["taxable"] + taxable)
    for rec in slabs.values():
        slab = float(rec["rate"].rstrip("%"))
        rec["tax"] = money(rec["taxable"] * slab / 100)
    return [slabs[k] for k in sorted(slabs)]


def gstr1(db, fy: str) -> dict:
    """Outward supplies (sales + credit notes) for GSTR-1."""
    s = voucher_repo.type_totals(db, fy, SALES_TYPES)
    cn = voucher_repo.type_totals(db, fy, CREDIT_TYPES)
    summ = summary(db, fy)
    return {
        "fy": fy, "label": fy_label(fy),
        "b2b": {"count": s["count"], "value": s["amount"]},
        "creditNotes": {"count": cn["count"], "value": cn["amount"]},
        "taxableValue": money(s["amount"] - summ["outputTax"]),
        "totalTax": summ["outputTax"],
        "components": summ["components"],
        "rateBreakdown": rate_breakdown(db, fy),
    }


def gstr3b(db, fy: str) -> dict:
    summ = summary(db, fy)
    return {
        "fy": fy, "label": fy_label(fy),
        "outwardTaxLiability": summ["outputTax"],
        "itcAvailable": summ["inputTaxCredit"],
        "netTaxPayable": summ["netPayable"],
        "components": summ["components"],
    }


def hsn_summary(db, fy: str) -> list[dict]:
    """HSN-wise outward summary from sales inventory entries."""
    hsn_map = {s["itemName"]: s for s in stock_repo.all_stock_items(
        db, {"itemName": 1, "hsnSacDetails.hsnCode": 1, "gstSettings.gstRate": 1,
             "unit.baseUnit": 1})}
    totals = voucher_repo.stockitem_totals(db, fy, SALES_TYPES)
    agg: dict[str, dict] = {}
    for item, rec in totals.items():
        master = hsn_map.get(item, {})
        hsn = (master.get("hsnSacDetails") or {}).get("hsnCode") or "N/A"
        rate = (master.get("gstSettings") or {}).get("gstRate") or 0
        b = agg.setdefault(hsn, {"hsn": hsn, "value": 0.0, "qty": 0,
                                 "rate": rate, "items": 0})
        b["value"] = money(b["value"] + rec["value"])
        b["items"] += 1
    out = list(agg.values())
    for b in out:
        b["tax"] = money(b["value"] * float(b["rate"] or 0) / 100)
    return sorted(out, key=lambda x: -x["value"])
