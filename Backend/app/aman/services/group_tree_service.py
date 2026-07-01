"""Shared recursive group-tree engine — the single source of truth for the
account hierarchy used by both the Trial Balance and the Balance Sheet.

Tally presents accounts as a tree (Primary group -> sub-group -> ... -> ledger).
This module turns a flat ``{ledgerName: LedgerBalance}`` map plus the ``groups``
collection into that tree, deriving every parent/child link from
``groups.parentGroupName`` — never hardcoded. Each node carries a netted
(Debit, Credit) pair aggregated bottom-up.

Tally's Trial Balance netting (reproduced here from the ``groups`` masters, not
hardcoded per company):

* Every ledger always shows its net closing balance on a single side.
* A GROUP is **netted to one side** (its opposite-side members cancel out) UNLESS
  Tally keeps it "bill-wise" — i.e. a party control account (Sundry Debtors,
  Sundry Creditors, Branch/Divisions, …) where a debtor who owes must never be
  netted against a debtor in credit. That behaviour is carried per group by
  ``behaviour.isBillWiseOn``.
* A bill-wise group (and a *primary* group that directly owns one) is therefore
  shown with **separate Debit and Credit columns**; every other group collapses
  to a single net side. When a group collapses, its whole subtree collapses with
  it (Tally does not resurrect a bill-wise flag under a netted parent — e.g.
  Sundry Debtors nets even though its branch sub-groups are bill-wise).

This is what makes the report tie to Tally's Grand Total to the rupee for every
tenant, because netting removes ``min(debit, credit)`` from *both* column totals
equally and so can never unbalance the Trial Balance.

node = {
  id, name, type:'group'|'ledger', debit, credit,
  isExpandable, isDrillable, classification?, groupName?, unmapped?, children:[node]
}

Both reports consume the same nodes so their numbers can never diverge.
"""
from collections import defaultdict

from app.aman.core.serializers import money
from app.aman.repositories import group_repo


def _net_sides(debit: float, credit: float) -> tuple[float, float]:
    """Collapse a (debit, credit) pair to a single net side (one side is 0)."""
    net = round(debit - credit, 2)
    return (net, 0.0) if net >= 0 else (0.0, -net)


def _ledger_node(lb, unmapped: bool = False) -> dict:
    cd, cc = lb.closing_debit, lb.closing_credit
    node = {
        "id": lb.name, "name": lb.name, "type": "ledger",
        "debit": money(cd), "credit": money(cc),
        "isExpandable": False, "isDrillable": True,
        "groupName": lb.group_name,
    }
    if unmapped:
        node["unmapped"] = True
    return node


def build_forest(balances: dict, groups_by_name: dict) -> tuple[list[dict], list[str]]:
    """Return (top_level_nodes, unmapped_ledger_names).

    ``top_level_nodes`` = every primary group that has a balance, plus any
    primary-level reserved ledgers (e.g. Profit & Loss A/c). Order is the data's
    natural order; callers sort as they wish.
    """
    by_name = groups_by_name

    children_groups: dict[str, list[str]] = defaultdict(list)
    for g in by_name.values():
        children_groups[g.get("parentGroupName")].append(g.get("groupName"))

    ledgers_in_group: dict[str, list] = defaultdict(list)
    primary_ledgers: list = []
    unmapped_names: list[str] = []
    for lb in balances.values():
        if not (lb.closing_debit or lb.closing_credit):
            continue
        gname = lb.group_name
        if gname is None:
            ledgers_in_group["Suspense A/c"].append((lb, True))
            unmapped_names.append(lb.name)
        elif gname == "Primary" or gname not in by_name:
            primary_ledgers.append(lb)
        else:
            ledgers_in_group[gname].append((lb, False))

    def _is_billwise(gname: str) -> bool:
        return bool(((by_name.get(gname) or {}).get("behaviour") or {}).get("isBillWiseOn"))

    def _shows_both_sides(gname: str, is_primary: bool) -> bool:
        """Whether this group keeps separate Dr/Cr columns (Tally bill-wise view).

        True when the group itself is bill-wise, or when a *primary* group directly
        parents a bill-wise sub-group (Sundry Creditors under Current Liabilities,
        the branch account under Branch/Divisions). Everything else collapses to a
        single net side. The primary restriction is deliberate: a non-primary
        holder (e.g. Provisions parenting a bill-wise salary-creditor sub-group) is
        netted by Tally, so bill-wise flags only "surface" at the top level."""
        if _is_billwise(gname):
            return True
        if is_primary:
            return any(_is_billwise(cg) for cg in children_groups.get(gname, []))
        return False

    def build_group(gname: str, is_primary: bool, force_net: bool) -> dict | None:
        # A collapsing ancestor forces this whole subtree onto one net side.
        both = (not force_net) and _shows_both_sides(gname, is_primary)
        child_force = force_net or (not both)
        children: list[dict] = []
        debit = credit = 0.0
        for cg in children_groups.get(gname, []):
            cn = build_group(cg, is_primary=False, force_net=child_force)
            if cn:
                children.append(cn)
                debit += cn["debit"]
                credit += cn["credit"]
        for lb, unmapped in sorted(ledgers_in_group.get(gname, []),
                                   key=lambda x: -(x[0].closing_debit + x[0].closing_credit)):
            ln = _ledger_node(lb, unmapped)
            children.append(ln)
            debit += ln["debit"]
            credit += ln["credit"]
        if not children:
            return None
        if not both:
            debit, credit = _net_sides(debit, credit)
        g = by_name.get(gname) or {}
        return {
            "id": gname, "name": gname, "type": "group",
            "debit": money(debit), "credit": money(credit),
            "isExpandable": True, "isDrillable": False,
            "classification": group_repo.classification_of(g),
            "children": children,
        }

    top_nodes: list[dict] = []
    for gname in children_groups.get("Primary", []):
        node = build_group(gname, is_primary=True, force_net=False)
        if node:
            top_nodes.append(node)
    for lb in primary_ledgers:
        top_nodes.append(_ledger_node(lb))

    return top_nodes, unmapped_names


def find_node(nodes: list[dict], node_id: str) -> dict | None:
    """Depth-first search for a group/ledger node by id (for drill-down)."""
    for n in nodes:
        if n.get("id") == node_id:
            return n
        if n.get("children"):
            found = find_node(n["children"], node_id)
            if found:
                return found
    return None
