"""Read access to the ``groups`` collection (chart-of-accounts skeleton)."""
from functools import lru_cache


def all_groups(db) -> list[dict]:
    return list(db["groups"].find({}))


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
