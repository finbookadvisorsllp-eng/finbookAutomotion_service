"""Persistence for Business Health — the Decision Ledger + weekly health snapshots.

Both collections live inside the caller's own ``sf_tenant_<id>`` database (passed
in as ``db``), so tenant/company isolation is automatic and free — the approved
"company-scoped" contract holds by construction. Sync pymongo, matching every
other aman repository. Index creation is idempotent and once-per-process, mirroring
``app.aman.ai_cfo.repository.ensure_indexes``.

Collections
-----------
``aman_decisions``         one document per tracked decision (the Decision Ledger)
``aman_health_snapshots``  one document per weekly score/vitals snapshot (memory)
"""
import threading
import uuid
from datetime import datetime
from typing import Optional

from app.aman.business_health.config import bh_settings as cfg

_DECISIONS = cfg.DECISIONS_COLLECTION
_SNAPSHOTS = cfg.SNAPSHOTS_COLLECTION

_indexed_dbs: set[str] = set()
_index_lock = threading.Lock()


def _now() -> datetime:
    return datetime.utcnow()


def _new_id() -> str:
    return uuid.uuid4().hex


# ─────────────────────────────── Indexes ───────────────────────────────
def _mk(coll, keys, **kw) -> None:
    """Best-effort single index — one pre-existing-duplicate failure must not block
    the others (each in its own try, unlike a single wrapping block)."""
    try:
        coll.create_index(keys, **kw)
    except Exception:
        pass


def ensure_indexes(db) -> None:
    """Idempotently create the Business-Health indexes for this tenant (once/process).

    The two ``unique`` compound indexes are the correctness backbone: they make
    decision generation and weekly snapshots race-safe (and therefore
    multi-worker-safe) — concurrent writers can no longer create duplicates for the
    same ``(fy, sourceId)`` decision or ``(fy, period)`` snapshot."""
    name = db.name
    with _index_lock:
        if name in _indexed_dbs:
            return
        _indexed_dbs.add(name)
    d, s = db[_DECISIONS], db[_SNAPSHOTS]
    _mk(d, [("decisionId", 1)], unique=True)
    # Idempotent regeneration + dedupe: exactly one live decision per (fy, sourceId).
    _mk(d, [("fy", 1), ("sourceId", 1)], unique=True)
    # Company-scoped listing: newest / highest-priority open items first.
    _mk(d, [("status", 1), ("priorityScore", -1)])
    _mk(d, [("updatedAt", -1)])
    _mk(s, [("snapshotId", 1)], unique=True)
    # One snapshot per ISO week per company (weekly memory, race-safe).
    _mk(s, [("fy", 1), ("period", 1)], unique=True)
    _mk(s, [("fy", 1), ("takenAt", -1)])


# ─────────────────────────────── Decisions ───────────────────────────────
def get_decision(db, decision_id: str) -> Optional[dict]:
    if not decision_id:
        return None
    return db[_DECISIONS].find_one({"decisionId": decision_id})


def get_decision_by_source(db, fy: str, source_id: str) -> Optional[dict]:
    """The single live decision for a (fy, sourceId) — the idempotency key."""
    return db[_DECISIONS].find_one({"fy": fy, "sourceId": source_id})


def list_decisions(db, fy: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
    ensure_indexes(db)
    match: dict = {}
    if fy:
        match["fy"] = fy
    if status:
        match["status"] = status
    # Open items by priority; everything else by recency.
    return list(db[_DECISIONS].find(match).sort([("priorityScore", -1), ("updatedAt", -1)]))


def insert_decision(db, doc: dict) -> dict:
    ensure_indexes(db)
    now = _now()
    doc.setdefault("decisionId", _new_id())
    doc.setdefault("status", "open")
    doc.setdefault("createdAt", now)
    doc["updatedAt"] = now
    db[_DECISIONS].insert_one(doc)
    return doc


def update_decision(db, decision_id: str, changes: dict) -> Optional[dict]:
    changes = dict(changes)
    changes["updatedAt"] = _now()
    db[_DECISIONS].update_one({"decisionId": decision_id}, {"$set": changes})
    return get_decision(db, decision_id)


def reopen_elapsed_snoozes(db, fy: str, now: datetime) -> int:
    """Atomically reopen every snoozed decision whose snooze window has elapsed.

    One ``update_many`` (not an N-write loop) so the sweep is race-safe and cheap
    even when triggered from a read path."""
    res = db[_DECISIONS].update_many(
        {"fy": fy, "status": "snoozed", "snoozeUntil": {"$lte": now}},
        {"$set": {"status": "open", "snoozeUntil": None, "updatedAt": now}},
    )
    return getattr(res, "modified_count", 0) or 0


def refresh_open_decision(db, decision_id: str, fields: dict) -> Optional[dict]:
    """Refresh a still-open decision's derived fields (impact/text/priority) in place
    without disturbing its lifecycle. Used by idempotent regeneration."""
    allowed = {k: fields[k] for k in
               ("title", "detail", "actionText", "rupeeImpact", "rupeesAtRisk",
                "confidence", "effort", "priorityScore", "evidence", "metricKey")
               if k in fields}
    return update_decision(db, decision_id, allowed)


# ─────────────────────────────── Snapshots ───────────────────────────────
def latest_snapshot(db, fy: str) -> Optional[dict]:
    return db[_SNAPSHOTS].find_one({"fy": fy}, sort=[("takenAt", -1)])


def latest_snapshot_before(db, fy: str, before: datetime) -> Optional[dict]:
    """Most recent snapshot taken at/earlier than ``before`` — the diff baseline."""
    return db[_SNAPSHOTS].find_one(
        {"fy": fy, "takenAt": {"$lte": before}}, sort=[("takenAt", -1)])


def earliest_snapshot(db, fy: str) -> Optional[dict]:
    """The first snapshot we ever captured for this company/FY — the *onboarding
    baseline* for the Impact tracker. Uses the (fy, takenAt) index in reverse."""
    return db[_SNAPSHOTS].find_one({"fy": fy}, sort=[("takenAt", 1)])


def count_snapshots(db, fy: str) -> int:
    """How many weekly snapshots have accrued for this company/FY."""
    return db[_SNAPSHOTS].count_documents({"fy": fy})


def insert_snapshot(db, doc: dict) -> dict:
    ensure_indexes(db)
    doc.setdefault("snapshotId", _new_id())
    doc.setdefault("takenAt", _now())
    doc.setdefault("source", "auto")
    db[_SNAPSHOTS].insert_one(doc)
    return doc


def list_snapshots(db, fy: str, limit: int = 12) -> list[dict]:
    ensure_indexes(db)
    cur = db[_SNAPSHOTS].find({"fy": fy}).sort("takenAt", -1).limit(int(limit))
    rows = list(cur)
    rows.reverse()   # oldest → newest for a trend series
    return rows
