"""AI CFO — expense anomaly detector tests (the Record-keeping intelligence).

The detector's data loaders are monkeypatched with a synthetic per-ledger monthly
series, so this runs without Mongo. It is consumed by the Findings Engine
(``ai_cfo/findings.py``) — see also ``test_ai_cfo_findings.py``.

Run:  python -m pytest app/aman/tests/test_ai_cfo_anomaly.py
      python -m app.aman.tests.test_ai_cfo_anomaly       (standalone, no pytest)
"""
from app.aman.ai_cfo import anomaly
from app.aman.repositories import voucher_repo


def _patch(ledgers, series):
    orig = (anomaly._expense_ledgers, voucher_repo.monthly_by_ledger)
    anomaly._expense_ledgers = lambda db, fy: ledgers
    voucher_repo.monthly_by_ledger = lambda db, fy, names, date_match=None: {k: dict(v) for k, v in series.items()}
    return orig


def _restore(orig):
    anomaly._expense_ledgers, voucher_repo.monthly_by_ledger = orig


def test_anomaly_detects_missing_drop_and_ignores_steady():
    # FY-order months Apr(4)..Sep(9) are booked; Sep is the latest.
    series = {
        "Rent": {4: 5000, 5: 5000, 6: 5000, 7: 5000, 8: 5000, 9: 500},          # 90% drop
        "Electricity": {4: 2000, 5: 2100, 6: 2000, 7: 2100, 8: 2000},           # missing in Sep
        "Salaries": {4: 100000, 5: 100000, 6: 100000, 7: 100000, 8: 100000, 9: 100000},  # steady
        "Misc": {4: 500, 9: 400},                                               # below noise floor
    }
    orig = _patch(list(series), series)
    try:
        res = anomaly.detect(None, "2025-2026")
    finally:
        _restore(orig)

    assert res["available"] is True and res["latestMonth"] == "Sep"
    kinds = {a["ledger"]: a["type"] for a in res["anomalies"]}
    assert kinds.get("Rent") == "drop"
    assert kinds.get("Electricity") == "missing"
    assert "Salaries" not in kinds and "Misc" not in kinds   # steady + trivial ignored
    assert res["counts"]["total"] == 2


def test_anomaly_needs_enough_history():
    series = {"Rent": {4: 5000, 5: 5000, 6: 5000}}   # only 3 booked months (< MIN_ACTIVE_MONTHS)
    orig = _patch(list(series), series)
    try:
        res = anomaly.detect(None, "2025-2026")
    finally:
        _restore(orig)
    assert res["available"] is False and res["anomalies"] == []


def test_anomaly_no_expense_ledgers():
    orig = _patch([], {})
    try:
        res = anomaly.detect(None, "2025-2026")
    finally:
        _restore(orig)
    assert res["available"] is False


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"\n{len(fns)} tests passed")
