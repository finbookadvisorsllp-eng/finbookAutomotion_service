"""AI CFO anomaly detector — the *Record Keeping* intelligence (deterministic, no LLM).

A real CFO doesn't type the entries — it makes sure they can be *trusted*. This
engine watches each expense ledger's month-over-month movement and flags entries
that look wrong or missing, so the owner can verify them before acting on the P&L:

  * MISSING — a normally-recurring expense has no entry in the latest booked month
              (e.g. the electricity bill wasn't booked this month)
  * DROP    — an expense fell far below its own running average
              (e.g. rent recorded as ₹500 when it's always ₹5,000 — a likely typo)
  * SPIKE   — an expense jumped far above its own average
              (a possible duplicate entry or wrong-ledger posting)

Grounding: every figure comes from the same journal the reports read (via
``voucher_repo.monthly_by_ledger``), classified as an expense through the real group
hierarchy. Thresholds are conservative and material-only, so seasonal noise and
trivial ledgers never cry wolf. A "missing this month" flag is advisory — the latest
month may simply be mid-way through booking.
"""
from app.aman.core.serializers import money, inr
from app.aman.services.accounting import compute_ledger_balances
from app.aman.repositories import group_repo, voucher_repo

# ── Tunables (kept here, conservative) ──
MIN_ACTIVE_MONTHS = 4       # need this many booked months before judging trends
MIN_LEDGER_MONTHS = 3       # a ledger must recur in >= this many prior months
RECURRING_COVERAGE = 0.6    # ...and in >= 60% of the prior booked months
DROP_PCT = 60.0             # fell > 60% below its own average → anomaly
SPIKE_PCT = 150.0           # rose > 150% above its own average → anomaly
MIN_AVG_RUPEES = 1000.0     # ignore ledgers averaging under ₹1,000 (noise floor)
MAX_ANOMALIES = 8

# Indian financial year month order (Apr → Mar) and display names.
_FY_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
_MONTH_NAME = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
               7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"}


def _empty(reason: str, active: int = 0) -> dict:
    return {"available": False, "reason": reason, "latestMonth": None,
            "activeMonths": active, "anomalies": [],
            "counts": {"missing": 0, "drop": 0, "spike": 0, "total": 0}}


def _expense_ledgers(db, fy: str) -> list[str]:
    """Names of ledgers that roll up to an EXPENSE root group (the real hierarchy)."""
    balances = compute_ledger_balances(db, fy)
    groups = group_repo.group_by_name(db)
    return [lb.name for lb in balances.values()
            if group_repo.classification_of(groups.get(lb.root_group)) == "EXPENSE"]


def _make(led: str, typ: str, latest_val: float, avg: float, delta_pct: float, mnum: int) -> dict:
    month = _MONTH_NAME.get(mnum, "this month")
    latest_val, avg = money(latest_val), money(avg)
    if typ == "missing":
        title = f"{led} — no entry this month"
        detail = (f"{led} usually costs about {inr(avg)}/month, but nothing was booked in "
                  f"{month}. Verify it isn't a missing bill before trusting this month's P&L.")
        magnitude = avg
    elif typ == "drop":
        title = f"{led} looks too low"
        detail = (f"{led} is {inr(latest_val)} in {month} vs a {inr(avg)} monthly average — "
                  f"a {abs(delta_pct):.0f}% drop. Looks like a possible entry error; re-check the voucher.")
        magnitude = abs(avg - latest_val)
    else:  # spike
        title = f"{led} spiked sharply"
        detail = (f"{led} is {inr(latest_val)} in {month} vs a {inr(avg)} monthly average "
                  f"({delta_pct:+.0f}%). Confirm it isn't a duplicate entry or a mis-posting.")
        magnitude = abs(latest_val - avg)
    return {
        "id": f"anomaly:{typ}:{led}", "ledger": led, "type": typ, "month": month,
        "latest": latest_val, "average": avg, "expected": avg,
        "deltaPct": round(delta_pct, 1), "magnitude": money(magnitude),
        "title": title, "detail": detail, "action": "Verify entry", "severity": "warning",
    }


def detect(db, fy: str) -> dict:
    """Scan every expense ledger for missing / dropped / spiked entries in the latest
    booked month. Returns a well-formed payload even when there isn't enough history."""
    try:
        expense_ledgers = _expense_ledgers(db, fy)
    except Exception:  # noqa: BLE001 — a failing ledger build must not break the desk
        return _empty("ledger balances unavailable")
    if not expense_ledgers:
        return _empty("no expense ledgers found")

    by_ledger = voucher_repo.monthly_by_ledger(db, fy, expense_ledgers)  # {ledger: {mnum: net}}

    # The company's booked timeline: FY-ordered months where any expense actually posted.
    present = {m for series in by_ledger.values() for m, v in series.items() if v}
    active = [m for m in _FY_ORDER if m in present]
    if len(active) < MIN_ACTIVE_MONTHS:
        return _empty("not enough booked months to judge anomalies", active=len(active))

    latest, prior = active[-1], active[:-1]
    anomalies: list[dict] = []
    for led, series in by_ledger.items():
        present_prior = [series[m] for m in prior if series.get(m, 0.0) > 0]
        # Only judge genuinely recurring expenses (present often enough to have a "normal").
        if len(present_prior) < MIN_LEDGER_MONTHS:
            continue
        if len(present_prior) / len(prior) < RECURRING_COVERAGE:
            continue
        avg = sum(present_prior) / len(present_prior)
        if avg < MIN_AVG_RUPEES:
            continue

        latest_val = series.get(latest, 0.0)
        if latest_val <= 0:
            typ, delta = "missing", -100.0
        elif latest_val < avg * (1 - DROP_PCT / 100):
            typ, delta = "drop", (latest_val - avg) / avg * 100
        elif latest_val > avg * (1 + SPIKE_PCT / 100):
            typ, delta = "spike", (latest_val - avg) / avg * 100
        else:
            continue
        anomalies.append(_make(led, typ, latest_val, avg, delta, latest))

    anomalies.sort(key=lambda a: -a["magnitude"])
    anomalies = anomalies[:MAX_ANOMALIES]
    counts = {"missing": 0, "drop": 0, "spike": 0}
    for a in anomalies:
        counts[a["type"]] += 1
    counts["total"] = len(anomalies)
    return {"available": True, "latestMonth": _MONTH_NAME.get(latest),
            "activeMonths": len(active), "anomalies": anomalies, "counts": counts}
