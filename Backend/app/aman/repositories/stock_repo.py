"""Read access to ``stockItems`` + inventory movement from voucher entries."""
from app.aman.repositories.voucher_repo import fy_match
from app.aman.core.serializers import parse_qty

DATE_FIELD = "dates.date"

# Voucher types that move stock OUT vs IN.
OUTWARD_TYPES = ["Sales", "Delivery Challan", "Delivery Note", "Material Out", "Rejections Out"]
INWARD_TYPES = ["Purchase", "Receipt Note", "Material In", "Rejections In"]


def all_stock_items(db, projection: dict | None = None) -> list[dict]:
    return list(db["stockItems"].find({}, projection))


def stock_item_by_name(db) -> dict[str, dict]:
    return {s.get("itemName"): s for s in all_stock_items(db) if s.get("itemName")}


def inventory_movement(db, fy: str | None = None, date_match: dict | None = None) -> dict[str, dict]:
    """Per stock item: inward/outward qty + value within the period.

    ``actualQty`` is stored as a string like ``'483.00 PCS'`` and ``rate`` as
    ``'51.00/PCS'`` so the parse happens in Python after pulling entries.
    """
    from app.aman.repositories.voucher_repo import date_match_clause
    match_clause = date_match_clause(fy, date_match)
    pipeline = [
        {"$match": match_clause},
        {"$project": {"voucherTypeName": 1, "inventoryEntries": 1, "dates.date": 1}},
        {"$unwind": "$inventoryEntries"},
    ]
    out: dict[str, dict] = {}
    for row in db["vouchers"].aggregate(pipeline):
        ie = row.get("inventoryEntries") or {}
        name = ie.get("stockItemName")
        if not name:
            continue
        qty = parse_qty(ie.get("actualQty") or ie.get("billedQty"))
        amount = abs(float(ie.get("amount") or 0))
        vtype = row.get("voucherTypeName")
        rec = out.setdefault(name, {"inQty": 0.0, "inValue": 0.0, "outQty": 0.0,
                                    "outValue": 0.0, "txns": 0})
        rec["txns"] += 1
        if vtype in OUTWARD_TYPES:
            rec["outQty"] += qty
            rec["outValue"] += amount
        elif vtype in INWARD_TYPES:
            rec["inQty"] += qty
            rec["inValue"] += amount
    return out


def stock_item_vouchers(db, fy: str | None = None, item_name: str | None = None, date_match: dict | None = None) -> list[dict]:
    """Vouchers in the period that include a given stock item (for stock-item ledger)."""
    from app.aman.repositories.voucher_repo import date_match_clause
    match = date_match_clause(fy, date_match, {"inventoryEntries.stockItemName": item_name})
    proj = {"voucherNumber": 1, "voucherTypeName": 1, "partyLedgerName": 1,
            "dates.date": 1, "inventoryEntries": 1}
    return list(db["vouchers"].find(match, proj).sort([(DATE_FIELD, 1)]))

