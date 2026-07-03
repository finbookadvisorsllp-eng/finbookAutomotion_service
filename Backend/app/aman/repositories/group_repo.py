"""Read access to the ``groups`` collection (chart-of-accounts skeleton)."""
import threading
import time

from app.aman.config import aman_settings

# Groups are master data (the Tally chart-of-accounts skeleton) that only changes
# on a fresh sync, yet ``compute_ledger_balances`` and nearly every report re-read
# them repeatedly per request. Memoise the full list per tenant DB for a short TTL
# so those repeat reads are served from memory instead of a full collection scan.
# Honours the same CACHE_ENABLED switch as the report cache.
_groups_cache: dict[str, tuple[float, list[dict]]] = {}
_groups_lock = threading.Lock()


def _db_key(db) -> str:
    return getattr(db, "name", "default")


def all_groups(db) -> list[dict]:
    if not aman_settings.CACHE_ENABLED:
        return list(db["groups"].find({}))
    key = _db_key(db)
    now = time.time()
    hit = _groups_cache.get(key)
    if hit and hit[0] > now:
        return hit[1]
    docs = list(db["groups"].find({}))
    with _groups_lock:
        _groups_cache[key] = (now + aman_settings.CACHE_TTL_SECONDS, docs)
    return docs


def group_by_name(db) -> dict[str, dict]:
    """Map groupName -> group document."""
    return {g.get("groupName"): g for g in all_groups(db) if g.get("groupName")}


def top_level_groups(db) -> list[dict]:
    """Primary groups (the L1 rows of the Trial Balance)."""
    return [g for g in all_groups(db)
            if (g.get("parentGroupName") in (None, "Primary")) or g.get("parentGroup") is None]


def group_root(group_path: str | None, fallback: str | None = None) -> str:
    """First segment of a groupPath: 'Current Assets > Bank Accounts' -> 'Current Assets'."""
    if group_path:
        return group_path.split(">")[0].strip()
    return fallback or "Suspense A/c"


def classification_of(group_doc: dict | None) -> str | None:
    if not group_doc:
        return None
    return (group_doc.get("nature") or {}).get("classification")


def nature_of(group_doc: dict | None) -> dict:
    return (group_doc or {}).get("nature") or {}
