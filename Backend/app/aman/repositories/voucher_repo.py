"""Read access + aggregation pipelines over the ``vouchers`` collection.

This is the single place that knows how to query the transaction journal. All
FY filtering happens here via ``app.aman.services.financial_year.date_filter``.
"""
from bson import ObjectId

from app.aman.services.financial_year import date_filter

DATE_FIELD = "dates.date"

# Tally **non-accounting** voucher classes — order / note / memorandum / pure-
# inventory documents that never post to ledgers. Tally excludes them from the
# Trial Balance and every ledger balance, so we must too (otherwise a synced
# Delivery Note carrying stray ledger lines inflates Sales/Purchase). These are
# Tally *reserved* parent-class names (identical across every company) matched on
# ``voucherTypeOrigName`` — not company-specific voucher names.
NON_ACCOUNTING_PARENTS = [
    "Sales Order", "Purchase Order", "Delivery Note", "Receipt Note",
    "Quotation", "Job Work In Order", "Job Work Out Order",
    "Material In", "Material Out", "Physical Stock",
    "Rejections In", "Rejections Out", "Memorandum", "Reversing Journal",
]


def accounting_only(match: dict) -> dict:
    """Add the universal 'real books' filters to a match clause: exclude cancelled,
    optional and non-accounting (order/note/memo) vouchers — exactly what Tally
    omits from ledger balances. Idempotent; never overrides an explicit caller key."""
    match.setdefault("flags.isCancelled", {"$ne": True})
    match.setdefault("flags.isOptional", {"$ne": True})
    match.setdefault("voucherTypeOrigName", {"$nin": NON_ACCOUNTING_PARENTS})
    return match


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


def date_match_clause(fy: str | None = None, date_match: dict | None = None, extra: dict | None = None) -> dict:
    match = date_match if date_match is not None else date_filter(fy)
    match = dict(match)
    if extra:
        match.update(extra)
    return match


# ─────────────────────────── aggregations ───────────────────────────
def ledger_movement(db, fy: str | None = None, date_match: dict | None = None) -> dict[str, dict]:
    """Per-ledger debit/credit movement for the period.

    Returns ``{ledgerName: {"debit": x, "credit": y}}`` summed from every
    ledgerEntry, bucketed by Tally's ``isDeemedPositive`` with abs(amount).
    """
    # Dr/Cr bucketed by the SIGN of amount (verified universal rule):
    #   amount < 0 -> Debit, amount > 0 -> Credit.
    # Cancelled, optional and non-accounting (order/note/memo) vouchers are
    # excluded — Tally never posts them to the books, so including them would
    # inflate every ledger/group total (universal rule, not tenant-specific).
    match_clause = accounting_only(dict(date_match if date_match is not None else date_filter(fy)))
    amt = {"$ifNull": ["$ledgerEntries.amount", 0]}
    pipeline = [
        {"$match": match_clause},
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


def build_search_match(match: dict, ledger_name: str | None, search: str | None) -> dict:
    if not search:
        return match
    import re
    escaped_search = re.escape(search)
    search_regex = {"$regex": escaped_search, "$options": "i"}
    
    or_clauses = [
        {"voucherNumber": search_regex},
        {"voucherTypeName": search_regex},
        {"reference.reference": search_regex},
        {"partyLedgerName": search_regex},
        {"partyName": search_regex}
    ]
    
    try:
        val = abs(float(search.replace(",", "")))
        if ledger_name:
            or_clauses.append({
                "ledgerEntries": {
                    "$elemMatch": {
                        "ledgerName": ledger_name,
                        "amount": {"$gte": val - 0.01, "$lte": val + 0.01}
                    }
                }
            })
        else:
            or_clauses.append({
                "ledgerEntries.amount": {"$gte": val - 0.01, "$lte": val + 0.01}
            })
    except ValueError:
        pass
        
    term_lower = search.lower()
    months_map = {
        "jan": 1, "january": 1,
        "feb": 2, "february": 2,
        "mar": 3, "march": 3,
        "apr": 4, "april": 4,
        "may": 5,
        "jun": 6, "june": 6,
        "jul": 7, "july": 7,
        "aug": 8, "august": 8,
        "sep": 9, "september": 9,
        "oct": 10, "october": 10,
        "nov": 11, "november": 11,
        "dec": 12, "december": 12
    }
    
    matched_months = [m_idx for name, m_idx in months_map.items() if name in term_lower]
    for m_idx in matched_months:
        or_clauses.append({
            "$expr": {"$eq": [{"$month": f"${DATE_FIELD}"}, m_idx]}
        })
        
    import re as pyre
    years = pyre.findall(r'\b(20\d{2})\b', term_lower)
    for y in years:
        or_clauses.append({
            "$expr": {"$eq": [{"$year": f"${DATE_FIELD}"}, int(y)]}
        })
        
    days = pyre.findall(r'\b([123]?\d)\b', term_lower)
    for d in days:
        day_num = int(d)
        if 1 <= day_num <= 31:
            or_clauses.append({
                "$expr": {"$eq": [{"$dayOfMonth": f"${DATE_FIELD}"}, day_num]}
            })
            
    match["$or"] = or_clauses
    return match


def vouchers_for_ledger(db, fy: str | None = None, ledger_name: str | None = None, skip: int = 0,
                        limit: int = 0, sort_dir: int = -1, date_match: dict | None = None, search: str | None = None) -> list[dict]:
    """All vouchers in the period that touch a given ledger (for L3 drill-down)."""
    match = date_match_clause(fy, date_match, {"ledgerEntries.ledgerName": ledger_name})
    match = build_search_match(match, ledger_name, search)
    proj = {"voucherNumber": 1, "voucherTypeName": 1, "partyLedgerName": 1,
            "partyName": 1, "dates.date": 1, "reference.reference": 1,
            "ledgerEntries": 1, "totals": 1}
    cur = db["vouchers"].find(match, proj).sort([(DATE_FIELD, sort_dir)])
    if skip:
        cur = cur.skip(skip)
    if limit:
        cur = cur.limit(limit)
    return list(cur)


def count_for_ledger(db, fy: str | None = None, ledger_name: str | None = None, date_match: dict | None = None, search: str | None = None) -> int:
    match = date_match_clause(fy, date_match, {"ledgerEntries.ledgerName": ledger_name})
    match = build_search_match(match, ledger_name, search)
    return db["vouchers"].count_documents(match)


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


def recent_with_measure(db, fy: str, limit: int = 10) -> list[dict]:
    """Most recent vouchers (any type) with a *derived* amount + tax.

    ``amount`` is the voucher's debit-side magnitude (its total) derived from
    ``ledgerEntries`` via the universal measure stages, so it is correct even on
    tenants whose ``totals`` block is absent; ``tax`` is the Σ of GST/CESS/TCS
    lines. Powers the dashboard "Recent Transactions" widget and reconciles with
    each voucher's detail drill-down.
    """
    pipeline = [
        {"$match": fy_match(fy)},
        {"$sort": {DATE_FIELD: -1, "_id": -1}},
        {"$limit": int(limit)},
        _measure_stage(), _derive_stage(),
        {"$project": {
            "voucherNumber": 1, "voucherTypeName": 1, "voucherTypeOrigName": 1,
            "partyLedgerName": 1, "partyName": 1, "dates.date": 1,
            "amount": "$_gross", "tax": "$_tax"}},
    ]
    return list(db["vouchers"].aggregate(pipeline, allowDiskUse=True))


def monthly_series(db, fy: str, voucher_types: list[str]) -> dict[int, float]:
    """Month-number -> total amount (for KPI sparklines / trends)."""
    pipeline = [
        {"$match": fy_match(fy, {"voucherTypeName": {"$in": voucher_types}})},
        {"$group": {"_id": {"$month": f"${DATE_FIELD}"},
                    "amount": {"$sum": {"$ifNull": ["$totals.totalDebit", 0]}}}},
    ]
    return {row["_id"]: round(row.get("amount", 0), 2) for row in db["vouchers"].aggregate(pipeline)}


def monthly_ledger_movement(db, fy: str | None = None, ledger_names: list[str] = None, date_match: dict | None = None) -> dict[int, dict]:
    """Month-number -> {debit, credit} for a set of ledgers (sign-based)."""
    if not ledger_names:
        return {}
    match_clause = accounting_only(date_match_clause(fy, date_match, {"ledgerEntries.ledgerName": {"$in": ledger_names}}))
    amt = {"$ifNull": ["$ledgerEntries.amount", 0]}
    pipeline = [
        {"$match": match_clause},
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


def ledgers_movement(db, date_match: dict, ledger_names: list[str]) -> dict[str, dict]:
    """Per-ledger {debit, credit} for a *restricted* set of ledgers over a range.

    Like ``ledger_movement`` but pre-filters vouchers to those touching one of
    ``ledger_names`` and only sums those lines — efficient for the cash/bank pool
    even on tenants with lakhs of vouchers. Sign rule: amount<0 Dr, amount>0 Cr.
    """
    if not ledger_names:
        return {}
    amt = {"$ifNull": ["$ledgerEntries.amount", 0]}
    pipeline = [
        {"$match": {**date_match, "ledgerEntries.ledgerName": {"$in": ledger_names}}},
        {"$unwind": "$ledgerEntries"},
        {"$match": {"ledgerEntries.ledgerName": {"$in": ledger_names}}},
        {"$group": {
            "_id": "$ledgerEntries.ledgerName",
            "debit": {"$sum": {"$cond": [{"$lt": [amt, 0]}, {"$abs": amt}, 0]}},
            "credit": {"$sum": {"$cond": [{"$gt": [amt, 0]}, amt, 0]}},
        }},
    ]
    out: dict[str, dict] = {}
    for row in db["vouchers"].aggregate(pipeline):
        if row["_id"] is None:
            continue
        out[row["_id"]] = {"debit": round(row.get("debit", 0), 2),
                           "credit": round(row.get("credit", 0), 2)}
    return out


def ledger_period_movement(db, date_match: dict, ledger_name: str) -> tuple[float, float]:
    """Total (debit, credit) magnitude of a single ledger over a date range.

    Used to roll an opening balance forward to the start of a sub-period (a month
    or a custom range) so a date-wise statement opens with the correct figure.
    Sign rule: amount < 0 -> Debit, amount > 0 -> Credit.
    """
    amt = {"$ifNull": ["$ledgerEntries.amount", 0]}
    pipeline = [
        {"$match": {**date_match, "ledgerEntries.ledgerName": ledger_name}},
        {"$unwind": "$ledgerEntries"},
        {"$match": {"ledgerEntries.ledgerName": ledger_name}},
        {"$group": {
            "_id": None,
            "debit": {"$sum": {"$cond": [{"$lt": [amt, 0]}, {"$abs": amt}, 0]}},
            "credit": {"$sum": {"$cond": [{"$gt": [amt, 0]}, amt, 0]}},
        }},
    ]
    rows = list(db["vouchers"].aggregate(pipeline))
    if not rows:
        return 0.0, 0.0
    return round(rows[0].get("debit", 0), 2), round(rows[0].get("credit", 0), 2)


# ─────────────────────── Document register engine (Sales / Sales Order /
# ─────────────────────── Credit Note / Delivery Note) ───────────────────────
# Universal classification + measures shared by every sales-side document register.
# A document is identified by Tally's reserved PARENT class (``voucherTypeOrigName``
# / ``voucherCategory``), never by the company-specific ``voucherTypeName`` — so the
# same code works for every tenant. Amounts are derived from ``ledgerEntries`` (sign
# rule) and ``inventoryEntries`` because the ``totals`` block is absent in many
# tenants' synced data, and because order / delivery documents are *non-accounting*
# (no ledger postings) so their value lives only in the inventory lines.
SALES_TAX_REGEX = r"CGST|SGST|IGST|CESS|GST|TCS"


def doc_base_match(parents: list[str], start, end, extra: dict | None = None) -> dict:
    """Base match for a document class in a period (excludes cancelled/optional)."""
    match = {
        "voucherTypeOrigName": {"$in": parents},
        "dates.date": {"$gte": start, "$lte": end},
        "flags.isCancelled": {"$ne": True},
        "flags.isOptional": {"$ne": True},
    }
    if extra:
        for k, v in extra.items():
            if k == "dates.date":          # caller narrows the window (e.g. a month)
                match["dates.date"] = v
            else:
                match[k] = v
    return match


def sales_base_match(start, end, extra: dict | None = None) -> dict:
    """Back-compat shim: the Sales document class."""
    return doc_base_match(["Sales"], start, end, extra)


def _measure_stage() -> dict:
    """Per-voucher raw magnitudes used to derive Gross / Net (see _derive_stage)."""
    led = {"$ifNull": ["$ledgerEntries", []]}
    inv = {"$ifNull": ["$inventoryEntries", []]}
    return {"$addFields": {
        # Debit-side magnitude = the voucher's total value (a balanced voucher's
        # Σdebit == Σcredit). Zero for non-accounting order/delivery vouchers.
        "_grossRaw": {"$sum": {"$map": {"input": led, "as": "e",
                      "in": {"$cond": [{"$lt": ["$$e.amount", 0]}, {"$abs": "$$e.amount"}, 0]}}}},
        # Tax = Σ GST/CESS/TCS ledger lines (used to net service invoices that carry
        # no inventory lines).
        "_tax": {"$sum": {"$map": {"input": {"$filter": {"input": led, "as": "e",
                 "cond": {"$regexMatch": {"input": {"$toUpper": {"$ifNull": ["$$e.ledgerName", ""]}},
                                          "regex": SALES_TAX_REGEX}}}},
                 "as": "e", "in": {"$abs": "$$e.amount"}}}},
        # Σ stock-item value (the goods value; the only value on order/delivery docs).
        "_netInv": {"$sum": {"$map": {"input": inv, "as": "i",
                    "in": {"$abs": {"$ifNull": ["$$i.amount", 0]}}}}},
    }}


def _derive_stage() -> dict:
    """Final Gross / Net per voucher (universal across accounting & order docs).

    Gross = document total incl. tax (debit-side magnitude); for non-accounting
    order/delivery vouchers (no ledger postings) it falls back to the goods value.
    Net  = taxable goods value (inventory); falls back to gross−tax for item-less
    (service) vouchers.
    """
    return {"$addFields": {
        "_gross": {"$cond": [{"$gt": ["$_grossRaw", 0]}, "$_grossRaw", "$_netInv"]},
        "_net": {"$cond": [{"$gt": ["$_netInv", 0]}, "$_netInv",
                 {"$max": [{"$subtract": ["$_grossRaw", "$_tax"]}, 0]}]},
    }}


def _qty_of(entry: str | dict) -> dict:
    """Leading numeric of an inventory line's qty string ('5.00 Pcs = 2.5 Kg' -> 5.0).

    ``entry`` is the inventory-entry expression — ``"$inventoryEntries"`` after an
    unwind, or a ``$map`` variable like ``"$$i"`` when summing over the array.
    """
    src = {"$ifNull": [f"{entry}.actualQty", {"$ifNull": [f"{entry}.billedQty", ""]}]}
    return {"$let": {"vars": {"m": {"$regexFind": {"input": src, "regex": r"[0-9][0-9.,]*"}}},
            "in": {"$cond": [{"$eq": ["$$m", None]}, 0,
                   {"$toDouble": {"$replaceAll": {"input": "$$m.match", "find": ",", "replacement": ""}}}]}}}


def _qty_expr() -> dict:
    """Per-line qty (post-unwind) — used by the stock-item grouping."""
    return _qty_of("$inventoryEntries")


def _voucher_qty_expr() -> dict:
    """Total qty across a voucher's inventory lines (pre-unwind)."""
    return {"$sum": {"$map": {"input": {"$ifNull": ["$inventoryEntries", []]}, "as": "i",
            "in": _qty_of("$$i")}}}


def sales_total(db, base_match: dict) -> dict:
    """Whole-period {gross, net, count} for a sales base match."""
    pipeline = [{"$match": base_match}, _measure_stage(), _derive_stage(),
                {"$group": {"_id": None, "gross": {"$sum": "$_gross"},
                            "net": {"$sum": "$_net"}, "count": {"$sum": 1}}}]
    rows = list(db["vouchers"].aggregate(pipeline, allowDiskUse=True))
    if not rows:
        return {"gross": 0.0, "net": 0.0, "count": 0}
    r = rows[0]
    return {"gross": round(r["gross"], 2), "net": round(r["net"], 2), "count": r["count"]}


def sales_group_by_voucher(db, base_match: dict, group_id) -> list[dict]:
    """Group sales by a voucher-level key, summing Gross & Net per voucher.

    ``group_id`` is any aggregation _id expression (a field path string like
    ``"$partyLedgerName"`` or a composite dict for month). Returns
    ``[{key, gross, net, count}]``.
    """
    pipeline = [{"$match": base_match}, _measure_stage(), _derive_stage(),
                {"$group": {"_id": group_id, "gross": {"$sum": "$_gross"},
                            "net": {"$sum": "$_net"}, "count": {"$sum": 1}}}]
    return [{"key": r["_id"], "gross": round(r["gross"], 2), "net": round(r["net"], 2),
             "count": r["count"]} for r in db["vouchers"].aggregate(pipeline, allowDiskUse=True)]


def sales_group_by_item(db, base_match: dict, with_qty: bool = True) -> list[dict]:
    """Group sales by stock item (unwind inventory). Amount = stock-item value.

    Per-item there is no GST split, so Gross == Net == item value here.
    Returns ``[{key, amount, qty, count}]`` keyed by ``stockItemName``.
    """
    group = {"_id": "$inventoryEntries.stockItemName",
             "amount": {"$sum": {"$abs": {"$ifNull": ["$inventoryEntries.amount", 0]}}},
             "count": {"$sum": 1}}
    if with_qty:
        group["qty"] = {"$sum": _qty_expr()}
    pipeline = [{"$match": base_match}, {"$unwind": "$inventoryEntries"}, {"$group": group}]
    out = []
    for r in db["vouchers"].aggregate(pipeline, allowDiskUse=True):
        out.append({"key": r["_id"], "amount": round(r["amount"], 2),
                    "qty": round(r.get("qty", 0), 3), "count": r["count"]})
    return out


def sales_voucher_page(db, base_match: dict, page: int, limit: int,
                       search: str | None, sort: str | None, order: str) -> tuple[list[dict], dict]:
    """Paginated per-invoice rows (Gross & Net per voucher) for a sales match."""
    pipeline = [{"$match": base_match}, _measure_stage(), _derive_stage()]
    if search:
        rx = {"$regex": search, "$options": "i"}
        pipeline.append({"$match": {"$or": [
            {"voucherNumber": rx}, {"partyLedgerName": rx},
            {"partyName": rx}, {"voucherTypeName": rx}]}})
    sort_field = {"date": "dates.date", "amount": "_gross", "net": "_net",
                  "party": "partyLedgerName", "number": "voucherNumber",
                  "type": "voucherTypeName"}.get(sort or "date", "dates.date")
    direction = -1 if (order or "desc").lower() == "desc" else 1
    skip = (page - 1) * limit if limit else 0
    data_stage = [{"$skip": skip}] + ([{"$limit": limit}] if limit else [])
    pipeline += [
        {"$project": {"voucherNumber": 1, "voucherTypeName": 1, "partyLedgerName": 1,
                      "partyName": 1, "dates.date": 1, "reference.reference": 1,
                      "_gross": 1, "_net": 1, "qty": _voucher_qty_expr(),
                      "items": {"$size": {"$ifNull": ["$inventoryEntries", []]}}}},
        {"$sort": {sort_field: direction, "_id": 1}},
        {"$facet": {"data": data_stage,
                    "meta": [{"$group": {"_id": None, "count": {"$sum": 1},
                                         "gross": {"$sum": "$_gross"}, "net": {"$sum": "$_net"}}}]}},
    ]
    out = list(db["vouchers"].aggregate(pipeline, allowDiskUse=True))
    facet = out[0] if out else {"data": [], "meta": []}
    meta = (facet.get("meta") or [{}])[0]
    total = meta.get("count", 0)
    return facet.get("data", []), {
        "gross": round(meta.get("gross", 0), 2), "net": round(meta.get("net", 0), 2),
        "count": total,
    }


def ledger_running_statement(db, date_match: dict, ledger_name: str, opening: float,
                             skip: int = 0, limit: int = 0, voucher_type: str | None = None,
                             search: str | None = None) -> tuple[list[dict], int, dict]:
    """Date-ordered voucher register for one ledger with a running balance.

    One voucher collapses to one row carrying its *net* effect on the ledger:
        receipts = debit magnitude (amount < 0)   — money into a cash/bank asset
        payments = credit magnitude (amount > 0)   — money out
    The running balance starts from ``opening`` and is accumulated server-side via
    ``$setWindowFields`` (Mongo 5.0+) so it remains correct under pagination.
    Filters (voucher type / free-text search on party or voucher number) are
    applied *before* the running total, keeping the on-screen figures consistent.

    Returns ``(rows, total, totals)`` where ``totals`` = {receipts, payments,
    closing} over the whole filtered set (not just the page).
    """
    amt = {"$ifNull": ["$ledgerEntries.amount", 0]}
    head_match: dict = {**date_match, "ledgerEntries.ledgerName": ledger_name}
    if voucher_type:
        head_match["voucherTypeName"] = voucher_type

    pipeline: list[dict] = [
        {"$match": head_match},
        {"$unwind": "$ledgerEntries"},
        {"$match": {"ledgerEntries.ledgerName": ledger_name}},
        {"$group": {
            "_id": "$_id",
            "date": {"$first": f"${DATE_FIELD}"},
            "voucherNumber": {"$first": "$voucherNumber"},
            "voucherTypeName": {"$first": "$voucherTypeName"},
            "partyLedgerName": {"$first": {"$ifNull": ["$partyLedgerName", "$partyName"]}},
            "ref": {"$first": {"$ifNull": ["$reference.reference", ""]}},
            "narration": {"$first": {"$ifNull": ["$narration", ""]}},
            "receipts": {"$sum": {"$cond": [{"$lt": [amt, 0]}, {"$abs": amt}, 0]}},
            "payments": {"$sum": {"$cond": [{"$gt": [amt, 0]}, amt, 0]}},
        }},
    ]

    if search:
        rx = {"$regex": search, "$options": "i"}
        pipeline.append({"$match": {"$or": [
            {"voucherNumber": rx}, {"partyLedgerName": rx}, {"voucherTypeName": rx},
        ]}})

    pipeline += [
        {"$addFields": {"net": {"$subtract": ["$receipts", "$payments"]}}},
        {"$sort": {"date": 1, "voucherNumber": 1, "_id": 1}},
        {"$setWindowFields": {
            "sortBy": {"date": 1, "voucherNumber": 1, "_id": 1},
            "output": {"runningNet": {
                "$sum": "$net",
                "window": {"documents": ["unbounded", "current"]},
            }},
        }},
        {"$addFields": {"running": {"$add": [opening, "$runningNet"]}}},
        {"$facet": {
            "data": ([{"$skip": skip}] + ([{"$limit": limit}] if limit else [])),
            "meta": [{"$group": {
                "_id": None, "count": {"$sum": 1},
                "receipts": {"$sum": "$receipts"}, "payments": {"$sum": "$payments"},
            }}],
        }},
    ]

    out = list(db["vouchers"].aggregate(pipeline))
    facet = out[0] if out else {"data": [], "meta": []}
    rows = facet.get("data", [])
    meta = (facet.get("meta") or [{}])[0]
    total = meta.get("count", 0)
    totals = {
        "receipts": round(meta.get("receipts", 0), 2),
        "payments": round(meta.get("payments", 0), 2),
        "closing": round(opening + meta.get("receipts", 0) - meta.get("payments", 0), 2),
    }
    return rows, total, totals

