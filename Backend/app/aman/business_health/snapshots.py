"""Weekly health snapshots — the module's memory, without a scheduler.

A snapshot is written lazily at most once per ISO week per company, triggered by a
Command Center (/overview) or Health Score (/score) view. That is enough to accrue
week-over-week history; a real cron is a later phase. The diff against the most
recent snapshot older than ``SNAPSHOT_MIN_AGE_DAYS`` powers "what changed" and the
7-day trend arrow.
"""
from datetime import datetime, timedelta

from pymongo.errors import DuplicateKeyError

from app.aman.core.serializers import money, fmt_date, iso_date
from app.aman.business_health.config import bh_settings as cfg
from app.aman.business_health import repository as repo

# Vitals persisted on each snapshot (flat, for cheap diffing). direction=True when
# a rise is the *good* direction; the UI colours deltas from this. ``sales`` and
# ``netProfit`` were added so the Impact tracker can tell a fuller before→after
# story as history accrues; snapshots taken before they existed simply omit them
# and any metric missing from the baseline is skipped (never fabricated).
_VITAL_KEYS = {
    "sales": ("Revenue", True), "netProfit": ("Net profit", True),
    "cashBank": ("Cash & bank", True), "receivablesTotal": ("Receivables", False),
    "payablesTotal": ("Payables", False), "netMargin": ("Net margin", True),
    "grossMargin": ("Gross margin", True), "concentrationTop1": ("Top-customer share", False),
    "salesYoY": ("Sales YoY", True), "runwayMonths": ("Cash runway", True),
    "collectionsMonths": ("Collections horizon", False),
}

# Display unit per vital (drives frontend formatting; ₹ values format compactly).
_UNIT = {
    "sales": "₹", "netProfit": "₹", "cashBank": "₹", "receivablesTotal": "₹",
    "payablesTotal": "₹", "netMargin": "%", "grossMargin": "%",
    "concentrationTop1": "%", "salesYoY": "%",
    "runwayMonths": "months", "collectionsMonths": "months",
}

# The order the Impact tracker prefers to tell the story in (best headline first).
# Only metrics present in BOTH the baseline snapshot and current metrics render.
_IMPACT_ORDER = ["sales", "netMargin", "receivablesTotal", "runwayMonths",
                 "cashBank", "collectionsMonths", "concentrationTop1", "grossMargin"]


def _period_key(dt: datetime) -> str:
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _vitals_of(metrics: dict) -> dict:
    return {k: metrics.get(k) for k in _VITAL_KEYS}


def maybe_write_weekly(db, fy: str, score: dict, metrics: dict) -> dict | None:
    """Write one snapshot per ISO week per company. Returns the snapshot or None."""
    now = datetime.utcnow()
    period = _period_key(now)
    latest = repo.latest_snapshot(db, fy)
    if latest and latest.get("period") == period:
        return None                      # already captured this week
    doc = {
        "fy": fy, "takenAt": now, "period": period, "source": "auto",
        "overall": score.get("overall"), "grade": score.get("grade"),
        "pillars": [{"key": p["key"], "score": p["score"], "weight": p["weight"],
                     "coverage": p["coverage"]} for p in score.get("pillars", [])],
        "vitals": _vitals_of(metrics),
    }
    try:
        return repo.insert_snapshot(db, doc)
    except DuplicateKeyError:
        # A concurrent request (or another worker) already wrote this week's
        # snapshot — the (fy, period) unique index made the race safe.
        return None


def _baseline(db, fy: str) -> dict | None:
    cutoff = datetime.utcnow() - timedelta(days=cfg.SNAPSHOT_MIN_AGE_DAYS)
    return repo.latest_snapshot_before(db, fy, cutoff)


def diff_vs_last(db, fy: str, metrics: dict) -> list[dict]:
    """"What changed" rows vs the most recent baseline snapshot. Empty first week."""
    base = _baseline(db, fy)
    if not base:
        return []
    prev = base.get("vitals") or {}
    rows = []
    for key, (label, higher_good) in _VITAL_KEYS.items():
        frm, to = prev.get(key), metrics.get(key)
        if not isinstance(frm, (int, float)) or not isinstance(to, (int, float)):
            continue
        if abs(to - frm) < 1e-9:
            continue
        delta_pct = round((to - frm) / abs(frm) * 100, 1) if frm else None
        rows.append({
            "label": label, "from": money(frm), "to": money(to),
            "deltaPct": delta_pct, "direction": "up" if to > frm else "down",
            "good": (to > frm) == higher_good, "metricKey": key,
        })
    # Surface the biggest movements first.
    rows.sort(key=lambda r: -abs(r["deltaPct"] or 0))
    return rows[:6]


def trend7d(db, fy: str, current_overall) -> int | None:
    """Change in the overall score vs the baseline snapshot (for the header arrow)."""
    base = _baseline(db, fy)
    if not base or base.get("overall") is None or current_overall is None:
        return None
    return current_overall - base["overall"]


def trend_series(db, fy: str, limit: int = 12) -> dict:
    rows = repo.list_snapshots(db, fy, limit)
    series = [{
        "period": r.get("period"), "takenAt": r.get("takenAt"),
        "overall": r.get("overall"), "vitals": r.get("vitals") or {},
    } for r in rows]
    return {"series": series}


# ─────────────────────────── Onboarding baseline (Impact tracker) ───────────────────────────
def baseline_snapshot(db, fy: str) -> dict | None:
    """The onboarding baseline = the first snapshot ever captured for this FY.

    Honest by construction: we compare against the earliest health we actually
    *measured*, never a day-1 we never saw. The label carries that date so the UI
    can say "since we started tracking on <date>"."""
    return repo.earliest_snapshot(db, fy)


def _as_dt(v) -> datetime | None:
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def since_baseline(db, fy: str, metrics: dict) -> dict:
    """Before→after movement of every headline vital from the onboarding baseline
    snapshot to the current reconciled metrics. Snapshot-derived only (the overall
    score delta and realised ₹ impact are composed in ``service.build_impact``).

    Returns ``{"available": False}`` until a baseline snapshot exists."""
    base = baseline_snapshot(db, fy)
    if not base:
        return {"available": False}

    taken = _as_dt(base.get("takenAt")) or datetime.utcnow()
    now = datetime.utcnow()
    base_vitals = base.get("vitals") or {}

    cards: list[dict] = []
    for key in _IMPACT_ORDER:
        if key not in _VITAL_KEYS:
            continue
        frm, to = base_vitals.get(key), metrics.get(key)
        if not isinstance(frm, (int, float)) or not isinstance(to, (int, float)):
            continue
        label, higher_good = _VITAL_KEYS[key]
        delta_pct = round((to - frm) / abs(frm) * 100, 1) if frm else None
        direction = "up" if to > frm else ("down" if to < frm else "flat")
        good = None if direction == "flat" else ((to > frm) == higher_good)
        cards.append({
            "key": key, "label": label, "unit": _UNIT.get(key),
            "from": money(frm) if _UNIT.get(key) == "₹" else frm,
            "to": money(to) if _UNIT.get(key) == "₹" else to,
            "deltaPct": delta_pct, "direction": direction, "good": good,
        })

    return {
        "available": True,
        "baselineDate": iso_date(taken),
        "baselineLabel": f"since we started tracking on {fmt_date(taken)}",
        "baselinePeriod": base.get("period"),
        "justStarted": base.get("period") == _period_key(now),
        "daysTracked": max(0, (now - taken).days),
        "snapshotCount": repo.count_snapshots(db, fy),
        "scoreFrom": base.get("overall"),
        "metrics": cards,
    }


def milestones(db, fy: str, current_overall) -> list[dict]:
    """Deterministic trend milestones for the insight stream (best-in-N, crossed a band)."""
    if current_overall is None:
        return []
    rows = repo.list_snapshots(db, fy, 12)
    prior = [r.get("overall") for r in rows if isinstance(r.get("overall"), (int, float))]
    out = []
    if prior and current_overall > max(prior):
        out.append({"id": f"ins:milestone-best:{fy}",
                    "title": "Health score at its highest in months",
                    "detail": f"Your score of {current_overall} is the best in the last "
                              f"{len(prior)} recorded weeks."})
    return out
