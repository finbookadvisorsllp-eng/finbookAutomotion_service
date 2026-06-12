"""Trial Balance report — a faithful, fully data-driven model of Tally's
Group Summary hierarchy.

Tally's Trial Balance is a **tree**: Primary group -> sub-group -> sub-sub-group
-> ledger. Every level shows a netted (Debit, Credit) pair where members that
net to a debit are summed into the Debit column and members that net to a credit
into the Credit column. We reconstruct that tree purely from the data:

* the group hierarchy comes from ``groups.parentGroupName`` / ``groups.groupPath``
  (never hardcoded),
* ledger placement comes from each ledger's ``groupName``,
* balances come from :func:`compute_ledger_balances` (opening ± movement).

The only presentation constant is the order in which Tally lists its reserved
*primary* groups (identical for every Tally company); membership, structure and
every number are derived.

Frontend contract (recursive):
{
  years: [{id,label}],
  data: { "<fy>": { particulars: [node], totalDebit, totalCredit, difference } }
}
node = { id, name, type:'group'|'ledger', debit, credit,
         isExpandable, isDrillable, classification?, unmapped?, children:[node] }
"""
from app.aman.core.serializers import money
from app.aman.repositories import group_repo
from app.aman.services.accounting import compute_ledger_balances
from app.aman.services.group_tree_service import build_forest, find_node
from app.aman.services.financial_year import fy_label, list_financial_years
from app.aman.services.drilldown_service import voucher_list_for_ledger

# Tally's universal reserved primary-group presentation order (Liabilities ->
# Assets -> Revenue). This is a Tally convention identical across every company,
# not company data. Unknown groups fall to the end, alphabetically.
TALLY_PRIMARY_ORDER = [
    "Capital Account", "Loans (Liability)", "Current Liabilities",
    "Suspense A/c", "Branch / Divisions",
    "Fixed Assets", "Investments", "Current Assets",
    "Loans & Advances (Asset)", "Deposits (Asset)", "Misc. Expenses (ASSET)",
    "Sales Accounts", "Purchase Accounts",
    "Direct Incomes", "Income (Direct)", "Direct Expenses", "Expenses (Direct)",
    "Indirect Incomes", "Income (Indirect)", "Indirect Expenses", "Expenses (Indirect)",
    "Revenue Accounts", "Profit & Loss A/c", "Difference in Opening Balances",
]
# Reserved name Tally uses for the P&L primary account; the P&L ledger sits here.
_PL_PRIMARY = "Profit & Loss A/c"


def _order_key(name: str) -> tuple[int, str]:
    try:
        return (TALLY_PRIMARY_ORDER.index(name), name)
    except ValueError:
        return (len(TALLY_PRIMARY_ORDER), name or "")


def _build_tree(db, fy: str):
    """Return (top_nodes, total_debit, total_credit, meta) for the FY.

    Uses the shared :mod:`group_tree_service` so the Trial Balance and Balance
    Sheet share one hierarchy engine. Trial Balance shows *all* primary groups,
    sorted into Tally's reserved presentation order.
    """
    balances = compute_ledger_balances(db, fy)
    groups = group_repo.group_by_name(db)
    top_nodes, unmapped_names = build_forest(balances, groups)

    top_nodes.sort(key=lambda n: _order_key(n["name"]))
    total_debit = money(sum(n["debit"] for n in top_nodes))
    total_credit = money(sum(n["credit"] for n in top_nodes))
    meta = {"unmappedLedgers": unmapped_names}
    return top_nodes, total_debit, total_credit, meta


def build_trial_balance(db, fy: str) -> dict:
    particulars, total_debit, total_credit, meta = _build_tree(db, fy)
    result = {
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
    if meta["unmappedLedgers"]:
        result["meta"] = {
            "unmappedLedgers": meta["unmappedLedgers"],
            "note": (
                "These ledgers appear in vouchers but have no master record, so "
                "they cannot be assigned to a group and are shown under Suspense A/c. "
                "Re-sync the ledger masters from Tally to classify them correctly."
            ),
        }
    return result


def group_ledgers(db, fy: str, group_id: str) -> dict:
    """L2+ drill: the immediate children (sub-groups + ledgers) of one group.

    Works at any depth of the tree, so the drill-down mirrors Tally's Group
    Summary navigation (Current Liabilities -> Duties & Taxes -> Output -> ledger).
    """
    particulars, *_ = _build_tree(db, fy)
    node = find_node(particulars, group_id)
    if not node:
        return {"group": group_id, "children": [], "ledgers": []}
    children = node.get("children", [])
    return {
        "group": group_id,
        "debit": node["debit"],
        "credit": node["credit"],
        "classification": node.get("classification"),
        "children": children,
        # legacy key: flat ledger list (immediate ledgers only) for older callers
        "ledgers": [c for c in children if c.get("type") == "ledger"],
    }


def ledger_vouchers(db, fy: str, ledger_id: str, page: int, limit: int) -> tuple[list, int]:
    """Leaf drill: vouchers that move a given ledger in the FY."""
    return voucher_list_for_ledger(db, fy, ledger_id, page=page, limit=limit)
