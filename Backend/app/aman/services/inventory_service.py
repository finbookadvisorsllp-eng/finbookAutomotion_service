"""Inventory service — stock summary, valuation (Avg cost), fast/slow movers.

Accounting model (CA view)
--------------------------
* **Opening stock** is held in the inventory masters
  (``stockItems.inventory.openingStock``). Tally stores the value with the
  asset/debit sign convention (negative = debit). The opening *value* we report
  is therefore ``-value`` (negated signed amount), summed across items — this
  reproduces Tally's "Opening Stock" figure to the paisa, including value-only
  items (value, zero quantity) and credit-balance items.
* **Movement** comes from ``vouchers.inventoryEntries`` (Purchase/Receipt = IN,
  Sales/Delivery = OUT). Quantities parse from strings like ``'483.00 PCS'``.
* **Closing stock** is valued at Weighted Average Cost (matches the Tally
  ``stockGroups.valuationMethod`` of 'Avg. Price').

Data-completeness caveat
------------------------
Closing stock can only be rolled forward accurately when *every* stock movement
is present. Manufacturing/Stock-Journal vouchers (which create finished goods
and consume raw materials) are **not** part of every Tally export. When they are
absent, finished-goods items appear "oversold" (negative closing quantity). We
surface those items with a ``negativeStock`` flag rather than fabricating a
number, and expose :func:`authoritative_closing_value` so an authoritative
Tally Stock-Summary figure can be supplied as *data* (never hardcoded in logic).
"""
from datetime import datetime

from app.aman.core.serializers import money, parse_qty, parse_rate
from app.aman.repositories import stock_repo
from app.aman.services.financial_year import fy_bounds, current_fy


# Stock-group display order fallback (Tally lists the auto group "Primary" last).
def _resolve_dates(fy: str | None = None,
                   start_date: datetime | None = None,
                   end_date: datetime | None = None,
                   date_match: dict | None = None) -> tuple[datetime, datetime]:
    """Resolve a (start, end) window from any of fy / explicit dates / a mongo
    date_match clause. Always returns a concrete inclusive window."""
    if date_match and (start_date is None or end_date is None):
        clause = (date_match or {}).get("dates.date") or {}
        start_date = start_date or clause.get("$gte")
        end_date = end_date or clause.get("$lte") or clause.get("$lt")
    if start_date and end_date:
        return start_date, end_date
    if fy:
        return fy_bounds(fy)
    return fy_bounds(current_fy())


def _opening_of(item: dict) -> tuple[float, float, float]:
    """(quantity, value, rate) opening from a stock master.

    Value is the *debit-positive* asset value (negated Tally signed amount).
    Quantity keeps its sign (Tally shows negative opening qty for some items).
    """
    op = (item.get("inventory") or {}).get("openingStock") or {}
    qty = parse_qty(op.get("quantity"))
    value = -float(op.get("value") or 0)          # negate signed -> debit asset
    rate = parse_rate(op.get("rate")) if op.get("rate") not in (None, "") else 0.0
    if not rate and qty:
        rate = value / qty
    return qty, round(value, 2), round(rate, 4)


def item_rows(db, fy: str | None = None,
              start_date: datetime | None = None,
              end_date: datetime | None = None,
              date_match: dict | None = None) -> list[dict]:
    """Per-item opening / inward / outward / closing with WAC valuation.

    This is the single engine behind every inventory report and the P&L stock
    branches. No company/FY specific constants — every figure is derived.
    """
    start_date, end_date = _resolve_dates(fy, start_date, end_date, date_match)

    masters = stock_repo.all_stock_items(
        db, {"itemName": 1, "stockGroupName": 1, "stockGroupPath": 1,
             "unit.baseUnit": 1, "inventory.openingStock": 1,
             "gstSettings.gstRate": 1, "hsnSacDetails.hsnCode": 1, "reorderLevel": 1})

    pre_movement = stock_repo.inventory_movement(db, date_match={"dates.date": {"$lt": start_date}})
    period_movement = stock_repo.inventory_movement(
        db, date_match={"dates.date": {"$gte": start_date, "$lte": end_date}})

    rows = []
    for i, m in enumerate(masters, start=1):
        name = m.get("itemName")
        if not name:
            continue

        open_qty, open_val, open_rate = _opening_of(m)

        # ── opening AS OF start_date = master opening + movement before start ──
        pre = pre_movement.get(name, {"inQty": 0.0, "inValue": 0.0, "outQty": 0.0, "outValue": 0.0})
        pre_avail_qty = open_qty + pre["inQty"]
        pre_wac = ((open_val + pre["inValue"]) / pre_avail_qty) if pre_avail_qty > 0 else open_rate
        start_qty = round(open_qty + pre["inQty"] - pre["outQty"], 3)
        # additive value carry (preserves value-only items; reduces by COGS at WAC)
        start_val = round(open_val + pre["inValue"] - pre["outQty"] * pre_wac, 2)

        # ── period movement -> closing ──
        mov = period_movement.get(name, {"inQty": 0.0, "inValue": 0.0, "outQty": 0.0,
                                         "outValue": 0.0, "txns": 0})
        in_qty, in_val = mov["inQty"], mov["inValue"]
        out_qty, out_val = mov["outQty"], mov["outValue"]
        close_qty = round(start_qty + in_qty - out_qty, 3)

        avail_qty = start_qty + in_qty
        avail_val = start_val + in_val
        if avail_qty > 0:
            wac = avail_val / avail_qty
            close_val = round(close_qty * wac, 2)
        else:
            # value-only item (never carried a quantity) -> value simply carries
            wac = start_val if start_qty == 0 else 0.0
            close_val = round(start_val, 2)

        negative_stock = close_qty < 0      # oversold: likely missing production journals

        reorder = float(m.get("reorderLevel") or 0)
        if close_qty <= 0:
            status = "critical"
        elif reorder and close_qty < reorder:
            status = "warning"
        else:
            status = "ok"

        rows.append({
            "id": i,
            "name": name,
            "group": m.get("stockGroupName"),
            "groupPath": m.get("stockGroupPath") or m.get("stockGroupName"),
            "unit": (m.get("unit") or {}).get("baseUnit"),
            "hsn": (m.get("hsnSacDetails") or {}).get("hsnCode") or "",
            "gstRate": (m.get("gstSettings") or {}).get("gstRate") or 0,
            # opening (as of start_date)
            "openingQty": start_qty,
            "openingRate": money(pre_wac if pre_avail_qty > 0 else open_rate),
            "opening": start_qty,            # legacy key (qty) used by existing UI
            "opening_value": money(start_val),
            # movement
            "in": round(in_qty, 3),
            "out": round(out_qty, 3),
            # closing (as of end_date)
            "closing": close_qty,
            "rate": money(wac if isinstance(wac, (int, float)) else 0),
            "value": close_val,
            "negativeStock": negative_stock,
            "salesValue": money(out_val),
            "txns": mov.get("txns", 0),
            "reorder": reorder,
            "status": status,
        })
    return rows


# Backwards-compatible alias (older callers import ``item_movements``).
def item_movements(db, fy: str | None = None,
                   start_date: datetime | None = None,
                   end_date: datetime | None = None) -> list[dict]:
    return item_rows(db, fy, start_date, end_date)


# ─────────────────────────── valuation totals ───────────────────────────
def opening_stock_value_range(db, fy: str | None = None,
                              start_date: datetime | None = None,
                              end_date: datetime | None = None,
                              date_match: dict | None = None) -> float:
    """Total opening-stock value (debit asset) as of the window start."""
    rows = item_rows(db, fy, start_date, end_date, date_match)
    return money(sum(r["opening_value"] for r in rows))


def closing_stock_value(db, fy: str | None = None,
                        start_date: datetime | None = None,
                        end_date: datetime | None = None,
                        date_match: dict | None = None) -> float:
    """Total closing-stock value as of the window end.

    Prefers an authoritative Tally Stock-Summary figure when one has been
    supplied as data (see :func:`authoritative_closing_value`); otherwise
    returns the Weighted-Average-Cost roll-forward computed from movements.
    """
    start_date, end_date = _resolve_dates(fy, start_date, end_date, date_match)
    override = authoritative_closing_value(db, start_date, end_date)
    if override is not None:
        return money(override)
    rows = item_rows(db, None, start_date, end_date)
    return money(sum(r["value"] for r in rows))


def authoritative_closing_value(db, start_date: datetime, end_date: datetime) -> float | None:
    """Return a stored authoritative closing-stock value for the period, if any.

    The figure lives in the tenant collection ``aman_stock_periods`` as data —
    e.g. ``{ "fy": "2025-2026", "closingStockValue": 2457200.75,
    "source": "Tally Stock Summary" }`` — so the authoritative Tally number can
    be recorded per company/FY **without hardcoding it in business logic**. The
    Tally sync can populate this collection going forward. Returns ``None`` when
    no override exists, in which case the computed WAC value is used.
    """
    try:
        from app.aman.services.financial_year import fy_of_date
        fy = fy_of_date(start_date)
        doc = db["aman_stock_periods"].find_one({"fy": fy})
        if doc and doc.get("closingStockValue") is not None:
            return float(doc["closingStockValue"])
    except Exception:
        pass
    return None


# ─────────────────────────── opening-stock summary (dedicated page) ───────────────────────────
def _sorted_rows(rows: list[dict], sort: str | None, order: str) -> list[dict]:
    key_map = {
        "name": lambda r: (r.get("name") or "").lower(),
        "group": lambda r: (r.get("group") or "").lower(),
        "quantity": lambda r: r.get("openingQty") or 0,
        "qty": lambda r: r.get("openingQty") or 0,
        "rate": lambda r: r.get("openingRate") or 0,
        "value": lambda r: r.get("opening_value") or 0,
    }
    keyfn = key_map.get((sort or "value").lower(), key_map["value"])
    reverse = (order or "desc").lower() == "desc"
    return sorted(rows, key=keyfn, reverse=reverse)


def opening_stock_summary(db, fy: str | None = None,
                          start_date: datetime | None = None,
                          end_date: datetime | None = None) -> dict:
    """Group-level opening-stock summary (L1 of the Opening Stock page).

    Mirrors Tally's "Opening Stock Summary": one row per stock group with the
    net opening value, total quantity and item count, plus overall totals.
    """
    start_date, end_date = _resolve_dates(fy, start_date, end_date)
    rows = item_rows(db, None, start_date, end_date)

    groups: dict[str, dict] = {}
    for r in rows:
        g = r.get("group") or "Primary"
        rec = groups.setdefault(g, {
            "id": g.lower().replace(" ", "-"),
            "name": g, "value": 0.0, "quantity": 0.0, "itemCount": 0,
        })
        if r["opening_value"] or r["openingQty"]:
            rec["value"] += r["opening_value"]
            rec["quantity"] += r["openingQty"]
            rec["itemCount"] += 1

    group_rows = [
        {**g, "value": money(g["value"]), "quantity": round(g["quantity"], 3)}
        for g in groups.values()
    ]
    # Tally lists the catch-all "Primary" group after the named groups.
    group_rows.sort(key=lambda g: (g["name"] == "Primary", -g["value"]))

    total_value = money(sum(g["value"] for g in group_rows))
    total_items = sum(g["itemCount"] for g in group_rows)
    return {
        "groups": group_rows,
        "summary": {
            "totalValue": total_value,
            "totalItems": total_items,
            "groupCount": len(group_rows),
            "asOfDate": start_date.strftime("%Y-%m-%d"),
            "asOfLabel": start_date.strftime("%d %b %Y"),
        },
    }


def opening_stock_items(db, fy: str | None = None,
                        start_date: datetime | None = None,
                        end_date: datetime | None = None,
                        group: str | None = None, search: str | None = None,
                        sort: str | None = None, order: str = "desc",
                        page: int = 1, limit: int = 50) -> tuple[list[dict], int, dict]:
    """Paginated / searchable / sortable opening-stock item list (L2)."""
    start_date, end_date = _resolve_dates(fy, start_date, end_date)
    rows = [r for r in item_rows(db, None, start_date, end_date)
            if r["opening_value"] or r["openingQty"]]

    if group:
        rows = [r for r in rows if (r.get("group") or "") == group]
    if search:
        q = search.strip().lower()
        rows = [r for r in rows if q in (r.get("name") or "").lower()]

    filtered_total_value = money(sum(r["opening_value"] for r in rows))
    total = len(rows)

    rows = _sorted_rows(rows, sort, order)
    start = (page - 1) * limit
    page_rows = rows[start:start + limit]

    items = [{
        "id": r["name"],
        "name": r["name"],
        "group": r["group"],
        "unit": r["unit"],
        "hsn": r["hsn"],
        "gstRate": r["gstRate"],
        "quantity": r["openingQty"],
        "rate": r["openingRate"],
        "value": r["opening_value"],
    } for r in page_rows]
    return items, total, {"filteredValue": filtered_total_value}


# ─────────────────────────── existing reports (unchanged shapes) ───────────────────────────
def stock_summary(db, fy: str) -> dict:
    rows = item_rows(db, fy)
    total_value = money(sum(r["value"] for r in rows))
    critical = sum(1 for r in rows if r["status"] == "critical")
    warning = sum(1 for r in rows if r["status"] == "warning")
    return {
        "items": rows,
        "summary": {
            "totalItems": len(rows),
            "totalValue": total_value,
            "criticalCount": critical,
            "warningCount": warning,
        },
    }


def fast_moving(db, fy: str, limit: int = 20) -> list[dict]:
    rows = sorted(item_rows(db, fy), key=lambda r: -r["out"])
    return [r for r in rows if r["out"] > 0][:limit]


def slow_moving(db, fy: str, limit: int = 20) -> list[dict]:
    rows = [r for r in item_rows(db, fy) if r["closing"] > 0]
    return sorted(rows, key=lambda r: r["out"])[:limit]


def valuation(db, fy: str) -> dict:
    rows = sorted(item_rows(db, fy), key=lambda r: -r["value"])
    return {"items": rows, "totalValue": money(sum(r["value"] for r in rows))}


def stock_alerts(db, fy: str) -> list[dict]:
    return [r for r in item_rows(db, fy) if r["status"] in ("critical", "warning")]


def item_performance(db, fy: str | None = None, item_name: str | None = None,
                     start_date: datetime | None = None, end_date: datetime | None = None) -> dict:
    """Per-item ledger: vouchers touching the item over the period."""
    from app.aman.core.serializers import fmt_date
    from app.aman.services.financial_year import date_range_filter
    date_match = date_range_filter(start_date, end_date) if start_date and end_date else None
    docs = stock_repo.stock_item_vouchers(db, fy, item_name, date_match=date_match)
    vouchers = []
    for v in docs:
        for ie in v.get("inventoryEntries", []):
            if ie.get("stockItemName") == item_name:
                vouchers.append({
                    "vchNo": v.get("voucherNumber"),
                    "date": fmt_date((v.get("dates") or {}).get("date")),
                    "type": v.get("voucherTypeName"),
                    "ledgerName": v.get("partyLedgerName") or "",
                    "qty": parse_qty(ie.get("actualQty") or ie.get("billedQty")),
                    "amount": money(abs(float(ie.get("amount") or 0))),
                })
    return {"name": item_name, "vouchers": vouchers}
