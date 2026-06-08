"""Profit & Loss (Trading + P&L account) — emits the plDrillDownData shape.

Bucketing uses ``groups.nature`` of each ledger's root group:
  Trading A/c (Gross Profit): affectsGrossProfit == True
      INCOME  -> Sales / Direct Incomes      (credit)
      EXPENSE -> Purchases / Direct Expenses  (debit)
      + Opening Stock (debit) and Closing Stock (credit)
  P&L A/c (Net Profit): affectsGrossProfit == False, affectsNetProfit == True
      INCOME  -> Indirect Incomes (credit)
      EXPENSE -> Indirect Expenses (debit)  [includes Audit Fees, Bank Charges, ...]
"""
from app.aman.core.serializers import money
from app.aman.repositories import group_repo
from app.aman.services.accounting import (
    compute_ledger_balances, opening_stock_value)
from app.aman.services.inventory_service import closing_stock_value
from app.aman.services.financial_year import fy_label, list_financial_years


def _bucket_groups(db):
    """Map root-group-name -> nature dict, for P&L classification."""
    groups = group_repo.group_by_name(db)
    return groups


def build_profit_loss(db, fy: str) -> dict:
    balances = compute_ledger_balances(db, fy, include_stock=False)
    groups = _bucket_groups(db)

    # accumulate per root group: debit, credit, ledgers[]
    agg: dict[str, dict] = {}
    for lb in balances.values():
        root = lb.root_group
        nature = group_repo.nature_of(groups.get(root))
        classification = nature.get("classification")
        if classification not in ("INCOME", "EXPENSE"):
            continue  # not a P&L account
        rec = agg.setdefault(root, {
            "classification": classification,
            "affectsGrossProfit": bool(nature.get("affectsGrossProfit")),
            "debit": 0.0, "credit": 0.0, "ledgers": [],
        })
        cd, cc = lb.closing_debit, lb.closing_credit
        rec["debit"] += cd
        rec["credit"] += cc
        if cd or cc:
            rec["ledgers"].append({"id": lb.name, "name": lb.name,
                                   "debit": money(cd), "credit": money(cc)})

    opening_stock = opening_stock_value(db)
    closing_stock = closing_stock_value(db, fy)

    def net_amount(rec) -> float:
        # income -> net credit ; expense -> net debit
        if rec["classification"] == "INCOME":
            return money(rec["credit"] - rec["debit"])
        return money(rec["debit"] - rec["credit"])

    particulars = []

    def add(group_name, sign, amount, ledgers=None):
        particulars.append({
            "id": group_name.lower().replace(" ", "-").replace("&", "and"),
            "name": group_name, "sign": sign, "amount": money(amount),
            "ledgers": ledgers or [],
        })

    # Trading account
    sales = agg.get("Sales Accounts")
    if sales:
        add("Sales Accounts", "+", net_amount(sales), sales["ledgers"])
    direct_inc = agg.get("Direct Incomes")
    if direct_inc:
        add("Direct Incomes", "+", net_amount(direct_inc), direct_inc["ledgers"])

    add("Opening Stock", "-", opening_stock,
        [{"id": "stock-hand", "name": "Stock in Hand", "debit": opening_stock, "credit": 0}])

    purch = agg.get("Purchase Accounts")
    if purch:
        add("Purchase Accounts", "-", net_amount(purch), purch["ledgers"])
    direct_exp = agg.get("Direct Expenses")
    if direct_exp:
        add("Direct Expenses", "-", net_amount(direct_exp), direct_exp["ledgers"])

    add("Less: Closing Stock", "+", closing_stock,
        [{"id": "stock-hand-closing", "name": "Closing Stock", "debit": closing_stock, "credit": 0}])

    # Gross profit
    revenue = (net_amount(sales) if sales else 0) + (net_amount(direct_inc) if direct_inc else 0)
    cogs = (opening_stock + (net_amount(purch) if purch else 0)
            + (net_amount(direct_exp) if direct_exp else 0) - closing_stock)
    gross = money(revenue - cogs)

    # P&L account
    indirect_inc = agg.get("Indirect Incomes")
    if indirect_inc:
        add("Indirect Incomes", "+", net_amount(indirect_inc), indirect_inc["ledgers"])
    # all remaining expense groups not already added (Indirect Expenses + its subs)
    handled = {"Sales Accounts", "Direct Incomes", "Purchase Accounts",
               "Direct Expenses", "Indirect Incomes"}
    ind_exp_total = 0.0
    ind_exp_ledgers = []
    for root, rec in agg.items():
        if root in handled:
            continue
        if rec["classification"] == "EXPENSE":
            ind_exp_total += net_amount(rec)
            ind_exp_ledgers.extend(rec["ledgers"])
        elif rec["classification"] == "INCOME":
            add(root, "+", net_amount(rec), rec["ledgers"])
    if ind_exp_total or ind_exp_ledgers:
        add("Indirect Expenses", "-", ind_exp_total, ind_exp_ledgers)

    indirect_income_amt = net_amount(indirect_inc) if indirect_inc else 0
    net = money(gross + indirect_income_amt - ind_exp_total)

    year = {
        "id": fy, "label": fy_label(fy), "isProfit": net >= 0,
        "summary": {"revenue": money(revenue), "gross": gross, "net": net},
        "particulars": particulars,
    }
    return {"years": [year], "fy": fy,
            "availableYears": list_financial_years(db)}
