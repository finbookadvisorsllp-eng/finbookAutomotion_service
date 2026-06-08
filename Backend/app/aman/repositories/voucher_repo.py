"""Read access + aggregation pipelines over the ``vouchers`` collection.

This is the single place that knows how to query the transaction journal. All
FY filtering happens here via ``app.aman.services.financial_year.date_filter``.
"""
from bson import ObjectId

from app.aman.services.financial_year import date_filter

DATE_FIELD = "dates.date"


# ─────────────────────────── basic queries ───────────────────────────
def count(db, match: dict) -> int:
    return db["vouchers"].count_documents(match)


def find(db, match: dict, projection: dict | None = None, sort=None,
         skip: int = 0, limit: int = 0) -> list[dict]:
    cur = db["vouchers"].find(match, projection)
    if sort:
        cur = cur.sort(sort)
    if skip:
        cur = cur.skip(skip)
    if limit:
        cur = cur.limit(limit)
    return list(cur)


def by_id_or_number(db, ident: str) -> dict | None:
    """Resolve a voucher by ObjectId, then by voucherNumber."""
    try:
        doc = db["vouchers"].find_one({"_id": ObjectId(ident)})
        if doc:
            return doc
    except Exception:
        pass
    return db["vouchers"].find_one({"voucherNumber": ident})


def fy_match(fy: str, extra: dict | None = None) -> dict:
    match = date_filter(fy)
    if extra:
        match.update(extra)
    return match


# ─────────────────────────── aggregations ───────────────────────────
def ledger_movement(db, fy: str) -> dict[str, dict]:
    """Per-ledger debit/credit movement for the FY.

    Returns ``{ledgerName: {"debit": x, "credit": y}}`` summed from every
    ledgerEntry, bucketed by Tally's ``isDeemedPositive`` with abs(amount).
    """
    # Dr/Cr bucketed by the SIGN of amount (verified universal rule):
    #   amount < 0 -> Debit, amount > 0 -> Credit.
    amt = {"$ifNull": ["$ledgerEntries.amount", 0]}
    pipeline = [
        {"$match": date_filter(fy)},
        {"$unwind": "$ledgerEntries"},
        {"$group": {
            "_id": "$ledgerEntries.ledgerName",
            "debit": {"$sum": {"$cond": [{"$lt": [amt, 0]}, {"$abs": amt}, 0]}},
            "credit": {"$sum": {"$cond": [{"$gt": [amt, 0]}, amt, 0]}},
        }},
    ]
    out: dict[str, dict] = {}
    for row in db["vouchers"].aggregate(pipeline):
        name = row["_id"]
        if name is None:
            continue
        out[name] = {"debit": round(row.get("debit", 0), 2),
                     "credit": round(row.get("credit", 0), 2)}
    return out


def vouchers_for_ledger(db, fy: str, ledger_name: str, skip: int = 0,
                        limit: int = 0, sort_dir: int = -1) -> list[dict]:
    """All vouchers in the FY that touch a given ledger (for L3 drill-down)."""
    match = fy_match(fy, {"ledgerEntries.ledgerName": ledger_name})
    proj = {"voucherNumber": 1, "voucherTypeName": 1, "partyLedgerName": 1,
            "partyName": 1, "dates.date": 1, "reference.reference": 1,
            "ledgerEntries": 1, "totals": 1}
    cur = db["vouchers"].find(match, proj).sort([(DATE_FIELD, sort_dir)])
    if skip:
        cur = cur.skip(skip)
    if limit:
        cur = cur.limit(limit)
    return list(cur)


def count_for_ledger(db, fy: str, ledger_name: str) -> int:
    return db["vouchers"].count_documents(fy_match(fy, {"ledgerEntries.ledgerName": ledger_name}))


def monthly_totals(db, fy: str, voucher_types: list[str]) -> dict[str, float]:
    """Sum of voucher totals grouped by calendar month (for Pattern B L1)."""
    pipeline = [
        {"$match": fy_match(fy, {"voucherTypeName": {"$in": voucher_types}})},
        {"$group": {
            "_id": {"y": {"$year": f"${DATE_FIELD}"}, "m": {"$month": f"${DATE_FIELD}"}},
            "amount": {"$sum": {"$ifNull": ["$totals.totalDebit", 0]}},
            "count": {"$sum": 1},
        }},
    ]
    out: dict[str, float] = {}
    for row in db["vouchers"].aggregate(pipeline):
        out[f"{row['_id']['y']}-{row['_id']['m']:02d}"] = {
            "amount": round(row.get("amount", 0), 2), "count": row.get("count", 0)}
    return out


def vouchers_by_type(db, fy: str, voucher_types: list[str], match_extra: dict | None = None,
                     skip: int = 0, limit: int = 0, sort_dir: int = -1,
                     projection: dict | None = None) -> list[dict]:
    extra = {"voucherTypeName": {"$in": voucher_types}}
    if match_extra:
        extra.update(match_extra)
    return find(db, fy_match(fy, extra), projection,
                sort=[(DATE_FIELD, sort_dir)], skip=skip, limit=limit)


def count_by_type(db, fy: str, voucher_types: list[str], match_extra: dict | None = None) -> int:
    extra = {"voucherTypeName": {"$in": voucher_types}}
    if match_extra:
        extra.update(match_extra)
    return count(db, fy_match(fy, extra))


def type_totals(db, fy: str, voucher_types: list[str]) -> dict:
    """Aggregate count + amount for a set of voucher types in the FY."""
    pipeline = [
        {"$match": fy_match(fy, {"voucherTypeName": {"$in": voucher_types}})},
        {"$group": {"_id": None,
                    "amount": {"$sum": {"$ifNull": ["$totals.totalDebit", 0]}},
                    "count": {"$sum": 1}}},
    ]
    rows = list(db["vouchers"].aggregate(pipeline))
    if not rows:
        return {"amount": 0.0, "count": 0}
    return {"amount": round(rows[0].get("amount", 0), 2), "count": rows[0].get("count", 0)}


def party_totals(db, fy: str, voucher_types: list[str]) -> dict[str, dict]:
    """Per-party total amount, count and last transaction date for a voucher set."""
    pipeline = [
        {"$match": fy_match(fy, {"voucherTypeName": {"$in": voucher_types}})},
        {"$group": {
            "_id": "$partyLedgerName",
            "amount": {"$sum": {"$ifNull": ["$totals.totalDebit", 0]}},
            "count": {"$sum": 1},
            "lastDate": {"$max": f"${DATE_FIELD}"},
        }},
    ]
    out: dict[str, dict] = {}
    for row in db["vouchers"].aggregate(pipeline):
        if row["_id"] is None:
            continue
        out[row["_id"]] = {"amount": round(row.get("amount", 0), 2),
                           "count": row.get("count", 0), "lastDate": row.get("lastDate")}
    return out


def stockitem_totals(db, fy: str, voucher_types: list[str]) -> dict[str, dict]:
    """Per stock-item sold/purchased value + qty (for top-items widgets)."""
    pipeline = [
        {"$match": fy_match(fy, {"voucherTypeName": {"$in": voucher_types}})},
        {"$unwind": "$inventoryEntries"},
        {"$group": {
            "_id": "$inventoryEntries.stockItemName",
            "value": {"$sum": {"$abs": {"$ifNull": ["$inventoryEntries.amount", 0]}}},
            "count": {"$sum": 1},
        }},
    ]
    out: dict[str, dict] = {}
    for row in db["vouchers"].aggregate(pipeline):
        if row["_id"] is None:
            continue
        out[row["_id"]] = {"value": round(row.get("value", 0), 2), "count": row.get("count", 0)}
    return out


def monthly_series(db, fy: str, voucher_types: list[str]) -> dict[int, float]:
    """Month-number -> total amount (for KPI sparklines / trends)."""
    pipeline = [
        {"$match": fy_match(fy, {"voucherTypeName": {"$in": voucher_types}})},
        {"$group": {"_id": {"$month": f"${DATE_FIELD}"},
                    "amount": {"$sum": {"$ifNull": ["$totals.totalDebit", 0]}}}},
    ]
    return {row["_id"]: round(row.get("amount", 0), 2) for row in db["vouchers"].aggregate(pipeline)}


def monthly_ledger_movement(db, fy: str, ledger_names: list[str]) -> dict[int, dict]:
    """Month-number -> {debit, credit} for a set of ledgers (sign-based)."""
    if not ledger_names:
        return {}
    amt = {"$ifNull": ["$ledgerEntries.amount", 0]}
    pipeline = [
        {"$match": fy_match(fy, {"ledgerEntries.ledgerName": {"$in": ledger_names}})},
        {"$unwind": "$ledgerEntries"},
        {"$match": {"ledgerEntries.ledgerName": {"$in": ledger_names}}},
        {"$group": {
            "_id": {"$month": f"${DATE_FIELD}"},
            "debit": {"$sum": {"$cond": [{"$lt": [amt, 0]}, {"$abs": amt}, 0]}},
            "credit": {"$sum": {"$cond": [{"$gt": [amt, 0]}, amt, 0]}},
        }},
    ]
    return {row["_id"]: {"debit": round(row.get("debit", 0), 2),
                        "credit": round(row.get("credit", 0), 2)}
            for row in db["vouchers"].aggregate(pipeline)}
