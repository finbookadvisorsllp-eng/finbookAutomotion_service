"""Business Health compute engines.

Each engine is a pure, deterministic function over the grounded metrics dict
(``kpi.build_metrics``) or the report services — no LLM, fully reproducible.
"""
