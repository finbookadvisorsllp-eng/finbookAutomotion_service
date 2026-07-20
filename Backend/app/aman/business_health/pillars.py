"""Business Health Score — five deterministic pillars over the grounded metrics.

Each pillar scores 0–100 from reconciled drivers, exposes those drivers for the
UI, and reports a ``coverage`` (how much of the pillar is fully reconciled vs a
labelled proxy). The overall is a weight-normalized blend (missing pillars simply
drop out of the denominator, never silently score zero) with a letter grade.

No LLM anywhere here — the score must be reproducible and auditable. The fifth
pillar is **Book Hygiene** (approved), replacing an unsourceable "Compliance"
pillar. Weights live in ``config.PILLAR_WEIGHTS``.
"""
from app.aman.core.serializers import inr
from app.aman.business_health.config import bh_settings as cfg


def _clamp(v: float) -> float:
    return max(0.0, min(100.0, v))


def _num(v):
    return v if isinstance(v, (int, float)) else None


def _driver(label, value, detail=""):
    return {"label": label, "value": value, "detail": detail}


def _band(score):
    if score is None:
        return "unknown"
    return "good" if score >= 70 else ("watch" if score >= 40 else "critical")


# ─────────────────────────── Pillar scorers ───────────────────────────
def _profitability(m: dict) -> tuple[float | None, int, list[dict]]:
    margin = _num(m.get("netMargin"))
    drivers = [
        _driver("Net margin", f"{margin}%" if margin is not None else "—",
                f"{inr(m.get('netProfit'))} on {inr(m.get('sales'))} sales"),
        _driver("Gross margin", f"{m.get('grossMargin')}%" if m.get("grossMargin") is not None else "—",
                f"{inr(m.get('grossProfit'))} gross profit"),
        _driver("Expense-to-revenue", f"{m.get('expenseRatio')}%" if m.get("expenseRatio") is not None else "—",
                f"{inr(m.get('expenses'))} expenses"),
    ]
    if margin is None:
        return None, 0, drivers
    if margin >= 15:
        s = 100.0
    elif margin >= 0:
        s = 40 + (margin / 15) * 60           # 0% → 40, 15% → 100
    else:
        s = _clamp(40 + margin * 4)           # −10% → 0
    return _clamp(s), 100, drivers


def _liquidity(m: dict) -> tuple[float | None, int, list[dict]]:
    cash = _num(m.get("cashBank"))
    net_cf = _num(m.get("netCashFlow"))
    runway = _num(m.get("runwayMonths"))
    drivers = [
        _driver("Cash & bank", inr(cash) if cash is not None else "—",
                "Overdrawn" if (cash is not None and cash < 0) else "Positive balance"),
        _driver("Net cash flow", inr(net_cf) if net_cf is not None else "—",
                "Cash grew" if (net_cf is not None and net_cf >= 0) else "Cash shrank"),
        _driver("Runway", f"{runway} months" if runway is not None else "n/a",
                f"at {inr(m.get('monthlyBurn'))}/mo burn" if runway is not None else "not burning"),
    ]
    if cash is None:
        return None, 0, drivers
    s = 70.0 if cash >= 0 else 15.0
    if net_cf is not None:
        s += 20 if net_cf >= 0 else -20
    if runway is not None:                     # burning — temper by how long cash lasts
        s += 10 if runway >= cfg.RUNWAY_MONTHS_GOOD else (0 if runway >= cfg.RUNWAY_MONTHS_WATCH else -25)
    return _clamp(s), 100, drivers


def _collections(m: dict) -> tuple[float | None, int, list[dict]]:
    months = _num(m.get("collectionsMonths"))
    conc = _num(m.get("concentrationTop1"))
    wc = _num(m.get("workingCapitalRatio"))
    drivers = [
        _driver("Collections horizon", f"{months} months" if months is not None else "—",
                f"{inr(m.get('receivablesTotal'))} across {m.get('receivableParties')} parties"),
        _driver("Receivables ÷ payables", wc if wc is not None else "—",
                f"vs {inr(m.get('payablesTotal'))} payable"),
        _driver("Top-customer concentration", f"{conc}%" if conc is not None else "—",
                m.get("topCustomerName") or "—"),
    ]
    if months is None:
        # No receivables at all is healthy, not unknown.
        if (m.get("receivablesTotal") or 0) == 0:
            return 90.0, (100 if m.get("agingAvailable") else 70), drivers
        return None, 0, drivers
    s = _clamp(100 - max(0.0, months - cfg.COLLECTIONS_MONTHS_GOOD) * 22)   # 1.5mo→100, ~6mo→0
    if conc is not None and conc >= cfg.CONCENTRATION_TOP1_CRITICAL:
        s = _clamp(s - 12)                     # heavy single-buyer reliance drags collections risk
    coverage = 100 if m.get("agingAvailable") else 70   # run-rate proxy when bill dates absent
    return s, coverage, drivers


def _growth(m: dict) -> tuple[float | None, int, list[dict]]:
    yoy = _num(m.get("salesYoY"))
    slope = _num(m.get("revenueSlope")) or 0.0
    drivers = [
        _driver("Sales YoY", f"{yoy:+.1f}%" if yoy is not None else "n/a",
                f"{inr(m.get('sales'))} vs {inr(m.get('salesPrevFy'))}"),
        _driver("Monthly trend", "rising" if slope > 0 else ("falling" if slope < 0 else "flat"),
                "least-squares slope of monthly revenue"),
    ]
    if yoy is None:
        # No prior year — score from within-year trend direction, low coverage.
        s = 60.0 if slope > 0 else (50.0 if slope == 0 else 40.0)
        return s, 50, drivers
    if yoy >= 20:
        s = 100.0
    elif yoy >= 0:
        s = 60 + (yoy / 20) * 40
    else:
        s = _clamp(60 + yoy * 3)               # −20% → 0
    return _clamp(s), 100, drivers


def _hygiene(m: dict) -> tuple[float | None, int, list[dict]]:
    rate = _num(m.get("cancelledRate")) or 0.0
    gaps = _num(m.get("monthGaps")) or 0
    applicable = m.get("gstApplicable", True)
    consistent = m.get("gstConsistent", True)
    gst_val = ("n/a" if not applicable else ("consistent" if consistent else "check"))
    drivers = [
        _driver("Cancelled-voucher rate", f"{rate}%",
                f"{m.get('cancelledCount')} of {m.get('totalVouchers')} vouchers"),
        _driver("Active-month coverage", f"{gaps} idle month(s)",
                "advisory — seasonal / off-season months are not penalised"),
        _driver("GST capture", gst_val,
                (f"output tax {inr(m.get('gstOutputTax'))}" if applicable
                 else "no GST output ledgers — composition / exempt / unregistered")),
    ]
    if not m.get("totalVouchers"):
        return None, 0, drivers
    s = 100.0
    s -= min(40.0, rate * 3)                    # 1% cancelled ≈ −3, capped
    # Month gaps are ADVISORY only (M2): we cannot deterministically distinguish
    # "missing bookkeeping" from a legitimate seasonal lull, and false-penalising
    # seasonal businesses erodes trust. Kept as a driver, not a deduction.
    if not consistent:                          # GST applicability already folded in (M3)
        s -= 15
    return _clamp(s), 100, drivers


_SCORERS = {
    "profitability": _profitability,
    "liquidity": _liquidity,
    "collections": _collections,
    "growth": _growth,
    "hygiene": _hygiene,
}


# ─────────────────────────── Composite ───────────────────────────
def _grade(score):
    for threshold, grade, label in cfg.GRADE_BANDS:
        if score >= threshold:
            return grade, label
    return "E", "Critical"


def compute(metrics: dict) -> dict:
    """Assemble the full 5-pillar Score object from the grounded metrics dict."""
    pillars = []
    weighted_sum = 0.0
    weight_total = 0.0
    cov_weighted = 0.0
    for key in cfg.pillar_keys:
        score, coverage, drivers = _SCORERS[key](metrics)
        weight = cfg.PILLAR_WEIGHTS[key]
        pillars.append({
            "key": key, "label": cfg.PILLAR_LABELS[key],
            "score": None if score is None else round(score),
            "weight": weight, "coverage": coverage, "band": _band(score),
            "drivers": drivers,
        })
        if score is not None:
            weighted_sum += score * weight
            weight_total += weight
            cov_weighted += coverage * weight

    overall = round(weighted_sum / weight_total) if weight_total else None
    coverage = round(cov_weighted / weight_total) if weight_total else 0
    grade, label = _grade(overall) if overall is not None else ("—", "No data")
    return {
        "fy": metrics.get("fy"),
        "overall": overall, "grade": grade, "label": label,
        "coverage": coverage, "pillars": pillars,
        # Baseline driver values so the Score Simulator can seed its sliders and
        # send overrides back to /simulate (additive to the API contract).
        "simInputs": {
            "cashBank": metrics.get("cashBank"),
            "receivablesTotal": metrics.get("receivablesTotal"),
            "netMargin": metrics.get("netMargin"),
        },
    }


def simulate(metrics: dict, base_overall: int | None) -> dict:
    """Score object for an overridden metrics dict, plus the delta vs current."""
    result = compute(metrics)
    delta = None
    if result["overall"] is not None and base_overall is not None:
        delta = result["overall"] - base_overall
    return {"overall": result["overall"], "grade": result["grade"],
            "label": result["label"], "delta": delta, "pillars": result["pillars"]}
