"""KPI engine — the single grounded metrics builder + the curated vital signs.

``build_metrics(db, fy)`` assembles ONE normalized dict of raw figures by
*consuming* the existing report services (never re-computing accounting). Every
other engine — pillars, risk, opportunity, simulate — reads this dict, so all of
Business Health shares one reconciled source of truth.

``vital_signs(metrics)`` turns the raw figures into the owner-facing VitalSign
objects (value + band + confidence + evidence) defined in the API contract.

Only two figures are genuinely new derivations, and both are trivial:
  * cash runway   = cash & bank ÷ average monthly net burn
  * concentration = the top customer's share of total sales
Everything else is lifted verbatim from the services that power the reports.
"""
from app.aman.core.serializers import money, inr
from app.aman.services.financial_year import prev_fy
from app.aman.services import dashboard_service as ds
from app.aman.services import outstanding_service as outs
from app.aman.services import gst_service as gst
from app.aman.services.pl_service import build_profit_loss

from app.aman.business_health.config import bh_settings as cfg


def _num(v):
    return v if isinstance(v, (int, float)) else None


def _linreg_slope(values: list[float]) -> float:
    """OLS slope over (0..n-1); 0 when < 2 points. Sign = trend direction."""
    n = len(values)
    if n < 2:
        return 0.0
    xs = list(range(n))
    mx, my = sum(xs) / n, sum(values) / n
    denom = sum((x - mx) ** 2 for x in xs)
    if denom == 0:
        return 0.0
    return sum((x - mx) * (y - my) for x, y in zip(xs, values)) / denom


def _active(series: list[dict]) -> list[dict]:
    """Months with any income/expense activity (drop not-yet-booked future months)."""
    return [m for m in series if (m.get("revenue") or 0) or (m.get("expense") or 0)]


def _safe(fn):
    """Run a source loader; convert any failure into ``None`` so a single failing
    report degrades that section instead of 500-ing the whole module (mirrors the
    AI-CFO ``context_builder`` resilience). C3."""
    try:
        return fn()
    except Exception:  # noqa: BLE001 — one bad report must not break Business Health
        return None


def _gst_consistent(sales, output, itc) -> tuple[bool, bool]:
    """(applicable, consistent) — M3. A business "operates under GST" only if it
    books output tax or claims ITC; only then is missing output tax on sales an
    anomaly. Composition / exempt / unregistered dealers legitimately have neither,
    so ``applicable`` is False and no hygiene penalty applies."""
    applicable = bool(output) or bool(itc)
    consistent = (not applicable) or (sales is not None and sales <= 0) or (output != 0)
    return applicable, consistent


def _concentration(top, sales):
    """Top-customer concentration excluding the cash / "(No Ledger)" bucket — M4.
    Returns ``(top1_pct, top1_name, top1_sales, top3_pct, top5_pct)``."""
    named = [c for c in (top or []) if c.get("name") and c["name"] != "(No Ledger)"]
    if not (named and sales):
        return (None, (named[0]["name"] if named else None),
                (money(named[0]["sales"]) if named else 0.0), None, None)
    share = lambda n: round(sum(c["sales"] for c in named[:n]) / sales * 100, 1)
    return share(1), named[0]["name"], money(named[0]["sales"]), share(3), share(5)


# ─────────────────────────── Grounded metrics ───────────────────────────
def build_metrics(db, fy: str, overrides: dict | None = None) -> dict:
    """Assemble the reconciled raw-figure dict for ``fy``.

    ``overrides`` (used only by /simulate) patches driver values *after* the real
    figures are computed, then re-derives the values that depend on them — so the
    what-if preview stays internally consistent."""
    # Every source is wrapped so one failing report degrades that section to a
    # gap (None) rather than 500-ing the whole module (C3).
    pl = _safe(lambda: build_profit_loss(db, fy)) or {}
    plk = pl.get("kpis", {}) or {}
    summary = (pl.get("years") or [{}])[0].get("summary", {}) or {}

    k = _safe(lambda: ds.kpis(db, fy)) or {}
    trend = (_safe(lambda: ds.monthly_trend(db, fy)) or {}).get("series", []) or []
    cf = (_safe(lambda: ds.cash_flow(db, fy)) or {}).get("summary", {}) or {}
    top = _safe(lambda: ds.top_customers(db, fy, limit=6)) or []

    rec = _safe(lambda: outs.receivables(db, fy, page=1, limit=1))
    pay = _safe(lambda: outs.payables(db, fy, page=1, limit=1))
    aging = (rec.get("aging") or {}) if rec else {}

    # ── P&L ──
    revenue = money(plk.get("revenue"))
    gross_profit = money(plk.get("grossProfit"))
    net_profit = money(plk.get("netProfit"))
    expenses = money(plk.get("expenses"))
    net_margin = _num(plk.get("profitMargin"))
    gross_margin = round(gross_profit / revenue * 100, 2) if revenue else None
    expense_ratio = round(expenses / revenue * 100, 2) if revenue else None

    np_kpi = k.get("netProfit", {})
    net_profit_prev = money(np_kpi.get("previous"))
    net_profit_change = _num(np_kpi.get("change"))

    # ── Sales + momentum ──
    sales_kpi = k.get("sales", {})
    sales = money(sales_kpi.get("current"))
    sales_prev = money(sales_kpi.get("previous"))
    sales_yoy = _num(sales_kpi.get("change")) if sales_prev else None
    active = _active(trend)
    n_active = len(active)
    avg_monthly_sales = money(sum(m["revenue"] for m in active) / n_active) if n_active else 0.0
    revenue_slope = _linreg_slope([m["revenue"] for m in active])

    # ── Purchases (for expense-creep signals) ──
    pur_kpi = k.get("purchase", {})
    purchase = money(pur_kpi.get("current"))
    purchase_prev = money(pur_kpi.get("previous"))
    purchase_change = _num(pur_kpi.get("change")) if purchase_prev else None

    # ── Cash & runway ── (None when the source failed, so liquidity degrades — C3)
    cb_kpi = k.get("cashBank") or {}
    cash_bank = money(cb_kpi.get("current")) if cb_kpi else None
    net_cash_flow = money(cf.get("net")) if cf else None
    inflow = money(cf.get("inflow"))
    outflow = money(cf.get("outflow"))
    monthly_burn = (money(-net_cash_flow / n_active)
                    if (n_active and net_cash_flow is not None and net_cash_flow < 0) else 0.0)
    runway_months = (round(cash_bank / monthly_burn, 1)
                     if (monthly_burn > 0 and cash_bank is not None and cash_bank > 0) else None)

    # ── Outstanding + working capital ── (None when the source failed — C3)
    receivables_total = money(rec["summary"]["total"]) if rec else None
    receivable_parties = rec["summary"]["partyCount"] if rec else None
    payables_total = money(pay["summary"]["total"]) if pay else None
    payable_parties = pay["summary"]["partyCount"] if pay else None
    aging_available = bool(aging.get("available"))
    overdue = money(aging.get("overdue")) if aging_available else None
    collections_months = (round(receivables_total / avg_monthly_sales, 1)
                          if (receivables_total is not None and avg_monthly_sales) else None)
    wc_ratio = (round(receivables_total / payables_total, 2)
                if (receivables_total is not None and payables_total) else None)

    # ── Concentration (excludes the cash / "(No Ledger)" bucket — M4) ──
    conc_top1, top1_name, top1_sales, conc_top3, conc_top5 = _concentration(top, sales)

    # ── Book hygiene ──
    cancelled_count, total_vouchers = _voucher_hygiene(db, fy)
    cancelled_rate = round(cancelled_count / total_vouchers * 100, 2) if total_vouchers else 0.0
    month_gaps = _month_gaps(trend)
    gsum = _safe_gst(db, fy)
    gst_output = money(gsum.get("outputTax"))
    gst_itc = money(gsum.get("inputTaxCredit"))
    gst_net_payable = money(gsum.get("netPayable"))
    # Only judge GST capture for businesses that actually operate under GST (M3).
    gst_applicable, gst_consistent = _gst_consistent(sales, gst_output, gst_itc)

    metrics = {
        "fy": fy, "prevFy": prev_fy(fy), "nActiveMonths": n_active,
        # P&L
        "revenue": revenue, "grossProfit": gross_profit, "netProfit": net_profit,
        "expenses": expenses, "netMargin": net_margin, "grossMargin": gross_margin,
        "expenseRatio": expense_ratio,
        "netProfitPrevFy": net_profit_prev, "netProfitChangePct": net_profit_change,
        "openingStock": money(summary.get("openingStock")), "closingStock": money(summary.get("closingStock")),
        # Sales / momentum
        "sales": sales, "salesPrevFy": sales_prev, "salesYoY": sales_yoy,
        "avgMonthlySales": avg_monthly_sales, "revenueSlope": revenue_slope,
        # Purchases
        "purchase": purchase, "purchasePrevFy": purchase_prev, "purchaseChangePct": purchase_change,
        # Cash
        "cashBank": cash_bank, "netCashFlow": net_cash_flow, "inflow": inflow, "outflow": outflow,
        "monthlyBurn": monthly_burn, "runwayMonths": runway_months,
        # Outstanding
        "receivablesTotal": receivables_total, "receivableParties": receivable_parties,
        "payablesTotal": payables_total, "payableParties": payable_parties,
        "overdue": overdue, "agingAvailable": aging_available,
        "collectionsMonths": collections_months, "workingCapitalRatio": wc_ratio,
        # Concentration
        "concentrationTop1": conc_top1, "concentrationTop3": conc_top3,
        "concentrationTop5": conc_top5, "topCustomerName": top1_name,
        "topCustomerSales": top1_sales,
        # Hygiene
        "cancelledCount": cancelled_count, "totalVouchers": total_vouchers,
        "cancelledRate": cancelled_rate, "monthGaps": month_gaps,
        "gstOutputTax": gst_output, "gstITC": gst_itc, "gstNetPayable": gst_net_payable,
        "gstApplicable": gst_applicable, "gstConsistent": gst_consistent,
    }
    if overrides:
        metrics = _apply_overrides(metrics, overrides)
    return metrics


def _apply_overrides(m: dict, overrides: dict) -> dict:
    """Patch driver inputs and re-derive dependents (for /simulate)."""
    m = dict(m)
    for key in ("receivablesTotal", "payablesTotal", "cashBank", "netMargin",
                "grossMargin", "netCashFlow", "salesYoY", "cancelledRate",
                "runwayMonths", "collectionsMonths", "concentrationTop1", "monthlyBurn"):
        if key in overrides and isinstance(overrides[key], (int, float)):
            m[key] = float(overrides[key])
    # Re-derive dependents so the preview is internally consistent.
    if "receivablesTotal" in overrides and m.get("avgMonthlySales"):
        m["collectionsMonths"] = round(m["receivablesTotal"] / m["avgMonthlySales"], 1)
    if ("cashBank" in overrides or "netCashFlow" in overrides):
        burn = m.get("monthlyBurn") or 0.0
        m["runwayMonths"] = (round(m["cashBank"] / burn, 1)
                             if (burn > 0 and m.get("cashBank", 0) > 0) else None)
    if "payablesTotal" in overrides and m.get("payablesTotal"):
        m["workingCapitalRatio"] = round(m["receivablesTotal"] / m["payablesTotal"], 2)
    return m


def _voucher_hygiene(db, fy: str) -> tuple[int, int]:
    """(cancelled count, total count) of vouchers in the FY — the hygiene inputs."""
    from app.aman.services.financial_year import date_filter
    try:
        base = date_filter(fy)
        total = db["vouchers"].count_documents(base)
        cancelled = db["vouchers"].count_documents({**base, "flags.isCancelled": True})
        return cancelled, total
    except Exception:
        return 0, 0


def _month_gaps(series: list[dict]) -> int:
    """Zero-activity months inside the active span (a books-currency signal)."""
    flags = [1 if ((m.get("revenue") or 0) or (m.get("expense") or 0)) else 0 for m in series]
    if 1 not in flags:
        return 0
    first, last = flags.index(1), len(flags) - 1 - flags[::-1].index(1)
    return sum(1 for i in range(first, last + 1) if flags[i] == 0)


def _safe_gst(db, fy: str) -> dict:
    try:
        return gst.summary(db, fy)
    except Exception:
        return {}


# ─────────────────────────── Vital signs ───────────────────────────
def _band(value, good, watch, higher_is_better=True):
    """Deterministic good / watch / critical band. ``None`` value → 'unknown'."""
    if not isinstance(value, (int, float)):
        return "unknown"
    if higher_is_better:
        return "good" if value >= good else ("watch" if value >= watch else "critical")
    return "good" if value <= good else ("watch" if value <= watch else "critical")


def _vital(key, label, value, unit, band, detail, confidence="high", evidence=None, trend=None):
    return {"key": key, "label": label, "value": value, "unit": unit, "band": band,
            "trend": trend, "confidence": confidence, "detail": detail, "evidence": evidence}


def vital_signs(m: dict) -> list[dict]:
    """The curated vital-signs array (API contract order). Reconciled by source."""
    out: list[dict] = []

    runway = m.get("runwayMonths")
    if runway is None:
        band = "good" if m.get("netCashFlow", 0) >= 0 and m.get("cashBank", 0) >= 0 else "unknown"
        detail = ("Cash flow is net positive — no burn to deplete the balance."
                  if band == "good" else "Not computable from the current cash trend.")
    else:
        band = _band(runway, cfg.RUNWAY_MONTHS_GOOD, cfg.RUNWAY_MONTHS_WATCH)
        detail = f"Cash {inr(m['cashBank'])} ÷ {inr(m['monthlyBurn'])} avg monthly burn"
    out.append(_vital("runway", "Cash runway", runway, "months", band, detail,
                      evidence={"report": "cashflow", "params": {}}))

    c1 = m.get("concentrationTop1")
    out.append(_vital(
        "concentration", "Customer concentration", c1, "%",
        _band(c1, cfg.CONCENTRATION_TOP1_WATCH, cfg.CONCENTRATION_TOP1_CRITICAL, higher_is_better=False),
        (f"{m.get('topCustomerName') or 'Top customer'} is {c1}% of sales" if c1 is not None
         else "No sales to measure concentration"),
        evidence={"report": "sales", "params": {"groupBy": "party"}}))

    nm = m.get("netMargin")
    out.append(_vital(
        "netMargin", "Net margin", nm, "%",
        _band(nm, cfg.NET_MARGIN_GOOD, cfg.NET_MARGIN_WATCH),
        (f"Net profit {inr(m['netProfit'])} on {inr(m['sales'])} sales" if nm is not None
         else "P&L not available"),
        evidence={"report": "pl", "params": {}}))

    col = m.get("collectionsMonths")
    out.append(_vital(
        "collections", "Collections horizon", col, "months",
        _band(col, cfg.COLLECTIONS_MONTHS_GOOD, cfg.COLLECTIONS_MONTHS_WATCH, higher_is_better=False),
        (f"{inr(m['receivablesTotal'])} due ≈ {col} months of sales" if col is not None
         else "No receivables / sales baseline"),
        confidence=("high" if m.get("agingAvailable") else "med"),
        evidence={"report": "receivables", "params": {}}))

    gm = m.get("grossMargin")
    out.append(_vital("grossMargin", "Gross margin", gm, "%",
                      _band(gm, 25, 12), f"Gross profit {inr(m['grossProfit'])}",
                      evidence={"report": "pl", "params": {}}))

    wc = m.get("workingCapitalRatio")
    out.append(_vital(
        "workingCapital", "Receivables ÷ payables", wc, "ratio",
        ("good" if (wc is not None and 0.8 <= wc <= 2.0) else ("watch" if wc is not None else "unknown")),
        (f"{inr(m['receivablesTotal'])} owed to you vs {inr(m['payablesTotal'])} you owe"
         if wc is not None else "No payables baseline"),
        evidence={"report": "receivables", "params": {}}))

    yoy = m.get("salesYoY")
    out.append(_vital(
        "revenueMomentum", "Revenue momentum", yoy, "%",
        (_band(yoy, 5, -5) if yoy is not None else ("good" if m.get("revenueSlope", 0) > 0 else "unknown")),
        (f"Sales {yoy:+.1f}% vs prior FY" if yoy is not None else "No prior-year baseline"),
        confidence=("high" if yoy is not None else "low"),
        evidence={"report": "sales", "params": {}}))

    er = m.get("expenseRatio")
    out.append(_vital("expenseRatio", "Expense-to-revenue", er, "%",
                      _band(er, 85, 95, higher_is_better=False),
                      f"Expenses {inr(m['expenses'])} of {inr(m['revenue'])} revenue",
                      evidence={"report": "pl", "params": {}}))

    return out


def headline_vitals(m: dict) -> list[dict]:
    """The four vitals shown on the Command Center."""
    wanted = ("runway", "concentration", "netMargin", "collections")
    by_key = {v["key"]: v for v in vital_signs(m)}
    return [by_key[k] for k in wanted if k in by_key]
