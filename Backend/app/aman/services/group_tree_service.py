"""Shared recursive group-tree engine — the single source of truth for the
account hierarchy used by both the Trial Balance and the Balance Sheet.

Tally presents accounts as a tree (Primary group -> sub-group -> ... -> ledger).
This module turns a flat ``{ledgerName: LedgerBalance}`` map plus the ``groups``
collection into that tree, deriving every parent/child link from
``groups.parentGroupName`` — never hardcoded. Each node carries a netted
(Debit, Credit) pair aggregated bottom-up.

node = {
  id, name, type:'group'|'ledger', debit, credit,
  isExpandable, isDrillable, classification?, groupName?, unmapped?, children:[node]
}

Both reports consume the same nodes so their numbers can never diverge.
"""
from collections import defaultdict

from app.aman.core.serializers import money
from app.aman.repositories import group_repo


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

    def build_group(gname: str) -> dict | None:
        children: list[dict] = []
        debit = credit = 0.0
        for cg in children_groups.get(gname, []):
            cn = build_group(cg)
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
        node = build_group(gname)
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
