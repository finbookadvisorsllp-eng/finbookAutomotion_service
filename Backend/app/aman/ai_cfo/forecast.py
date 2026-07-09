"""Forecasting engine (Phase 10) — sales / cash / collections outlook.

Deterministic and transparent: a least-squares linear trend fitted to the live
monthly series (the same P&L/cash figures the reports show), projected forward a
few months. No black box, no fabricated precision — every response states the
method and its caveats so the number is never mistaken for a guarantee.

Grounded inputs come from ``dashboard_service.monthly_trend`` (revenue / expense /
profit per month) and ``dashboard_service.cash_flow``.
"""
from app.aman.core.serializers import money
from app.aman.services import dashboard_service as ds
from app.aman.services.financial_year import current_fy

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _linreg(values: list[float]):
    """Ordinary least squares over (0..n-1) → (slope, intercept). n>=2 required."""
    n = len(values)
    if n < 2:
        return 0.0, (values[0] if values else 0.0)
    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    denom = sum((x - mean_x) ** 2 for x in xs)
    if denom == 0:
        return 0.0, mean_y
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values)) / denom
    intercept = mean_y - slope * mean_x
    return slope, intercept


def _trim_trailing_zeros(series: list[dict], key: str) -> list[dict]:
    """Drop trailing months with no activity (future months not yet booked), so the
    trend is fitted only to months that actually have data."""
    last = -1
    for i, m in enumerate(series):
        if (m.get(key) or 0) != 0:
            last = i
    return series[: last + 1] if last >= 0 else []


def _project(values: list[float], periods: int, clamp_nonneg: bool = True) -> list[float]:
    slope, intercept = _linreg(values)
    n = len(values)
    out = []
    for i in range(n, n + periods):
        v = slope * i + intercept
        if clamp_nonneg and v < 0:
            v = 0.0
        out.append(money(v))
    return out


def _confidence(n_points: int) -> str:
    if n_points >= 6:
        return "moderate"
    if n_points >= 3:
        return "low"
    return "very low"


def _future_labels(count: int) -> list[str]:
    """Generic forward labels (M+1..M+n); month names aren't assumed since the
    historical window may not align to the calendar tail."""
    return [f"M+{i}" for i in range(1, count + 1)]


def build_forecast(db, fy: str | None = None, months: int = 3) -> dict:
    fy = fy or current_fy()
    months = max(1, min(12, months))
    series = ds.monthly_trend(db, fy).get("series", [])

    rev_hist_rows = _trim_trailing_zeros(series, "revenue")
    rev_hist = [m["revenue"] for m in rev_hist_rows]
    exp_hist = [series[i]["expense"] for i in range(len(rev_hist_rows))]
    profit_hist = [series[i]["profit"] for i in range(len(rev_hist_rows))]
    n = len(rev_hist)

    labels = _future_labels(months)
    revenue_fc = _project(rev_hist, months) if n >= 2 else []
    expense_fc = _project(exp_hist, months, clamp_nonneg=True) if n >= 2 else []
    profit_fc = ([money(r - e) for r, e in zip(revenue_fc, expense_fc)]
                 if revenue_fc and expense_fc else [])

    sales = {
        "available": n >= 2,
        "method": "least-squares linear trend on monthly revenue",
        "confidence": _confidence(n),
        "historyMonths": n,
        "projection": [{"period": labels[i], "value": revenue_fc[i]} for i in range(len(revenue_fc))],
        "nextMonth": revenue_fc[0] if revenue_fc else None,
        "note": ("Projected from only a few months of data — treat as directional, not exact."
                 if n < 6 else "Linear projection; actuals will vary with seasonality and one-off deals."),
    }
    cashflow = {
        "available": bool(profit_fc),
        "method": "revenue trend minus expense trend (P&L lens proxy for operating cash)",
        "confidence": _confidence(n),
        "projection": [{"period": labels[i], "value": profit_fc[i]} for i in range(len(profit_fc))],
        "note": "Operating proxy from P&L movement; excludes financing/investing and timing of receipts.",
    }

    # Collections outlook — how long to clear receivables at the recent sales run-rate
    # (a proxy for collections when bill-wise settlement data isn't in the sync).
    collections = _collections_outlook(db, fy, rev_hist)

    return {"fy": fy, "months": months, "sales": sales,
            "cashFlow": cashflow, "collections": collections}


def _collections_outlook(db, fy: str, rev_hist: list[float]) -> dict:
    try:
        from app.aman.services import outstanding_service as outs
        rec = outs.receivables(db, fy, page=1, limit=1)
        receivables_total = money(rec["summary"]["total"])
    except Exception:
        return {"available": False, "reason": "receivables unavailable"}
    avg_monthly = money(sum(rev_hist) / len(rev_hist)) if rev_hist else 0.0
    if not avg_monthly:
        return {"available": False, "reason": "no sales run-rate to estimate collections"}
    months_to_clear = round(receivables_total / avg_monthly, 1) if avg_monthly else None
    return {
        "available": True,
        "receivablesTotal": receivables_total,
        "avgMonthlySales": avg_monthly,
        "monthsToClearAtRunRate": months_to_clear,
        "method": "receivables ÷ average monthly sales (run-rate proxy)",
        "note": ("Assumes collections keep pace with sales; bill-wise due dates are not in the "
                 "synced data, so this is an indicative horizon, not a dated schedule."),
    }
