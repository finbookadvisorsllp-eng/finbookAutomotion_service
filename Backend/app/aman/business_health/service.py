"""Business Health orchestration — ties the deterministic engines together and
owns the Decision Ledger lifecycle. Everything is company-scoped through the
``db`` handed in by the route.

Public surface used by routes.py:
  metrics(db, fy)                     grounded metrics (uncached; routes cache it)
  score(metrics)                      5-pillar Score object
  build_overview(db, fy, metrics, score)
  generate_decisions(db, fy, metrics)
  list_decisions / act / snooze / dismiss
"""
from datetime import datetime, timedelta

from pymongo.errors import DuplicateKeyError

from app.aman.core.serializers import money, inr, serialize_docs, serialize_doc
from app.aman.business_health.config import bh_settings as cfg
from app.aman.business_health import pillars, snapshots, repository as repo
from app.aman.business_health.engines import kpi, risk, opportunity, priority, insight


# Outcome direction: is a *rise* in this metric an improvement?
_HIGHER_BETTER = {"cashBank", "netProfit", "netMargin", "grossMargin", "sales"}
_LOWER_BETTER = {"receivablesTotal", "payablesTotal", "collectionsMonths",
                 "concentrationTop1", "cancelledRate"}


# ─────────────────────────── Grounded compute ───────────────────────────
def metrics(db, fy: str, overrides: dict | None = None) -> dict:
    return kpi.build_metrics(db, fy, overrides)


def score(m: dict) -> dict:
    return pillars.compute(m)


def _risks_and_opps(db, m: dict):
    risks = risk.evaluate(m)
    opps = opportunity.evaluate(db, m)
    return risks, opps


# ─────────────────────────── Decision Ledger ───────────────────────────
def _decision_from_candidate(fy: str, c: dict) -> dict:
    return {
        "fy": fy, "kind": c["kind"], "sourceId": c["sourceId"],
        "title": c["title"], "detail": c["detail"], "actionText": c["actionText"],
        "rupeeImpact": c.get("rupees"), "confidence": c.get("confidence", "med"),
        "effort": c.get("effort", "med"), "priorityScore": c.get("priorityScore", 0.0),
        "evidence": c.get("evidence"), "metricKey": c.get("metricKey"),
        "status": "open", "statusReason": None, "snoozeUntil": None,
        "baselineValue": None,
        "outcome": {"measuredValue": None, "deltaValue": None, "evaluatedAt": None, "verdict": None},
        "actedBy": None, "actedAt": None,
    }


def generate_decisions(db, fy: str, m: dict,
                       risks: list[dict] | None = None, opps: list[dict] | None = None) -> dict:
    """Idempotent: upsert open decisions from the priority queue keyed on sourceId.
    Creates new, refreshes still-open, leaves acted/snoozed, revives a dismissed
    item only on a material ₹ change. Returns {created, updated, decisions}.

    ``risks``/``opps`` may be passed in to avoid recomputing them (the composed
    /overview does this). Concurrency-safe: the insert races against the
    ``(fy, sourceId)`` unique index, and a lost race degrades to a refresh."""
    if risks is None or opps is None:
        risks, opps = _risks_and_opps(db, m)
    cands = priority.build_candidates(risks, opps)
    created = updated = 0
    for c in cands:
        existing = repo.get_decision_by_source(db, fy, c["sourceId"])
        if not existing:
            try:
                repo.insert_decision(db, _decision_from_candidate(fy, c))
                created += 1
                continue
            except DuplicateKeyError:
                # A concurrent generator inserted this sourceId first — fall through
                # and treat it as existing (refresh if still open).
                existing = repo.get_decision_by_source(db, fy, c["sourceId"])
                if not existing:
                    continue
        st = existing.get("status")
        if st == "open":
            repo.refresh_open_decision(db, existing["decisionId"], {
                "title": c["title"], "detail": c["detail"], "actionText": c["actionText"],
                "rupeeImpact": c.get("rupees"), "confidence": c.get("confidence"),
                "effort": c.get("effort"), "priorityScore": c.get("priorityScore"),
                "evidence": c.get("evidence"), "metricKey": c.get("metricKey"),
            })
            updated += 1
        elif st == "dismissed":
            if _materially_changed(existing.get("rupeeImpact"), c.get("rupees")):
                repo.update_decision(db, existing["decisionId"], {
                    "status": "open", "statusReason": None,
                    "rupeeImpact": c.get("rupees"), "priorityScore": c.get("priorityScore"),
                    "title": c["title"], "detail": c["detail"], "actionText": c["actionText"],
                })
                updated += 1
        # acted / snoozed → untouched
    decisions = list_decisions(db, fy, status="open", m=m)
    return {"created": created, "updated": updated, "decisions": decisions}


def _materially_changed(old, new) -> bool:
    if not isinstance(old, (int, float)) or not isinstance(new, (int, float)) or not old:
        return bool(new) and not old
    return abs(new - old) / abs(old) >= cfg.DISMISS_REVIVE_MATERIALITY


def list_decisions(db, fy: str, status: str | None = None, m: dict | None = None) -> list[dict]:
    """List decisions, auto-reopening elapsed snoozes and evaluating outcomes for
    acted ones (against current metrics when available)."""
    _reopen_elapsed_snoozes(db, fy)
    rows = repo.list_decisions(db, fy, status)
    if m is not None:
        for d in rows:
            if d.get("status") == "acted":
                _evaluate_outcome(db, d, m)
    return serialize_docs(rows)


def _reopen_elapsed_snoozes(db, fy: str) -> None:
    # One atomic update_many (race-safe) rather than a read-then-write loop.
    repo.reopen_elapsed_snoozes(db, fy, datetime.utcnow())


def _evaluate_outcome(db, d: dict, m: dict) -> None:
    key = d.get("metricKey")
    base = d.get("baselineValue")
    if not key or not isinstance(base, (int, float)):
        return
    current = m.get(key)
    if not isinstance(current, (int, float)):
        return
    delta = money(current - base)
    if base:
        change_pct = (current - base) / abs(base) * 100
    else:
        change_pct = 100.0 if current else 0.0
    if abs(change_pct) < 2:
        verdict = "no-change"
    else:
        improved = (current > base) if key in _HIGHER_BETTER else (current < base)
        verdict = "improved" if improved else "worsened"
    outcome = {"measuredValue": money(current), "deltaValue": delta,
               "evaluatedAt": datetime.utcnow(), "verdict": verdict}
    if (d.get("outcome") or {}).get("verdict") != verdict:
        repo.update_decision(db, d["decisionId"], {"outcome": outcome})
    d["outcome"] = outcome


def act(db, decision_id: str, user_sub: str | None, note: str | None = None) -> dict | None:
    d = repo.get_decision(db, decision_id)
    if not d:
        return None
    # Stamp the baseline for the outcome loop from the decision's own FY metrics.
    baseline = None
    key = d.get("metricKey")
    if key:
        try:
            baseline = kpi.build_metrics(db, d["fy"]).get(key)
        except Exception:
            baseline = None
    changes = {"status": "acted", "actedAt": datetime.utcnow(), "actedBy": user_sub,
               "statusReason": note, "baselineValue": baseline}
    return serialize_doc(repo.update_decision(db, decision_id, changes))


def snooze(db, decision_id: str, days: int | None = None, until: datetime | None = None) -> dict | None:
    if not repo.get_decision(db, decision_id):
        return None
    if until is None:
        until = datetime.utcnow() + timedelta(days=days or cfg.SNOOZE_DEFAULT_DAYS)
    return serialize_doc(repo.update_decision(db, decision_id,
                         {"status": "snoozed", "snoozeUntil": until}))


def dismiss(db, decision_id: str, reason: str | None = None) -> dict | None:
    if not repo.get_decision(db, decision_id):
        return None
    return serialize_doc(repo.update_decision(db, decision_id,
                         {"status": "dismissed", "statusReason": reason}))


# ─────────────────────────── Composed views ───────────────────────────
def insights(db, fy: str, m: dict, type_: str | None = None) -> list[dict]:
    risks, opps = _risks_and_opps(db, m)
    ms = snapshots.milestones(db, fy, score(m).get("overall"))
    stream = insight.build(m, risks, opps, ms)
    if type_:
        stream = [i for i in stream if i["type"] == type_]
    return stream


def _verdict(sc: dict, risks: list[dict]) -> str:
    label = (sc.get("label") or "").lower()
    danger = next((r for r in risks if r["severity"] == "danger"), None)
    warning = next((r for r in risks if r["severity"] == "warning"), None)
    if danger:
        return f"You're {label}, but {danger['title'][0].lower()}{danger['title'][1:]}."
    if warning:
        return f"{sc.get('label')} overall — watch: {warning['title'][0].lower()}{warning['title'][1:]}."
    return f"{sc.get('label')} — no pressing risks this week."


def build_overview(db, fy: str, m: dict, sc: dict) -> dict:
    """The single Command Center payload. Also (side-effect) writes the weekly
    snapshot and regenerates decisions so the landing self-maintains with one call.
    The AI briefing is intentionally NOT inlined — the page fetches /briefing
    separately so it renders instantly (approved decision)."""
    snapshots.maybe_write_weekly(db, fy, sc, m)
    # Compute risks/opportunities ONCE and thread them into both the decision
    # generator and the verdict (was computed twice).
    risks, opps = _risks_and_opps(db, m)
    gen = generate_decisions(db, fy, m, risks=risks, opps=opps)
    top_decisions = gen["decisions"][: cfg.TOP_DECISIONS]
    return {
        "fy": fy, "generatedAt": datetime.utcnow().isoformat(),
        "score": {"overall": sc.get("overall"), "grade": sc.get("grade"),
                  "label": sc.get("label"), "trend7d": snapshots.trend7d(db, fy, sc.get("overall"))},
        "verdict": _verdict(sc, risks),
        "topDecisions": top_decisions,
        "whatChanged": snapshots.diff_vs_last(db, fy, m),
        "vitals": kpi.headline_vitals(m),
        # Rendered client-side via a separate /briefing call (non-blocking).
        "briefing": None,
    }


# ─────────────────────────── Impact tracker (since onboarding) ───────────────────────────
def _impact_headline(base: dict, sfrom, sto, delta, realised: float) -> str:
    """One honest, deterministic sentence — no LLM. Never claims a number we can't back."""
    label = base.get("baselineLabel") or "since we started tracking"
    if base.get("justStarted"):
        return ("We've just started tracking this company's health — your first full "
                "impact report builds from here, week over week.")
    parts: list[str] = []
    if isinstance(delta, int) and isinstance(sto, int):
        if delta > 0:
            parts.append(f"Your health score is up {delta} points ({sfrom}→{sto}) {label}.")
        elif delta < 0:
            parts.append(f"Your health score has slipped {abs(delta)} points ({sfrom}→{sto}) "
                         f"{label} — the decisions below are how to recover it.")
        else:
            parts.append(f"Your health score is holding steady at {sto} {label}.")
    if realised and realised > 0:
        parts.append(f"Acting on your CFO's decisions has freed or protected {inr(realised)} so far.")
    return " ".join(parts) or f"Tracking your business health {label}."


def build_impact(db, fy: str, m: dict, sc: dict) -> dict:
    """The "Business Impact since onboarding" payload.

    Composes three grounded sources — never re-computes accounting:
      * snapshot baseline → before→after movement of every headline vital (snapshots)
      * the current 5-pillar score → the overall-score delta
      * the Decision Ledger → **realised** ₹ impact = the acted decisions whose metric
        actually moved the right way (a decision that didn't move the number earns ₹0).
    """
    base = snapshots.since_baseline(db, fy, m)
    now_iso = datetime.utcnow().isoformat()
    if not base.get("available"):
        return {"fy": fy, "available": False, "asOf": now_iso,
                "score": {"from": None, "to": sc.get("overall"), "grade": sc.get("grade"),
                          "delta": None, "pct": None}}

    score_from, score_to = base.get("scoreFrom"), sc.get("overall")
    delta = (score_to - score_from) if isinstance(score_from, int) and isinstance(score_to, int) else None
    pct = round((score_to - score_from) / score_from * 100, 1) if (score_from and score_to is not None) else None

    # Realised impact from the ledger. list_decisions(m=…) refreshes each acted
    # decision's outcome verdict against current metrics before we read it.
    decisions = list_decisions(db, fy, m=m)
    realised = 0.0
    acted = improved = 0
    drivers: list[dict] = []
    for d in decisions:
        if d.get("status") != "acted":
            continue
        acted += 1
        if (d.get("outcome") or {}).get("verdict") != "improved":
            continue
        improved += 1
        raw = d.get("rupeeImpact")
        imp = abs(raw) if isinstance(raw, (int, float)) else 0.0
        realised += imp
        drivers.append({
            "decisionId": d.get("decisionId"), "title": d.get("title"),
            "detail": d.get("detail"), "kind": d.get("kind"),
            "rupeeImpact": money(imp), "metricKey": d.get("metricKey"),
            "actedAt": d.get("actedAt"), "verdict": "improved",
        })
    drivers.sort(key=lambda x: -(x["rupeeImpact"] or 0))
    realised = money(realised)

    return {
        "fy": fy, "available": True, "asOf": now_iso,
        "justStarted": base.get("justStarted"),
        "baselineDate": base.get("baselineDate"),
        "baselineLabel": base.get("baselineLabel"),
        "daysTracked": base.get("daysTracked"),
        "snapshotCount": base.get("snapshotCount"),
        "score": {"from": score_from, "to": score_to, "grade": sc.get("grade"),
                  "delta": delta, "pct": pct},
        "metrics": base.get("metrics", []),
        "realisedImpact": realised,
        "actedCount": acted, "improvedCount": improved,
        "drivers": drivers,
        "headline": _impact_headline(base, score_from, score_to, delta, realised),
    }
