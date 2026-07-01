"""Outstanding Reports — Receivables & Payables (Tally Bills Receivable/Payable).

Design (CA + architect):
  * A party's outstanding is the **closing balance of its ledger** (opening ±
    voucher movement) — derived from the same accounting engine as the Trial
    Balance / Balance Sheet, so every figure reconciles to the rupee. Sundry
    Debtors with a debit balance are receivable; a credit balance is an advance
    received. Sundry Creditors mirror this on the payable side.
  * Receivable vs payable is decided **dynamically** by the ledger's primary
    group nature (ASSETS-side debtors vs LIABILITIES-side creditors) — never by
    hardcoded ledger names.
  * **Aging is bill-wise**: Tally ages each bill by its due date. This engine
    reads ``vouchers.ledgerEntries.billAllocations`` and buckets each open bill
    by age against a configurable set of buckets. When the sync has not exported
    bill allocations (``billAllocations`` empty, although ``isBillWiseOn`` is
    true in Tally), aging is reported as **unavailable** rather than fabricated.
  * Aging buckets are **configuration**, persisted per tenant in
    ``aman_aging_config`` so the cards, chart, table and export all read the
    same source of truth.

Nothing here is hardcoded: parties, balances, cities, buckets and status all
derive from MongoDB + the configured rules.
"""
from datetime import datetime

from app.aman.core.serializers import money, iso_date
from app.aman.repositories import group_repo, ledger_repo, voucher_repo
from app.aman.services.accounting import compute_ledger_balances
from app.aman.services.financial_year import fy_bounds

# Default aging buckets (days). `to: None` = open-ended (>= from).
DEFAULT_BUCKETS = [
    {"id": "b1", "label": "0-30 Days", "from": 0, "to": 30},
    {"id": "b2", "label": "31-60 Days", "from": 31, "to": 60},
    {"id": "b3", "label": "61-90 Days", "from": 61, "to": 90},
    {"id": "b4", "label": "Above 90 Days", "from": 91, "to": None},
]
_AGING_COLLECTION = "aman_aging_config"


# ─────────────────────────── classification (dynamic) ───────────────────────────
def _groups_by_subtype(db, subtype: str) -> list[str]:
    """Group names whose nature subType matches (e.g. SUNDRY_DEBTORS) — data-driven."""
    names = []
    for g in group_repo.all_groups(db):
        nat = (g.get("nature") or {})
        if nat.get("subType") == subtype or g.get("groupName") in _RESERVED.get(subtype, ()):
            names.append(g.get("groupName"))
    return names or list(_RESERVED.get(subtype, ()))


# Fallback only if the tenant's groups lack a subType (still Tally-standard names,
# not company-specific): receivables vs payables reserved groups.
_RESERVED = {
    "SUNDRY_DEBTORS": ("Sundry Debtors",),
    "SUNDRY_CREDITORS": ("Sundry Creditors",),
}


def _party_detail(ledger_doc: dict) -> dict:
    pd = (ledger_doc or {}).get("partyDetails") or {}
    addr = pd.get("address") or []
    city = addr[-1] if addr else None
    return {"gstin": pd.get("gstin"), "pan": pd.get("panNumber"),
            "city": city, "phone": pd.get("phone"), "email": pd.get("email"),
            "state": pd.get("gstState")}


# ─────────────────────────── party rows ───────────────────────────
def _party_rows(db, fy: str, side: str) -> list[dict]:
    """All open parties on one side. side='debit' (receivable) | 'credit' (payable)."""
    subtype = "SUNDRY_DEBTORS" if side == "debit" else "SUNDRY_CREDITORS"
    group_names = _groups_by_subtype(db, subtype)
    masters = {l["ledgerName"]: l for l in ledger_repo.ledgers_in_groups(db, group_names)}
    balances = compute_ledger_balances(db, fy)
    txn_types = ["Sales"] if side == "debit" else ["Purchase"]
    txn_totals = voucher_repo.party_totals(db, fy, txn_types)

    rows = []
    for name, master in masters.items():
        lb = balances.get(name)
        if not lb:
            continue
        outstanding = lb.closing_debit if side == "debit" else lb.closing_credit
        advance = lb.closing_credit if side == "debit" else lb.closing_debit  # opposite balance
        if outstanding <= 0 and advance <= 0:
            continue
        tx = txn_totals.get(name, {})
        det = _party_detail(master)
        rows.append({
            "id": str(master["_id"]),
            "name": name,
            "city": det["city"],
            "gstin": det["gstin"],
            "state": det["state"],
            "phone": det["phone"],
            "outstanding": money(outstanding),
            "advance": money(advance),
            "lastTxn": iso_date(tx.get("lastDate")),
            "txnCount": tx.get("count", 0),
            # No bill due dates in the synced data -> cannot assert "overdue".
            # Status is the honest, data-derived state; the bill-wise engine
            # upgrades it to overdue / due-soon once due dates are present.
            "status": "open" if outstanding > 0 else "advance",
            "nextDueDate": None,
        })
    return rows


def _sort_rows(rows, sort, order):
    key_map = {
        "name": lambda r: (r.get("name") or "").lower(),
        "city": lambda r: (r.get("city") or "").lower(),
        "outstanding": lambda r: r.get("outstanding") or 0,
        "lastTxn": lambda r: r.get("lastTxn") or "",
    }
    keyfn = key_map.get((sort or "outstanding"), key_map["outstanding"])
    return sorted(rows, key=keyfn, reverse=(order or "desc").lower() == "desc")


# ─────────────────────────── bill-wise aging engine (bill-ready) ───────────────────────────
def _collect_bill_allocations(db, fy: str, party_names: set[str]) -> list[dict]:
    """Open bills per party from voucher bill allocations. Empty until the sync
    exports ``billAllocations`` (today: 0 across all vouchers)."""
    bills = []
    match = voucher_repo.fy_match(fy, {"ledgerEntries.ledgerName": {"$in": list(party_names)}})
    cur = db["vouchers"].find(match, {"dates.date": 1, "ledgerEntries": 1})
    for v in cur:
        vdate = (v.get("dates") or {}).get("date")
        for e in v.get("ledgerEntries", []):
            if e.get("ledgerName") not in party_names:
                continue
            for b in (e.get("billAllocations") or []):
                bills.append({
                    "party": e.get("ledgerName"),
                    "billRef": b.get("name"),
                    "billDate": b.get("billDate") or vdate,
                    "dueDate": b.get("dueDate"),
                    "creditPeriod": b.get("creditPeriod"),
                    "amount": float(b.get("amount") or 0),
                })
    return bills


def _bucket_index(days: int, buckets: list[dict]) -> int | None:
    for i, b in enumerate(buckets):
        lo = b.get("from", 0) or 0
        hi = b.get("to")
        if hi is None:
            if days >= lo:
                return i
        elif lo <= days <= hi:
            return i
    return None


def compute_aging(db, fy: str, rows: list[dict], buckets: list[dict]) -> dict:
    """Bucket open bills by age against the configured buckets.

    Returns an ``available`` flag: ``False`` (with a reason) when the source data
    has no bill allocations / due dates, so the UI can show the buckets but
    clearly mark them as not-yet-computable rather than showing fabricated splits.
    """
    as_of = fy_bounds(fy)[1]
    party_names = {r["name"] for r in rows}
    bill_allocs = _collect_bill_allocations(db, fy, party_names)

    bucket_view = [{"id": b["id"], "label": b["label"], "from": b.get("from"),
                    "to": b.get("to"), "amount": 0.0, "count": 0, "pct": 0.0}
                   for b in buckets]
    overdue = not_due = 0.0

    if not bill_allocs:
        total_outstanding = money(sum(r["outstanding"] for r in rows))
        return {
            "available": False,
            "reason": ("Bill-wise allocations / due dates are not present in the synced "
                       "data, so age-wise outstanding cannot be derived. Re-sync "
                       "billAllocations from Tally to enable aging."),
            "asOf": iso_date(as_of),
            "buckets": bucket_view,
            "overdue": 0.0, "notDue": 0.0,
            "total": total_outstanding,
        }

    for bill in bill_allocs:
        due = bill["dueDate"] or bill["billDate"]
        if isinstance(due, str):
            try:
                due = datetime.fromisoformat(due.replace("Z", "+00:00"))
            except ValueError:
                due = None
        days = (as_of - due).days if isinstance(due, datetime) else 0
        amt = abs(bill["amount"])
        if days < 0:
            not_due += amt
        else:
            overdue += amt
        idx = _bucket_index(max(days, 0), buckets)
        if idx is not None:
            bucket_view[idx]["amount"] += amt
            bucket_view[idx]["count"] += 1

    total = sum(b["amount"] for b in bucket_view) or 1
    for b in bucket_view:
        b["amount"] = money(b["amount"])
        b["pct"] = round(b["amount"] / total * 100, 1)
    return {
        "available": True, "reason": None, "asOf": iso_date(as_of),
        "buckets": bucket_view, "overdue": money(overdue), "notDue": money(not_due),
        "total": money(sum(b["amount"] for b in bucket_view)),
    }


# ─────────────────────────── aging-bucket config (server-side) ───────────────────────────
def get_aging_buckets(db) -> list[dict]:
    doc = db[_AGING_COLLECTION].find_one({"_id": "default"})
    return (doc or {}).get("buckets") or DEFAULT_BUCKETS


def save_aging_buckets(db, buckets: list[dict]) -> list[dict]:
    cleaned = []
    for i, b in enumerate(buckets or []):
        frm = int(b.get("from") or 0)
        to = b.get("to")
        to = None if to in (None, "", "null") else int(to)
        label = f"{frm}-{to} Days" if to is not None else f"Above {max(frm - 1, 0)} Days"
        cleaned.append({"id": str(b.get("id") or f"b{i + 1}"), "label": label,
                        "from": frm, "to": to})
    if not cleaned:
        cleaned = DEFAULT_BUCKETS
    db[_AGING_COLLECTION].update_one({"_id": "default"}, {"$set": {"buckets": cleaned}}, upsert=True)
    return cleaned


def reset_aging_buckets(db) -> list[dict]:
    db[_AGING_COLLECTION].delete_one({"_id": "default"})
    return DEFAULT_BUCKETS


# ─────────────────────────── report builder (paginated) ───────────────────────────
def build_outstanding(db, fy: str, side: str, page: int = 1, limit: int = 10,
                      search: str | None = None, sort: str | None = None,
                      order: str = "desc", status: str | None = None) -> dict:
    rows = _party_rows(db, fy, side)
    buckets = get_aging_buckets(db)

    # summary + aging are computed over the FULL set (reconcile with the table)
    summary = {
        "total": money(sum(r["outstanding"] for r in rows)),
        "advanceTotal": money(sum(r["advance"] for r in rows)),
        "partyCount": sum(1 for r in rows if r["outstanding"] > 0),
    }
    aging = compute_aging(db, fy, [r for r in rows if r["outstanding"] > 0], buckets)

    # filter -> sort -> paginate (server-side)
    filtered = [r for r in rows if r["outstanding"] > 0]
    if search:
        q = search.strip().lower()
        filtered = [r for r in filtered
                    if q in (r.get("name") or "").lower() or q in (r.get("city") or "").lower()]
    if status:
        filtered = [r for r in filtered if r.get("status") == status]
    filtered = _sort_rows(filtered, sort, order)

    total_records = len(filtered)
    start = (page - 1) * limit
    page_rows = filtered[start:start + limit]

    return {
        "data": page_rows,
        "total_records": total_records,
        "summary": summary,
        "aging": aging,
        "buckets": buckets,
        "side": "receivable" if side == "debit" else "payable",
    }


def outstanding_by_party(db, fy: str, side: str = "debit") -> dict[str, float]:
    """``{ledgerName: outstanding}`` for one side — the same closing-balance figure
    the Outstanding report shows, so dashboard widgets (e.g. Top Customers "Due")
    reconcile to the rupee with Receivables / Payables. ``side='debit'`` for
    receivables (Sundry Debtors), ``'credit'`` for payables (Sundry Creditors)."""
    return {r["name"]: r["outstanding"] for r in _party_rows(db, fy, side)}


def receivables(db, fy: str, **kw) -> dict:
    return build_outstanding(db, fy, "debit", **kw)


def payables(db, fy: str, **kw) -> dict:
    return build_outstanding(db, fy, "credit", **kw)
