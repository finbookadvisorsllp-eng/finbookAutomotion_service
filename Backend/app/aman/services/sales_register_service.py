"""Dynamic, Tally-matched Sales Register engine.

A single :func:`drilldown` dispatcher generates the whole report from the live
``vouchers`` collection of whatever company (tenant) is selected — no hardcoded
company ids, ledger names, GST rates, voucher types or sales totals.

    Level 0  Register        — rows grouped by the chosen dimension (+ Total Sales)
    Level 1  Voucher list    — invoices behind one group row
    Level 2  Voucher detail  — universal invoice detail (items + tax + ledger)

Two orthogonal toggles drive every figure from the *same* calculation engine:

    measure   gross | net      (Gross = invoice total incl. tax;  Net = goods value)
    groupBy   month | bill | ledger | voucherType | ledgerGroup
              | stockItem | stockGroup | stockCategory

Sales classification is universal: a voucher is a sale when its Tally parent
class ``voucherTypeOrigName == "Sales"`` (identical across all companies),
*not* its company-specific ``voucherTypeName``. Amounts come from
``ledgerEntries`` / ``inventoryEntries`` (the ``totals`` block is absent in many
tenants). See :mod:`app.aman.repositories.voucher_repo` for the pipelines.
"""
from datetime import datetime, timedelta

from app.aman.core.serializers import money, fmt_date, iso_date
from app.aman.repositories import voucher_repo, ledger_repo, stock_repo
from app.aman.services.drilldown_service import get_voucher_detail
from app.aman.services.financial_year import fy_bounds, month_buckets

GROUP_BYS = {"month", "bill", "ledger", "voucherType",
             "ledgerGroup", "stockItem", "stockGroup", "stockCategory"}
# Dimensions resolved from inventory lines (per-item value; no per-item GST split).
ITEM_DIMS = {"stockItem", "stockGroup", "stockCategory"}

GROUP_TITLES = {
    "month": "Monthly", "bill": "Bill-wise", "ledger": "Ledger-wise",
    "voucherType": "Voucher Type", "ledgerGroup": "Ledger Group",
    "stockItem": "Stock Item", "stockGroup": "Stock Group",
    "stockCategory": "Stock Category",
}

# Every sales-side document register is the same engine over a different Tally
# parent class. ``parents`` lists the reserved ``voucherTypeOrigName`` values that
# identify the document (synonyms included — e.g. Delivery Note shows up as
# "Delivery Challan" in some companies). ``accounting`` = whether the voucher posts
# to ledgers (Sales / Credit Note) vs a non-accounting order/delivery document
# whose value lives only in its inventory lines.
REPORTS = {
    "sales":         {"parents": ["Sales"], "accounting": True,  "title": "Sales Register"},
    "sales_order":   {"parents": ["Sales Order"], "accounting": False, "title": "Sales Order"},
    "credit_note":   {"parents": ["Credit Note"], "accounting": True,  "title": "Credit Note"},
    "delivery_note": {"parents": ["Delivery Note", "Delivery Challan"], "accounting": False,
                      "title": "Delivery Note"},
}


def report_config(report: str | None) -> dict:
    return REPORTS.get(report or "sales", REPORTS["sales"])


# ─────────────────────────── helpers ───────────────────────────
def _measure(params) -> str:
    return "net" if (params.get("measure") == "net") else "gross"


def _period(db, fy, params):
    start, end = params.get("start"), params.get("end")
    if not (start and end):
        start, end = fy_bounds(fy)
    return start, end


def _page_meta(total: int, page: int, limit: int) -> dict:
    """Standard server-side pagination envelope (limit 0 == all rows / one page)."""
    pages = (total + limit - 1) // limit if limit else 1
    return {"page": page, "limit": limit, "total": total, "pages": pages,
            "pageSize": limit, "totalRecords": total, "totalPages": pages,
            "hasNext": page < pages, "hasPrevious": page > 1}


def _paginate(rows: list[dict], page: int, limit: int) -> tuple[list[dict], dict]:
    total = len(rows)
    if limit:
        rows = rows[(page - 1) * limit:(page - 1) * limit + limit]
    return rows, _page_meta(total, page, limit)


def _sort_rows(rows, sort, order, default_key="amount"):
    key = sort if sort in {"name", "amount", "count", "qty"} else default_key
    reverse = (order or ("asc" if key == "name" else "desc")).lower() == "desc"
    return sorted(rows, key=lambda r: (r.get(key) if key != "name" else (r.get("name") or "").lower()),
                  reverse=reverse)


def _ledger_group_map(db) -> dict[str, str]:
    """ledgerName -> its accounting group (for the Ledger-Group view)."""
    return {l.get("ledgerName"): l.get("groupName")
            for l in ledger_repo.all_ledgers(db, {"ledgerName": 1, "groupName": 1})
            if l.get("ledgerName")}


def _item_attr_maps(db) -> tuple[dict, dict, dict]:
    """itemName -> (stockGroupName, stockCategoryName, unit)."""
    grp, cat, unit = {}, {}, {}
    for s in stock_repo.all_stock_items(
            db, {"itemName": 1, "stockGroupName": 1, "stockCategoryName": 1, "unit": 1}):
        name = s.get("itemName")
        if not name:
            continue
        grp[name] = s.get("stockGroupName") or "Primary"
        cat[name] = s.get("stockCategoryName") or "Not Applicable"
        unit[name] = s.get("unit") or ""
    return grp, cat, unit


def _month_window(fy, month_id, start, end):
    """Resolve a 'Apr 25' bucket id to its [start, end] datetime window."""
    target = next((b for b in month_buckets(fy) if b["id"] == month_id), None)
    if not target:
        return None
    mstart = datetime(target["year"], target["month"], 1)
    mend = (datetime(target["year"] + 1, 1, 1) if target["month"] == 12
            else datetime(target["year"], target["month"] + 1, 1)) - timedelta(microseconds=1000)
    # Clamp to the requested period so custom ranges stay honoured.
    return max(mstart, start), min(mend, end), target["label"]


# ─────────────────────────── Level 0: register ───────────────────────────
def _register(db, fy, params, start, end, measure, parents, report):
    group_by = params.get("groupBy") or "month"
    if group_by not in GROUP_BYS:
        group_by = "month"
    page = max(int(params.get("page") or 1), 1)
    limit = int(params.get("limit") or 0)
    search = (params.get("search") or "").strip()
    sort = params.get("sort")
    order = params.get("order") or ""

    base = voucher_repo.doc_base_match(parents, start, end)
    totals = voucher_repo.sales_total(db, base)
    grand = {"gross": totals["gross"], "net": totals["net"], "count": totals["count"],
             "total": totals[measure]}
    meta = {"fy": fy, "report": report, "groupBy": group_by, "measure": measure}

    # ── Bill-wise: the register IS the invoice list (drills straight to detail) ──
    if group_by == "bill":
        raw, page_meta = voucher_repo.sales_voucher_page(
            db, base, page, limit, search or None, sort, order or "desc")
        rows = [_invoice_row(v, measure) for v in raw]
        return {
            "data": {"groupBy": group_by, "measure": measure, "drillable": True,
                     "itemBased": False, "columns": _columns(group_by),
                     "rows": rows, "total": grand["total"], "measureTotals": grand},
            "pagination": _page_meta(page_meta["count"], page, limit),
            "meta": meta,
        }

    # ── Grouped views ──
    rows = _grouped_rows(db, fy, base, group_by, measure, start, end)
    if search:
        s = search.lower()
        rows = [r for r in rows if s in (r.get("name") or "").lower()]
    # The header total is the sum of every group row (after any search filter), so it
    # always reconciles with what's on screen. For voucher-level dimensions this
    # equals the voucher Gross/Net; for item dimensions (no per-item GST split) it is
    # the goods value — which is why Gross == Net there.
    full_total = money(sum(r["amount"] for r in rows))
    # Month keeps Tally's calendar order (newest first); others sort by value.
    if group_by != "month":
        rows = _sort_rows(rows, sort, order)
    page_rows, pagination = _paginate(rows, page, limit)
    return {
        "data": {"groupBy": group_by, "measure": measure, "drillable": True,
                 "itemBased": group_by in ITEM_DIMS,
                 "columns": _columns(group_by),
                 "rows": page_rows,
                 "total": full_total, "measureTotals": grand},
        "pagination": pagination,
        "meta": meta,
    }


def _grouped_rows(db, fy, base, group_by, measure, start, end):
    if group_by == "month":
        agg = {(_k(r["key"])): r for r in voucher_repo.sales_group_by_voucher(
            db, base, {"y": {"$year": "$dates.date"}, "m": {"$month": "$dates.date"}})}
        rows = []
        for b in reversed(month_buckets(fy)):  # newest month first (Tally order)
            rec = agg.get((b["year"], b["month"]))
            if not rec:  # hide months in the period that have no transactions at all
                continue
            rows.append({"id": b["id"], "key": b["id"], "name": b["label"], "label": b["label"],
                         "amount": rec[measure], "gross": rec["gross"], "net": rec["net"],
                         "count": rec["count"], "year": b["year"], "month": b["month"]})
        return rows

    if group_by == "ledger":
        return [_named_row(r, measure, "(No Ledger)") for r in
                voucher_repo.sales_group_by_voucher(db, base, "$partyLedgerName")]

    if group_by == "voucherType":
        return [_named_row(r, measure, "(No Type)") for r in
                voucher_repo.sales_group_by_voucher(db, base, "$voucherTypeName")]

    if group_by == "ledgerGroup":
        gmap = _ledger_group_map(db)
        return _rollup(voucher_repo.sales_group_by_voucher(db, base, "$partyLedgerName"),
                       lambda key: gmap.get(key) or "Unspecified", measure)

    # Item-based dimensions
    item_rows = voucher_repo.sales_group_by_item(db, base, with_qty=(group_by == "stockItem"))
    if group_by == "stockItem":
        out = []
        for r in item_rows:
            key = r["key"] or "(No Item)"
            qty = r.get("qty", 0)
            out.append({"id": key, "key": key, "name": key, "label": key,
                        "amount": r["amount"], "gross": r["amount"], "net": r["amount"],
                        "qty": qty, "rate": money(r["amount"] / qty) if qty else 0.0,
                        "count": r["count"]})
        return out

    grp_map, cat_map, _ = _item_attr_maps(db)
    pick = grp_map if group_by == "stockGroup" else cat_map
    default = "Primary" if group_by == "stockGroup" else "Not Applicable"
    return _rollup_items(item_rows, lambda key: pick.get(key) or default)


def _k(key):  # month _id dict -> (year, month)
    return (key.get("y"), key.get("m")) if isinstance(key, dict) else key


def _named_row(r, measure, fallback="(Unspecified)"):
    name = r["key"] or fallback
    return {"id": name, "key": name, "name": name, "label": name,
            "amount": r[measure], "gross": r["gross"], "net": r["net"], "count": r["count"]}


def _rollup(rows, classify, measure):
    """Re-aggregate voucher-level group rows under a coarser key (e.g. ledger->group)."""
    acc: dict[str, dict] = {}
    for r in rows:
        name = classify(r["key"])
        a = acc.setdefault(name, {"gross": 0.0, "net": 0.0, "count": 0})
        a["gross"] += r["gross"]; a["net"] += r["net"]; a["count"] += r["count"]
    return [{"id": n, "key": n, "name": n, "label": n, "amount": money(v[measure]),
             "gross": money(v["gross"]), "net": money(v["net"]), "count": v["count"]}
            for n, v in acc.items()]


def _rollup_items(rows, classify):
    acc: dict[str, dict] = {}
    for r in rows:
        name = classify(r["key"])
        a = acc.setdefault(name, {"amount": 0.0, "qty": 0.0, "count": 0})
        a["amount"] += r["amount"]; a["count"] += r["count"]
    return [{"id": n, "key": n, "name": n, "label": n, "amount": money(v["amount"]),
             "gross": money(v["amount"]), "net": money(v["amount"]), "count": v["count"]}
            for n, v in acc.items()]


def _invoice_row(v, measure):
    g, n = money(v.get("_gross", 0)), money(v.get("_net", 0))
    return {
        "id": str(v.get("_id")), "voucherId": str(v.get("_id")),
        "number": v.get("voucherNumber") or str(v.get("_id")),
        "date": fmt_date((v.get("dates") or {}).get("date")),
        "isoDate": iso_date((v.get("dates") or {}).get("date")),
        "party": v.get("partyLedgerName") or v.get("partyName") or "",
        "type": v.get("voucherTypeName"),
        "items": v.get("items") or 0,
        "qty": round(v.get("qty") or 0, 3),
        "amount": n if measure == "net" else g, "gross": g, "net": n,
    }


def _columns(group_by):
    """Column descriptors the UI table renders (label + numeric measure column)."""
    if group_by == "bill":
        return [{"key": "number", "label": "Invoice No"}, {"key": "date", "label": "Date"},
                {"key": "party", "label": "Customer"},
                {"key": "amount", "label": "Amount", "align": "right", "money": True}]
    if group_by == "stockItem":
        return [{"key": "name", "label": "Stock Item"},
                {"key": "qty", "label": "Quantity", "align": "right"},
                {"key": "rate", "label": "Rate", "align": "right", "money": True},
                {"key": "amount", "label": "Amount", "align": "right", "money": True}]
    label = {"month": "Month", "ledger": "Ledger", "voucherType": "Voucher Type",
             "ledgerGroup": "Ledger Group", "stockGroup": "Stock Group",
             "stockCategory": "Stock Category"}.get(group_by, "Group")
    return [{"key": "name", "label": label},
            {"key": "amount", "label": "Amount", "align": "right", "money": True}]


# ─────────────────────────── Level 1: voucher list ───────────────────────────
def _voucher_list(db, fy, params, start, end, measure, parents, report):
    group_by = params.get("groupBy") or "month"
    group_value = params.get("groupValue") or ""
    page = max(int(params.get("page") or 1), 1)
    limit = int(params.get("limit") or 0)
    search = (params.get("search") or "").strip()
    sort = params.get("sort")
    order = params.get("order") or "desc"

    extra, label = _list_filter(db, fy, group_by, group_value, start, end)
    if extra is None:
        return {"data": None, "pagination": None, "meta": {"fy": fy}, "error": "Group not found"}

    base = voucher_repo.doc_base_match(parents, start, end, extra)
    raw, meta = voucher_repo.sales_voucher_page(
        db, base, page, limit, search or None, sort, order)
    rows = [_invoice_row(v, measure) for v in raw]
    return {
        "data": {"groupBy": group_by, "groupValue": group_value, "label": label,
                 "measure": measure, "rows": rows,
                 "totals": {"gross": meta["gross"], "net": meta["net"],
                            "total": meta[measure], "count": meta["count"]}},
        "pagination": _page_meta(meta["count"], page, limit),
        "meta": {"fy": fy, "report": report, "groupBy": group_by, "groupValue": group_value, "measure": measure},
    }


def _list_filter(db, fy, group_by, group_value, start, end):
    """Build the extra match + a human label for a selected group row."""
    if group_by == "month":
        win = _month_window(fy, group_value, start, end)
        if not win:
            return None, None
        mstart, mend, label = win
        return {"dates.date": {"$gte": mstart, "$lte": mend}}, label
    if group_by in ("ledger",):
        return {"partyLedgerName": group_value}, group_value
    if group_by == "voucherType":
        return {"voucherTypeName": group_value}, group_value
    if group_by == "ledgerGroup":
        names = [l.get("ledgerName") for l in
                 ledger_repo.ledgers_in_group(db, group_value, {"ledgerName": 1})
                 if l.get("ledgerName")]
        return {"partyLedgerName": {"$in": names or ["__none__"]}}, group_value
    if group_by == "stockItem":
        return {"inventoryEntries.stockItemName": group_value}, group_value
    if group_by in ("stockGroup", "stockCategory"):
        field = "stockGroupName" if group_by == "stockGroup" else "stockCategoryName"
        names = [s.get("itemName") for s in
                 stock_repo.all_stock_items(db, {"itemName": 1, field: 1})
                 if (s.get(field) or ("Primary" if group_by == "stockGroup" else "Not Applicable")) == group_value]
        return {"inventoryEntries.stockItemName": {"$in": names or ["__none__"]}}, group_value
    return None, None


# ─────────────────────────── dispatcher ───────────────────────────
def drilldown(db, fy: str, level: int, params: dict) -> dict:
    """Resolve a single document-register level into ``{data, pagination, meta}``.

    ``params['report']`` selects the document class (sales / sales_order /
    credit_note / delivery_note); defaults to sales.
    """
    start, end = _period(db, fy, params)
    measure = _measure(params)
    cfg = report_config(params.get("report"))
    parents = cfg["parents"]
    report = params.get("report") or "sales"

    if level >= 2:
        voucher_id = params.get("voucherId")
        detail = get_voucher_detail(db, voucher_id) if voucher_id else None
        return {"data": detail, "pagination": None,
                "meta": {"fy": fy, "report": report, "voucherId": voucher_id}}

    if level == 1:
        return _voucher_list(db, fy, params, start, end, measure, parents, report)

    return _register(db, fy, params, start, end, measure, parents, report)
