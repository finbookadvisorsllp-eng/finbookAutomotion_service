"""Cash & Bank module — accounts, ledger statements with running balance.

Accounts = ledgers in groups 'Bank Accounts' + 'Cash-in-Hand'. For an asset
account, money IN is a Debit (amount<0) and money OUT is a Credit (amount>0):
    receipt  = debit line magnitude
    payment  = credit line magnitude
"""
from datetime import datetime

from app.aman.core.serializers import money, fmt_date, iso_date
from app.aman.repositories import ledger_repo, voucher_repo
from app.aman.services.accounting import compute_ledger_balances

CASH_GROUPS = ["Cash-in-Hand"]
BANK_GROUPS = ["Bank Accounts", "Bank OD A/c"]
MOVEMENT_TYPES = ["Payment", "Receipt", "Contra", "Journal"]
_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _accounts(db):
    cash = ledger_repo.ledgers_in_groups(db, CASH_GROUPS)
    bank = ledger_repo.ledgers_in_groups(db, BANK_GROUPS)
    return cash, bank


def dashboard(db, fy: str) -> dict:
    cash, bank = _accounts(db)
    balances = compute_ledger_balances(db, fy)

    def acc_row(m):
        name = m["ledgerName"]
        lb = balances.get(name)
        closing = (lb.closing_debit - lb.closing_credit) if lb else 0.0
        opening = (lb.opening_debit - lb.opening_credit) if lb else 0.0
        return {"id": str(m["_id"]), "name": name, "balance": money(closing),
                "opening": money(opening)}

    cash_accounts = [acc_row(m) for m in cash]
    bank_accounts = [acc_row(m) for m in bank]
    cash_total = money(sum(a["balance"] for a in cash_accounts))
    bank_total = money(sum(a["balance"] for a in bank_accounts))

    # Recent transactions across all cash/bank accounts
    names = [m["ledgerName"] for m in cash + bank]
    recent = []
    if names:
        docs = voucher_repo.find(
            db, voucher_repo.fy_match(fy, {"ledgerEntries.ledgerName": {"$in": names}}),
            projection={"voucherNumber": 1, "voucherTypeName": 1, "partyLedgerName": 1,
                        "dates.date": 1, "totals.totalDebit": 1},
            sort=[("dates.date", -1)], limit=10)
        for v in docs:
            recent.append({
                "id": v.get("voucherNumber"),
                "date": fmt_date((v.get("dates") or {}).get("date")),
                "party": v.get("partyLedgerName") or "",
                "type": v.get("voucherTypeName"),
                "amount": money((v.get("totals") or {}).get("totalDebit") or 0),
            })

    all_accounts = []
    for m in cash + bank:
        name = m["ledgerName"]
        lb = balances.get(name)
        all_accounts.append({
            "id": str(m["_id"]), "name": name,
            "type": "Cash" if m in cash else "Bank",
            "opening": money((lb.opening_debit - lb.opening_credit) if lb else 0),
            "receipts": money(lb.movement_debit if lb else 0),
            "payments": money(lb.movement_credit if lb else 0),
            "closing": money((lb.closing_debit - lb.closing_credit) if lb else 0),
        })

    return {
        "summary": {
            "cashInHand": cash_total,
            "bankBalance": bank_total,
            "totalBalance": money(cash_total + bank_total),
            "accountsCount": len(all_accounts),
        },
        "cashAccounts": cash_accounts,
        "bankAccounts": bank_accounts,
        "recentTransactions": recent,
        "allAccounts": all_accounts,
    }


def cash_flow(db, fy: str) -> dict:
    """Monthly inflow/outflow across all cash + bank accounts (Cash Flow page)."""
    cash, bank = _accounts(db)
    names = [m["ledgerName"] for m in cash + bank]
    mov = voucher_repo.monthly_ledger_movement(db, fy, names)
    from app.aman.services.financial_year import FY_MONTH_ORDER
    series = []
    for mnum in FY_MONTH_ORDER:
        rec = mov.get(mnum, {"debit": 0.0, "credit": 0.0})
        inflow = rec["debit"]    # money into bank/cash = debit
        outflow = rec["credit"]  # money out = credit
        series.append({"month": _MONTHS[mnum - 1], "inflow": money(inflow),
                       "outflow": money(outflow), "net": money(inflow - outflow)})
    total_in = money(sum(s["inflow"] for s in series))
    total_out = money(sum(s["outflow"] for s in series))
    return {"series": series, "totalInflow": total_in, "totalOutflow": total_out,
            "netCashFlow": money(total_in - total_out)}


def ledger_detail(db, fy: str, account_id: str) -> dict:
    master = ledger_repo.find_ledger(db, account_id)
    if not master:
        return {}
    name = master["ledgerName"]
    balances = compute_ledger_balances(db, fy)
    lb = balances.get(name)
    opening = (lb.opening_debit - lb.opening_credit) if lb else 0.0

    docs = voucher_repo.vouchers_for_ledger(db, fy, name, sort_dir=1)
    transactions = []
    running = opening
    monthly = {}
    for v in docs:
        receipts = payments = 0.0
        for e in v.get("ledgerEntries", []):
            if e.get("ledgerName") == name:
                amt = float(e.get("amount") or 0)
                if amt < 0:
                    receipts += abs(amt)
                else:
                    payments += amt
        running += receipts - payments
        d = (v.get("dates") or {}).get("date")
        transactions.append({
            "id": v.get("voucherNumber"),
            "date": fmt_date(d), "isoDate": iso_date(d),
            "party": v.get("partyLedgerName") or "",
            "type": v.get("voucherTypeName"),
            "no": v.get("voucherNumber"),
            "ref": ((v.get("reference") or {}).get("reference") if isinstance(v.get("reference"), dict) else "") or "",
            "receipts": money(receipts), "payments": money(payments),
            "running": money(running),
        })
        if isinstance(d, datetime):
            mk = _MONTHS[d.month - 1]
            mrec = monthly.setdefault(mk, {"month": mk, "receipts": 0.0, "payments": 0.0})
            mrec["receipts"] += receipts
            mrec["payments"] += payments

    # Build monthly opening/closing chain
    monthly_list = []
    run = opening
    # order months by appearance in FY
    from app.aman.services.financial_year import FY_MONTH_ORDER
    for mnum in FY_MONTH_ORDER:
        mk = _MONTHS[mnum - 1]
        if mk in monthly:
            rec = monthly[mk]
            o = run
            run = o + rec["receipts"] - rec["payments"]
            monthly_list.append({"month": mk, "opening": money(o),
                                 "receipts": money(rec["receipts"]),
                                 "payments": money(rec["payments"]), "closing": money(run)})

    return {
        "id": str(master["_id"]),
        "name": name,
        "type": master.get("groupName"),
        "openingBalance": money(opening),
        "currentBalance": money((lb.closing_debit - lb.closing_credit) if lb else 0),
        "transactions": transactions,
        "monthly": monthly_list,
    }
