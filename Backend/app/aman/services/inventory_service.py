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


# ─────────────────────────── valuation (per Tally-configured method) ───────────────────────────
def _costing_method(item: dict) -> str:
    """The item's configured Tally costing method (drives closing-stock value)."""
    m = ((item.get("pricing") or {}).get("costingMethod") or "").strip()
    return m or "Avg. Cost"


def _item_mrp(item: dict) -> float:
    rates = ((item.get("pricing") or {}).get("MRP") or {}).get("rates") or []
    for r in rates:
        if r.get("mrpRate"):
            return parse_rate(r.get("mrpRate"))
    return 0.0


def _valuation_context(db, end_date: datetime) -> dict:
    """Rate maps + purchase layers needed to value items by FIFO / Last-Sale /
    Last-Purchase (fetched once, as of the period end)."""
    upto = {"dates.date": {"$lte": end_date}}
    return {
        "lastSale": stock_repo.last_rate_by_item(db, upto, ["Sales"]),
        "lastPurchase": stock_repo.last_rate_by_item(db, upto, ["Purchase", "Receipt Note"]),
        "layers": stock_repo.purchase_layers_by_item(db, upto),
    }


def _fifo_value(layers: list, qty: float) -> float:
    """Closing value of ``qty`` units consumed FIFO — i.e. valued at the most
    recent purchase layers (what remains on hand under FIFO)."""
    remaining, value = qty, 0.0
    for L in reversed(layers or []):                 # newest purchases first
        if remaining <= 1e-9:
            break
        lqty = L.get("qty") or 0
        rate = L.get("rate") or (L["val"] / lqty if lqty else 0)
        take = min(remaining, lqty)
        value += take * rate
        remaining -= take
    if remaining > 1e-9 and layers:                  # closing exceeds purchases (opening) -> oldest rate
        L = layers[0]
        lqty = L.get("qty") or 0
        value += remaining * (L.get("rate") or (L["val"] / lqty if lqty else 0))
    return round(value, 2)


def _close_value(name: str, method: str, qty: float, wac: float,
                 wac_val: float, ctx: dict | None) -> float:
    """Closing-stock value by the item's configured method (falls back to WAC)."""
    if qty <= 0:
        return 0.0                                   # nothing / negative on hand
    if not ctx:
        return wac_val
    m = method.lower()
    if "zero" in m:
        return 0.0
    if "fifo" in m:
        return _fifo_value(ctx["layers"].get(name), qty)
    if "last sale" in m:
        rate = ctx["lastSale"].get(name) or wac
        return round(qty * rate, 2)
    if "last purchase" in m:
        rate = ctx["lastPurchase"].get(name) or wac
        return round(qty * rate, 2)
    return wac_val                                   # Avg. Cost / Default


_ZERO_MOV = {"inQty": 0.0, "inValue": 0.0, "outQty": 0.0, "outValue": 0.0,
             "salesQty": 0.0, "salesValue": 0.0, "purchaseQty": 0.0, "purchaseValue": 0.0,
             "lastSaleDate": None, "lastPurchaseDate": None, "lastOutDate": None,
             "lastInDate": None, "txns": 0}


def item_rows(db, fy: str | None = None,
              start_date: datetime | None = None,
              end_date: datetime | None = None,
              date_match: dict | None = None,
              valued: bool = False) -> list[dict]:
    """Per-item opening / inward / outward / closing + movement analytics.

    The single engine behind every inventory report and the P&L stock branches.
    No company/FY specific constants — every figure is derived. Closing value is
    Weighted Average Cost by default; with ``valued=True`` each item is valued by
    its own Tally costing method (Avg / FIFO / Last-Sale / Last-Purchase / Zero).
    """
    from app.aman.core.serializers import iso_date
    start_date, end_date = _resolve_dates(fy, start_date, end_date, date_match)

    masters = stock_repo.all_stock_items(
        db, {"itemName": 1, "stockGroupName": 1, "stockGroupPath": 1, "stockCategoryName": 1,
             "unit.baseUnit": 1, "inventory.openingStock": 1, "gstSettings.gstRate": 1,
             "hsnSacDetails.hsnCode": 1, "pricing.costingMethod": 1,
             "pricing.valuationMethod": 1, "pricing.MRP.rates": 1})

    pre_movement = stock_repo.inventory_movement(db, date_match={"dates.date": {"$lt": start_date}})
    period = stock_repo.movement_by_item(db, {"dates.date": {"$gte": start_date, "$lte": end_date}})
    val_ctx = _valuation_context(db, end_date) if valued else None

    rows = []
    for i, m in enumerate(masters, start=1):
        name = m.get("itemName")
        if not name:
            continue

        open_qty, open_val, open_rate = _opening_of(m)

        # ── opening AS OF start_date = master opening + movement before start ──
        pre = pre_movement.get(name, _ZERO_MOV)
        pre_avail_qty = open_qty + pre["inQty"]
        pre_wac = ((open_val + pre["inValue"]) / pre_avail_qty) if pre_avail_qty > 0 else open_rate
        start_qty = round(open_qty + pre["inQty"] - pre["outQty"], 3)
        # additive value carry (preserves value-only items; reduces by COGS at WAC)
        start_val = round(open_val + pre["inValue"] - pre["outQty"] * pre_wac, 2)

        # ── period movement -> closing ──
        mov = period.get(name, _ZERO_MOV)
        in_qty, in_val = mov["inQty"], mov["inValue"]
        out_qty, out_val = mov["outQty"], mov["outValue"]
        close_qty = round(start_qty + in_qty - out_qty, 3)

        avail_qty = start_qty + in_qty
        avail_val = start_val + in_val
        if avail_qty > 0:
            wac = avail_val / avail_qty
            close_val_wac = round(close_qty * wac, 2)
        else:
            # value-only item (never carried a quantity) -> value simply carries
            wac = start_val if start_qty == 0 else 0.0
            close_val_wac = round(start_val, 2)

        method = _costing_method(m)
        close_val = _close_value(name, method, close_qty, wac, close_val_wac, val_ctx) \
            if valued else close_val_wac

        negative_stock = close_qty < 0      # oversold: likely missing production journals

        # ── movement analytics (aging / turnover) ──
        last_out = mov.get("lastOutDate") or mov.get("lastSaleDate")
        aging_days = (end_date - last_out).days if last_out else None
        avg_qty = (start_qty + close_qty) / 2
        turnover = round(out_qty / avg_qty, 2) if avg_qty > 0 else 0.0

        # Reorder/minimum levels are NOT in the synced data, so only zero/negative
        # stock states are derivable. (status kept for back-compat consumers.)
        if close_qty < 0:
            status, alert_type = "critical", "negative"
        elif close_qty == 0:
            status, alert_type = "critical", "zero"
        else:
            status, alert_type = "ok", None

        rows.append({
            "id": i,
            "name": name,
            "group": m.get("stockGroupName"),
            "groupPath": m.get("stockGroupPath") or m.get("stockGroupName"),
            "category": m.get("stockCategoryName") or "",
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
            "inValue": money(in_val),
            "outValue": money(out_val),
            # sales / purchase split (for performance + fast/slow)
            "salesQty": round(mov.get("salesQty", 0), 3),
            "salesValue": money(mov.get("salesValue", 0)),
            "purchaseQty": round(mov.get("purchaseQty", 0), 3),
            "purchaseValue": money(mov.get("purchaseValue", 0)),
            # closing (as of end_date)
            "closing": close_qty,
            "rate": money(wac if isinstance(wac, (int, float)) else 0),
            "value": close_val,
            "valueWac": close_val_wac,
            "negativeStock": negative_stock,
            # analytics
            "lastSaleDate": iso_date(mov.get("lastSaleDate")),
            "lastPurchaseDate": iso_date(mov.get("lastPurchaseDate")),
            "agingDays": aging_days,
            "turnover": turnover,
            "valuationMethod": (m.get("pricing") or {}).get("valuationMethod") or method,
            "costingMethod": method,
            "mrp": money(_item_mrp(m)),
            "txns": mov.get("txns", 0),
            "reorder": 0,                    # reorder level not synced from Tally
            "status": status,
            "alertType": alert_type,
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


# ─────────────────────────── shared list helpers ───────────────────────────
def _item_rows_cached(db, fy=None, start_date=None, end_date=None, valued=False) -> list[dict]:
    """``item_rows`` memoised per (tenant, period, valued).

    The whole-catalogue movement roll-forward is expensive on large tenants, so we
    compute it once per period and reuse it across the summary, drill-down levels
    and every module report. Keyed by ``db.name`` (tenant) so company switching is
    always honoured; TTL matches the report cache (invalidated on next sync).
    """
    from app.aman.core.cache import report_cache
    start_date, end_date = _resolve_dates(fy, start_date, end_date)
    key = f"invrows|{getattr(db, 'name', '?')}|{start_date.date()}|{end_date.date()}|{int(valued)}"
    hit = report_cache.get(key)
    if hit is not None:
        return hit
    rows = item_rows(db, None, start_date, end_date, valued=valued)
    report_cache.set(key, rows)
    return rows


def _page_meta(total: int, page: int, limit: int) -> dict:
    pages = (total + limit - 1) // limit if limit else 1
    return {"page": page, "limit": limit, "total": total, "pages": pages,
            "pageSize": limit, "totalRecords": total, "totalPages": pages,
            "hasNext": page < pages, "hasPrevious": page > 1}


def _filter_sort_page(rows, *, search=None, group=None, category=None,
                      sort=None, order="desc", page=1, limit=0, sort_keys=None):
    if group:
        rows = [r for r in rows if (r.get("group") or "") == group]
    if category:
        rows = [r for r in rows if (r.get("category") or "") == category]
    if search:
        q = search.strip().lower()
        rows = [r for r in rows if q in (r.get("name") or "").lower()]
    total = len(rows)
    keyfn = (sort_keys or {}).get((sort or "").lower())
    if keyfn:
        rows = sorted(rows, key=keyfn, reverse=(order or "desc").lower() == "desc")
    if limit:
        s = (page - 1) * limit
        rows = rows[s:s + limit]
    return rows, total


_ITEM_SORT_KEYS = {
    "name": lambda r: (r.get("name") or "").lower(),
    "group": lambda r: (r.get("group") or "").lower(),
    "closing": lambda r: r.get("closing") or 0,
    "qty": lambda r: r.get("closing") or 0,
    "value": lambda r: r.get("value") or 0,
    "out": lambda r: r.get("out") or 0,
    "salesqty": lambda r: r.get("salesQty") or 0,
    "salesvalue": lambda r: r.get("salesValue") or 0,
    "turnover": lambda r: r.get("turnover") or 0,
    "aging": lambda r: r.get("agingDays") if r.get("agingDays") is not None else -1,
}


# ─────────────────────────── Stock Summary ───────────────────────────
def stock_summary(db, fy: str | None = None,
                  start_date: datetime | None = None,
                  end_date: datetime | None = None) -> dict:
    """Headline KPIs + full item list (closing valued by each item's method)."""
    rows = _item_rows_cached(db, fy, start_date, end_date, valued=True)
    total_value = money(sum(r["value"] for r in rows))
    zero = sum(1 for r in rows if r["alertType"] == "zero")
    negative = sum(1 for r in rows if r["alertType"] == "negative")
    return {
        "items": rows,
        "summary": {
            "totalItems": len(rows),
            "totalValue": total_value,
            "zeroCount": zero,
            "negativeCount": negative,
            "criticalCount": zero + negative,
            "warningCount": 0,
        },
    }


# ─────────────────────────── Stock Summary drill-down (Group → Item → Voucher) ──
_LEVELS = ["Groups", "Items", "Item Ledger", "Voucher"]


def _group_rollup(rows: list[dict]) -> list[dict]:
    groups: dict[str, dict] = {}
    for r in rows:
        g = r.get("group") or "Primary"
        rec = groups.setdefault(g, {"id": g, "key": g, "name": g, "itemCount": 0,
                                    "openingValue": 0.0, "inValue": 0.0, "outValue": 0.0, "value": 0.0})
        rec["itemCount"] += 1
        rec["openingValue"] += r["opening_value"]
        rec["inValue"] += r["inValue"]
        rec["outValue"] += r["outValue"]
        rec["value"] += r["value"]
    out = [{**g, "openingValue": money(g["openingValue"]), "inValue": money(g["inValue"]),
            "outValue": money(g["outValue"]), "value": money(g["value"])} for g in groups.values()]
    out.sort(key=lambda g: (g["name"] == "Primary", -g["value"]))
    return out


def inventory_drilldown(db, fy: str, level: int, params: dict) -> dict:
    """Stock Summary drill-down: 0 Groups → 1 Items → 2 Item ledger → 3 Voucher."""
    start = params.get("start")
    end = params.get("end")
    start, end = _resolve_dates(fy, start, end)
    page = max(int(params.get("page") or 1), 1)
    limit = int(params.get("limit") or 0)
    search = (params.get("search") or "").strip() or None
    sort = params.get("sort")
    order = params.get("order") or "desc"

    if level >= 3:                                    # voucher detail
        from app.aman.services.drilldown_service import get_voucher_detail
        detail = get_voucher_detail(db, params.get("voucherId")) if params.get("voucherId") else None
        return {"data": detail, "pagination": None, "meta": {"fy": fy}}

    if level == 2:                                    # item ledger (vouchers)
        item = params.get("item") or ""
        data = item_performance(db, fy, item, start, end)
        rows = data.get("vouchers", [])
        total = len(rows)
        if limit:
            rows = rows[(page - 1) * limit:(page - 1) * limit + limit]
        return {"data": {"level": 2, "label": item, "item": item,
                         "summary": data.get("summary"), "rows": rows},
                "pagination": _page_meta(total, page, limit), "meta": {"fy": fy, "item": item}}

    rows = _item_rows_cached(db, fy, start, end, valued=True)
    if level == 1:                                    # items in a group
        group = params.get("group") or ""
        page_rows, total = _filter_sort_page(
            rows, search=search, group=group, sort=sort or "value", order=order,
            page=page, limit=limit, sort_keys=_ITEM_SORT_KEYS)
        return {"data": {"level": 1, "label": group, "group": group, "rows": page_rows,
                         "total": money(sum(r["value"] for r in rows if (r.get("group") or "") == group))},
                "pagination": _page_meta(total, page, limit), "meta": {"fy": fy, "group": group}}

    # level 0 — groups
    grows = _group_rollup(rows)
    if search:
        q = search.lower()
        grows = [g for g in grows if q in g["name"].lower()]
    total = len(grows)
    if limit:
        grows = grows[(page - 1) * limit:(page - 1) * limit + limit]
    return {"data": {"level": 0, "rows": grows,
                     "total": money(sum(r["value"] for r in rows)),
                     "itemCount": len(rows),
                     "groupCount": len(_group_rollup(rows)),
                     "zeroCount": sum(1 for r in rows if r["alertType"] == "zero"),
                     "negativeCount": sum(1 for r in rows if r["alertType"] == "negative")},
            "pagination": _page_meta(total, page, limit), "meta": {"fy": fy}}


# ─────────────────────────── Fast / Slow moving ───────────────────────────
def fast_moving(db, fy: str | None = None, start_date=None, end_date=None,
                top: int = 0, search=None, sort=None, order="desc",
                page: int = 1, limit: int = 0) -> dict:
    """Items ranked by outward (sales) movement + inventory turnover."""
    rows = [r for r in _item_rows_cached(db, fy, start_date, end_date) if r["out"] > 0]
    rows.sort(key=lambda r: -r["out"])
    if top:
        rows = rows[:top]
    page_rows, total = _filter_sort_page(
        rows, search=search, sort=sort or "out", order=order, page=page, limit=limit,
        sort_keys=_ITEM_SORT_KEYS)
    return {"items": page_rows, "pagination": _page_meta(total, page, limit),
            "summary": {"totalItems": total,
                        "totalOutValue": money(sum(r["outValue"] for r in rows))}}


def slow_moving(db, fy: str | None = None, start_date=None, end_date=None,
                days: int = 90, search=None, sort=None, order="desc",
                page: int = 1, limit: int = 0) -> dict:
    """Items still in stock that have NOT sold within ``days`` (aging based)."""
    start_date, end_date = _resolve_dates(fy, start_date, end_date)
    rows = [r for r in _item_rows_cached(db, None, start_date, end_date)
            if r["closing"] > 0 and (r["agingDays"] is None or r["agingDays"] >= days)]
    rows.sort(key=lambda r: (r["agingDays"] is not None, r["agingDays"] or 10 ** 9), reverse=True)
    page_rows, total = _filter_sort_page(
        rows, search=search, sort=sort, order=order, page=page, limit=limit,
        sort_keys=_ITEM_SORT_KEYS)
    return {"items": page_rows, "pagination": _page_meta(total, page, limit),
            "summary": {"deadStockItems": total, "days": days,
                        "deadStockValue": money(sum(r["value"] for r in rows))}}


# ─────────────────────────── Valuation (per item's Tally method) ───────────────────────────
def valuation(db, fy: str | None = None, start_date=None, end_date=None,
              search=None, group=None, sort=None, order="desc",
              page: int = 1, limit: int = 0) -> dict:
    rows = [r for r in _item_rows_cached(db, fy, start_date, end_date, valued=True) if r["closing"] != 0 or r["value"]]
    total_value = money(sum(r["value"] for r in rows))

    by_group: dict[str, float] = {}
    by_method: dict[str, float] = {}
    for r in rows:
        by_group[r.get("group") or "Primary"] = by_group.get(r.get("group") or "Primary", 0) + r["value"]
        by_method[r.get("costingMethod") or "Avg. Cost"] = by_method.get(r.get("costingMethod") or "Avg. Cost", 0) + r["value"]

    page_rows, total = _filter_sort_page(
        rows, search=search, group=group, sort=sort or "value", order=order,
        page=page, limit=limit, sort_keys=_ITEM_SORT_KEYS)
    return {
        "items": page_rows,
        "pagination": _page_meta(total, page, limit),
        "totalValue": total_value,
        "byGroup": sorted(({"name": k, "value": money(v)} for k, v in by_group.items()),
                          key=lambda x: -x["value"]),
        "byMethod": sorted(({"name": k, "value": money(v)} for k, v in by_method.items()),
                           key=lambda x: -x["value"]),
    }


# ─────────────────────────── Stock Alerts (zero / negative — reorder not synced) ──
def stock_alerts(db, fy: str | None = None, start_date=None, end_date=None,
                 search=None, page: int = 1, limit: int = 0) -> dict:
    rows = [r for r in _item_rows_cached(db, fy, start_date, end_date) if r["alertType"] in ("zero", "negative")]
    rows.sort(key=lambda r: (r["alertType"] != "negative", (r.get("name") or "").lower()))
    page_rows, total = _filter_sort_page(rows, search=search, page=page, limit=limit)
    negative = sum(1 for r in rows if r["alertType"] == "negative")
    zero = sum(1 for r in rows if r["alertType"] == "zero")
    return {
        "items": page_rows,
        "pagination": _page_meta(total, page, limit),
        "summary": {"negativeCount": negative, "zeroCount": zero, "totalAlerts": total},
        # Surfaced as DATA, never hardcoded: reorder/minimum levels are not part of
        # the Tally sync, so reorder-based alerts cannot be derived.
        "dataGaps": ["Reorder level and minimum stock level are not present in the "
                     "Tally-synced data, so reorder/min-level alerts cannot be generated. "
                     "Showing zero-stock and negative-stock alerts only."],
    }


# ─────────────────────────── Item Performance ───────────────────────────
def performance_list(db, fy: str | None = None, start_date=None, end_date=None,
                     search=None, group=None, sort=None, order="desc",
                     page: int = 1, limit: int = 0) -> dict:
    """Top / low performing items by sales value (+ qty, GP contribution)."""
    rows = []
    for r in _item_rows_cached(db, fy, start_date, end_date):
        cogs = money((r["salesQty"] or 0) * (r["rate"] or 0))   # COGS at WAC
        gp = money((r["salesValue"] or 0) - cogs)
        margin = round(gp / r["salesValue"] * 100, 2) if r["salesValue"] else 0.0
        rows.append({**r, "cogs": cogs, "grossProfit": gp, "margin": margin})
    rows = [r for r in rows if r["salesQty"] or r["salesValue"]]
    page_rows, total = _filter_sort_page(
        rows, search=search, group=group, sort=sort or "salesvalue", order=order,
        page=page, limit=limit, sort_keys={**_ITEM_SORT_KEYS,
                                           "margin": lambda r: r.get("margin") or 0,
                                           "profit": lambda r: r.get("grossProfit") or 0})
    return {"items": page_rows, "pagination": _page_meta(total, page, limit),
            "summary": {"totalItems": total,
                        "totalSalesValue": money(sum(r["salesValue"] for r in rows)),
                        "totalGrossProfit": money(sum(r["grossProfit"] for r in rows))}}


def item_performance(db, fy: str | None = None, item_name: str | None = None,
                     start_date: datetime | None = None, end_date: datetime | None = None) -> dict:
    """Per-item summary metrics + monthly trend + voucher ledger."""
    from app.aman.core.serializers import fmt_date, month_key
    from app.aman.services.financial_year import date_range_filter
    start_date, end_date = _resolve_dates(fy, start_date, end_date)
    date_match = date_range_filter(start_date, end_date)

    # Item master row (opening/closing/value/turnover) for the same window.
    row = next((r for r in _item_rows_cached(db, None, start_date, end_date) if r["name"] == item_name), None)

    docs = stock_repo.stock_item_vouchers(db, None, item_name, date_match=date_match)
    vouchers, trend = [], {}
    for v in docs:
        parent = v.get("voucherTypeOrigName")
        for ie in v.get("inventoryEntries", []):
            if ie.get("stockItemName") != item_name:
                continue
            qty = parse_qty(ie.get("actualQty") or ie.get("billedQty"))
            amt = money(abs(float(ie.get("amount") or 0)))
            vouchers.append({
                "voucherId": str(v.get("_id")),
                "vchNo": v.get("voucherNumber"),
                "date": fmt_date((v.get("dates") or {}).get("date")),
                "type": v.get("voucherTypeName"),
                "direction": "out" if parent in stock_repo.OUT_PARENTS else "in",
                "ledgerName": v.get("partyLedgerName") or "",
                "qty": qty, "amount": amt,
            })
            if parent == "Sales":
                mk = month_key((v.get("dates") or {}).get("date"))
                t = trend.setdefault(mk, {"month": mk, "qty": 0.0, "value": 0.0})
                t["qty"] += qty
                t["value"] += amt
    summary = None
    if row:
        cogs = money((row["salesQty"] or 0) * (row["rate"] or 0))
        summary = {
            "name": item_name, "group": row["group"], "unit": row["unit"],
            "closingQty": row["closing"], "closingValue": row["value"],
            "salesQty": row["salesQty"], "salesValue": row["salesValue"],
            "purchaseQty": row["purchaseQty"], "purchaseValue": row["purchaseValue"],
            "grossProfit": money((row["salesValue"] or 0) - cogs),
            "turnover": row["turnover"], "lastSaleDate": row["lastSaleDate"],
            "lastPurchaseDate": row["lastPurchaseDate"], "valuationMethod": row["valuationMethod"],
        }
    return {"name": item_name, "summary": summary,
            "trend": [trend[k] for k in sorted(trend)], "vouchers": vouchers}
