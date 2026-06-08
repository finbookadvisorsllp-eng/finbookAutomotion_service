"""Sales / Purchase registers + Order/Note documents.

Registers are flat voucher lists (SalesRegister / PurchaseRegister). Order/Note
documents (Sales Order, Credit Note, Delivery Note, Purchase Order, Debit Note,
Receipt Note) use the Pattern-B monthly drill from drilldown_service.
"""
from app.aman.core.serializers import money, fmt_date, iso_date
from app.aman.repositories import voucher_repo
from app.aman.services import drilldown_service as dd

# Voucher type groupings (matches the live voucherTypes collection).
TYPES = {
    "sales": ["Sales"],
    "sales_order": ["Sales Order"],
    "credit_note": ["Credit Note"],
    "delivery_note": ["Delivery Challan", "Delivery Note", "Deliver", "Deliv"],
    "purchase": ["Purchase"],
    "purchase_order": ["Purchase Order"],
    "debit_note": ["Debit Note"],
    "receipt_note": ["Receipt Note"],
    "journal": ["Journal"],
    "payment": ["Payment"],
    "receipt": ["Receipt"],
    "contra": ["Contra"],
}

_TAX_TOKENS = ("CGST", "SGST", "IGST", "CESS", "GST", "TCS")


def _register_row(v: dict) -> dict:
    inv = v.get("inventoryEntries") or []
    taxable = sum(abs(float(ie.get("amount") or 0)) for ie in inv)
    gst = 0.0
    for e in v.get("ledgerEntries", []):
        name = (e.get("ledgerName") or "").upper()
        if any(tok in name for tok in _TAX_TOKENS):
            gst += abs(float(e.get("amount") or 0))
    totals = v.get("totals") or {}
    total = money(totals.get("totalDebit") or 0)
    if not taxable:
        taxable = max(total - gst, 0)
    return {
        "id": v.get("voucherNumber") or str(v.get("_id")),
        "voucherId": str(v.get("_id")),
        "date": fmt_date((v.get("dates") or {}).get("date")),
        "isoDate": iso_date((v.get("dates") or {}).get("date")),
        "party": v.get("partyLedgerName") or v.get("partyName") or "",
        "items": totals.get("itemCount") or len(inv),
        "taxable": money(taxable),
        "gst": money(gst),
        "total": total,
        "type": v.get("voucherTypeName"),
        "status": "posted",
        "payMode": "",
    }


def register(db, fy: str, type_key: str, page: int = 1, limit: int = 50,
             search: str | None = None, sort_dir: int = -1) -> tuple[list, int]:
    vtypes = TYPES.get(type_key, [type_key])
    extra = {}
    if search:
        extra["$or"] = [
            {"voucherNumber": {"$regex": search, "$options": "i"}},
            {"partyLedgerName": {"$regex": search, "$options": "i"}},
            {"partyName": {"$regex": search, "$options": "i"}},
        ]
    total = voucher_repo.count_by_type(db, fy, vtypes, extra)
    docs = voucher_repo.vouchers_by_type(
        db, fy, vtypes, match_extra=extra, skip=(page - 1) * limit, limit=limit,
        sort_dir=sort_dir,
        projection={"voucherNumber": 1, "voucherTypeName": 1, "partyLedgerName": 1,
                    "partyName": 1, "dates.date": 1, "totals": 1,
                    "inventoryEntries.amount": 1, "ledgerEntries": 1})
    return [_register_row(v) for v in docs], total


def stats(db, fy: str, type_key: str) -> dict:
    vtypes = TYPES.get(type_key, [type_key])
    t = voucher_repo.type_totals(db, fy, vtypes)
    return {"totalAmount": t["amount"], "count": t["count"],
            "averageValue": money(t["amount"] / t["count"]) if t["count"] else 0.0}


def monthly_drilldown(db, fy: str, type_key: str) -> dict:
    return dd.monthly_summary(db, fy, TYPES.get(type_key, [type_key]))


def month_vouchers(db, fy: str, type_key: str, month_id: str,
                   page: int = 1, limit: int = 200) -> tuple[list, int]:
    return dd.voucher_list_for_month(db, fy, TYPES.get(type_key, [type_key]),
                                     month_id, page, limit)
