"""Financial Context Engine — turns the company's live books into a compact,
grounded snapshot the AI can reason over.

HARD RULE (the anti-hallucination guarantee): every number here is pulled from
an existing report service — the same engine that powers the UI. The AI is only
ever *shown* real, reconciled figures; it never computes accounting itself. Each
loader is defensively wrapped so a single failing report degrades that one
section to ``{"available": False, "reason": ...}`` instead of breaking the chat.

Public API
----------
``build_context(db, fy, sections=None)``  assemble the structured snapshot
``format_for_prompt(context)``            render it as compact text for the model
"""
from app.aman.core.serializers import money, inr
from app.aman.services.financial_year import current_fy, prev_fy

# Report engines (consumed, never re-implemented).
from app.aman.services import dashboard_service as ds
from app.aman.services import outstanding_service as outs
from app.aman.services import inventory_service as inv
from app.aman.services import gst_service as gst
from app.aman.services.pl_service import build_profit_loss


# All sections the engine can build. A chat request may ask for a subset.
ALL_SECTIONS = ["profit", "sales", "expense", "outstanding", "cash", "customer", "stock", "gst"]


def _safe(fn):
    """Run a loader, converting any failure into a structured 'unavailable' marker
    so the context is always well-formed."""
    try:
        data = fn()
        if data is None:
            return {"available": False, "reason": "no data"}
        return data
    except Exception as exc:  # noqa: BLE001 — never let one report break the context
        return {"available": False, "reason": f"{type(exc).__name__}: {exc}"}


# ─────────────────────────────── Section loaders ───────────────────────────────
def profit_context(db, fy: str) -> dict:
    """P&L: revenue, gross/net profit, margin, and YoY movement (from the KPI
    engine, which compares the FY against the prior FY)."""
    pl = build_profit_loss(db, fy)
    k = pl.get("kpis", {})
    summary = (pl.get("years") or [{}])[0].get("summary", {})
    kpis = ds.kpis(db, fy)  # current vs previous, with % change
    np_kpi = kpis.get("netProfit", {})
    sales_kpi = kpis.get("sales", {})
    return {
        "available": True,
        "revenue": money(k.get("revenue")),
        "grossProfit": money(k.get("grossProfit")),
        "netProfit": money(k.get("netProfit")),
        "profitMargin": k.get("profitMargin"),
        "expensesTotal": money(k.get("expenses")),
        "openingStock": money(summary.get("openingStock")),
        "closingStock": money(summary.get("closingStock")),
        "netProfitPrevFy": money(np_kpi.get("previous")),
        "netProfitChangePct": np_kpi.get("change"),
        "salesPrevFy": money(sales_kpi.get("previous")),
        "salesChangePct": sales_kpi.get("change"),
        "stockNote": (pl.get("stockInfo") or {}).get("note"),
    }


def sales_context(db, fy: str) -> dict:
    """Gross sales (register lens), YoY change, and monthly revenue trend."""
    kpis = ds.kpis(db, fy)
    sales_kpi = kpis.get("sales", {})
    trend = ds.monthly_trend(db, fy).get("series", [])
    return {
        "available": True,
        "totalSales": money(sales_kpi.get("current")),
        "previousFy": money(sales_kpi.get("previous")),
        "changePct": sales_kpi.get("change"),
        "trend": "up" if sales_kpi.get("trend") == "up" else "down",
        "monthly": [{"month": m["month"], "revenue": m["revenue"]} for m in trend],
        "topCustomers": ds.top_customers(db, fy, limit=5),
    }


def expense_context(db, fy: str) -> dict:
    """Expense total, YoY movement, and the biggest expense groups."""
    kpis = ds.kpis(db, fy)
    breakdown = ds.expense_breakdown(db, fy)
    top = [{"name": b["name"], "value": b["value"]} for b in breakdown[:6]]
    # Total expenses come from the P&L (authoritative), YoY from the trend.
    pl = build_profit_loss(db, fy)
    return {
        "available": True,
        "expensesTotal": money(pl.get("kpis", {}).get("expenses")),
        "topExpenseGroups": top,
        "purchasePrevFy": money(kpis.get("purchase", {}).get("previous")),
        "purchaseCurrent": money(kpis.get("purchase", {}).get("current")),
        "purchaseChangePct": kpis.get("purchase", {}).get("change"),
    }


def outstanding_context(db, fy: str) -> dict:
    """Receivables + payables totals, party counts and aging availability."""
    rec = outs.receivables(db, fy, page=1, limit=1)
    pay = outs.payables(db, fy, page=1, limit=1)
    return {
        "available": True,
        "receivablesTotal": money(rec["summary"]["total"]),
        "receivableParties": rec["summary"]["partyCount"],
        "payablesTotal": money(pay["summary"]["total"]),
        "payableParties": pay["summary"]["partyCount"],
        "agingAvailable": bool((rec.get("aging") or {}).get("available", False)),
    }


def cash_context(db, fy: str) -> dict:
    """Cash & bank balance plus cash-flow inflow/outflow/net for the FY."""
    kpis = ds.kpis(db, fy)
    cf = ds.cash_flow(db, fy)
    cb = kpis.get("cashBank", {})
    return {
        "available": True,
        "cashBankBalance": money(cb.get("current")),
        "previousFy": money(cb.get("previous")),
        "changePct": cb.get("change"),
        "inflow": money((cf.get("summary") or {}).get("inflow")),
        "outflow": money((cf.get("summary") or {}).get("outflow")),
        "netCashFlow": money((cf.get("summary") or {}).get("net")),
    }


def customer_context(db, fy: str) -> dict:
    """Top customers by sales with their live outstanding (receivables)."""
    top = ds.top_customers(db, fy, limit=6)
    return {
        "available": True,
        "topCustomers": [
            {"name": c["name"], "sales": c["sales"], "outstanding": c["outstanding"]}
            for c in top
        ],
    }


def stock_context(db, fy: str) -> dict:
    """Stock alert summary (zero/negative). Reorder levels are not in the sync,
    so only real, derivable alerts are surfaced."""
    alerts = inv.stock_alerts(db, fy)
    summary = alerts.get("summary") or {}
    return {
        "available": True,
        "totalAlerts": summary.get("totalAlerts", 0),
        "note": "Reorder levels are not in the synced data; only zero/negative stock is flagged.",
    }


def gst_context(db, fy: str) -> dict:
    s = gst.summary(db, fy)
    return {"available": True, "summary": s}


_LOADERS = {
    "profit": profit_context,
    "sales": sales_context,
    "expense": expense_context,
    "outstanding": outstanding_context,
    "cash": cash_context,
    "customer": customer_context,
    "stock": stock_context,
    "gst": gst_context,
}


# ─────────────────────────────── Assembly ───────────────────────────────
def build_context(db, fy: str | None = None, sections: list[str] | None = None) -> dict:
    """Assemble the grounded financial snapshot for ``fy`` (defaults to current).

    ``sections`` limits which loaders run (a targeted question needn't build
    everything). Unknown sections are ignored; the default is all of them."""
    fy = fy or current_fy()
    # None => all sections; an explicit [] => none (used for greetings/smalltalk).
    wanted = [s for s in (ALL_SECTIONS if sections is None else sections) if s in _LOADERS]
    out: dict = {"fy": fy, "previousFy": prev_fy(fy), "sections": {}}
    for name in wanted:
        out["sections"][name] = _safe(lambda n=name: _LOADERS[n](db, fy))
    return out


# ─────────────────────────────── Prompt rendering ───────────────────────────────
def _fmt_money(v) -> str:
    return inr(v)


def _pct(v) -> str:
    return f"{v:+.1f}%" if isinstance(v, (int, float)) else "n/a"


def format_for_prompt(context: dict) -> str:
    """Render the structured context as compact, labelled text for the model.

    Only available sections are emitted; unavailable ones are listed as data gaps
    so the model can honestly say 'that data isn't available' instead of guessing."""
    fy = context.get("fy")
    lines = [f"FINANCIAL CONTEXT (Financial Year {fy}; prior FY {context.get('previousFy')})",
             "All figures below are from the company's live books and reconcile with the report pages.",
             ""]
    gaps: list[str] = []
    sec = context.get("sections", {})

    def avail(name):
        d = sec.get(name)
        if d is None:
            return None  # not requested this turn — not a real data gap
        if not d.get("available", False):
            gaps.append(f"{name} ({d.get('reason', 'unavailable')})")
            return None
        return d

    if (p := avail("profit")):
        lines += [
            "PROFIT & LOSS:",
            f"  Revenue: {_fmt_money(p['revenue'])}",
            f"  Gross Profit: {_fmt_money(p['grossProfit'])}",
            f"  Net Profit: {_fmt_money(p['netProfit'])} (margin {p.get('profitMargin')}%)",
            f"  Net Profit vs prior FY: {_fmt_money(p['netProfitPrevFy'])} ({_pct(p['netProfitChangePct'])})",
            f"  Total Expenses: {_fmt_money(p['expensesTotal'])}",
            f"  Opening/Closing Stock: {_fmt_money(p['openingStock'])} / {_fmt_money(p['closingStock'])}",
        ]
        if p.get("stockNote"):
            lines.append(f"  ⚠ Stock caveat: {p['stockNote']}")
        lines.append("")

    if (s := avail("sales")):
        lines += [
            "SALES:",
            f"  Total Sales (gross): {_fmt_money(s['totalSales'])} vs prior {_fmt_money(s['previousFy'])} ({_pct(s['changePct'])})",
            "  Monthly revenue: " + ", ".join(f"{m['month']}={_fmt_money(m['revenue'])}" for m in s.get("monthly", [])[:12]),
        ]
        if s.get("topCustomers"):
            lines.append("  Top customers: " + "; ".join(
                f"{c['name']} ({_fmt_money(c['sales'])})" for c in s["topCustomers"][:5]))
        lines.append("")

    if (e := avail("expense")):
        lines += [
            "EXPENSES:",
            f"  Total Expenses: {_fmt_money(e['expensesTotal'])}",
            f"  Purchases: {_fmt_money(e['purchaseCurrent'])} vs prior {_fmt_money(e['purchasePrevFy'])} ({_pct(e['purchaseChangePct'])})",
            "  Largest expense groups: " + "; ".join(
                f"{g['name']} ({_fmt_money(g['value'])})" for g in e.get("topExpenseGroups", [])),
            "",
        ]

    if (o := avail("outstanding")):
        lines += [
            "OUTSTANDING:",
            f"  Receivables: {_fmt_money(o['receivablesTotal'])} across {o['receivableParties']} parties",
            f"  Payables: {_fmt_money(o['payablesTotal'])} across {o['payableParties']} parties",
            f"  Bill-wise aging available: {o['agingAvailable']}",
            "",
        ]

    if (c := avail("cash")):
        lines += [
            "CASH & BANK:",
            f"  Balance: {_fmt_money(c['cashBankBalance'])} vs prior {_fmt_money(c['previousFy'])} ({_pct(c['changePct'])})",
            f"  Cash flow — inflow {_fmt_money(c['inflow'])}, outflow {_fmt_money(c['outflow'])}, net {_fmt_money(c['netCashFlow'])}",
            "",
        ]

    if (cu := avail("customer")):
        rows = cu.get("topCustomers", [])
        if rows:
            lines.append("KEY CUSTOMERS (sales / outstanding):")
            for r in rows[:6]:
                lines.append(f"  {r['name']}: sales {_fmt_money(r['sales'])}, due {_fmt_money(r['outstanding'])}")
            lines.append("")

    if (st := avail("stock")):
        lines += [f"STOCK: {st['totalAlerts']} item(s) with zero/negative stock. {st.get('note','')}", ""]

    # avail() has quietly recorded gaps for anything unavailable/gst-heavy.
    avail("gst")

    if gaps:
        lines += ["DATA GAPS (be honest — do not invent figures for these):",
                  "  " + "; ".join(gaps), ""]
    return "\n".join(lines).strip()
