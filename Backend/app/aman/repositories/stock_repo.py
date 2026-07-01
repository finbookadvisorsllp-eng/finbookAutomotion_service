"""Read access to ``stockItems`` + inventory movement from voucher entries.

Stock movement is classified by Tally's reserved PARENT class
(``voucherTypeOrigName``) — never the company-specific ``voucherTypeName`` — so
the same code works for every tenant (the same universal rule used by the sales
engine). Quantities/rates are stored as strings ('483.00 PCS', '51.00/PCS'); the
leading number is extracted in-pipeline so large tenants aggregate server-side.
"""
DATE_FIELD = "dates.date"

# Stock OUT (goods leave) vs IN (goods arrive), by Tally parent class.
OUT_PARENTS = ["Sales", "Delivery Note", "Delivery Challan", "Material Out",
               "Rejections Out", "Debit Note"]
IN_PARENTS = ["Purchase", "Receipt Note", "Material In", "Rejections In", "Credit Note"]
MOVE_PARENTS = OUT_PARENTS + IN_PARENTS


def all_stock_items(db, projection: dict | None = None) -> list[dict]:
    return list(db["stockItems"].find({}, projection))


def stock_item_by_name(db) -> dict[str, dict]:
    return {s.get("itemName"): s for s in all_stock_items(db) if s.get("itemName")}


# ─────────────────────────── pipeline helpers ───────────────────────────
def _num(field) -> dict:
    """Leading number of a Tally qty/rate string ('510.000 Kg' / '105.00/Kg' -> 510 / 105)."""
    return {"$let": {"vars": {"m": {"$regexFind": {"input": {"$ifNull": [field, ""]}, "regex": r"[0-9][0-9.,]*"}}},
            "in": {"$cond": [{"$eq": ["$$m", None]}, 0,
                   {"$toDouble": {"$replaceAll": {"input": "$$m.match", "find": ",", "replacement": ""}}}]}}}


def _date_match(fy, date_match):
    from app.aman.repositories.voucher_repo import date_match_clause
    return date_match_clause(fy, date_match)


# ─────────────────────────── movement ───────────────────────────
def movement_by_item(db, date_match: dict) -> dict[str, dict]:
    """Per stock item: IN/OUT + Sales/Purchase qty & value + last movement dates.

    One server-side aggregation classified by ``voucherTypeOrigName``. Returns
    ``{itemName: {inQty,inValue,outQty,outValue,salesQty,salesValue,purchaseQty,
    purchaseValue,lastSaleDate,lastPurchaseDate,lastOutDate,lastInDate,txns}}``.
    """
    qty = _num({"$ifNull": ["$inventoryEntries.actualQty", "$inventoryEntries.billedQty"]})
    val = {"$abs": {"$ifNull": ["$inventoryEntries.amount", 0]}}
    parent = "$voucherTypeOrigName"
    is_out = {"$in": [parent, OUT_PARENTS]}
    is_in = {"$in": [parent, IN_PARENTS]}
    is_sale = {"$eq": [parent, "Sales"]}
    is_pur = {"$eq": [parent, "Purchase"]}
    d = f"${DATE_FIELD}"
    pipeline = [
        {"$match": {**date_match, "voucherTypeOrigName": {"$in": MOVE_PARENTS}}},
        {"$project": {"voucherTypeOrigName": 1, "dates.date": 1, "inventoryEntries": 1}},
        {"$unwind": "$inventoryEntries"},
        {"$group": {
            "_id": "$inventoryEntries.stockItemName",
            "inQty": {"$sum": {"$cond": [is_in, qty, 0]}},
            "inValue": {"$sum": {"$cond": [is_in, val, 0]}},
            "outQty": {"$sum": {"$cond": [is_out, qty, 0]}},
            "outValue": {"$sum": {"$cond": [is_out, val, 0]}},
            "salesQty": {"$sum": {"$cond": [is_sale, qty, 0]}},
            "salesValue": {"$sum": {"$cond": [is_sale, val, 0]}},
            "purchaseQty": {"$sum": {"$cond": [is_pur, qty, 0]}},
            "purchaseValue": {"$sum": {"$cond": [is_pur, val, 0]}},
            "lastSaleDate": {"$max": {"$cond": [is_sale, d, None]}},
            "lastPurchaseDate": {"$max": {"$cond": [is_pur, d, None]}},
            "lastOutDate": {"$max": {"$cond": [is_out, d, None]}},
            "lastInDate": {"$max": {"$cond": [is_in, d, None]}},
            "txns": {"$sum": 1},
        }},
    ]
    out: dict[str, dict] = {}
    for r in db["vouchers"].aggregate(pipeline, allowDiskUse=True):
        name = r.get("_id")
        if not name:
            continue
        out[name] = {
            "inQty": round(r.get("inQty", 0), 3), "inValue": round(r.get("inValue", 0), 2),
            "outQty": round(r.get("outQty", 0), 3), "outValue": round(r.get("outValue", 0), 2),
            "salesQty": round(r.get("salesQty", 0), 3), "salesValue": round(r.get("salesValue", 0), 2),
            "purchaseQty": round(r.get("purchaseQty", 0), 3), "purchaseValue": round(r.get("purchaseValue", 0), 2),
            "lastSaleDate": r.get("lastSaleDate"), "lastPurchaseDate": r.get("lastPurchaseDate"),
            "lastOutDate": r.get("lastOutDate"), "lastInDate": r.get("lastInDate"),
            "txns": r.get("txns", 0),
        }
    return out


def inventory_movement(db, fy: str | None = None, date_match: dict | None = None) -> dict[str, dict]:
    """Legacy 5-key movement shape (in/out qty+value+txns), classifier-fixed.

    Kept for existing callers (P&L stock branches, ``item_rows`` opening
    roll-forward). Now classified by ``voucherTypeOrigName`` so it is correct for
    companies with custom voucher-type names.
    """
    full = movement_by_item(db, _date_match(fy, date_match))
    return {n: {"inQty": v["inQty"], "inValue": v["inValue"], "outQty": v["outQty"],
                "outValue": v["outValue"], "txns": v["txns"]} for n, v in full.items()}


def last_rate_by_item(db, date_match: dict, parents: list[str]) -> dict[str, float]:
    """Latest unit rate per item from a voucher class (for Last-Sale/Last-Purchase valuation)."""
    pipeline = [
        {"$match": {**date_match, "voucherTypeOrigName": {"$in": parents}}},
        {"$project": {"d": f"${DATE_FIELD}", "inventoryEntries": 1}},
        {"$unwind": "$inventoryEntries"},
        {"$project": {"name": "$inventoryEntries.stockItemName", "d": 1,
                      "rate": _num("$inventoryEntries.rate")}},
        {"$match": {"rate": {"$gt": 0}}},
        {"$sort": {"d": 1}},
        {"$group": {"_id": "$name", "rate": {"$last": "$rate"}}},
    ]
    return {r["_id"]: round(r["rate"], 4) for r in db["vouchers"].aggregate(pipeline, allowDiskUse=True) if r["_id"]}


def purchase_layers_by_item(db, date_match: dict) -> dict[str, list]:
    """Date-ordered purchase layers per item (for FIFO closing valuation)."""
    qty = _num({"$ifNull": ["$inventoryEntries.actualQty", "$inventoryEntries.billedQty"]})
    rate = _num("$inventoryEntries.rate")
    val = {"$abs": {"$ifNull": ["$inventoryEntries.amount", 0]}}
    pipeline = [
        {"$match": {**date_match, "voucherTypeOrigName": {"$in": ["Purchase", "Receipt Note"]}}},
        {"$project": {"d": f"${DATE_FIELD}", "inventoryEntries": 1}},
        {"$unwind": "$inventoryEntries"},
        {"$project": {"name": "$inventoryEntries.stockItemName", "d": 1, "qty": qty, "rate": rate, "val": val}},
        {"$match": {"qty": {"$gt": 0}}},
        {"$sort": {"d": 1}},
        {"$group": {"_id": "$name", "layers": {"$push": {"qty": "$qty", "rate": "$rate", "val": "$val"}}}},
    ]
    return {r["_id"]: r["layers"] for r in db["vouchers"].aggregate(pipeline, allowDiskUse=True) if r["_id"]}


def stock_item_vouchers(db, fy: str | None = None, item_name: str | None = None,
                        date_match: dict | None = None) -> list[dict]:
    """Vouchers in the period that include a given stock item (for stock-item ledger)."""
    from app.aman.repositories.voucher_repo import date_match_clause
    match = date_match_clause(fy, date_match, {"inventoryEntries.stockItemName": item_name})
    proj = {"voucherNumber": 1, "voucherTypeName": 1, "voucherTypeOrigName": 1,
            "partyLedgerName": 1, "dates.date": 1, "inventoryEntries": 1}
    return list(db["vouchers"].find(match, proj).sort([(DATE_FIELD, 1)]))
