"""Risk engine — deterministic threats over the grounded metrics, each with
rupees-at-risk, a confidence, a stable ``sourceId`` and evidence provenance so it
can flow straight into the priority engine and the Decision Ledger.

Severity: ``danger`` (act now) · ``warning`` (watch) · ``info``. Every figure
reconciles to a report; proxy-based risks are marked ``med`` confidence.
"""
from app.aman.core.serializers import inr
from app.aman.business_health.config import bh_settings as cfg


def _risk(source_id, severity, title, detail, rupees, confidence, metric_key, evidence):
    return {"id": source_id, "sourceId": source_id, "severity": severity,
            "title": title, "detail": detail, "rupeesAtRisk": rupees,
            "confidence": confidence, "metricKey": metric_key, "evidence": evidence}


def evaluate(m: dict) -> list[dict]:
    fy = m.get("fy")
    out: list[dict] = []

    # ── Negative cash / bank ──
    cash = m.get("cashBank")
    if isinstance(cash, (int, float)) and cash < 0:
        out.append(_risk(
            f"risk:cash-negative:{fy}", "danger", "Cash & bank balance is negative",
            f"The combined cash + bank pool is {inr(cash)} — overdrawn. Review upcoming "
            "payments and collections before committing new spend.",
            abs(cash), "high", "cashBank", {"report": "cashflow", "params": {}}))

    # ── Short runway ──
    runway = m.get("runwayMonths")
    if isinstance(runway, (int, float)) and runway < cfg.RUNWAY_MONTHS_WATCH:
        out.append(_risk(
            f"risk:cash-runway:{fy}", "danger", f"Cash runway under {cfg.RUNWAY_MONTHS_WATCH:.0f} months",
            f"At the current burn of {inr(m.get('monthlyBurn'))}/month, cash covers about "
            f"{runway} months. {inr(m.get('payablesTotal'))} is payable to vendors.",
            m.get("payablesTotal"), "high", "cashBank", {"report": "cashflow", "params": {}}))

    # ── Net loss / thin or compressing margin ──
    np = m.get("netProfit")
    if isinstance(np, (int, float)) and np < 0:
        out.append(_risk(
            f"risk:net-loss:{fy}", "danger", "The business is running at a net loss",
            f"Net result for {fy} is {inr(np)}.", abs(np), "high", "netProfit",
            {"report": "pl", "params": {}}))
    else:
        margin = m.get("netMargin")
        change = m.get("netProfitChangePct")
        if isinstance(margin, (int, float)) and 0 <= margin < cfg.NET_MARGIN_WATCH:
            out.append(_risk(
                f"risk:thin-margin:{fy}", "warning", "Net profit margin is thin",
                f"Net margin is {margin}% — a small cost or price move swings the bottom line.",
                None, "high", "netMargin", {"report": "pl", "params": {}}))
        if isinstance(change, (int, float)) and change <= -5:
            drop = None
            if isinstance(np, (int, float)) and isinstance(m.get("netProfitPrevFy"), (int, float)):
                drop = abs(np - m["netProfitPrevFy"])
            out.append(_risk(
                f"risk:margin-compression:{fy}", "warning", "Net profit is down year-over-year",
                f"Net profit is {change:+.1f}% vs the prior year ({inr(m.get('netProfitPrevFy'))}).",
                drop, "high", "netProfit", {"report": "pl", "params": {}}))

    # ── Customer concentration ──
    conc = m.get("concentrationTop1")
    if isinstance(conc, (int, float)) and conc >= cfg.CONCENTRATION_TOP1_WATCH:
        sev = "danger" if conc >= cfg.CONCENTRATION_TOP1_CRITICAL else "warning"
        out.append(_risk(
            f"risk:concentration:{fy}", sev, "Revenue is concentrated in one customer",
            f"{m.get('topCustomerName') or 'The top customer'} is {conc}% of sales "
            f"({inr(m.get('topCustomerSales'))}). Losing them would hit revenue hard.",
            m.get("topCustomerSales"), "high", None,
            {"report": "sales", "params": {"groupBy": "party"}}))

    # ── Receivables high vs sales ──
    months = m.get("collectionsMonths")
    rec = m.get("receivablesTotal")
    if isinstance(months, (int, float)) and months >= cfg.COLLECTIONS_MONTHS_WATCH and rec:
        out.append(_risk(
            f"risk:receivables-high:{fy}", "warning", "Receivables are high relative to sales",
            f"{inr(rec)} is outstanding — about {months} months of sales. Tightening "
            "collections would free up cash.",
            rec, ("high" if m.get("agingAvailable") else "med"), "receivablesTotal",
            {"report": "receivables", "params": {}}))

    # ── Purchases outgrowing sales ──
    pc = m.get("purchaseChangePct")
    if isinstance(pc, (int, float)) and pc >= 15 and (m.get("salesYoY") is None or pc > (m.get("salesYoY") or 0)):
        out.append(_risk(
            f"risk:expense-spike:{fy}", "warning", "Purchases are rising faster than sales",
            f"Purchases are up {pc:+.1f}% YoY to {inr(m.get('purchase'))} — check whether "
            "margins are eroding.",
            None, "high", None, {"report": "pl", "params": {}}))

    # ── Book hygiene ──
    rate = m.get("cancelledRate")
    if isinstance(rate, (int, float)) and rate >= 5:
        out.append(_risk(
            f"risk:cancelled-rate:{fy}", "info", "High share of cancelled vouchers",
            f"{rate}% of vouchers ({m.get('cancelledCount')}) are cancelled — worth a spot-check "
            "for data-entry or process issues.",
            None, "high", None, {"report": "pl", "params": {}}))

    order = {"danger": 0, "warning": 1, "info": 2}
    out.sort(key=lambda r: (order.get(r["severity"], 9), -(r.get("rupeesAtRisk") or 0)))
    return out
