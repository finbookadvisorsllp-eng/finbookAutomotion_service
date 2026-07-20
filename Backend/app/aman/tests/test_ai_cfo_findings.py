"""AI CFO — Findings Engine tests (the "CFO brain" rebuild).

Pure-function + monkeypatched-source tests, no Mongo. Verifies the guarantees from
CFO_REASONING_MODEL.md:

  * materiality is anchored to REVENUE (not net income), with an absolute floor
  * qualitative overrides (record-keeping, criticals) survive regardless of size
  * the %-base guard kills the exploding-percentage bug
  * the forecast guards kill the "positive next month but ₹0 at 6/12mo" bug
  * silence: nothing material ⇒ a calm brief, not filler
  * ranking puts criticals first, then by score
  * a clean category reports clean=True (drives "checked, all clear")

Run:  python -m pytest app/aman/tests/test_ai_cfo_findings.py
      python -m app.aman.tests.test_ai_cfo_findings      (standalone)
"""
from app.aman.ai_cfo import findings as F


# ─────────────────────────── guards & materiality ───────────────────────────
def test_materiality_anchored_to_revenue():
    # floor = max(₹25,000, 0.5% of revenue)
    assert F._material(60_000, 10_000_000) is True      # ≥ 0.5% of 1cr = ₹50k
    assert F._material(30_000, 10_000_000) is False     # below ₹50k floor
    assert F._material(30_000, 1_000_000) is True        # 0.5% = ₹5k → abs floor ₹25k governs
    assert F._material(None, 10_000_000) is False


def test_mom_percent_base_guard_fixes_exploding_pct():
    # A jump from ≈₹0 must NOT produce a percentage (the +19771830% bug).
    assert F._safe_pct(1_300_000, 50, avg_monthly=1_320_000) is None
    assert F._safe_pct(1_300_000, 0, avg_monthly=1_320_000) is None
    # A real base (above the ₹10k floor) gives a sane number.
    assert F._safe_pct(1_100_000, 1_000_000, avg_monthly=1_000_000) == 10.0
    # Runaway ratio above the hard cap is suppressed even with a base over the floor.
    assert F._safe_pct(10_000_000, 12_000, avg_monthly=50_000) is None


def test_forecast_horizon_guards_fix_contradictory_zero():
    # 6 months of history; the 12-month projection is clamped to 0 (declining trend).
    proj_r = [{"period": f"M+{i}", "value": (0 if i == 12 else 1_000_000)} for i in range(1, 13)]
    proj_p = [{"period": f"M+{i}", "value": -1_000 * i} for i in range(1, 13)]
    h = F._guarded_horizon({"projection": proj_r, "confidence": "moderate"},
                           {"projection": proj_p}, n_history=6)
    assert [x["months"] for x in h] == [3, 6, 12]
    h12 = next(x for x in h if x["months"] == 12)
    assert h12["reliable"] is False and h12["revenue"] is None     # never a fake ₹0
    h3 = next(x for x in h if x["months"] == 3)
    assert h3["reliable"] and h3["revenue"] is not None
    # confidence degrades with distance
    assert h3["confidence"] == "med"
    assert next(x for x in h if x["months"] == 6)["confidence"] == "low"


def test_forecast_horizon_omits_what_history_cant_support():
    proj_r = [{"period": f"M+{i}", "value": 1_000_000} for i in range(1, 13)]
    proj_p = [{"period": f"M+{i}", "value": 100_000} for i in range(1, 13)]
    h = F._guarded_horizon({"projection": proj_r, "confidence": "low"},
                           {"projection": proj_p}, n_history=4)   # 2×4 = 8 → 12mo dropped
    assert [x["months"] for x in h] == [3, 6]


# ─────────────────────────── reporting guard (bug 1 in context) ───────────────────────────
def test_reporting_finding_suppresses_pct_on_near_zero_base():
    m = {"avgMonthlySales": 1_320_000}
    trend = [{"month": "Aug", "revenue": 50, "expense": 900_000, "profit": -899_950},
             {"month": "Sep", "revenue": 1_300_000, "expense": 1_200_000, "profit": 100_000}]
    out = F._reporting_findings(m, trend, annual_rev=15_840_000)
    assert len(out) == 1
    f = out[0]
    assert f["revenueMoM"] is None            # near-zero base → no runaway %
    assert f["profitChange"] is not None       # but the ₹ movement is still reported


# ─────────────────────────── overrides, silence, ranking ───────────────────────────
def test_record_keeping_override_kept_despite_small_rupees():
    an = {"available": True, "latestMonth": "Sep",
          "anomalies": [{"id": "anomaly:drop:Rent", "title": "Rent looks too low",
                         "detail": "…", "magnitude": 4_500, "type": "drop",
                         "action": "Verify entry", "ledger": "Rent"}]}
    fs = F._from_anomalies(an)
    assert len(fs) == 1 and fs[0]["_override"] is True
    # ₹4,500 is below the material floor, but the override keeps it.
    assert F._keep(fs[0], annual_rev=15_840_000) is True


def test_silence_when_nothing_material():
    brief = F._brief([])
    assert brief["count"] == 0 and "No material" in brief["headline"] and brief["tone"] == "good"


def test_ranking_puts_criticals_first():
    fs = [
        F._finding("a", "reporting", "positive", "Good month", "…", rupee=500_000, confidence="high"),
        F._finding("b", "risk", "critical", "Net loss", "…", rupee=1_200_000, confidence="high"),
        F._finding("c", "risk", "warning", "Receivables high", "…", rupee=700_000, confidence="med"),
    ]
    ranked = F._rank(fs)
    assert ranked[0]["severity"] == "critical"          # BLUF: worst first
    assert [f["id"] for f in ranked][0] == "b"


# ─────────────────────────── full composition ───────────────────────────
def test_build_findings_composition_and_clean_category():
    saved = {}

    def patch(modpath, name, fn):
        import importlib
        mod = importlib.import_module(modpath)
        saved[(modpath, name)] = getattr(mod, name)
        setattr(mod, name, fn)

    patch("app.aman.business_health.engines.kpi", "build_metrics",
          lambda db, fy: {"fy": fy, "revenue": 15_840_000, "sales": 15_840_000,
                          "avgMonthlySales": 1_320_000})
    patch("app.aman.business_health.engines.risk", "evaluate",
          lambda m: [{"sourceId": "risk:net-loss:2024-2025", "severity": "danger",
                      "title": "The business is running at a net loss",
                      "detail": "Net result is ₹-12.1L.", "rupeesAtRisk": 1_210_000,
                      "confidence": "high", "metricKey": "netProfit", "evidence": {"report": "pl"}}])
    patch("app.aman.business_health.engines.opportunity", "evaluate",
          lambda db, m: [{"sourceId": "opp:collect-overdue:fy", "title": "Collect ₹15L overdue",
                          "detail": "…", "rupeeImpact": 1_500_000, "confidence": "high",
                          "effort": "low", "actionText": "Chase it",
                          "metricKey": "receivablesTotal", "evidence": {"report": "receivables"}}])
    patch("app.aman.ai_cfo.anomaly", "detect",
          lambda db, fy: {"available": True, "latestMonth": "Sep",
                          "counts": {"total": 0}, "anomalies": []})
    patch("app.aman.ai_cfo.forecast", "build_forecast",
          lambda db, fy, months=12: {
              "sales": {"available": True, "historyMonths": 8, "nextMonth": 1_790_000,
                        "confidence": "moderate",
                        "projection": [{"period": f"M+{i}", "value": 1_800_000} for i in range(1, 13)]},
              "cashFlow": {"projection": [{"value": -100_000 * i} for i in range(1, 13)]},
              "collections": {}})
    patch("app.aman.services.dashboard_service", "monthly_trend",
          lambda db, fy: {"series": [
              {"month": "Aug", "revenue": 1_400_000, "expense": 900_000, "profit": 500_000},
              {"month": "Sep", "revenue": 1_300_000, "expense": 1_200_000, "profit": 100_000}]})
    try:
        res = F.build_findings(None, "2024-2025")
    finally:
        import importlib
        for (modpath, name), fn in saved.items():
            setattr(importlib.import_module(modpath), name, fn)

    # Brief leads with the critical net loss (worst first).
    assert res["brief"]["tone"] == "critical"
    assert "loss" in res["brief"]["headline"].lower()
    assert res["brief"]["count"] >= 1

    # Category summary: risk not clean, record-keeping clean (drives "checked, all clear").
    assert res["categories"]["risk"]["clean"] is False
    assert res["categories"]["record_keeping"]["clean"] is True

    # A material opportunity surfaced (money to gain).
    assert any(f["severity"] == "positive" for f in res["findings"])
    # Planning carries a forecast payload (declining ⇒ warning) with a guarded horizon.
    plan = next(f for f in res["findings"] if f["category"] == "planning")
    assert "forecast" in plan and isinstance(plan["forecast"]["horizon"], list)


# ─────────────────────────── standalone runner ───────────────────────────
if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"\n{len(fns)} tests passed")
