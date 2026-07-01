"""Self-healing normalization for tenants whose Tally sync omitted the reserved
voucher parent class (``voucherTypeOrigName``).

Background
----------
The whole reporting engine classifies a document (Sales / Purchase / Credit Note
/ …) by Tally's **reserved parent class** ``voucherTypeOrigName`` — never by the
company-specific ``voucherTypeName`` — so the same code works for every tenant
without hardcoding company-specific names.

Some sync runs export only ``voucherTypeName`` (e.g. ``"Sales _Pulse"``) and leave
``voucherTypeOrigName`` null, carrying the reserved parent on the ``voucherTypes``
master instead (its ``parent`` field). When that happens every document register
reads zero for that tenant even though the data is present.

Fix
---
Backfill ``voucherTypeOrigName`` on the vouchers from the tenant's **own**
``voucherTypes`` master (``voucherTypeName -> parent``). This is pure data
normalization derived from the authoritative Tally master — no hardcoded names, no
keyword guessing, no per-tenant config. After it runs, the tenant behaves exactly
like a normally-synced one and the *standard* classification logic is used
unchanged. Idempotent: only ever fills missing values.
"""
import threading

# Tenants already checked in this process (db name -> done), so the guard runs
# once per process per tenant. A normally-synced tenant is a cheap no-op.
_checked: set[str] = set()
_lock = threading.Lock()

_MISSING = {"$or": [
    {"voucherTypeOrigName": None},
    {"voucherTypeOrigName": ""},
    {"voucherTypeOrigName": {"$exists": False}},
]}


def _name_to_parent(db) -> dict:
    """``voucherTypeName -> parent`` reserved class from the voucherTypes master."""
    out: dict[str, str] = {}
    for t in db["voucherTypes"].find({}, {"voucherTypeName": 1, "parent": 1, "voucherCategory": 1}):
        name = t.get("voucherTypeName")
        # ``parent`` is the reserved class ("Sales", "Purchase", …) the engine
        # matches on; fall back to voucherCategory only if parent is absent.
        parent = t.get("parent") or t.get("voucherCategory")
        if name and parent:
            out[name] = parent
    return out


def backfill_voucher_origin(db) -> dict:
    """Set ``voucherTypeOrigName`` from the voucherTypes master where it is missing.

    Returns a small summary dict. Safe to call repeatedly (idempotent)."""
    try:
        collections = db.list_collection_names()
    except Exception:
        return {"status": "error", "updated": 0}
    if "voucherTypes" not in collections or "vouchers" not in collections:
        return {"status": "no-master", "updated": 0}

    mapping = _name_to_parent(db)
    if not mapping:
        return {"status": "empty-master", "updated": 0}

    # Only the type-names that actually have unclassified vouchers — keeps this to a
    # handful of targeted updates instead of one scan per master entry.
    try:
        names = db["vouchers"].distinct("voucherTypeName", _MISSING)
    except Exception:
        names = list(mapping.keys())

    updated = 0
    skipped = 0
    for name in names:
        parent = mapping.get(name)
        if not parent:
            skipped += 1
            continue
        res = db["vouchers"].update_many(
            {**_MISSING, "voucherTypeName": name},
            {"$set": {"voucherTypeOrigName": parent}},
        )
        updated += res.modified_count
    return {"status": "ok", "masterTypes": len(mapping),
            "namesNormalized": len(names) - skipped, "updated": updated}


def ensure_voucher_origin(db, tenant_key: str) -> None:
    """Run the backfill at most once per process per tenant, only when needed.

    A fast existence probe keeps well-synced tenants a near-instant no-op (no
    writes). Designed to be fired from a background thread so it never blocks a
    request; all failures are swallowed (reporting must never break on a heal)."""
    if not tenant_key or tenant_key in _checked:
        return
    with _lock:
        if tenant_key in _checked:
            return
        _checked.add(tenant_key)
    try:
        gap = db["vouchers"].find_one(_MISSING, {"_id": 1})
        if gap:
            backfill_voucher_origin(db)
    except Exception:
        # Never let a maintenance heal surface as a report error.
        pass
