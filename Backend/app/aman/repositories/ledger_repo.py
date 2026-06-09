"""Read access to the ``ledgers`` collection (postable accounts)."""


def all_ledgers(db, projection: dict | None = None) -> list[dict]:
    return list(db["ledgers"].find({}, projection))


def ledger_by_name(db) -> dict[str, dict]:
    return {l.get("ledgerName"): l for l in all_ledgers(db) if l.get("ledgerName")}


def ledgers_in_groups(db, group_names: list[str], projection: dict | None = None) -> list[dict]:
    return list(db["ledgers"].find({"groupName": {"$in": group_names}}, projection))


def ledgers_in_group(db, group_name: str, projection: dict | None = None) -> list[dict]:
    return list(db["ledgers"].find({"groupName": group_name}, projection))


def find_ledger(db, ident: str) -> dict | None:
    """Resolve a ledger by name, ledgerCode, or ObjectId string."""
    from bson import ObjectId
    doc = db["ledgers"].find_one({"ledgerName": ident})
    if doc:
        return doc
    doc = db["ledgers"].find_one({"ledgerCode": ident})
    if doc:
        return doc
    try:
        return db["ledgers"].find_one({"_id": ObjectId(ident)})
    except Exception:
        return None


def opening_balance(ledger_doc: dict) -> tuple[float, float]:
    """Return (opening_debit, opening_credit) from a ledger master document.

    NOTE: the ``type`` field on openingBalance is unreliable (always "DEBIT" in
    the live data). The SIGN of ``amount`` is authoritative — same rule as
    voucher entries:  amount < 0 -> Debit, amount > 0 -> Credit.
    """
    ob = (ledger_doc.get("balances") or {}).get("openingBalance") or {}
    amt = float(ob.get("amount") or 0)
    if amt < 0:
        return abs(amt), 0.0
    if amt > 0:
        return 0.0, amt
    return 0.0, 0.0
