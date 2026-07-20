"""Opportunity engine — quantified upside over the grounded metrics, each phrased
as "do X → worth ~₹Y" with an honest confidence band and evidence link.

Quantified candidates (real ₹): collect concentrated overdue, stop margin leak on
loss-making items. Directional candidates (₹ estimate, low confidence, clearly
labelled): purchases outgrowing sales. Qualitative candidates (no ₹): resolve
zero/negative stock. Never over-states impact — confidence carries the honesty.
"""
from app.aman.core.serializers import inr, money
from app.aman.services import inventory_service as inv


def _opp(source_id, title, detail, rupee_impact, confidence, effort, metric_key, action, evidence):
    return {"id": source_id, "sourceId": source_id, "title": title, "detail": detail,
            "rupeeImpact": rupee_impact, "confidence": confidence, "effort": effort,
            "metricKey": metric_key, "actionText": action, "evidence": evidence}


def evaluate(db, m: dict) -> list[dict]:
    fy = m.get("fy")
    out: list[dict] = []

    # ── Collect concentrated overdue receivables ──
    rec = m.get("receivablesTotal") or 0
    if rec > 0:
        overdue = m.get("overdue")
        amount = overdue if isinstance(overdue, (int, float)) and overdue > 0 else rec
        parties = m.get("receivableParties") or 0
        conc_note = (f"across {parties} parties"
                     if parties else "from your debtors")
        out.append(_opp(
            f"opp:collect-overdue:{fy}",
            f"Collect {inr(amount)} outstanding {conc_note}",
            (f"{inr(amount)} is overdue and ageing." if isinstance(overdue, (int, float)) and overdue > 0
             else f"{inr(rec)} is receivable {conc_note}."),
            money(amount), ("high" if m.get("agingAvailable") else "med"), "low",
            "receivablesTotal", "Chase the largest overdue balances this week.",
            {"report": "receivables", "params": {}}))

    # ── Stop margin leak on loss-making items ──
    leak = _margin_leak(db, fy)
    if leak["count"] and leak["loss"] > 0:
        out.append(_opp(
            f"opp:margin-leak:{fy}",
            f"Fix margins on {leak['count']} loss-making item(s)",
            f"{leak['count']} items sold below weighted-average cost, leaking about "
            f"{inr(leak['loss'])} of gross profit this year. Reprice or renegotiate supply.",
            money(leak["loss"]), "med", "med", None,
            "Reprice or drop the loss-making SKUs.",
            {"report": "inventory", "params": {}}))

    # ── Purchases outgrowing sales (directional) ──
    pc = m.get("purchaseChangePct")
    if isinstance(pc, (int, float)) and pc >= 15:
        excess = max(0.0, (m.get("purchase") or 0) - (m.get("purchasePrevFy") or 0))
        est = money(0.05 * excess)             # conservative 5% negotiable, low confidence
        if est > 0:
            out.append(_opp(
                f"opp:purchase-review:{fy}",
                "Renegotiate the fastest-growing purchases",
                f"Purchases rose {pc:+.1f}% to {inr(m.get('purchase'))}. Even a 5% negotiation "
                f"on the increase is ~{inr(est)}.",
                est, "low", "med", None,
                "Review top vendors and negotiate rate or terms.",
                {"report": "pl", "params": {}}))

    # ── Resolve zero / negative stock (qualitative) ──
    alerts = _stock_alerts(db, fy)
    if alerts:
        out.append(_opp(
            f"opp:stock-cleanup:{fy}",
            f"Resolve {alerts} zero/negative-stock item(s)",
            "Zero and negative stock lines distort valuation and hide unsellable inventory. "
            "Clean them up to trust the stock report.",
            None, "med", "low", None,
            "Reconcile the flagged items in inventory.",
            {"report": "inventory", "params": {}}))

    out.sort(key=lambda o: -(o.get("rupeeImpact") or 0))
    return out


def _margin_leak(db, fy: str) -> dict:
    """Sum of negative gross profit across items sold below cost (real ₹ leak)."""
    try:
        perf = inv.performance_list(db, fy, page=1, limit=0)
        losers = [r for r in perf.get("items", []) if (r.get("grossProfit") or 0) < 0]
        loss = money(sum(-r["grossProfit"] for r in losers))
        return {"count": len(losers), "loss": loss}
    except Exception:
        return {"count": 0, "loss": 0.0}


def _stock_alerts(db, fy: str) -> int:
    try:
        a = inv.stock_alerts(db, fy)
        return (a.get("summary") or {}).get("totalAlerts", 0)
    except Exception:
        return 0
