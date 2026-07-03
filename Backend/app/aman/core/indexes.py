"""Idempotent MongoDB index creation for a tenant database (aman module only).

The aman reports query the ``vouchers`` collection heavily, always filtering by
``dates.date`` and frequently by ledger / party / voucher-type. Without these
indexes every aggregation pipeline is a full collection scan. Indexes are created
lazily per tenant DB (see ``core.dependencies.get_db``) in a background thread,
exactly once per process, and ``create_index`` is idempotent so this is safe to
call repeatedly. Nothing here touches collections outside the aman data model.
"""

# (collection, keys) — keys is a list of (field, direction) tuples. Compound
# indexes lead with the most selective equality field and end with the range
# field (``dates.date``) so a single index serves both filter + sort.
_INDEXES: list[tuple[str, list[tuple[str, int]]]] = [
    ("vouchers", [("dates.date", 1)]),                              # FY / date-range filtering
    ("vouchers", [("voucherTypeOrigName", 1), ("dates.date", 1)]), # doc_base_match (Sales/Purchase)
    ("vouchers", [("voucherTypeName", 1), ("dates.date", 1)]),     # type-based registers
    ("vouchers", [("partyLedgerName", 1), ("dates.date", 1)]),     # party grouping
    ("vouchers", [("ledgerEntries.ledgerName", 1), ("dates.date", 1)]),  # ledger drill-downs
    ("ledgers", [("ledgerName", 1)]),
    ("ledgers", [("groupName", 1)]),
    ("groups", [("groupName", 1)]),
    ("stockItems", [("name", 1)]),
]


def ensure_indexes(db) -> None:
    """Create the aman report indexes on ``db`` if they don't already exist."""
    for coll, keys in _INDEXES:
        try:
            db[coll].create_index(keys)
        except Exception:
            # Never let index creation break a request (e.g. read-only replica, or
            # a conflicting legacy index). Reports still work without the index —
            # just slower.
            pass
