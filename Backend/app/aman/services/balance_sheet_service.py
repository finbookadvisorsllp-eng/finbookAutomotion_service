"""Balance Sheet — Assets vs Liabilities at FY close, built on the *same*
recursive group-tree engine as the Trial Balance (single source of truth).

CA construction (so it always ties out):
  * Liabilities side = LIABILITIES-classified primary groups (Capital, Loans,
    Current Liabilities, Suspense, …) **plus Profit & Loss A/c** = brought-forward
    P&L balance + the current period's Net Profit (from ``pl_service``).
  * Assets side = ASSETS-classified primary groups (Fixed Assets, Investments,
    Current Assets, …) with **Closing Stock** added under Current Assets
    (the Trial Balance carries *opening* stock; the Balance Sheet carries
    *closing* stock).
  * Nominal accounts (Sales/Purchase/Direct/Indirect) never appear here — they
    are folded into Net Profit.

  Assets(excl. stock) + ClosingStock  ==  Liabilities + Capital + NetProfit + P&L b/f

Every KPI card and chart in the UI is derived from this one tree, so they can
never drift apart. No balances, mappings, groups, or rows are hardcoded.
"""
from app.aman.core.serializers import money
from app.aman.repositories import group_repo
from app.aman.services.accounting import compute_ledger_balances
from app.aman.services.group_tree_service import build_forest, find_node
from app.aman.services.inventory_service import closing_stock_value
from app.aman.services.pl_service import build_profit_loss
from app.aman.services.financial_year import fy_label

# Tally's reserved presentation order for each side (display only).
LIAB_ORDER = ["Capital Account", "Reserves & Surplus", "Loans (Liability)",
              "Current Liabilities", "Suspense A/c", "Branch / Divisions",
              "Profit & Loss A/c"]
ASSET_ORDER = ["Fixed Assets", "Investments", "Current Assets",
               "Loans & Advances (Asset)", "Deposits (Asset)", "Misc. Expenses (ASSET)"]
# Groups that make up Owner's Equity (capital + retained earnings).
EQUITY_GROUPS = {"Capital Account", "Reserves & Surplus", "Profit & Loss A/c"}

_CLOSING_STOCK_GROUP = "Current Assets"


def _order(name, order):
    try:
        return order.index(name)
    except ValueError:
        return len(order)


def _to_side_node(node: dict, side: str) -> dict:
    """Project a Dr/Cr tree node onto one Balance-Sheet column.

    ``amount`` is the net balance on the side's natural direction (assets =
    Dr−Cr, liabilities = Cr−Dr), recursively for every child.
    """
    debit = node.get("debit", 0.0)
    credit = node.get("credit", 0.0)
    amount = (debit - credit) if side == "asset" else (credit - debit)
    out = {
        "id": node["id"], "name": node["name"], "type": node["type"],
        "amount": money(amount),
        "isExpandable": node.get("isExpandable", False),
        "isDrillable": node.get("isDrillable", False),
    }
    if node.get("unmapped"):
        out["unmapped"] = True
    if node.get("children"):
        out["children"] = [_to_side_node(c, side) for c in node["children"]]
    return out


def _leaf_ledger_node(name: str, amount: float) -> dict:
    """A synthetic drillable ledger row (Closing Stock, Current Period Profit)."""
    return {"id": name, "name": name, "type": "ledger",
            "amount": money(amount), "isExpandable": False, "isDrillable": False}


def build_balance_sheet(db, fy: str) -> dict:
    balances = compute_ledger_balances(db, fy, include_stock=False)
    groups = group_repo.group_by_name(db)
    forest, unmapped = build_forest(balances, groups)

    assets: list[dict] = []
    liabilities: list[dict] = []
    pl_components: list[tuple[str, float]] = []   # (label, credit-positive amount)

    for node in forest:
        cls = node.get("classification")
        if node["type"] == "ledger":
            # primary-level reserved ledger (Profit & Loss A/c brought forward)
            amt = money(node.get("credit", 0) - node.get("debit", 0))
            if amt:
                pl_components.append(("Opening Balance", amt))
            continue
        if cls == "ASSETS":
            assets.append(_to_side_node(node, "asset"))
        elif cls == "LIABILITIES":
            liabilities.append(_to_side_node(node, "liability"))
        # INCOME / EXPENSE (nominal) -> excluded; captured via Net Profit below.

    # ── Closing Stock -> Current Assets ──
    closing_stock = closing_stock_value(db, fy)
    if closing_stock:
        ca = next((a for a in assets if a["name"] == _CLOSING_STOCK_GROUP), None)
        stock_row = _leaf_ledger_node("Closing Stock", closing_stock)
        if ca is None:
            assets.append({"id": _CLOSING_STOCK_GROUP, "name": _CLOSING_STOCK_GROUP,
                           "type": "group", "amount": money(closing_stock),
                           "isExpandable": True, "isDrillable": False,
                           "children": [stock_row]})
        else:
            ca.setdefault("children", []).append(stock_row)
            ca["amount"] = money(ca["amount"] + closing_stock)

    # ── Profit & Loss A/c = brought-forward balance + current-period result ──
    # CA rule (matches Tally): the P&L A/c is the one primary account with no
    # fixed side. A net CREDIT (profit) sits on the Liabilities side; a net DEBIT
    # (loss) sits on the Assets side. We place it dynamically by the sign of the
    # derived balance and always present a positive magnitude — the side is never
    # hardcoded, it follows the accounting result.
    pl = build_profit_loss(db, fy)
    net_profit = pl["years"][0]["summary"]["net"]        # credit-positive (loss < 0)
    pl_components.append(("Current Period", net_profit))
    pl_net_credit = money(sum(amt for _, amt in pl_components))

    on_liabilities = pl_net_credit >= 0                  # profit -> liabilities
    sign = 1 if on_liabilities else -1                   # show positive on its side
    pl_node = {
        "id": "Profit & Loss A/c", "name": "Profit & Loss A/c", "type": "group",
        "amount": money(sign * pl_net_credit),
        "isExpandable": True, "isDrillable": False,
        "side": "liability" if on_liabilities else "asset",
        "children": [_leaf_ledger_node(label, money(sign * amt)) for label, amt in pl_components],
    }
    (liabilities if on_liabilities else assets).append(pl_node)

    assets.sort(key=lambda b: _order(b["name"], ASSET_ORDER))
    liabilities.sort(key=lambda b: _order(b["name"], LIAB_ORDER))

    total_assets = money(sum(b["amount"] for b in assets))
    total_liab = money(sum(b["amount"] for b in liabilities))
    difference = money(total_assets - total_liab)

    kpis, charts = _derive_dashboard(assets, liabilities, pl_net_credit,
                                     total_assets, total_liab)

    result = {
        "fy": fy,
        "label": fy_label(fy),
        "asOf": fy_label(fy).split(" - ")[-1],
        "liabilities": liabilities,
        "assets": assets,
        "totals": {"assets": total_assets, "liabilities": total_liab, "difference": difference},
        "kpis": kpis,
        "charts": charts,
        "netProfit": net_profit,
        "closingStock": closing_stock,
    }
    meta = {}
    if difference != 0:
        meta["reconciliation"] = (
            f"Balance Sheet does not tie out by {difference:,.2f}. "
            "Assets must equal Liabilities + Equity — investigate the difference.")
    if unmapped:
        meta["unmappedLedgers"] = unmapped
    if pl.get("stockInfo", {}).get("closingStockSource") == "computed" and pl.get("stockInfo", {}).get("oversoldItemCount"):
        meta["stockNote"] = pl["stockInfo"].get("note")
    if meta:
        result["meta"] = meta
    return result


def _group_amount(side_nodes: list[dict], name: str) -> float:
    n = next((g for g in side_nodes if g["name"] == name), None)
    return n["amount"] if n else 0.0


def _derive_dashboard(assets, liabilities, pl_net_credit, total_assets, total_liab) -> tuple[dict, dict]:
    """All KPI cards + charts come from the same tree — never recomputed.

    ``pl_net_credit`` is the signed retained-earnings (profit +, loss −), so
    Owner's Equity is correct regardless of which side the P&L A/c is displayed.
    """
    current_assets = _group_amount(assets, "Current Assets")
    current_liab = _group_amount(liabilities, "Current Liabilities")
    capital_reserves = money(sum(g["amount"] for g in liabilities
                                 if g["name"] in ("Capital Account", "Reserves & Surplus")))
    owners_equity = money(capital_reserves + pl_net_credit)

    kpis = {
        "totalAssets": total_assets,
        "currentAssets": current_assets,
        "totalLiabilities": total_liab,
        "ownersEquity": owners_equity,
        "workingCapital": money(current_assets - current_liab),
    }

    def composition(nodes, total):
        rows = []
        for g in nodes:
            if g["amount"] <= 0:
                continue
            rows.append({"name": g["name"], "value": g["amount"],
                         "pct": round((g["amount"] / total * 100), 1) if total else 0.0})
        return rows

    # Equity slices: capital/reserves + the P&L A/c only when it is a profit
    # (a loss is a negative contribution and cannot be a pie slice).
    equity_nodes = [g for g in liabilities if g["name"] in ("Capital Account", "Reserves & Surplus")]
    if pl_net_credit > 0:
        pl_node = next((g for s in (liabilities, assets) for g in s if g["name"] == "Profit & Loss A/c"), None)
        if pl_node:
            equity_nodes = equity_nodes + [pl_node]
    liab_only_nodes = [g for g in liabilities if g["name"] not in EQUITY_GROUPS]
    charts = {
        "assetsComposition": composition(assets, total_assets),
        "liabilitiesComposition": composition(
            liab_only_nodes, money(sum(g["amount"] for g in liab_only_nodes if g["amount"] > 0))),
        "equityComposition": composition(
            equity_nodes, money(sum(g["amount"] for g in equity_nodes if g["amount"] > 0))),
        "assetsVsLiabilities": [
            {"name": "Assets", "value": total_assets},
            {"name": "Liabilities", "value": total_liab},
        ],
    }
    return kpis, charts


# ─────────────────────────── drill-down ───────────────────────────
def group_children(db, fy: str, group_id: str) -> dict:
    """Immediate children (sub-groups + ledgers) of any Balance-Sheet node."""
    bs = build_balance_sheet(db, fy)
    node = find_node(bs["assets"], group_id) or find_node(bs["liabilities"], group_id)
    if not node:
        return {"group": group_id, "children": []}
    return {"group": group_id, "amount": node.get("amount"),
            "children": node.get("children", [])}
