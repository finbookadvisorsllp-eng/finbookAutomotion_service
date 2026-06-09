"""Unit tests for the accounting core.

Run with:  python -m pytest app/aman/tests/test_accounting.py
Or standalone (no pytest needed):  python -m app.aman.tests.test_accounting
"""
from app.aman.services.accounting import dr_cr, net_balance, LedgerBalance, group_rollup
from app.aman.services.financial_year import (
    fy_bounds, is_valid_fy, fy_of_date, prev_fy, current_fy, fy_label)
from app.aman.core.serializers import parse_qty, parse_unit, parse_rate, money
from datetime import datetime


# ─────────────────────────── dr_cr ───────────────────────────
def test_dr_cr_debit_side():
    # Debtor line from the known voucher FG-01/2025-26 (Priya Enterprises).
    assert dr_cr({"amount": -27589.0, "isDeemedPositive": True}) == (27589.0, 0.0)


def test_dr_cr_credit_side():
    # Income line: GST Sales 12% (deemed positive False, positive amount).
    assert dr_cr({"amount": 24633.0, "isDeemedPositive": False}) == (0.0, 24633.0)


def test_dr_cr_handles_missing_amount():
    assert dr_cr({"isDeemedPositive": True}) == (0.0, 0.0)
    assert dr_cr({"isDeemedPositive": False}) == (0.0, 0.0)


def test_dr_cr_known_voucher_balances():
    """The five lines of FG-01/2025-26 must net to zero (Dr total == Cr total)."""
    entries = [
        {"ledgerName": "Priya Enterprises", "amount": -27589.0, "isDeemedPositive": True},
        {"ledgerName": "GST Sales 12%", "amount": 24633.0, "isDeemedPositive": False},
        {"ledgerName": "SGST Output", "amount": 1477.98, "isDeemedPositive": False},
        {"ledgerName": "CGST Output", "amount": 1477.98, "isDeemedPositive": False},
        {"ledgerName": "ROUND OFF", "amount": 0.04, "isDeemedPositive": False},
    ]
    debit = sum(dr_cr(e)[0] for e in entries)
    credit = sum(dr_cr(e)[1] for e in entries)
    assert round(debit, 2) == round(credit, 2) == 27589.0


# ─────────────────────────── net_balance ───────────────────────────
def test_net_balance_debit():
    assert net_balance(1000, 300) == (700.0, 0.0)


def test_net_balance_credit():
    assert net_balance(300, 1000) == (0.0, 700.0)


def test_net_balance_zero():
    assert net_balance(500, 500) == (0.0, 0.0)


# ─────────────────────────── group_rollup ───────────────────────────
def test_group_rollup_sums_member_sides_without_renetting():
    balances = {
        "GST Sales 12%": LedgerBalance(name="GST Sales 12%", root_group="Sales Accounts",
                                       classification="INCOME", movement_credit=15948083.22),
        "GST Sales Return 18%": LedgerBalance(name="GST Sales Return 18%", root_group="Sales Accounts",
                                              classification="INCOME", movement_debit=15700.60),
    }
    rollups = group_rollup(balances)
    sales = rollups["Sales Accounts"]
    # Group shows both a debit and a credit (returns net-debit, sales net-credit).
    assert sales.debit == 15700.60
    assert sales.credit == 15948083.22
    assert len(sales.ledgers) == 2


# ─────────────────────────── financial year ───────────────────────────
def test_fy_bounds():
    start, end = fy_bounds("2025-2026")
    assert start == datetime(2025, 4, 1, 0, 0, 0)
    assert end.year == 2026 and end.month == 3 and end.day == 31


def test_is_valid_fy():
    assert is_valid_fy("2025-2026")
    assert not is_valid_fy("2025-2027")
    assert not is_valid_fy("2025")
    assert not is_valid_fy("abc-defg")


def test_fy_of_date():
    assert fy_of_date(datetime(2025, 4, 1)) == "2025-2026"
    assert fy_of_date(datetime(2025, 3, 31)) == "2024-2025"
    assert fy_of_date(datetime(2026, 1, 15)) == "2025-2026"


def test_prev_fy():
    assert prev_fy("2025-2026") == "2024-2025"


def test_fy_label():
    assert fy_label("2025-2026") == "01/04/2025 - 31/03/2026"


# ─────────────────────────── serializers ───────────────────────────
def test_parse_qty_unit_rate():
    assert parse_qty("483.00 PCS") == 483.0
    assert parse_unit("483.00 PCS") == "PCS"
    assert parse_rate("51.00/PCS") == 51.0
    assert parse_qty(12) == 12.0
    assert parse_rate(None) == 0.0


def test_money_rounding():
    assert money("1477.985") == 1477.98 or money("1477.985") == 1477.99  # bankers/half-up tolerant
    assert money(None) == 0.0
    assert money("abc") == 0.0


# ─────────────────────────── standalone runner ───────────────────────────
if __name__ == "__main__":
    funcs = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    passed = 0
    for fn in funcs:
        try:
            fn()
            passed += 1
            print(f"  PASS  {fn.__name__}")
        except AssertionError as e:
            print(f"  FAIL  {fn.__name__}: {e}")
        except Exception as e:  # noqa
            print(f"  ERROR {fn.__name__}: {type(e).__name__}: {e}")
    print(f"\n{passed}/{len(funcs)} tests passed")
