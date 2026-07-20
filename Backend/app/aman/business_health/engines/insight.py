"""Insight engine — one typed stream unifying risks, opportunities, positive
signals and (when snapshots exist) trend milestones.

Every insight is provenance-stamped ("reconciles with …") so the UI can show
where the number comes from. Deterministic; the LLM never fabricates an insight —
it only narrates them elsewhere (the briefing).
"""
from app.aman.core.serializers import inr

_SEV_FROM_RISK = {"danger": "danger", "warning": "warning", "info": "info"}
_PROV = {
    "cashBank": "reconciles with Cash Flow", "netProfit": "reconciles with Profit & Loss",
    "netMargin": "reconciles with Profit & Loss", "receivablesTotal": "reconciles with Receivables",
    None: "reconciles with your reports",
}


def _insight(id_, type_, severity, title, detail, rupees, confidence, provenance, evidence):
    return {"id": id_, "type": type_, "severity": severity, "title": title,
            "detail": detail, "rupees": rupees, "confidence": confidence,
            "provenance": provenance, "evidence": evidence}


def build(m: dict, risks: list[dict], opportunities: list[dict],
          trend_milestones: list[dict] | None = None) -> list[dict]:
    fy = m.get("fy")
    out: list[dict] = []

    for r in risks:
        out.append(_insight(
            f"ins:{r['sourceId']}", "risk", _SEV_FROM_RISK.get(r["severity"], "warning"),
            r["title"], r["detail"], r.get("rupeesAtRisk"), r.get("confidence", "high"),
            _PROV.get(r.get("metricKey"), _PROV[None]), r.get("evidence")))

    for o in opportunities:
        out.append(_insight(
            f"ins:{o['sourceId']}", "opportunity", "info", o["title"], o["detail"],
            o.get("rupeeImpact"), o.get("confidence", "med"),
            _PROV.get(o.get("metricKey"), _PROV[None]), o.get("evidence")))

    # ── Positive signals (deterministic) ──
    change = m.get("netProfitChangePct")
    if isinstance(change, (int, float)) and change >= 10:
        out.append(_insight(
            f"ins:profit-growth:{fy}", "positive", "success", "Net profit is growing",
            f"Net profit is up {change:+.1f}% YoY to {inr(m.get('netProfit'))}.",
            m.get("netProfit"), "high", _PROV["netProfit"], {"report": "pl", "params": {}}))
    yoy = m.get("salesYoY")
    if isinstance(yoy, (int, float)) and yoy >= 15:
        out.append(_insight(
            f"ins:sales-growth:{fy}", "positive", "success", "Sales are growing strongly",
            f"Sales are up {yoy:+.1f}% vs the prior year.", m.get("sales"), "high",
            "reconciles with Sales", {"report": "sales", "params": {}}))

    for ms in (trend_milestones or []):
        out.append(_insight(
            ms.get("id", f"ins:milestone:{fy}"), "milestone", "info",
            ms["title"], ms["detail"], ms.get("rupees"), "high",
            "compared with last week's snapshot", ms.get("evidence")))

    rank = {"danger": 0, "warning": 1, "info": 2, "success": 3}
    out.sort(key=lambda i: rank.get(i["severity"], 9))
    return out
