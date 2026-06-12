"""Generic drill-down engine + the universal voucher-detail mapper.

Reused by Trial Balance, P&L, Sales/Purchase, Cash & Bank — so every drill-down
across the app renders consistently. Two patterns:

* Pattern A  Group -> Ledger -> Voucher list -> Voucher detail
* Pattern B  Month -> Voucher list -> Voucher detail
"""
from app.aman.core.serializers import (
    money, fmt_date, iso_date, month_key, parse_qty, parse_unit, parse_rate)
from app.aman.repositories import voucher_repo
from app.aman.services.financial_year import month_buckets

# Ledger-name fragments used to classify GST / round-off lines.
_TAX_TOKENS = ("CGST", "SGST", "IGST", "CESS", "GST", "TCS", "TDS")
_ROUNDOFF_TOKENS = ("ROUND OFF", "ROUNDOFF", "ROUND-OFF")


def _is_tax_ledger(name: str) -> bool:
    n = (name or "").upper()
    return any(tok in n for tok in _TAX_TOKENS)


def _is_roundoff(name: str) -> bool:
    n = (name or "").upper()
    return any(tok in n for tok in _ROUNDOFF_TOKENS)


# ─────────────────────────── voucher row (list item) ───────────────────────────
def voucher_row(v: dict, amount: float | None = None) -> dict:
    """Compact row for L3 voucher lists."""
    if amount is None:
        amount = (v.get("totals") or {}).get("totalDebit") or 0
    ref = v.get("reference") or {}
    ref_str = ref.get("reference") if isinstance(ref, dict) else (ref or "")
    return {
        "id": v.get("voucherNumber") or str(v.get("_id")),
        "voucherId": str(v.get("_id")) if v.get("_id") else None,
        "date": fmt_date((v.get("dates") or {}).get("date")),
        "isoDate": iso_date((v.get("dates") or {}).get("date")),
        "type": v.get("voucherTypeName"),
        "refNo": ref_str or "",
        "name": v.get("partyLedgerName") or v.get("partyName") or "",
        "partyName": v.get("partyLedgerName") or v.get("partyName") or "",
        "amount": money(amount),
    }


def ledger_amount_in_voucher(v: dict, ledger_name: str) -> float:
    """Magnitude of a specific ledger's line within a voucher."""
    total = 0.0
    for e in v.get("ledgerEntries", []):
        if e.get("ledgerName") == ledger_name:
            total += abs(float(e.get("amount") or 0))
    return money(total)


# ─────────────────────────── universal voucher detail ───────────────────────────
def map_voucher_detail(db, v: dict) -> dict:
    """Convert a raw voucher document into the UI detail shape.

    Emits ``items`` (inventory lines), ``taxes`` (cgst/sgst/igst/roundOff),
    ``entries`` (accounting lines as Dr/Cr), ``summary`` (non-party ledger lines),
    ``totals`` and ``narration`` — the union the various detail screens consume.
    """
    if not v:
        return {}

    # HSN lookup for the stock items in this voucher (single targeted query).
    item_names = [ie.get("stockItemName") for ie in v.get("inventoryEntries", []) if ie.get("stockItemName")]
    hsn_map: dict[str, str] = {}
    gst_map: dict[str, float] = {}
    if item_names:
        for s in db["stockItems"].find(
                {"itemName": {"$in": item_names}},
                {"itemName": 1, "hsnSacDetails.hsnCode": 1, "gstSettings.gstRate": 1}):
            hsn_map[s.get("itemName")] = (s.get("hsnSacDetails") or {}).get("hsnCode") or ""
            gst_map[s.get("itemName")] = (s.get("gstSettings") or {}).get("gstRate") or 0

    items = []
    for ie in v.get("inventoryEntries", []):
        name = ie.get("stockItemName")
        qty = parse_qty(ie.get("actualQty") or ie.get("billedQty"))
        amount = money(abs(float(ie.get("amount") or 0)))
        # Skip empty/placeholder inventory rows (no item name and no qty/amount)
        # so Payment / Receipt / Journal / Contra vouchers don't render an empty
        # Items table. Item-less vouchers therefore return items == [].
        if not name and not qty and not amount:
            continue
        rate = parse_rate(ie.get("rate"))
        gross_rate = money(amount / qty) if qty else rate
        items.append({
            "srNo": len(items) + 1,
            "name": name,
            "hsn": hsn_map.get(name, ""),
            "qty": qty,
            "unit": parse_unit(ie.get("actualQty") or ie.get("billedQty")),
            "rate": rate,
            "grossRate": gross_rate,
            "discount": ie.get("discount") or 0,
            "amount": amount,
        })

    party = v.get("partyLedgerName") or v.get("partyName")
    taxes = {"cgst": 0.0, "sgst": 0.0, "igst": 0.0, "cess": 0.0, "roundOff": 0.0}
    entries = []
    summary = []
    for i, e in enumerate(v.get("ledgerEntries", [])):
        name = e.get("ledgerName")
        amt = float(e.get("amount") or 0)
        mag = money(abs(amt))
        entries.append({
            "srNo": i + 1,
            "partyName": name,
            "ledgerName": name,
            "amount": mag,
            "isDr": amt < 0,  # negative => debit
        })
        upper = (name or "").upper()
        if "CGST" in upper:
            taxes["cgst"] += mag
        elif "SGST" in upper:
            taxes["sgst"] += mag
        elif "IGST" in upper:
            taxes["igst"] += mag
        elif "CESS" in upper:
            taxes["cess"] += mag
        elif _is_roundoff(name):
            taxes["roundOff"] += amt  # keep sign for round-off
        if name != party:
            summary.append({"name": name, "amount": mag})

    taxes = {k: money(val) for k, val in taxes.items()}
    gst = v.get("gstDetails") or {}
    totals = v.get("totals") or {}
    grand_total = money(totals.get("totalDebit") or totals.get("grandTotal") or 0)

    # Payment/Receipt style helpers
    payment_details = [{"ledgerName": s["name"], "amount": s["amount"]} for s in summary]

    return {
        "voucherNo": v.get("voucherNumber") or str(v.get("_id")),
        "voucherId": str(v.get("_id")) if v.get("_id") else None,
        "date": fmt_date((v.get("dates") or {}).get("date")),
        "isoDate": iso_date((v.get("dates") or {}).get("date")),
        "type": v.get("voucherTypeName"),
        "partyName": party or "",
        "partyGstin": gst.get("partyGstin"),
        "placeOfSupply": gst.get("placeOfSupply"),
        "narration": v.get("narration") or "",
        "hasItems": len(items) > 0,
        "items": items,
        "taxes": taxes,
        "entries": entries,
        "summary": summary,
        "bills": [],
        "paymentDetails": payment_details,
        "totals": {"grandTotal": grand_total},
        "grossTotal": grand_total,
    }


def get_voucher_detail(db, ident: str) -> dict | None:
    v = voucher_repo.by_id_or_number(db, ident)
    if not v:
        return None
    return map_voucher_detail(db, v)


# ─────────────────────────── Pattern A: ledger -> vouchers ───────────────────────────
def voucher_list_for_ledger(db, fy: str | None = None, ledger_name: str | None = None, page: int = 1,
                            limit: int = 100, sort_dir: int = -1, date_match: dict | None = None) -> tuple[list[dict], int]:
    skip = (page - 1) * limit
    total = voucher_repo.count_for_ledger(db, fy, ledger_name, date_match=date_match)
    docs = voucher_repo.vouchers_for_ledger(db, fy, ledger_name, skip=skip,
                                            limit=limit, sort_dir=sort_dir, date_match=date_match)
    rows = [voucher_row(v, ledger_amount_in_voucher(v, ledger_name)) for v in docs]
    return rows, total



# ─────────────────────────── Pattern B: month -> vouchers ───────────────────────────
def monthly_summary(db, fy: str, voucher_types: list[str]) -> dict:
    """L1 for the Order/Note documents: {total, months:[{id,label,amount,count}]}."""
    totals = voucher_repo.monthly_totals(db, fy, voucher_types)
    buckets = month_buckets(fy)
    months = []
    grand = 0.0
    for b in reversed(buckets):  # UI shows newest month first
        key = f"{b['year']}-{b['month']:02d}"
        rec = totals.get(key, {"amount": 0.0, "count": 0})
        grand += rec["amount"]
        months.append({
            "id": b["id"], "label": b["label"],
            "amount": money(rec["amount"]), "count": rec["count"],
            "year": b["year"], "month": b["month"],
        })
    return {"total": money(grand), "months": months}


def voucher_list_for_month(db, fy: str, voucher_types: list[str], month_id: str,
                           page: int = 1, limit: int = 200) -> tuple[list[dict], int]:
    """L2 for Pattern B: resolve 'Mar 26' -> that calendar month's vouchers."""
    target = next((b for b in month_buckets(fy) if b["id"] == month_id), None)
    if not target:
        return [], 0
    from datetime import datetime
    start = datetime(target["year"], target["month"], 1)
    if target["month"] == 12:
        end = datetime(target["year"] + 1, 1, 1)
    else:
        end = datetime(target["year"], target["month"] + 1, 1)
    match = {"voucherTypeName": {"$in": voucher_types},
             "dates.date": {"$gte": start, "$lt": end}}
    total = voucher_repo.count(db, match)
    docs = voucher_repo.find(
        db, match,
        projection={"voucherNumber": 1, "voucherTypeName": 1, "partyLedgerName": 1,
                    "partyName": 1, "dates.date": 1, "totals": 1, "reference": 1,
                    "basicShippedBy": 1},
        sort=[("dates.date", -1)], skip=(page - 1) * limit, limit=limit)
    return [voucher_row(v) for v in docs], total
