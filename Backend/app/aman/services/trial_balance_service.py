"""Trial Balance report — emits the exact shape the LiveTally UI consumes.

Frontend contract (src/data/trialBalanceData.js):
{
  years: [{id, label}],
  data: { "<fy>": { particulars: [ {id,name,debit,credit,isExpandable,
                                    children:[{id,name,debit,credit,isDrillable}]} ],
                    totalDebit, totalCredit, difference } }
}
"""
from app.aman.core.serializers import money
from app.aman.services.accounting import (
    compute_ledger_balances, group_rollup, trial_balance_totals)
from app.aman.services.financial_year import fy_label, list_financial_years
from app.aman.services.drilldown_service import voucher_list_for_ledger

# Conventional Tally presentation order for the primary groups.
TALLY_GROUP_ORDER = [
    "Fixed Assets", "Investments", "Current Assets", "Misc. Expenses (ASSET)",
    "Loans (Liability)", "Current Liabilities", "Capital Account",
    "Branch / Divisions", "Suspense A/c",
    "Sales Accounts", "Purchase Accounts", "Direct Incomes", "Direct Expenses",
    "Indirect Incomes", "Indirect Expenses", "Revenue Accounts",
    "Profit & Loss", "Primary", "Difference in Opening Balances",
]


def _order_key(name: str) -> tuple[int, str]:
    try:
        return (TALLY_GROUP_ORDER.index(name), name)
    except ValueError:
        return (len(TALLY_GROUP_ORDER), name)


def build_trial_balance(db, fy: str) -> dict:
    balances = compute_ledger_balances(db, fy)
    rollups = group_rollup(balances)
    total_debit, total_credit = trial_balance_totals(rollups)

    particulars = []
    for name in sorted(rollups, key=_order_key):
        ru = rollups[name]
        if not ru.debit and not ru.credit:
            continue
        children = [
            {"id": l["name"], "name": l["name"],
             "debit": money(l["debit"]), "credit": money(l["credit"]),
             "groupName": l.get("groupName"), "isDrillable": True}
            for l in sorted(ru.ledgers, key=lambda x: -(x["debit"] + x["credit"]))
        ]
        particulars.append({
            "id": name, "name": name,
            "debit": money(ru.debit), "credit": money(ru.credit),
            "classification": ru.classification,
            "isExpandable": len(children) > 0,
            "children": children,
        })

    return {
        "years": list_financial_years(db),
        "data": {
            fy: {
                "particulars": particulars,
                "totalDebit": total_debit,
                "totalCredit": total_credit,
                "difference": money(total_debit - total_credit),
            }
        },
        "fy": fy,
        "label": fy_label(fy),
    }


def group_ledgers(db, fy: str, group_id: str) -> dict:
    """L2 drill: the member ledgers of one group with their closing balances."""
    balances = compute_ledger_balances(db, fy)
    rollups = group_rollup(balances)
    ru = rollups.get(group_id)
    if not ru:
        return {"group": group_id, "ledgers": []}
    ledgers = [
        {"id": l["name"], "name": l["name"],
         "debit": money(l["debit"]), "credit": money(l["credit"]),
         "isDrillable": True}
        for l in sorted(ru.ledgers, key=lambda x: -(x["debit"] + x["credit"]))
    ]
    return {"group": group_id, "debit": money(ru.debit), "credit": money(ru.credit),
            "ledgers": ledgers}


def ledger_vouchers(db, fy: str, ledger_id: str, page: int, limit: int) -> tuple[list, int]:
    """L3 drill: vouchers that move a given ledger in the FY."""
    return voucher_list_for_ledger(db, fy, ledger_id, page=page, limit=limit)
