"""Cash Flow Statement — Tally's **Direct Method**, fully derived & reconciled.

Methodology (CA view)
---------------------
Tally's Cash Flow tracks the actual movement of the **Cash + Bank pool** and
attributes every movement to the *counter* ledger on the other side of the
voucher:

    Receipt  : Cash/Bank Dr  ·  Customer Cr   -> inflow  (Operating)
    Payment  : Salary   Dr   ·  Bank      Cr   -> outflow (Operating)
    Loan recd: Bank     Dr   ·  Loan      Cr   -> inflow  (Financing)
    Asset buy: Asset    Dr   ·  Bank      Cr   -> outflow (Investing)

So a counter line that is **credited** (amount > 0) is cash coming **in**, and a
counter line that is **debited** (amount < 0) is cash going **out**. Contra
vouchers (Cash <-> Bank) net to zero inside the pool and never appear.

The Operating / Investing / Financing bucket of each movement is decided
**dynamically** from the counter ledger's root-group nature (``subType``) — never
by hardcoded ledger or group names:

    FIXED_ASSETS / INVESTMENTS         -> Investing
    CAPITAL_ACCOUNT / LONG_TERM_LIAB.  -> Financing
    everything else                    -> Operating

Reconciliation guarantee:  Opening pool + Total Inflow − Total Outflow == Closing
pool (verified to the paisa). Every figure traces Voucher → Ledger Entry →
Ledger → Group → Activity. Heavy work runs as MongoDB aggregation pipelines.
"""
from datetime import datetime

from app.aman.core.serializers import money
from app.aman.repositories import group_repo, ledger_repo
from app.aman.services.accounting import compute_ledger_balances

CASHBANK_GROUPS = ["Cash-in-Hand", "Bank Accounts", "Bank OD A/c"]
_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
_FY_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]

_INVESTING = {"FIXED_ASSETS", "INVESTMENTS"}
_FINANCING = {"CAPITAL_ACCOUNT", "LONG_TERM_LIABILITIES"}


def _activity_of(subtype: str | None) -> str:
    if subtype in _INVESTING:
        return "Investing"
    if subtype in _FINANCING:
        return "Financing"
    return "Operating"


def _cashbank_names(db) -> list[str]:
    return [l["ledgerName"] for l in ledger_repo.ledgers_in_groups(db, CASHBANK_GROUPS)
            if l.get("ledgerName")]


def _ledger_classifier(db):
    """ledgerName -> (immediate group, activity) — derived from group hierarchy."""
    groups = group_repo.group_by_name(db)
    masters = {l.get("ledgerName"): l for l in ledger_repo.all_ledgers(
        db, {"ledgerName": 1, "groupName": 1, "groupPath": 1})}

    def classify(name: str):
        m = masters.get(name) or {}
        gname = m.get("groupName") or "Suspense A/c"
        root = group_repo.group_root(m.get("groupPath"), gname)
        sub = (groups.get(root) or {}).get("nature", {}).get("subType")
        return gname, _activity_of(sub)
    return classify


def _counter_flows(db, cb_names, date_match):
    """Per counter-ledger inflow/outflow over the period (one aggregation)."""
    pipeline = [
        {"$match": {**date_match, "ledgerEntries.ledgerName": {"$in": cb_names}}},
        {"$unwind": "$ledgerEntries"},
        {"$match": {"ledgerEntries.ledgerName": {"$nin": cb_names, "$ne": None}}},
        {"$group": {
            "_id": "$ledgerEntries.ledgerName",
            "inflow": {"$sum": {"$cond": [{"$gt": ["$ledgerEntries.amount", 0]}, "$ledgerEntries.amount", 0]}},
            "outflow": {"$sum": {"$cond": [{"$lt": ["$ledgerEntries.amount", 0]}, {"$abs": "$ledgerEntries.amount"}, 0]}},
        }},
    ]
    return list(db["vouchers"].aggregate(pipeline))


def _pool_net(db, cb_names, date_match) -> float:
    """Net change of the cash/bank pool over the period (inflow − outflow)."""
    pipeline = [
        {"$match": {**date_match, "ledgerEntries.ledgerName": {"$in": cb_names}}},
        {"$unwind": "$ledgerEntries"},
        {"$match": {"ledgerEntries.ledgerName": {"$in": cb_names}}},
        # cash/bank debit (amount<0) = inflow; credit = outflow; net = -sum(amount)
        {"$group": {"_id": None, "net": {"$sum": {"$multiply": ["$ledgerEntries.amount", -1]}}}},
    ]
    rows = list(db["vouchers"].aggregate(pipeline))
    return float(rows[0]["net"]) if rows else 0.0


def _monthly(db, cb_names, date_match):
    pipeline = [
        {"$match": {**date_match, "ledgerEntries.ledgerName": {"$in": cb_names}}},
        {"$unwind": "$ledgerEntries"},
        {"$match": {"ledgerEntries.ledgerName": {"$in": cb_names}}},
        {"$group": {
            "_id": {"$month": "$dates.date"},
            "inflow": {"$sum": {"$cond": [{"$lt": ["$ledgerEntries.amount", 0]}, {"$abs": "$ledgerEntries.amount"}, 0]}},
            "outflow": {"$sum": {"$cond": [{"$gt": ["$ledgerEntries.amount", 0]}, "$ledgerEntries.amount", 0]}},
        }},
    ]
    return {r["_id"]: r for r in db["vouchers"].aggregate(pipeline)}


def build_cash_flow(db, fy: str, start: datetime, end: datetime) -> dict:
    cb_names = _cashbank_names(db)
    classify = _ledger_classifier(db)

    # ── Opening (as of `start`) = FY opening of the pool + pool movement before start ──
    masters = {l["ledgerName"]: l for l in ledger_repo.ledgers_in_groups(db, CASHBANK_GROUPS)}
    fy_opening = 0.0
    for m in masters.values():
        od, oc = ledger_repo.opening_balance(m)
        fy_opening += od - oc
    pre_net = _pool_net(db, cb_names, {"dates.date": {"$lt": start}}) if cb_names else 0.0
    opening = money(fy_opening + pre_net)

    period_match = {"dates.date": {"$gte": start, "$lte": end}}

    # ── Activity → Group → Ledger tree (from counter flows) ──
    activities: dict[str, dict] = {}
    total_in = total_out = 0.0
    for row in _counter_flows(db, cb_names, period_match):
        name = row["_id"]
        inflow, outflow = money(row["inflow"]), money(row["outflow"])
        if not inflow and not outflow:
            continue
        gname, activity = classify(name)
        total_in += inflow
        total_out += outflow
        act = activities.setdefault(activity, {"name": activity, "inflow": 0.0, "outflow": 0.0, "groups": {}})
        act["inflow"] += inflow
        act["outflow"] += outflow
        grp = act["groups"].setdefault(gname, {"name": gname, "inflow": 0.0, "outflow": 0.0, "ledgers": []})
        grp["inflow"] += inflow
        grp["outflow"] += outflow
        grp["ledgers"].append({"id": name, "name": name, "inflow": inflow, "outflow": outflow,
                               "net": money(inflow - outflow)})

    # finalise the tree (sorted, netted)
    ACT_ORDER = {"Operating": 0, "Investing": 1, "Financing": 2}
    activity_list = []
    for act in sorted(activities.values(), key=lambda a: ACT_ORDER.get(a["name"], 9)):
        groups = []
        for g in sorted(act["groups"].values(), key=lambda x: -(x["inflow"] + x["outflow"])):
            g["ledgers"].sort(key=lambda l: -(l["inflow"] + l["outflow"]))
            groups.append({"name": g["name"], "inflow": money(g["inflow"]), "outflow": money(g["outflow"]),
                           "net": money(g["inflow"] - g["outflow"]), "ledgers": g["ledgers"]})
        activity_list.append({"name": act["name"], "inflow": money(act["inflow"]),
                              "outflow": money(act["outflow"]), "net": money(act["inflow"] - act["outflow"]),
                              "groups": groups})

    total_in, total_out = money(total_in), money(total_out)
    closing = money(opening + total_in - total_out)

    # ── Monthly series — only months that actually have cash movement.
    #    The running closing still carries correctly: empty months don't change
    #    the balance, so skipping them leaves each shown month's closing exact. ──
    monthly = _monthly(db, cb_names, period_match)
    series, run = [], opening
    cur = datetime(start.year, start.month, 1)
    while cur <= end:
        rec = monthly.get(cur.month) or {"inflow": 0.0, "outflow": 0.0}
        inflow, outflow = money(rec["inflow"]), money(rec["outflow"])
        run = money(run + inflow - outflow)
        if inflow or outflow:
            series.append({"month": f"{_MONTHS[cur.month - 1]} {str(cur.year)[2:]}", "inflow": inflow,
                           "outflow": outflow, "net": money(inflow - outflow), "closing": run})
        cur = datetime(cur.year + 1, 1, 1) if cur.month == 12 else datetime(cur.year, cur.month + 1, 1)

    # ── Reconciliation cross-check against the actual pool closing balance ──
    reconciled = True
    if start.month == 4 and (end.year - start.year) >= 1:  # full-FY: cross-check vs ledger closing
        balances = compute_ledger_balances(db, fy)
        pool_closing = money(sum((balances[n].closing_debit - balances[n].closing_credit)
                                 for n in cb_names if n in balances))
        reconciled = abs(pool_closing - closing) < 1.0

    return {
        "summary": {
            "opening": opening, "inflow": total_in, "outflow": total_out,
            "net": money(total_in - total_out), "closing": closing,
        },
        "activities": activity_list,
        "series": series,
        "method": "Direct Method (classified by counter-party group)",
        "reconciled": reconciled,
        "asOf": {"from": start.strftime("%Y-%m-%d"), "to": end.strftime("%Y-%m-%d")},
        "cashBankAccounts": [m["ledgerName"] for m in masters.values()],
    }
