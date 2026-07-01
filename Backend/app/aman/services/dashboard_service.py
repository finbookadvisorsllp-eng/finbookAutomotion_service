"""Dashboard / Business Command Center — composed from the report services.

Hard rule (CA + architect): the dashboard NEVER invents its own accounting. Every
figure is pulled from the *same* engine that powers the corresponding report
module, so each widget reconciles to the rupee with its drill-down page:

    Total Sales · Top Customers · Top Products  ->  Sales Register engine
    Total Purchase · Top Vendors                ->  Purchase Register engine
    Receivables · Payables · Cash & Bank        ->  ledger balances (Trial Balance / BS)
    Net Profit · Revenue-vs-Expense trend       ->  Profit & Loss
    Receivables Aging                           ->  Outstanding Reports
    Cash Flow                                   ->  Cash Flow statement

KPIs compare the selected FY against the prior FY. Nothing is hardcoded — parties,
items, classifications and amounts all derive from MongoDB + Tally-synced records.

Note on "Total Sales" vs P&L "Revenue": the KPI/registers report the **gross**
invoice value (what the business calls sales, incl. output GST), while the
Revenue-vs-Expense chart and Net Profit are the **P&L** view (income net of tax).
Both are correct and each reconciles with its own module; they are intentionally
different lenses, not a discrepancy.
"""
from app.aman.core.serializers import money, fmt_date
from app.aman.repositories import group_repo, voucher_repo
from app.aman.services.accounting import compute_ledger_balances
from app.aman.services.pl_service import build_profit_loss
from app.aman.services.financial_year import prev_fy, fy_bounds, FY_MONTH_ORDER

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ─────────────────────────── canonical register totals ───────────────────────────
def _doc_total(db, fy: str, parent: str) -> dict:
    """Whole-FY {gross, net, count} for a document class via the register engine.

    ``doc_base_match`` classifies by Tally's reserved parent class
    (``voucherTypeOrigName``) and excludes cancelled/optional vouchers, and
    ``sales_total`` derives the value from ``ledgerEntries`` — identical to the
    Sales / Purchase Register, so the KPI matches the register header exactly."""
    start, end = fy_bounds(fy)
    base = voucher_repo.doc_base_match([parent], start, end)
    return voucher_repo.sales_total(db, base)


def _classify_ledgers(db, balances):
    """Split ledger names by root-group classification + roll up the balance-sheet
    pools (debtors / creditors / cash-bank) — the same figures as Trial Balance,
    Balance Sheet and Outstanding Reports."""
    groups = group_repo.group_by_name(db)
    income, expense = [], []
    debtors = creditors = cashbank = 0.0
    for lb in balances.values():
        cls = group_repo.classification_of(groups.get(lb.root_group))
        if cls == "INCOME":
            income.append(lb.name)
        elif cls == "EXPENSE":
            expense.append(lb.name)
        if lb.group_name == "Sundry Debtors":
            debtors += lb.closing_debit
        elif lb.group_name == "Sundry Creditors":
            creditors += lb.closing_credit
        elif lb.group_name in ("Bank Accounts", "Cash-in-Hand"):
            cashbank += (lb.closing_debit - lb.closing_credit)
    return income, expense, money(debtors), money(creditors), money(cashbank)


def _fy_totals(db, fy):
    sales = _doc_total(db, fy, "Sales")["gross"]
    purchase = _doc_total(db, fy, "Purchase")["gross"]
    balances = compute_ledger_balances(db, fy)
    _, _, debtors, creditors, cashbank = _classify_ledgers(db, balances)
    net = build_profit_loss(db, fy)["years"][0]["summary"]["net"]
    return {"sales": money(sales), "purchase": money(purchase),
            "receivables": debtors, "payables": creditors,
            "cashBank": cashbank, "netProfit": net}


def _change(curr, prev):
    if not prev:
        return 0.0
    return round((curr - prev) / abs(prev) * 100, 1)


def kpis(db, fy: str) -> dict:
    curr = _fy_totals(db, fy)
    prev = _fy_totals(db, prev_fy(fy))
    spark = monthly_trend(db, fy)["series"]
    sales_spark = [m["revenue"] for m in spark]
    out = {}
    labels = {"sales": "Total Sales", "purchase": "Total Purchase",
              "receivables": "Receivables", "payables": "Payables",
              "cashBank": "Cash & Bank Balance", "netProfit": "Net Profit"}
    # For receivables/payables a *fall* is the good direction; the UI colours it.
    for key, label in labels.items():
        c, p = curr[key], prev[key]
        out[key] = {"current": c, "previous": p, "change": _change(c, p),
                    "trend": "up" if c >= p else "down", "label": label,
                    "sparkData": sales_spark if key == "sales" else None}
    # Net profit margin (on gross sales) — a real, derived figure for the subtitle.
    out["netProfit"]["margin"] = round(curr["netProfit"] / curr["sales"] * 100, 1) if curr["sales"] else 0.0
    return out


def monthly_trend(db, fy: str) -> dict:
    """Revenue / Expense / Profit per month — the P&L lens (income & expense ledger
    movement, net of tax), so it reconciles with the Profit & Loss report."""
    balances = compute_ledger_balances(db, fy)
    income, expense, *_ = _classify_ledgers(db, balances)
    inc_mov = voucher_repo.monthly_ledger_movement(db, fy, income)
    exp_mov = voucher_repo.monthly_ledger_movement(db, fy, expense)
    series = []
    for mnum in FY_MONTH_ORDER:
        rev = (inc_mov.get(mnum, {}).get("credit", 0)
               - inc_mov.get(mnum, {}).get("debit", 0))
        exp = (exp_mov.get(mnum, {}).get("debit", 0)
               - exp_mov.get(mnum, {}).get("credit", 0))
        series.append({"month": _MONTHS[mnum - 1], "revenue": money(rev),
                       "expense": money(exp), "profit": money(rev - exp)})
    return {"series": series}


def expense_breakdown(db, fy: str) -> list[dict]:
    balances = compute_ledger_balances(db, fy)
    groups = group_repo.group_by_name(db)
    agg: dict[str, float] = {}
    for lb in balances.values():
        cls = group_repo.classification_of(groups.get(lb.root_group))
        if cls == "EXPENSE":
            net = lb.closing_debit - lb.closing_credit
            if net:
                agg[lb.root_group] = money(agg.get(lb.root_group, 0) + net)
    palette = ["#2563eb", "#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#94a3b8"]
    return [{"name": k, "value": v, "color": palette[i % len(palette)]}
            for i, (k, v) in enumerate(sorted(agg.items(), key=lambda x: -x[1]))]


def recent_vouchers(db, fy: str, limit: int = 10) -> list[dict]:
    """Latest vouchers across every type for the 'Recent Transactions' widget.

    Amount + tax are derived from ``ledgerEntries`` (robust to a missing ``totals``
    block). ``id`` carries the Mongo ``_id`` so the row drills straight to the
    universal voucher detail; ``number`` is the human voucher number."""
    docs = voucher_repo.recent_with_measure(db, fy, limit)
    out = []
    for v in docs:
        out.append({
            "id": str(v.get("_id")),
            "number": v.get("voucherNumber") or str(v.get("_id")),
            "date": fmt_date((v.get("dates") or {}).get("date")),
            "type": v.get("voucherTypeName") or v.get("voucherTypeOrigName") or "",
            "party": v.get("partyLedgerName") or v.get("partyName") or "",
            "amount": money(v.get("amount") or 0),
            "gst": money(v.get("tax") or 0),
            # Every synced Tally voucher is posted; bill-level paid/overdue status
            # needs bill allocations (absent in the sync) so we don't fabricate it.
            "status": "posted",
        })
    return out


def top_customers(db, fy: str, limit: int = 8) -> list[dict]:
    """Top customers by gross sales (Sales Register, ledger view) enriched with the
    live outstanding (Receivables). Both figures reconcile with their modules."""
    start, end = fy_bounds(fy)
    base = voucher_repo.doc_base_match(["Sales"], start, end)
    from app.aman.services.outstanding_service import outstanding_by_party
    outstanding = outstanding_by_party(db, fy, "debit")
    rows = []
    for r in voucher_repo.sales_group_by_voucher(db, base, "$partyLedgerName"):
        name = r["key"] or "(No Ledger)"
        rows.append({"name": name, "sales": money(r["gross"]), "txns": r["count"],
                     "outstanding": money(outstanding.get(name, 0.0)),
                     "lastTxn": None})
    return sorted(rows, key=lambda r: -r["sales"])[:limit]


def top_vendors(db, fy: str, limit: int = 8) -> list[dict]:
    """Top vendors by gross purchases (Purchase Register) enriched with the live
    payable (Payables)."""
    start, end = fy_bounds(fy)
    base = voucher_repo.doc_base_match(["Purchase"], start, end)
    from app.aman.services.outstanding_service import outstanding_by_party
    outstanding = outstanding_by_party(db, fy, "credit")
    rows = []
    for r in voucher_repo.sales_group_by_voucher(db, base, "$partyLedgerName"):
        name = r["key"] or "(No Ledger)"
        rows.append({"name": name, "purchase": money(r["gross"]), "txns": r["count"],
                     "outstanding": money(outstanding.get(name, 0.0)),
                     "lastTxn": None})
    return sorted(rows, key=lambda r: -r["purchase"])[:limit]


def top_items(db, fy: str, limit: int = 8) -> list[dict]:
    """Top products by sales value, consumed from the Item Performance engine so
    the figures match that report. Carries the three metrics the dashboard shows —
    quantity sold, sales value and **profit contribution** (gross profit + margin
    at weighted-average cost) — plus each item's share of total sales value.
    ``trend`` is derived from margin sign (no fabricated up/down)."""
    from app.aman.services.inventory_service import performance_list
    perf = performance_list(db, fy, sort="salesvalue", order="desc", page=1, limit=limit)
    total_sales = perf["summary"].get("totalSalesValue") or 1.0
    rows = []
    for r in perf["items"]:
        sv = money(r.get("salesValue", 0))
        margin = round(r.get("margin", 0) or 0, 1)
        rows.append({"name": r.get("name") or "(No Item)", "value": sv,
                     "qty": round(r.get("salesQty", 0) or 0, 3),
                     "category": r.get("group") or "—",
                     "grossProfit": money(r.get("grossProfit", 0)),
                     "margin": margin,
                     "trend": "up" if margin > 0 else ("down" if margin < 0 else "stable"),
                     "valueShare": round(sv / total_sales * 100, 1)})
    return rows


def receivables_aging(db, fy: str) -> dict:
    """Receivables aging consumed straight from the Outstanding Reports engine, so
    the total + buckets match that page. ``aging.available`` is False (with a
    reason) when bill-wise allocations / due dates are not in the synced data — the
    UI shows the configured buckets but marks them not-yet-computable rather than
    fabricating a split."""
    from app.aman.services.outstanding_service import receivables as os_receivables
    # page/limit only trim the (unused) party rows; aging + summary are full-set.
    r = os_receivables(db, fy, page=1, limit=1)
    return {"aging": r["aging"], "summary": r["summary"], "buckets": r["buckets"]}


def cash_flow(db, fy: str) -> dict:
    """Cash inflow / outflow / net + monthly series consumed from the Cash Flow
    statement (Tally direct method). Reconciles with the Cash Flow report
    (Opening + Inflow − Outflow = Closing)."""
    from app.aman.services.cashflow_service import build_cash_flow
    start, end = fy_bounds(fy)
    cf = build_cash_flow(db, fy, start, end)
    return {"summary": cf["summary"], "series": cf["series"],
            "reconciled": cf.get("reconciled", True)}


def alerts(db, fy: str) -> list[dict]:
    """Business alerts, every one derived from live data (never hardcoded):
    overdue receivables, outstanding payables, low/critical stock, negative cash.

    Alerts requiring data the sync does not carry (e.g. a GST-return due calendar)
    are deliberately not emitted rather than faked."""
    out = []
    # Overdue receivables — heuristic flag from the parties view (no recent activity
    # 90+ days); the amount is the ledger outstanding, so it reconciles.
    try:
        from app.aman.services.parties_service import receivables as approx_receivables
        rec = approx_receivables(db, fy)
        overdue = [p for p in rec["parties"] if p.get("status") == "overdue"]
        if overdue:
            amt = money(sum(p["outstanding"] for p in overdue))
            out.append({"type": "danger", "icon": "⚠️", "text": "Overdue receivables",
                        "value": amt, "subtext": f"{len(overdue)} parties · no activity 90+ days",
                        "action": "View Receivables"})
    except Exception:
        pass
    # Outstanding payables — total reconciles with the Payables page.
    try:
        from app.aman.services.outstanding_service import payables as os_payables
        pay = os_payables(db, fy, page=1, limit=1)
        if pay["summary"]["total"]:
            out.append({"type": "warning", "icon": "🧾", "text": "Outstanding payables",
                        "value": pay["summary"]["total"],
                        "subtext": f"{pay['summary']['partyCount']} vendor balances",
                        "action": "View Payables"})
    except Exception:
        pass
    # Zero / negative stock (reorder levels are not in the sync — see stock_alerts).
    try:
        from app.aman.services.inventory_service import stock_alerts
        low = stock_alerts(db, fy)
        count = (low.get("summary") or {}).get("totalAlerts", 0)
        if count:
            out.append({"type": "warning", "icon": "📦", "text": "Stock alerts",
                        "value": f"{count} items", "subtext": "Zero / negative stock",
                        "action": "View Inventory"})
    except Exception:
        pass
    # Negative cash / bank balance.
    balances = compute_ledger_balances(db, fy)
    _, _, _, _, cashbank = _classify_ledgers(db, balances)
    if cashbank < 0:
        out.append({"type": "danger", "icon": "🏦", "text": "Negative cash / bank balance",
                    "value": money(cashbank), "subtext": "Cash + bank pool is overdrawn",
                    "action": "View Cash & Bank"})
    return out


def notifications(db, fy: str) -> list[dict]:
    notes = []
    for i, a in enumerate(alerts(db, fy), start=1):
        notes.append({"id": i, "type": a["type"], "message": f"{a['text']}: {a['value']}",
                      "time": "today", "read": False})
    return notes
