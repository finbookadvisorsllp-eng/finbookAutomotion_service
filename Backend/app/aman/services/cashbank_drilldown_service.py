"""Generic, Tally-like Cash & Bank drill-down engine.

A single :func:`drilldown` dispatcher serves every level of the report so the UI
renders one consistent hierarchy, generated **dynamically** from the live data of
whatever company (tenant) is selected — no hardcoded company ids, ledger names,
bank names, months or voucher types.

    Level 0  Cash & Bank summary   (group rows + KPIs)
    Level 1  Ledgers in a group    (or all cash/bank ledgers)
    Level 2  Month-wise summary    (opening / receipts / payments / closing)
    Level 3  Date-wise statement   (voucher register with running balance)
    Level 4  Complete voucher      (universal voucher detail)

Accounting (verified sign rule — see ``accounting.dr_cr``): for a cash/bank asset
ledger, a Debit line (amount < 0) is money IN (a *receipt*) and a Credit line
(amount > 0) is money OUT (a *payment*).

    opening  = opening_debit − opening_credit
    receipts = Σ debit movement
    payments = Σ credit movement
    closing  = opening + receipts − payments
"""
from datetime import datetime, timedelta

from app.aman.core.serializers import money, fmt_date, iso_date
from app.aman.repositories import group_repo, ledger_repo, voucher_repo
from app.aman.services.drilldown_service import get_voucher_detail
from app.aman.services.financial_year import (
    fy_bounds, month_buckets, date_range_filter)

# Tally's reserved cash/bank primary groups. These names are part of Tally's
# fixed chart-of-accounts skeleton (identical across every company), not
# company-specific data — so matching them is universal, never a per-tenant rule.
_CASH_RESERVED = {"cash-in-hand"}
_BANK_RESERVED = {"bank accounts", "bank od a/c", "bank occ a/c", "bank od account"}
# nature.subType hints (when a sync populates them) — matched case-insensitively.
_CASH_SUBTYPES = {"cash-in-hand", "cash in hand", "cash"}
_BANK_SUBTYPES = {"bank accounts", "bank od a/c", "bank occ a/c", "bank"}

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ─────────────────────────── dynamic discovery ───────────────────────────
def discover_cashbank_groups(db) -> dict[str, str]:
    """Map every cash/bank group (and its sub-groups) -> 'Cash' | 'Bank'.

    Seeds from the reserved cash/bank group names (or a matching ``nature.subType``)
    then walks the ``parentGroupName`` tree so user-defined sub-groups (e.g. a
    "HDFC Banks" group nested under "Bank Accounts") are discovered automatically.
    Returns ``{}`` only for a company with no cash/bank groups at all.
    """
    groups = group_repo.all_groups(db)
    type_by_group: dict[str, str] = {}
    children: dict[str, list[str]] = {}

    for g in groups:
        name = g.get("groupName")
        if not name:
            continue
        parent = g.get("parentGroupName")
        if parent:
            children.setdefault(parent.strip(), []).append(name)
        lname = name.strip().lower()
        sub = ((g.get("nature") or {}).get("subType") or "").strip().lower()
        if lname in _CASH_RESERVED or sub in _CASH_SUBTYPES:
            type_by_group[name] = "Cash"
        elif lname in _BANK_RESERVED or sub in _BANK_SUBTYPES:
            type_by_group[name] = "Bank"

    # Propagate the cash/bank classification down to all descendant sub-groups.
    seeds = list(type_by_group.items())
    for root, kind in seeds:
        stack = list(children.get(root, []))
        while stack:
            child = stack.pop()
            if child in type_by_group:
                continue
            type_by_group[child] = kind
            stack.extend(children.get(child, []))
    return type_by_group


def cashbank_ledger_masters(db, type_by_group: dict[str, str]) -> list[dict]:
    """Ledger master docs in any discovered cash/bank group (single query)."""
    if not type_by_group:
        return []
    return ledger_repo.ledgers_in_groups(db, list(type_by_group.keys()))


# ─────────────────────────── balance helpers ───────────────────────────
def _figures(db, masters: list[dict], period_match: dict,
             fy_start: datetime, view_start: datetime) -> dict[str, dict]:
    """Per-ledger opening / receipts / payments / closing over the period.

    ``opening`` is rolled forward to ``view_start`` = FY opening + movement strictly
    before the period start, so custom date ranges open with the right figure (for
    the default full-FY view this pre-movement is zero).
    """
    names = [m["ledgerName"] for m in masters if m.get("ledgerName")]
    period = voucher_repo.ledgers_movement(db, period_match, names)
    pre: dict[str, dict] = {}
    if view_start and fy_start and view_start > fy_start:
        pre = voucher_repo.ledgers_movement(
            db, {"dates.date": {"$gte": fy_start, "$lt": view_start}}, names)

    figs: dict[str, dict] = {}
    for m in masters:
        name = m["ledgerName"]
        od, oc = ledger_repo.opening_balance(m)
        opening = (od - oc)
        p = pre.get(name)
        if p:
            opening += p["debit"] - p["credit"]
        mv = period.get(name, {})
        receipts = mv.get("debit", 0.0)
        payments = mv.get("credit", 0.0)
        figs[name] = {
            "opening": money(opening),
            "receipts": money(receipts),
            "payments": money(payments),
            "closing": money(opening + receipts - payments),
        }
    return figs


def _has_activity(r: dict) -> bool:
    """A row carries meaningful data if it has a balance or any movement.

    Used to hide fully-empty groups / ledgers / months (Tally only lists rows
    that actually have something to show)."""
    return any(round(float(r.get(k) or 0), 2) for k in ("opening", "receipts", "payments", "closing"))


def _sort_rows(rows: list[dict], sort: str | None, order: str) -> list[dict]:
    key = sort if sort in {"name", "opening", "receipts", "payments", "closing"} else "name"
    reverse = (order or "asc").lower() == "desc"
    return sorted(rows, key=lambda r: (r.get(key) if key != "name" else (r.get("name") or "").lower()),
                  reverse=reverse)


def _paginate(rows: list[dict], page: int, limit: int) -> tuple[list[dict], dict]:
    total = len(rows)
    if limit:
        start = (page - 1) * limit
        rows = rows[start:start + limit]
    pages = (total + limit - 1) // limit if limit else 1
    return rows, {"page": page, "limit": limit, "total": total, "pages": pages,
                  "pageSize": limit, "totalRecords": total, "totalPages": pages,
                  "hasNext": page < pages, "hasPrevious": page > 1}


# ─────────────────────────── levels ───────────────────────────
def _ledger_row(m, type_by_group, figs) -> dict:
    name = m["ledgerName"]
    gname = m.get("groupName")
    return {"id": str(m["_id"]), "ledgerId": str(m["_id"]), "name": name,
            "group": gname, "type": type_by_group.get(gname, "Bank"), **figs[name]}


def _sum_totals(rows) -> dict:
    return {k: money(sum(r[k] for r in rows)) for k in ("opening", "receipts", "payments", "closing")}


def level0_summary(db, masters, type_by_group, period_match, fy_start, view_start) -> dict:
    """Top-level **category overview** in a single call.

    Returns the KPI block plus the *cash* and *bank* ledger lists (each with its
    own totals) so the UI can present the two top tabs and switch between them
    without re-querying. A ``groups`` rollup is also included for any consumer
    that still wants the group-wise view. Empty (no-activity) ledgers are hidden.
    """
    figs = _figures(db, masters, period_match, fy_start, view_start)

    cash_rows, bank_rows = [], []
    grp: dict[str, dict] = {}
    for m in masters:
        row = _ledger_row(m, type_by_group, figs)
        if not _has_activity(row):
            continue
        (cash_rows if row["type"] == "Cash" else bank_rows).append(row)
        gname = m.get("groupName") or "Cash-in-Hand"
        g = grp.setdefault(gname, {"id": gname, "name": gname, "type": row["type"],
                                   "opening": 0.0, "receipts": 0.0, "payments": 0.0,
                                   "closing": 0.0, "ledgerCount": 0})
        for k in ("opening", "receipts", "payments", "closing"):
            g[k] = money(g[k] + row[k])
        g["ledgerCount"] += 1

    cash_rows.sort(key=lambda r: (r["name"] or "").lower())
    bank_rows.sort(key=lambda r: (r["name"] or "").lower())
    cash_totals, bank_totals = _sum_totals(cash_rows), _sum_totals(bank_rows)
    receipts = money(cash_totals["receipts"] + bank_totals["receipts"])
    payments = money(cash_totals["payments"] + bank_totals["payments"])

    groups = sorted(grp.values(), key=lambda r: (0 if r["type"] == "Cash" else 1, r["name"].lower()))

    return {
        "summary": {
            "cashInHand": cash_totals["closing"],
            "bankBalance": bank_totals["closing"],
            "totalBalance": money(cash_totals["closing"] + bank_totals["closing"]),
            "opening": money(cash_totals["opening"] + bank_totals["opening"]),
            "receipts": receipts,
            "payments": payments,
            "netActivity": money(receipts - payments),
            "cashAccounts": len(cash_rows),
            "bankAccounts": len(bank_rows),
            "accountsCount": len(cash_rows) + len(bank_rows),
        },
        "cash": {"rows": cash_rows, "totals": cash_totals},
        "bank": {"rows": bank_rows, "totals": bank_totals},
        "groups": groups,
    }


def level1_ledgers(db, masters, type_by_group, period_match, fy_start, view_start,
                   group, search, sort, order, page, limit) -> tuple[dict, dict]:
    scoped = [m for m in masters if (not group or m.get("groupName") == group)]
    figs = _figures(db, scoped, period_match, fy_start, view_start)
    rows = []
    for m in scoped:
        name = m["ledgerName"]
        if search and search.lower() not in (name or "").lower():
            continue
        gname = m.get("groupName")
        row = {"id": str(m["_id"]), "ledgerId": str(m["_id"]), "name": name,
               "group": gname, "type": type_by_group.get(gname, "Bank"), **figs[name]}
        if _has_activity(row):
            rows.append(row)
    rows = _sort_rows(rows, sort, order)
    totals = {k: money(sum(r[k] for r in rows)) for k in ("opening", "receipts", "payments", "closing")}
    page_rows, pagination = _paginate(rows, page, limit)
    data = {
        "group": {"name": group, "type": type_by_group.get(group)} if group else None,
        "rows": page_rows,
        "totals": totals,
    }
    return data, pagination


def _resolve_ledger(db, ledger_id, ledger_name):
    master = None
    if ledger_id:
        master = ledger_repo.find_ledger(db, ledger_id)
    if not master and ledger_name:
        master = ledger_repo.find_ledger(db, ledger_name)
    return master


def level2_monthly(db, master, type_by_group, fy) -> dict:
    name = master["ledgerName"]
    gname = master.get("groupName")
    od, oc = ledger_repo.opening_balance(master)
    fy_opening = od - oc

    movement = voucher_repo.monthly_ledger_movement(db, fy, [name])
    buckets = month_buckets(fy)
    rows = []
    run = fy_opening
    for b in buckets:
        rec = movement.get(b["month"], {"debit": 0.0, "credit": 0.0})
        receipts, payments = rec["debit"], rec["credit"]
        o = run
        run = o + receipts - payments
        # Carry the running balance across every month, but only surface months
        # that actually had movement (Tally hides empty months).
        if receipts or payments:
            rows.append({
                "id": b["id"], "month": b["label"], "year": b["year"], "monthNum": b["month"],
                "opening": money(o), "receipts": money(receipts),
                "payments": money(payments), "closing": money(run),
            })
    totals = {
        "opening": money(fy_opening),
        "receipts": money(sum(r["receipts"] for r in rows)),
        "payments": money(sum(r["payments"] for r in rows)),
        "closing": money(run),
    }
    return {
        "ledger": {"id": str(master["_id"]), "name": name, "group": gname,
                   "type": type_by_group.get(gname, "Bank"),
                   "opening": money(fy_opening), "closing": money(run)},
        "rows": rows,
        "totals": totals,
    }


def _month_window(fy, month_id):
    target = next((b for b in month_buckets(fy) if b["id"] == month_id), None)
    if not target:
        return None
    start = datetime(target["year"], target["month"], 1)
    end = (datetime(start.year + 1, 1, 1) if start.month == 12
           else datetime(start.year, start.month + 1, 1))
    return start, end, target["label"]


def level3_transactions(db, master, type_by_group, fy, fy_start, period_match, view_start,
                        month, search, voucher_type, page, limit) -> tuple[dict, dict]:
    name = master["ledgerName"]
    gname = master.get("groupName")
    od, oc = ledger_repo.opening_balance(master)
    fy_opening = od - oc

    period_label = None
    if month:
        win = _month_window(fy, month)
        if win:
            mstart, mend, period_label = win
            stmt_match = date_range_filter(mstart, mend - timedelta(microseconds=1000))
            view_start = mstart
        else:
            stmt_match = period_match
    else:
        stmt_match = period_match

    # Opening brought forward to the start of the shown window.
    pre_d, pre_c = (0.0, 0.0)
    if view_start and view_start > fy_start:
        pre_d, pre_c = voucher_repo.ledger_period_movement(
            db, {"dates.date": {"$gte": fy_start, "$lt": view_start}}, name)
    opening = money(fy_opening + pre_d - pre_c)

    skip = (page - 1) * limit if limit else 0
    raw, total, totals = voucher_repo.ledger_running_statement(
        db, stmt_match, name, opening, skip=skip, limit=limit,
        voucher_type=voucher_type or None, search=search or None)

    rows = []
    for r in raw:
        receipts, payments = money(r.get("receipts", 0)), money(r.get("payments", 0))
        rows.append({
            "id": str(r["_id"]), "voucherId": str(r["_id"]),
            "voucherNo": r.get("voucherNumber") or str(r["_id"]),
            "date": fmt_date(r.get("date")), "isoDate": iso_date(r.get("date")),
            "type": r.get("voucherTypeName"),
            "party": r.get("partyLedgerName") or "",
            "ref": r.get("ref") or "", "narration": r.get("narration") or "",
            "receipts": receipts, "payments": payments,
            "running": money(r.get("running", 0)),
        })
    pages = (total + limit - 1) // limit if limit else 1
    pagination = {"page": page, "limit": limit, "total": total, "pages": pages,
                  "pageSize": limit, "totalRecords": total, "totalPages": pages,
                  "hasNext": page < pages, "hasPrevious": page > 1}
    data = {
        "ledger": {"id": str(master["_id"]), "name": name, "group": gname,
                   "type": type_by_group.get(gname, "Bank")},
        "period": {"label": period_label, "month": month},
        "opening": opening,
        "rows": rows,
        "totals": {"receipts": money(totals["receipts"]), "payments": money(totals["payments"]),
                   "closing": money(totals["closing"])},
    }
    return data, pagination


# ─────────────────────────── dispatcher ───────────────────────────
def drilldown(db, fy: str, level: int, params: dict) -> dict:
    """Resolve a single drill-down level into ``{data, pagination, meta}``."""
    start = params.get("start")
    end = params.get("end")
    fy_start = fy_bounds(fy)[0]
    period_match = date_range_filter(start, end) if start and end else {"dates.date": {"$gte": fy_start}}
    view_start = start or fy_start

    page = max(int(params.get("page") or 1), 1)
    limit = int(params.get("limit") or 0)
    search = (params.get("search") or "").strip()
    sort = params.get("sort")
    order = params.get("order") or "asc"
    voucher_type = (params.get("voucherType") or "").strip()

    type_by_group = discover_cashbank_groups(db)
    masters = cashbank_ledger_masters(db, type_by_group)
    meta = {"fy": fy}

    if level <= 0:
        data = level0_summary(db, masters, type_by_group, period_match, fy_start, view_start)
        return {"data": data, "pagination": None, "meta": meta}

    if level == 1:
        group = params.get("group") or None
        meta["group"] = group
        data, pagination = level1_ledgers(
            db, masters, type_by_group, period_match, fy_start, view_start,
            group, search, sort, order, page, limit)
        return {"data": data, "pagination": pagination, "meta": meta}

    if level >= 4:
        # Complete voucher detail — needs only the voucher id, no ledger context.
        voucher_id = params.get("voucherId")
        meta["voucherId"] = voucher_id
        detail = get_voucher_detail(db, voucher_id) if voucher_id else None
        return {"data": detail, "pagination": None, "meta": meta}

    master = _resolve_ledger(db, params.get("ledgerId"), params.get("ledgerName"))
    if not master:
        return {"data": None, "pagination": None, "meta": meta, "error": "Ledger not found"}
    meta["ledgerName"] = master["ledgerName"]
    meta["group"] = master.get("groupName")

    if level == 2:
        data = level2_monthly(db, master, type_by_group, fy)
        return {"data": data, "pagination": None, "meta": meta}

    # level == 3 : date-wise statement with running balance
    month = params.get("month") or None
    meta["month"] = month
    # limit == 0 means "all rows" (used by export); the route defaults to 50.
    data, pagination = level3_transactions(
        db, master, type_by_group, fy, fy_start, period_match, view_start,
        month, search, voucher_type, page, limit)
    return {"data": data, "pagination": pagination, "meta": meta}
