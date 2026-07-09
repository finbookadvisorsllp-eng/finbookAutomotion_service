"""Deterministic financial rules engine — the non-AI half of the AI CFO.

These findings are computed straight from the grounded context (which is itself
built from the report services), so every recommendation/warning reconciles to
the rupee with the reports. No LLM is involved here — this is the trustworthy,
auditable backbone; the LLM only *explains* and *converses* on top of it.

Detects: profit decline, expense increase, cash shortage, outstanding/receivables
risk, sales decline — plus positive signals (healthy growth).

Public API
----------
``evaluate(context)``  -> list[Insight-dict]  (severity-ranked)
"""
from app.aman.core.serializers import money, inr

# Tunable thresholds (kept here, not scattered). Conservative, business-sensible.
SALES_DECLINE_PCT = -5.0        # sales down >5% YoY
PROFIT_DECLINE_PCT = -5.0       # net profit down >5% YoY
EXPENSE_SPIKE_PCT = 15.0        # purchases/expenses up >15% YoY
MARGIN_THIN_PCT = 5.0           # net margin below 5%
RECEIVABLES_TO_SALES = 0.25     # receivables > 25% of annual sales = collection risk


def _sec(context: dict, name: str) -> dict:
    d = (context.get("sections") or {}).get(name) or {}
    return d if d.get("available") else {}


def _insight(id_, severity, category, title, detail, **extra) -> dict:
    return {"id": id_, "severity": severity, "category": category,
            "title": title, "detail": detail, **extra}


def evaluate(context: dict) -> list[dict]:
    """Return severity-ranked insights derived purely from the grounded context."""
    out: list[dict] = []
    fy = context.get("fy")
    profit = _sec(context, "profit")
    sales = _sec(context, "sales")
    expense = _sec(context, "expense")
    cash = _sec(context, "cash")
    outstanding = _sec(context, "outstanding")

    # ── Profit decline ──
    npc = profit.get("netProfitChangePct")
    if isinstance(npc, (int, float)):
        if npc <= PROFIT_DECLINE_PCT:
            out.append(_insight(
                "profit-decline", "danger", "profitability",
                "Net profit is down year-over-year",
                f"Net profit is {inr(profit.get('netProfit'))} in {fy}, "
                f"{npc:+.1f}% vs the prior year ({inr(profit.get('netProfitPrevFy'))}).",
                metric="netProfit", value=money(profit.get("netProfit")), change=npc,
                action="Analyze P&L"))
        elif npc >= 10:
            out.append(_insight(
                "profit-growth", "success", "profitability",
                "Net profit is growing",
                f"Net profit is up {npc:+.1f}% YoY to {inr(profit.get('netProfit'))}.",
                metric="netProfit", value=money(profit.get("netProfit")), change=npc))

    # ── Thin margin ──
    margin = profit.get("profitMargin")
    if isinstance(margin, (int, float)) and 0 <= margin < MARGIN_THIN_PCT:
        out.append(_insight(
            "thin-margin", "warning", "profitability",
            "Net profit margin is thin",
            f"Net margin is {margin}% — below {MARGIN_THIN_PCT}%. Small cost or price "
            "changes will swing the bottom line.",
            metric="profitMargin", value=margin, action="Analyze P&L"))
    if isinstance(profit.get("netProfit"), (int, float)) and profit["netProfit"] < 0:
        out.append(_insight(
            "net-loss", "danger", "profitability",
            "The business is running at a net loss",
            f"Net result for {fy} is {inr(profit['netProfit'])}.",
            metric="netProfit", value=money(profit["netProfit"]), action="Analyze P&L"))

    # ── Sales decline ──
    sc = sales.get("changePct")
    if isinstance(sc, (int, float)) and sc <= SALES_DECLINE_PCT:
        out.append(_insight(
            "sales-decline", "warning", "sales",
            "Sales are declining year-over-year",
            f"Total sales are {inr(sales.get('totalSales'))}, {sc:+.1f}% vs the prior "
            f"year ({inr(sales.get('previousFy'))}).",
            metric="totalSales", value=money(sales.get("totalSales")), change=sc,
            action="Analyze Sales"))

    # ── Expense / purchase spike ──
    pc = expense.get("purchaseChangePct")
    if isinstance(pc, (int, float)) and pc >= EXPENSE_SPIKE_PCT:
        out.append(_insight(
            "expense-spike", "warning", "expenses",
            "Purchases are rising sharply",
            f"Purchases are up {pc:+.1f}% YoY to {inr(expense.get('purchaseCurrent'))}. "
            "Check whether sales grew in step, or margins are eroding.",
            metric="purchase", value=money(expense.get("purchaseCurrent")), change=pc,
            action="Analyze P&L"))

    # ── Cash shortage ──
    bal = cash.get("cashBankBalance")
    if isinstance(bal, (int, float)):
        if bal < 0:
            out.append(_insight(
                "cash-negative", "danger", "liquidity",
                "Cash & bank balance is negative",
                f"The combined cash + bank pool is {inr(bal)} — overdrawn. This is a "
                "liquidity risk; review upcoming payments and collections.",
                metric="cashBank", value=money(bal), action="Analyze Cash"))
        net_cf = cash.get("netCashFlow")
        if isinstance(net_cf, (int, float)) and net_cf < 0 and bal >= 0:
            out.append(_insight(
                "cash-flow-negative", "warning", "liquidity",
                "Net cash flow is negative for the year",
                f"More cash left the business than came in (net {inr(net_cf)}). "
                "Balance is still positive, but the trend is worth watching.",
                metric="netCashFlow", value=money(net_cf), action="Analyze Cash"))

    # ── Receivables / collection risk ──
    rec = outstanding.get("receivablesTotal")
    ann_sales = sales.get("totalSales")
    if isinstance(rec, (int, float)) and rec > 0:
        if isinstance(ann_sales, (int, float)) and ann_sales > 0 and rec / ann_sales >= RECEIVABLES_TO_SALES:
            ratio = rec / ann_sales * 100
            out.append(_insight(
                "receivables-high", "warning", "collections",
                "Receivables are high relative to sales",
                f"Receivables of {inr(rec)} are {ratio:.0f}% of annual sales across "
                f"{outstanding.get('receivableParties')} parties. Tightening collections "
                "would free up cash.",
                metric="receivables", value=money(rec), action="View Receivables"))
        elif outstanding.get("receivableParties"):
            out.append(_insight(
                "receivables-info", "info", "collections",
                "Outstanding receivables to collect",
                f"{inr(rec)} is due from {outstanding.get('receivableParties')} parties.",
                metric="receivables", value=money(rec), action="View Receivables"))

    # ── Payables (informational) ──
    pay = outstanding.get("payablesTotal")
    if isinstance(pay, (int, float)) and pay > 0:
        out.append(_insight(
            "payables-info", "info", "obligations",
            "Outstanding payables due to vendors",
            f"{inr(pay)} is payable across {outstanding.get('payableParties')} vendors.",
            metric="payables", value=money(pay), action="View Payables"))

    severity_rank = {"danger": 0, "warning": 1, "info": 2, "success": 3}
    out.sort(key=lambda i: severity_rank.get(i["severity"], 9))
    return out


def split_by_kind(insights: list[dict]) -> dict:
    """Partition insights for the /recommendations, /warnings and /alerts endpoints."""
    warnings = [i for i in insights if i["severity"] in ("warning", "danger")]
    alerts = [i for i in insights if i["severity"] == "danger"]
    # Recommendations = anything actionable (has an 'action'), any severity.
    recommendations = [i for i in insights if i.get("action")]
    return {"recommendations": recommendations, "warnings": warnings, "alerts": alerts}
