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
from app.aman.repositories import group_repo, voucher_repo
from app.aman.services.accounting import (
    compute_ledger_balances)
from app.aman.services import inventory_service as inv
from app.aman.services.financial_year import fy_label, list_financial_years, resolve_date_range, date_range_filter, fy_of_date


def _bucket_groups(db):
    """Map root-group-name -> nature dict, for P&L classification."""
    groups = group_repo.group_by_name(db)
    return groups


def build_profit_loss(
    db,
    fy: str | None = None,
    date_filter: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None
) -> dict:
    start_date, end_date = resolve_date_range(date_filter, from_date, to_date, fy)
    date_match = date_range_filter(start_date, end_date)

    if date_filter and date_filter != "this_financial_year" and date_filter != "custom":
        period_id = date_filter
        period_label = date_filter.replace("_", " ").title()
    elif from_date and to_date:
        period_id = f"{from_date}_{to_date}"
        from_dt_label = start_date.strftime("%d/%m/%Y")
        to_dt_label = end_date.strftime("%d/%m/%Y")
        period_label = f"{from_dt_label} - {to_dt_label}"
    else:
        resolved_fy = fy or fy_of_date(start_date)
        period_id = resolved_fy
        period_label = fy_label(resolved_fy)

    balances = compute_ledger_balances(db, fy=None, include_stock=False, date_match=date_match)
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

    # Single-pass stock valuation (opening + closing share the same item rows).
    stock_rows = inv.item_rows(db, start_date=start_date, end_date=end_date)
    opening_stock = money(sum(r["opening_value"] for r in stock_rows))
    closing_override = inv.authoritative_closing_value(db, start_date, end_date)
    if closing_override is not None:
        closing_stock = money(closing_override)
        closing_source = "authoritative"
    else:
        closing_stock = money(sum(r["value"] for r in stock_rows))
        closing_source = "computed"
    oversold_items = [r["name"] for r in stock_rows if r.get("negativeStock")]

    def net_amount(rec) -> float:
        # income -> net credit ; expense -> net debit
        if rec["classification"] == "INCOME":
            return money(rec["credit"] - rec["debit"])
        return money(rec["debit"] - rec["credit"])

    particulars = []

    def add(group_name, sign, amount, ledgers=None, row_id=None):
        particulars.append({
            "id": row_id or group_name.lower().replace(" ", "-").replace("&", "and").replace(":", ""),
            "name": group_name, "sign": sign, "amount": money(amount),
            "ledgers": ledgers or [],
        })

    # Trading account — every figure is derived from ledger movements / stock
    # masters. No company- or FY-specific constants live here (Tally-derived
    # adjustments such as "Sales Bills to Make" that are absent from the synced
    # voucher data are intentionally excluded rather than fabricated).
    sales = agg.get("Sales Accounts")
    if sales:
        add("Sales Accounts", "+", net_amount(sales), sales["ledgers"])
    direct_inc = agg.get("Direct Incomes")
    if direct_inc:
        add("Direct Incomes", "+", net_amount(direct_inc), direct_inc["ledgers"])

    add("Opening Stock", "-", opening_stock,
        [{"id": "stock-hand", "name": "Stock in Hand", "debit": opening_stock, "credit": 0}],
        row_id="opening-stock")

    purch = agg.get("Purchase Accounts")
    if purch:
        add("Purchase Accounts", "-", net_amount(purch), purch["ledgers"])
    direct_exp = agg.get("Direct Expenses")
    if direct_exp:
        add("Direct Expenses", "-", net_amount(direct_exp), direct_exp["ledgers"])

    add("Less: Closing Stock", "+", closing_stock,
        [{"id": "stock-hand-closing", "name": "Closing Stock", "debit": closing_stock, "credit": 0}],
        row_id="closing-stock")

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

    # Compute KPI Cards
    total_expenses = money(cogs + ind_exp_total)
    profit_margin = round((net / revenue) * 100, 2) if revenue > 0 else 0.0
    kpis = {
        "revenue": money(revenue),
        "expenses": total_expenses,
        "grossProfit": gross,
        "netProfit": net,
        "profitMargin": profit_margin
    }

    # Generate Monthly Charts Data
    income_ledgers = []
    expense_ledgers = []
    for root, rec in agg.items():
        if rec["classification"] == "INCOME":
            income_ledgers.extend([l["name"] for l in rec["ledgers"]])
        elif rec["classification"] == "EXPENSE":
            expense_ledgers.extend([l["name"] for l in rec["ledgers"]])

    inc_mov = voucher_repo.monthly_ledger_movement(db, date_match=date_match, ledger_names=income_ledgers)
    exp_mov = voucher_repo.monthly_ledger_movement(db, date_match=date_match, ledger_names=expense_ledgers)

    months_in_period = []
    curr_date = start_date.replace(day=1)
    while curr_date <= end_date:
        months_in_period.append((curr_date.year, curr_date.month))
        if curr_date.month == 12:
            curr_date = curr_date.replace(year=curr_date.year + 1, month=1)
        else:
            curr_date = curr_date.replace(month=curr_date.month + 1)

    monthly_data = []
    _MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for y, m in months_in_period:
        rev = inc_mov.get(m, {}).get("credit", 0.0) - inc_mov.get(m, {}).get("debit", 0.0)
        exp = exp_mov.get(m, {}).get("debit", 0.0) - exp_mov.get(m, {}).get("credit", 0.0)
        monthly_data.append({
            "month": f"{_MONTHS[m - 1]} {str(y)[2:]}",
            "revenue": money(rev),
            "expense": money(exp),
            "profit": money(rev - exp)
        })

    charts = {
        "monthlyRevenue": [{"month": d["month"], "value": d["revenue"]} for d in monthly_data],
        "monthlyExpenses": [{"month": d["month"], "value": d["expense"]} for d in monthly_data],
        "monthlyProfit": [{"month": d["month"], "value": d["profit"]} for d in monthly_data],
        "profitTrend": [{"month": d["month"], "value": d["profit"]} for d in monthly_data],
        "revenueVsExpense": [{"month": d["month"], "revenue": d["revenue"], "expense": d["expense"]} for d in monthly_data]
    }

    year = {
        "id": period_id, "label": period_label, "isProfit": net >= 0,
        "summary": {
            "revenue": money(revenue), "gross": gross, "net": net,
            "openingStock": opening_stock, "closingStock": closing_stock,
        },
        "particulars": particulars,
    }

    # Transparency: report how closing stock was obtained so the UI can flag it.
    stock_info = {
        "closingStockSource": closing_source,
        "oversoldItemCount": len(oversold_items),
    }
    if closing_source == "computed" and oversold_items:
        stock_info["note"] = (
            "Closing stock is computed from voucher movements. "
            f"{len(oversold_items)} item(s) show as oversold because manufacturing / "
            "stock-journal vouchers are not present in the synced data - reconcile "
            "with Tally's Stock Summary for the authoritative value."
        )

    return {
        "years": [year],
        "fy": period_id,
        "availableYears": list_financial_years(db),
        "kpis": kpis,
        "charts": charts,
        "stockInfo": stock_info,
    }

