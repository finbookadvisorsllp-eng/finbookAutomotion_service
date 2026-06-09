"""Customers / Vendors / Receivables / Payables / Outstanding / Credit limits.

Customers  = Sundry Debtors ledgers (closing debit = receivable).
Vendors    = Sundry Creditors ledgers (closing credit = payable).
Aging: bill-wise allocations are largely empty in the source data, so aging is
approximated by the age of each party's latest transaction and flagged in meta.
"""
from datetime import datetime

from app.aman.core.serializers import money, iso_date, fmt_date
from app.aman.repositories import ledger_repo, voucher_repo
from app.aman.services.accounting import compute_ledger_balances

DEBTOR_GROUPS = ["Sundry Debtors"]
CREDITOR_GROUPS = ["Sundry Creditors"]
AGING_BUCKETS = [(0, 30, "0–30 Days"), (31, 60, "31–60 Days"),
                 (61, 90, "61–90 Days"), (91, 10**9, "90+ Days")]
AGING_COLORS = {"0–30 Days": "#10b981", "31–60 Days": "#f59e0b",
                "61–90 Days": "#f97316", "90+ Days": "#ef4444"}


def _party_detail(ledger_doc: dict) -> dict:
    pd = (ledger_doc or {}).get("partyDetails") or {}
    addr = pd.get("address") or []
    city = addr[-1] if addr else None
    return {"gstin": pd.get("gstin"), "pan": pd.get("panNumber"),
            "city": city, "phone": pd.get("phone"), "email": pd.get("email"),
            "state": pd.get("gstState")}


def _bucket_for_days(days: int) -> str:
    for lo, hi, label in AGING_BUCKETS:
        if lo <= days <= hi:
            return label
    return "90+ Days"


def _parties(db, fy: str, group_names: list[str], sale_types: list[str], side: str):
    masters = {l["ledgerName"]: l for l in ledger_repo.ledgers_in_groups(db, group_names)}
    balances = compute_ledger_balances(db, fy)
    txn_totals = voucher_repo.party_totals(db, fy, sale_types)

    rows = []
    today = datetime.now()
    for name, master in masters.items():
        lb = balances.get(name)
        outstanding = 0.0
        if lb:
            outstanding = lb.closing_debit if side == "debit" else lb.closing_credit
        tx = txn_totals.get(name, {})
        last_date = tx.get("lastDate")
        days = (today - last_date).days if isinstance(last_date, datetime) else None
        status = "active"
        if outstanding > 0 and days is not None:
            if days > 90:
                status = "overdue"
            elif days > 60:
                status = "warning"
        elif outstanding == 0:
            status = "paid" if side == "credit" else "active"
        detail = _party_detail(master)
        rows.append({
            "id": str(master["_id"]),
            "name": name,
            "city": detail["city"],
            "gstin": detail["gstin"],
            "state": detail["state"],
            "phone": detail["phone"],
            "outstanding": money(outstanding),
            ("sales" if side == "debit" else "purchase"): money(tx.get("amount", 0)),
            "lastTxn": iso_date(last_date),
            "txnCount": tx.get("count", 0),
            "agingBucket": _bucket_for_days(days) if (days is not None and outstanding > 0) else None,
            "status": status,
        })
    rows.sort(key=lambda r: -r["outstanding"])
    return rows


def customers(db, fy: str) -> list[dict]:
    return _parties(db, fy, DEBTOR_GROUPS, ["Sales"], "debit")


def vendors(db, fy: str) -> list[dict]:
    return _parties(db, fy, CREDITOR_GROUPS, ["Purchase"], "credit")


def _aging(rows: list[dict]) -> list[dict]:
    buckets = {label: {"bucket": label, "amount": 0.0, "count": 0,
                       "color": AGING_COLORS[label]} for _, _, label in AGING_BUCKETS}
    for r in rows:
        b = r.get("agingBucket")
        if b and r["outstanding"] > 0:
            buckets[b]["amount"] = money(buckets[b]["amount"] + r["outstanding"])
            buckets[b]["count"] += 1
    total = sum(b["amount"] for b in buckets.values()) or 1
    out = list(buckets.values())
    for b in out:
        b["pct"] = round(b["amount"] / total * 100, 1)
    return out


def receivables(db, fy: str) -> dict:
    rows = [r for r in customers(db, fy) if r["outstanding"] > 0]
    return {"parties": rows, "aging": _aging(rows),
            "total": money(sum(r["outstanding"] for r in rows)),
            "dataCompleteness": "approximate"}


def payables(db, fy: str) -> dict:
    rows = [r for r in vendors(db, fy) if r["outstanding"] > 0]
    return {"parties": rows, "aging": _aging(rows),
            "total": money(sum(r["outstanding"] for r in rows)),
            "dataCompleteness": "approximate"}


def credit_limit(db, fy: str) -> list[dict]:
    masters = ledger_repo.ledgers_in_groups(db, DEBTOR_GROUPS)
    balances = compute_ledger_balances(db, fy)
    out = []
    for m in masters:
        name = m["ledgerName"]
        lb = balances.get(name)
        outstanding = lb.closing_debit if lb else 0.0
        limit = float(m.get("creditLimit") or (m.get("partyDetails") or {}).get("creditLimit") or 0)
        out.append({
            "id": str(m["_id"]), "name": name,
            "creditLimit": money(limit), "outstanding": money(outstanding),
            "available": money(limit - outstanding) if limit else None,
            "utilization": round(outstanding / limit * 100, 1) if limit else None,
            "exceeded": bool(limit and outstanding > limit),
        })
    return sorted(out, key=lambda r: -r["outstanding"])


def bills_due(db, fy: str) -> list[dict]:
    """Open purchase bills approximated from unpaid vendor invoices."""
    rows = [r for r in vendors(db, fy) if r["outstanding"] > 0]
    return [{"party": r["name"], "amount": r["outstanding"], "dueDate": r["lastTxn"],
             "status": r["status"], "gstin": r["gstin"]} for r in rows]
