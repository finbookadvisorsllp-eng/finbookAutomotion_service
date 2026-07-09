"""Financial Health Score (Phase 9) — a deterministic 0–100 composite.

Four sub-scores, each 0–100, computed straight from the grounded context (so they
reconcile with the reports). No LLM. The overall is a weighted blend with a letter
grade the UI can show as a headline number.

  Profitability (35%)  net margin
  Liquidity     (30%)  cash balance sign + net cash-flow direction
  Collections   (20%)  receivables as a share of annual sales (lower = better)
  Growth        (15%)  sales year-over-year (neutral when no prior-year data)
"""
from app.aman.core.serializers import money

WEIGHTS = {"profitability": 0.35, "liquidity": 0.30, "collections": 0.20, "growth": 0.15}


def _sec(context, name):
    d = (context.get("sections") or {}).get(name) or {}
    return d if d.get("available") else {}


def _clamp(v):
    return max(0.0, min(100.0, v))


def _profitability_score(profit):
    """Map net margin → 0..100. 15%+ excellent, 0% weak, negative → near zero."""
    m = profit.get("profitMargin")
    if not isinstance(m, (int, float)):
        return None, "No P&L data"
    if m >= 15:
        s = 100
    elif m >= 0:
        s = 40 + (m / 15) * 60          # 0% → 40, 15% → 100
    else:
        s = _clamp(40 + m * 4)          # −10% → 0
    return _clamp(s), f"Net margin {round(m, 1)}%"


def _liquidity_score(cash):
    bal = cash.get("cashBankBalance")
    net_cf = cash.get("netCashFlow")
    if not isinstance(bal, (int, float)):
        return None, "No cash data"
    if bal < 0:
        s = 15                          # overdrawn is a serious flag
    else:
        s = 70
        if isinstance(net_cf, (int, float)):
            s += 30 if net_cf >= 0 else -25
    return _clamp(s), f"Cash {money(bal)}, net flow {money(net_cf) if isinstance(net_cf,(int,float)) else 'n/a'}"


def _collections_score(outstanding, sales):
    rec = outstanding.get("receivablesTotal")
    ann = sales.get("totalSales")
    if not isinstance(rec, (int, float)):
        return None, "No receivables data"
    if not isinstance(ann, (int, float)) or ann <= 0:
        return 50.0, "Receivables present; no sales baseline"
    ratio = rec / ann                   # 0 → 100, 0.5+ → 0
    s = _clamp(100 - ratio * 200)
    return s, f"Receivables are {round(ratio * 100)}% of annual sales"


def _growth_score(sales):
    pct = sales.get("changePct")
    prev = sales.get("previousFy")
    if not isinstance(pct, (int, float)) or not prev:
        return 50.0, "No prior-year sales to compare"
    if pct >= 20:
        s = 100
    elif pct >= 0:
        s = 60 + (pct / 20) * 40
    else:
        s = _clamp(60 + pct * 3)        # −20% → 0
    return _clamp(s), f"Sales {round(pct, 1)}% YoY"


def _grade(score):
    if score >= 85: return "A", "Excellent"
    if score >= 70: return "B", "Healthy"
    if score >= 55: return "C", "Fair"
    if score >= 40: return "D", "At risk"
    return "E", "Critical"


def compute(context: dict) -> dict:
    profit = _sec(context, "profit")
    cash = _sec(context, "cash")
    outstanding = _sec(context, "outstanding")
    sales = _sec(context, "sales")

    raw = {
        "profitability": _profitability_score(profit),
        "liquidity": _liquidity_score(cash),
        "collections": _collections_score(outstanding, sales),
        "growth": _growth_score(sales),
    }

    components = []
    weighted_sum = 0.0
    weight_total = 0.0
    labels = {"profitability": "Profitability", "liquidity": "Liquidity",
              "collections": "Collections", "growth": "Growth"}
    for key, (score, detail) in raw.items():
        components.append({"key": key, "label": labels[key],
                           "score": None if score is None else round(score),
                           "weight": WEIGHTS[key], "detail": detail})
        if score is not None:
            weighted_sum += score * WEIGHTS[key]
            weight_total += WEIGHTS[key]

    overall = round(weighted_sum / weight_total) if weight_total else None
    grade, label = _grade(overall) if overall is not None else ("—", "No data")
    return {
        "fy": context.get("fy"),
        "overall": overall,
        "grade": grade,
        "label": label,
        "components": components,
    }
