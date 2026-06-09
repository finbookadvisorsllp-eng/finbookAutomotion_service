"""Dashboard, Analytics, Alerts — composed from the other report services.

KPIs compare the selected FY against the prior FY. All figures are real
aggregations; nothing is hardcoded.
"""
from app.aman.core.serializers import money, fmt_date
from app.aman.repositories import group_repo, voucher_repo
from app.aman.services.accounting import compute_ledger_balances
from app.aman.services.pl_service import build_profit_loss
from app.aman.services.financial_year import prev_fy, FY_MONTH_ORDER

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _classify_ledgers(db, balances):
    """Split ledger names by root-group classification."""
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
    sales = voucher_repo.type_totals(db, fy, ["Sales"])["amount"]
    purchase = voucher_repo.type_totals(db, fy, ["Purchase"])["amount"]
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
    for key, label in labels.items():
        c, p = curr[key], prev[key]
        out[key] = {"current": c, "previous": p, "change": _change(c, p),
                    "trend": "up" if c >= p else "down", "label": label,
                    "sparkData": sales_spark if key == "sales" else None}
    return out


def monthly_trend(db, fy: str) -> dict:
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
    docs = voucher_repo.find(
        db, voucher_repo.fy_match(fy),
        projection={"voucherNumber": 1, "voucherTypeName": 1, "partyLedgerName": 1,
                    "dates.date": 1, "totals": 1, "gstDetails.partyGstin": 1},
        sort=[("dates.date", -1)], limit=limit)
    out = []
    for v in docs:
        totals = v.get("totals") or {}
        out.append({
            "id": v.get("voucherNumber"),
            "date": fmt_date((v.get("dates") or {}).get("date")),
            "type": v.get("voucherTypeName"),
            "party": v.get("partyLedgerName") or "",
            "amount": money(totals.get("totalDebit") or 0),
            "gst": money(totals.get("taxAmount") or 0),
            "status": "posted",
        })
    return out


def top_customers(db, fy: str, limit: int = 8) -> list[dict]:
    totals = voucher_repo.party_totals(db, fy, ["Sales"])
    rows = [{"name": k, "sales": money(v["amount"]), "txns": v["count"],
             "lastTxn": fmt_date(v.get("lastDate"))}
            for k, v in totals.items()]
    return sorted(rows, key=lambda r: -r["sales"])[:limit]


def top_vendors(db, fy: str, limit: int = 8) -> list[dict]:
    totals = voucher_repo.party_totals(db, fy, ["Purchase"])
    rows = [{"name": k, "purchase": money(v["amount"]), "txns": v["count"],
             "lastTxn": fmt_date(v.get("lastDate"))}
            for k, v in totals.items()]
    return sorted(rows, key=lambda r: -r["purchase"])[:limit]


def top_items(db, fy: str, limit: int = 8) -> list[dict]:
    totals = voucher_repo.stockitem_totals(db, fy, ["Sales"])
    rows = [{"name": k, "value": money(v["value"]), "txns": v["count"]}
            for k, v in totals.items()]
    return sorted(rows, key=lambda r: -r["value"])[:limit]


def alerts(db, fy: str) -> list[dict]:
    """Derived business alerts (overdue receivables, low stock, payables)."""
    from app.aman.services.parties_service import receivables, payables
    from app.aman.services.inventory_service import stock_alerts
    out = []
    rec = receivables(db, fy)
    overdue = [p for p in rec["parties"] if p["status"] == "overdue"]
    if overdue:
        amt = money(sum(p["outstanding"] for p in overdue))
        out.append({"type": "danger", "icon": "⚠️", "text": "Overdue receivables",
                    "value": amt, "subtext": f"{len(overdue)} parties past 90 days",
                    "action": "View Receivables"})
    pay = payables(db, fy)
    if pay["total"]:
        out.append({"type": "warning", "icon": "🧾", "text": "Outstanding payables",
                    "value": pay["total"], "subtext": f"{len(pay['parties'])} vendor bills",
                    "action": "View Payables"})
    low = stock_alerts(db, fy)
    if low:
        out.append({"type": "warning", "icon": "📦", "text": "Low / critical stock",
                    "value": f"{len(low)} items", "subtext": "At or below reorder level",
                    "action": "View Inventory"})
    return out


def notifications(db, fy: str) -> list[dict]:
    notes = []
    for i, a in enumerate(alerts(db, fy), start=1):
        notes.append({"id": i, "type": a["type"], "message": f"{a['text']}: {a['value']}",
                      "time": "today", "read": False})
    return notes
