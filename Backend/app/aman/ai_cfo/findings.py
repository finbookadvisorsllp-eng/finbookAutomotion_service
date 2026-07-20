"""AI CFO — the Findings Engine (deterministic "CFO brain").

Replaces the old "always emit content for all 4 categories" desk with a single
pass that produces ZERO or many *findings* and ranks them together. A check emits
a finding only when something is genuinely material; otherwise it stays silent.
Category is a TAG (for filtering/learning), never a box that must be filled.

Design spec: see CFO_REASONING_MODEL.md. In one line:
    SCAN → FILTER (material OR qualitative override) → GUARD (data-sufficiency,
    %-base, forecast) → RANK (reuses Business Health's priority weights) → the AI
    only narrates the finished list.

The engine does 100% of the numbers and the materiality judgment. It is fully
deterministic and reproducible; the LLM is never involved here.
"""
from datetime import datetime

from app.aman.core.serializers import money, inr
from app.aman.services import dashboard_service as ds
from app.aman.services.financial_year import current_fy

# ─────────────────────────── tunable thresholds (see CFO_REASONING_MODEL.md) ───────────────────────────
ABS_FLOOR = 25_000.0        # ignore ₹ smaller than this unless a qualitative override trips
MATERIAL_PCT = 0.5          # % of annual revenue → "worth mentioning"
CRITICAL_PCT = 2.0          # % of annual revenue → "urgent"

PCT_BASE_FLOOR_ABS = 10_000.0   # a %-change needs a base at least this big …
PCT_BASE_FLOOR_REL = 1.0        # … or at least this % of avg monthly revenue
PCT_HARD_CAP = 999.0            # any |%| above this ⇒ base too small ⇒ suppress

MIN_FORECAST_MONTHS = 3         # below this: no forecast (insufficient)
MAX_HORIZON_FACTOR = 2          # only show horizon month H if H ≤ 2 × months of history

_SEV_RANK = {"critical": 0, "warning": 1, "positive": 2, "info": 3}
_CONF_LADDER = ["high", "med", "low"]


# ─────────────────────────── helpers ───────────────────────────
def _safe(fn):
    try:
        return fn()
    except Exception:  # noqa: BLE001 — one failing source degrades a check, never the engine
        return None


def _num(v):
    return v if isinstance(v, (int, float)) else None


def _material(rupees, annual_rev) -> bool:
    """Quantitative size test — anchored to REVENUE (stable) not net income (which
    is ≈0 for an SME and blows up the ratio). See C1."""
    if rupees is None:
        return False
    floor = max(ABS_FLOOR, MATERIAL_PCT / 100 * (annual_rev or 0))
    return abs(rupees) >= floor


def _critical_size(rupees, annual_rev) -> bool:
    return rupees is not None and abs(rupees) >= CRITICAL_PCT / 100 * (annual_rev or 0)


def _safe_pct(cur, prev, avg_monthly):
    """Month-over-month % with the base guard (C3). Returns None when the base is
    too small to make a percentage meaningful — the fix for the +19771830% bug."""
    if not isinstance(cur, (int, float)) or not isinstance(prev, (int, float)):
        return None
    floor = max(PCT_BASE_FLOOR_ABS, PCT_BASE_FLOOR_REL / 100 * (avg_monthly or 0))
    if abs(prev) < floor:
        return None                       # base too small → no percentage
    pct = round((cur - prev) / abs(prev) * 100, 1)
    if abs(pct) > PCT_HARD_CAP:
        return None                       # runaway ratio → base effectively too small
    return pct


def _degrade(conf, steps: int) -> str:
    """Normalize a forecast confidence to the finding ladder and step it down."""
    base = {"high": "high", "moderate": "med", "med": "med",
            "low": "low", "very low": "low"}.get(conf, "med")
    i = _CONF_LADDER.index(base)
    return _CONF_LADDER[min(len(_CONF_LADDER) - 1, i + steps)]


def _finding(id_, category, severity, title, detail, action=None, rupee=None,
             confidence="med", data_status="ok", reason=None, metric_key=None,
             evidence=None, override=False, extra=None) -> dict:
    f = {
        "id": id_, "category": category, "severity": severity,
        "title": title, "detail": detail, "action": action,
        "rupeeImpact": (money(rupee) if rupee is not None else None),
        "confidence": confidence, "dataStatus": data_status,
        "insufficientReason": reason, "metricKey": metric_key,
        "evidence": evidence, "priorityScore": 0.0, "_override": override,
    }
    if extra:
        f.update(extra)
    return f


def _active(trend):
    return [x for x in trend if (x.get("revenue") or 0) or (x.get("expense") or 0)]


# ─────────────────────────── SCAN: per-source finding builders ───────────────────────────
def _from_risks(risks, annual_rev):
    """Business Health risks → findings (category 'risk'). These are pre-thresholded
    and several are qualitative overrides (negative cash, net loss, concentration)."""
    out = []
    sev_map = {"danger": "critical", "warning": "warning", "info": "info"}
    override_ids = ("cash-negative", "net-loss", "concentration", "cash-runway")
    for r in risks:
        sid = r.get("sourceId", "")
        sev = sev_map.get(r.get("severity"), "info")
        override = any(k in sid for k in override_ids)
        out.append(_finding(
            sid, "risk", sev, r["title"], r["detail"],
            action="Review and act on this risk.",
            rupee=r.get("rupeesAtRisk"), confidence=r.get("confidence", "med"),
            metric_key=r.get("metricKey"), evidence=r.get("evidence"), override=override))
    return out


_OPP_CATEGORY = (
    (("collect", "receivable", "overdue"), "risk"),
    (("margin", "loss-making", "leak"), "reporting"),
    (("purchase", "renegotiat", "cost"), "planning"),
    (("stock", "inventory"), "record_keeping"),
)


def _opp_category(source_id):
    s = (source_id or "").lower()
    for keys, cat in _OPP_CATEGORY:
        if any(k in s for k in keys):
            return cat
    return "planning"


def _from_opportunities(opps, annual_rev):
    """Business Health opportunities → 'positive' findings (money to gain)."""
    out = []
    for o in opps:
        rupee = o.get("rupeeImpact")
        if not _material(rupee, annual_rev):
            continue                      # skip immaterial upside (noise)
        out.append(_finding(
            o.get("sourceId", ""), _opp_category(o.get("sourceId")), "positive",
            o["title"], o["detail"], action=o.get("actionText"),
            rupee=rupee, confidence=o.get("confidence", "med"),
            metric_key=o.get("metricKey"), evidence=o.get("evidence"),
            extra={"effort": o.get("effort", "med")}))
    return out


def _from_anomalies(an):
    """Record-keeping anomalies → findings. Book integrity is a qualitative override:
    a mis-keyed / missing entry matters regardless of its rupee size (A1)."""
    if not an:
        return []
    if not an.get("available"):
        return [_finding(
            "finding:record:insufficient", "record_keeping", "info",
            "Not enough history to audit entries",
            "The entry-level anomaly check needs at least a few booked months. It will "
            "start flagging missing or mis-keyed expenses once more data syncs.",
            data_status="insufficient",
            reason=an.get("reason", "insufficient booked months"))]
    out = []
    for a in an.get("anomalies", []):
        out.append(_finding(
            a["id"], "record_keeping", "warning", a["title"], a["detail"],
            action=a.get("action", "Verify this entry"),
            rupee=a.get("magnitude"), confidence="med",
            evidence={"report": "pl", "params": {}}, override=True,
            metric_key=a.get("ledger")))
    return out


def _reporting_findings(m, trend, annual_rev):
    """One 'reporting' headline finding: the month-over-month result — but only when
    the movement is material. Uses the %-base guard so a near-zero base can never
    produce a runaway percentage (C3)."""
    active = _active(trend)
    if len(active) < 2:
        return []
    last, prev = active[-1], active[-2]
    avg_monthly = m.get("avgMonthlySales")
    rev_pct = _safe_pct(last.get("revenue"), prev.get("revenue"), avg_monthly)
    exp_pct = _safe_pct(last.get("expense"), prev.get("expense"), avg_monthly)
    prof_pct = _safe_pct(last.get("profit"), prev.get("profit"), avg_monthly)
    profit_change = money((last.get("profit") or 0) - (prev.get("profit") or 0))
    sign_reversal = (prev.get("profit") or 0) >= 0 > (last.get("profit") or 0)

    material = _material(abs(profit_change), annual_rev) or sign_reversal
    if not material:
        return []                          # steady month → say nothing here

    payload = {"revenueMoM": rev_pct, "expenseMoM": exp_pct, "profitMoM": prof_pct,
               "profitChange": profit_change,
               "monthly": [{"month": x["month"], "revenue": money(x.get("revenue")),
                            "expense": money(x.get("expense")), "profit": money(x.get("profit"))}
                           for x in active[-6:]]}

    if profit_change > 0:
        detail = _reporting_sentence(rev_pct, exp_pct, prof_pct, up=True, last=last)
        return [_finding("finding:reporting:mom", "reporting", "positive",
                         "Profit improved this month", detail,
                         rupee=abs(profit_change), confidence="high",
                         evidence={"report": "pl", "params": {}}, extra=payload)]
    detail = _reporting_sentence(rev_pct, exp_pct, prof_pct, up=False, last=last)
    return [_finding("finding:reporting:mom", "reporting", "warning",
                     "Profit slipped this month", detail, action="Review the month's cost lines.",
                     rupee=abs(profit_change), confidence="high", override=sign_reversal,
                     evidence={"report": "pl", "params": {}}, extra=payload)]


def _reporting_sentence(rev_pct, exp_pct, prof_pct, up, last):
    # Note: any of the %s may be None (base too small) — phrase around the gap.
    def p(v):
        return f"{v:+.0f}%" if isinstance(v, (int, float)) else "n/a"
    if up and isinstance(rev_pct, (int, float)) and isinstance(exp_pct, (int, float)):
        return (f"Profit rose {p(prof_pct)} — revenue grew {p(rev_pct)} while expenses moved "
                f"{p(exp_pct)}. " + ("Growth on controlled costs." if exp_pct <= rev_pct else ""))
    if not up and isinstance(rev_pct, (int, float)) and isinstance(exp_pct, (int, float)):
        return (f"Profit fell {p(prof_pct)} — expenses moved {p(exp_pct)} against {p(rev_pct)} "
                "in revenue. Costs are eating the gains.")
    return (f"Net profit for the month is {inr(last.get('profit'))}; "
            "month-on-month percentages aren't shown because last month's base was near zero.")


def _guarded_horizon(fsales, fcash, n_history):
    """3 / 6 / 12-month checkpoints with the forecast guards (C4): don't project
    further than 2× the history you have, and never present a clamped-to-zero
    declining value as a real number."""
    proj_r = fsales.get("projection", []) or []
    proj_p = fcash.get("projection", []) or []
    base_conf = fsales.get("confidence")
    out = []
    for step, months in enumerate((3, 6, 12)):
        if months > MAX_HORIZON_FACTOR * (n_history or 0):
            continue                       # not enough history to see this far → omit
        i = months - 1
        rev = proj_r[i]["value"] if i < len(proj_r) else None
        prof = proj_p[i]["value"] if i < len(proj_p) else None
        # A value clamped to 0 by a declining trend is NOT a prediction.
        reliable = rev is not None and rev > 0
        out.append({
            "label": f"{months} mo", "months": months,
            "revenue": (money(rev) if reliable else None),
            "profit": (money(prof) if reliable else None),
            "reliable": reliable, "confidence": _degrade(base_conf, step),
        })
    return out


def _planning_findings(m, fc, annual_rev):
    """One 'planning' finding carrying the forward outlook. Warning when the trend
    points down (material); otherwise an 'info' outlook that only shows on drill-down.
    Insufficient history → an explicit 'insufficient' state, never a fake number."""
    fsales = (fc or {}).get("sales") or {}
    fcash = (fc or {}).get("cashFlow") or {}
    n = fsales.get("historyMonths") or 0

    if not fsales.get("available") or n < MIN_FORECAST_MONTHS:
        return [_finding(
            "finding:planning:outlook", "planning", "info", "Outlook needs more history",
            f"A reliable forward outlook needs at least {MIN_FORECAST_MONTHS} months of booked "
            "activity. Until then we don't project — we won't show a number we can't stand behind.",
            data_status="insufficient", reason=f"only {n} month(s) of history")]

    horizon = _guarded_horizon(fsales, fcash, n)
    profit_proj = [p["value"] for p in fcash.get("projection", [])]
    declining = len(profit_proj) >= 2 and profit_proj[-1] < profit_proj[0]
    reliable = [h for h in horizon if h["reliable"]]
    far_label = reliable[-1]["label"] if reliable else "the coming months"

    payload = {"forecast": {
        "nextMonthRevenue": fsales.get("nextMonth"), "horizon": horizon,
        "confidence": _degrade(fsales.get("confidence"), 0), "declining": declining,
        "caveat": ("Trend points down — figures beyond what history supports are withheld, not zero-filled."
                   if declining else None)}}

    if declining:
        return [_finding(
            "finding:planning:outlook", "planning", "warning", "Forward trend is weakening",
            f"On the current trend, monthly profit is set to weaken over {far_label}. "
            "Plan for it now rather than react later.",
            action="Set a cost budget and protect margin before it compounds.",
            confidence=_degrade(fsales.get("confidence"), 0),
            evidence={"report": "pl", "params": {}}, extra=payload)]
    return [_finding(
        "finding:planning:outlook", "planning", "info", "Forward outlook is stable",
        f"Revenue and costs are trending in balance; next month lands near "
        f"{inr(fsales.get('nextMonth'))} on current data.",
        confidence=_degrade(fsales.get("confidence"), 0),
        evidence={"report": "pl", "params": {}}, extra=payload)]


# ─────────────────────────── FILTER + RANK ───────────────────────────
def _keep(f, annual_rev) -> bool:
    if f["dataStatus"] == "insufficient":
        return True                        # kept, but ranks last (shown on drill-down)
    if f["severity"] == "critical" or f.get("_override"):
        return True
    if f["rupeeImpact"] is not None:
        return _material(f["rupeeImpact"], annual_rev)
    return f["severity"] in ("warning", "positive")


def _rank(findings):
    """Reuses Business Health's priority weights (CONFIDENCE_WEIGHT / URGENCY_BOOST)
    and its separate-scales idea so one huge loss can't crush every smaller finding."""
    from app.aman.business_health.config import bh_settings as bhcfg

    pos = [f for f in findings if f["severity"] == "positive"]
    neg = [f for f in findings if f["severity"] != "positive"]

    def scale(group):
        vals = [abs(f["rupeeImpact"]) for f in group if f.get("rupeeImpact")]
        mx = max(vals) if vals else 0
        for f in group:
            r = abs(f["rupeeImpact"]) if f.get("rupeeImpact") else None
            norm = (r / mx) if (r and mx) else 0.15
            conf = bhcfg.CONFIDENCE_WEIGHT.get(f["confidence"], 0.7)
            urgent = bhcfg.URGENCY_BOOST if f["severity"] == "critical" else 1.0
            damp = 0.05 if f["dataStatus"] == "insufficient" else 1.0
            f["priorityScore"] = round(norm * conf * urgent * damp, 4)

    scale(pos)
    scale(neg)
    findings.sort(key=lambda f: (_SEV_RANK.get(f["severity"], 9), -f["priorityScore"]))
    return findings


def _brief(findings):
    """BLUF: the top material findings, worst first. A calm, specific line when clean."""
    material = [f for f in findings
                if f["dataStatus"] == "ok" and f["severity"] in ("critical", "warning", "positive")]
    top = material[:5]
    if not top:
        return {"headline": "No material issues this period — the fundamentals look stable.",
                "tone": "good", "findings": [], "count": 0}
    lead = top[0]
    return {"headline": lead["title"], "tone": lead["severity"],
            "findings": top, "count": len(material)}


def _category_summary(findings):
    out = {}
    for cat in ("planning", "risk", "record_keeping", "reporting"):
        items = [f for f in findings if f["category"] == cat and f["dataStatus"] == "ok"]
        insuff = [f for f in findings if f["category"] == cat and f["dataStatus"] == "insufficient"]
        worst = min((_SEV_RANK[f["severity"]] for f in items), default=99)
        worst_sev = next((s for s, r in _SEV_RANK.items() if r == worst), None)
        out[cat] = {"count": len(items), "clean": len(items) == 0,
                    "insufficient": bool(insuff), "worstSeverity": worst_sev}
    return out


# ─────────────────────────── public composer ───────────────────────────
def build_findings(db, fy: str | None = None) -> dict:
    fy = fy or current_fy()
    # Business Health engines carry the richest reconciled metrics + curated risks.
    from app.aman.business_health.engines import kpi, risk as bh_risk, opportunity as bh_opp
    from app.aman.ai_cfo import anomaly, forecast

    m = _safe(lambda: kpi.build_metrics(db, fy)) or {}
    annual_rev = _num(m.get("revenue")) or _num(m.get("sales")) or 0
    trend = (_safe(lambda: ds.monthly_trend(db, fy)) or {}).get("series", []) or []
    an = _safe(lambda: anomaly.detect(db, fy)) or {}
    fc = _safe(lambda: forecast.build_forecast(db, fy, 12)) or {}
    risks = _safe(lambda: bh_risk.evaluate(m)) or []
    opps = _safe(lambda: bh_opp.evaluate(db, m)) or []

    findings = []
    findings += _from_risks(risks, annual_rev)
    findings += _from_opportunities(opps, annual_rev)
    findings += _from_anomalies(an)
    findings += _reporting_findings(m, trend, annual_rev)
    findings += _planning_findings(m, fc, annual_rev)

    # de-dupe by id (a source can only speak once), then filter + rank.
    seen, deduped = set(), []
    for f in findings:
        if f["id"] in seen:
            continue
        seen.add(f["id"])
        deduped.append(f)
    kept = [f for f in deduped if _keep(f, annual_rev)]
    kept = _rank(kept)

    return {
        "fy": fy, "generatedAt": datetime.utcnow().isoformat(),
        "brief": _brief(kept),
        "findings": kept,
        "categories": _category_summary(kept),
        "meta": {"annualRevenue": money(annual_rev), "scanned": len(deduped),
                 "surfaced": len(kept),
                 "thresholds": {"absFloor": ABS_FLOOR, "materialPct": MATERIAL_PCT,
                                "criticalPct": CRITICAL_PCT}},
    }
