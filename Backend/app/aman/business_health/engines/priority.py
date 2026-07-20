"""Priority engine — merge risks + opportunities into one ranked queue.

Deterministic and reproducible (auditability matters):

    priorityScore = normalize(rupees) × confidenceWeight ÷ effortWeight × urgencyBoost

``normalize`` scales rupees against the largest in the current set (0..1); items
without a ₹ figure get a small floor so they still rank, but below anything
quantified. Weights + the urgency boost live in ``config``. The Command Center
shows the top ``TOP_DECISIONS``; the rest surface on the Opportunities/Risks page.
"""
from app.aman.business_health.config import bh_settings as cfg


def _candidate(kind, item, rupees, effort, urgent):
    return {
        "kind": kind,                    # "risk" | "opportunity"
        "sourceId": item["sourceId"],
        "title": item["title"],
        "detail": item["detail"],
        "actionText": item.get("actionText") or _default_action(kind, item),
        "rupees": rupees,
        "confidence": item.get("confidence", "med"),
        "effort": effort,
        "metricKey": item.get("metricKey"),
        "evidence": item.get("evidence"),
        "severity": item.get("severity"),
        "urgent": urgent,
        "priorityScore": 0.0,
    }


def _default_action(kind, item):
    return ("Review and act on this risk." if kind == "risk"
            else "Act on this opportunity.")


def build_candidates(risks: list[dict], opportunities: list[dict]) -> list[dict]:
    cands: list[dict] = []
    for o in opportunities:
        cands.append(_candidate("opportunity", o, o.get("rupeeImpact"),
                                o.get("effort", "med"), urgent=False))
    for r in risks:
        urgent = r.get("severity") == "danger" or r.get("metricKey") == "cashBank"
        # Acting on most risks (chase, review, spot-check) is low effort.
        cands.append(_candidate("risk", r, r.get("rupeesAtRisk"), "low", urgent))
    return _score(cands)


def _score(cands: list[dict]) -> list[dict]:
    # Normalize opportunities and risks on SEPARATE scales (M1): a single huge
    # loss must not shrink every genuine opportunity's score toward zero. Each kind
    # is scaled against the largest ₹ within its own kind.
    max_by_kind = {}
    for kind in ("opportunity", "risk"):
        vals = [(c["rupees"] or 0) for c in cands if c["kind"] == kind]
        max_by_kind[kind] = max(vals) if vals else 0
    for c in cands:
        base = max_by_kind.get(c["kind"], 0)
        norm = (c["rupees"] / base) if (c["rupees"] and base) else 0.15
        conf = cfg.CONFIDENCE_WEIGHT.get(c["confidence"], 0.7)
        effort = cfg.EFFORT_WEIGHT.get(c["effort"], 1.5)
        boost = cfg.URGENCY_BOOST if c["urgent"] else 1.0
        c["priorityScore"] = round(norm * conf / effort * boost, 4)
    cands.sort(key=lambda c: -c["priorityScore"])
    return cands


def top(cands: list[dict], n: int | None = None) -> list[dict]:
    """Top-N by priority, but guarantee at least one opportunity when any exist
    (M1) — otherwise a run of large risks would crowd out the actionable win the
    owner could actually take this week."""
    n = n or cfg.TOP_DECISIONS
    picked = cands[:n]
    have_opp = any(c["kind"] == "opportunity" for c in cands)
    if n >= 1 and have_opp and not any(c["kind"] == "opportunity" for c in picked):
        best_opp = next(c for c in cands if c["kind"] == "opportunity")  # cands sorted desc
        picked = picked[: n - 1] + [best_opp]
    return picked
