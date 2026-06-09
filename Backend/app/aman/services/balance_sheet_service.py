"""Balance Sheet — Assets vs Liabilities at FY close.

Uses ledger closing balances (excluding the opening-stock injection), adds the
computed Closing Stock as a Current Asset, and the period Net Profit to the
liabilities side. By construction this ties out:

    Assets(excl stock) + ClosingStock == Liabilities + Capital + NetProfit
"""
from app.aman.core.serializers import money
from app.aman.repositories import group_repo
from app.aman.services.accounting import compute_ledger_balances
from app.aman.services.inventory_service import closing_stock_value
from app.aman.services.pl_service import build_profit_loss
from app.aman.services.financial_year import fy_label

ASSET_ORDER = ["Fixed Assets", "Investments", "Current Assets",
               "Loans & Advances (Asset)", "Misc. Expenses (ASSET)"]
LIAB_ORDER = ["Capital Account", "Reserves & Surplus", "Loans (Liability)",
              "Current Liabilities", "Branch / Divisions", "Suspense A/c"]


def _order(name, order):
    try:
        return order.index(name)
    except ValueError:
        return len(order)


def build_balance_sheet(db, fy: str) -> dict:
    balances = compute_ledger_balances(db, fy, include_stock=False)
    groups = group_repo.group_by_name(db)

    assets: dict[str, dict] = {}
    liabilities: dict[str, dict] = {}

    for lb in balances.values():
        root = lb.root_group
        classification = group_repo.classification_of(groups.get(root))
        cd, cc = lb.closing_debit, lb.closing_credit
        if classification == "ASSETS":
            net = money(cd - cc)
            if net == 0:
                continue
            bucket = assets.setdefault(root, {"group": root, "total": 0.0, "ledgers": {}})
            bucket["ledgers"][lb.name] = net
            bucket["total"] = money(bucket["total"] + net)
        elif classification == "LIABILITIES":
            net = money(cc - cd)
            if net == 0:
                continue
            bucket = liabilities.setdefault(root, {"group": root, "total": 0.0, "ledgers": {}})
            bucket["ledgers"][lb.name] = net
            bucket["total"] = money(bucket["total"] + net)
        elif classification in ("INCOME", "EXPENSE"):
            # Revenue/expense accounts are represented via the period Net Profit
            # added to the liabilities side below — exclude them here.
            continue
        else:
            # Truly unclassified groups ("Profit & Loss", "Revenue Accounts"):
            # the brought-forward P&L balance belongs to equity. Net credit ->
            # liabilities (may be negative for an accumulated loss b/f).
            net = money(cc - cd)
            if net == 0:
                continue
            bucket = liabilities.setdefault("Profit & Loss A/c",
                                            {"group": "Profit & Loss A/c", "total": 0.0, "ledgers": {}})
            bucket["ledgers"][lb.name + " (B/f)"] = net
            bucket["total"] = money(bucket["total"] + net)

    # Closing stock -> Current Assets
    closing_stock = closing_stock_value(db, fy)
    if closing_stock:
        ca = assets.setdefault("Current Assets", {"group": "Current Assets", "total": 0.0, "ledgers": {}})
        ca["ledgers"]["Closing Stock"] = closing_stock
        ca["total"] = money(ca["total"] + closing_stock)

    # Net profit -> liabilities (Profit & Loss A/c)
    pl = build_profit_loss(db, fy)
    net_profit = pl["years"][0]["summary"]["net"]
    pl_bucket = liabilities.setdefault("Profit & Loss A/c",
                                       {"group": "Profit & Loss A/c", "total": 0.0, "ledgers": {}})
    pl_bucket["ledgers"]["Current Period Profit"] = net_profit
    pl_bucket["total"] = money(pl_bucket["total"] + net_profit)

    asset_list = sorted(assets.values(), key=lambda b: _order(b["group"], ASSET_ORDER))
    liab_list = sorted(liabilities.values(), key=lambda b: _order(b["group"], LIAB_ORDER))

    total_assets = money(sum(b["total"] for b in asset_list))
    total_liab = money(sum(b["total"] for b in liab_list))

    return {
        "fy": fy,
        "label": fy_label(fy),
        "assets": asset_list,
        "liabilities": liab_list,
        "totals": {
            "assets": total_assets,
            "liabilities": total_liab,
            "difference": money(total_assets - total_liab),
        },
        "netProfit": net_profit,
        "closingStock": closing_stock,
    }
