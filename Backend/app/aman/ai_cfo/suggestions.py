"""Suggested questions for the AI CFO chat.

A curated set of high-value CFO questions, plus dynamic suggestions surfaced from
the live rules engine (e.g. if receivables are high, suggest asking about them).
Dynamic ones come first so the most relevant prompts lead.
"""
from app.aman.ai_cfo import context_builder as ctx
from app.aman.ai_cfo import rules_engine

# Static starter prompts (always available).
STARTERS = [
    {"id": "why-profit", "label": "Why did profit change?",
     "prompt": "Why did my net profit change compared to last year?", "category": "profitability"},
    {"id": "overdue-customers", "label": "Show overdue customers",
     "prompt": "Which customers have the highest outstanding balances?", "category": "collections"},
    {"id": "cash-position", "label": "What is my cash position?",
     "prompt": "What is my current cash and bank position and cash flow this year?", "category": "liquidity"},
    {"id": "expense-increase", "label": "Which expenses increased?",
     "prompt": "Which expenses increased the most and why?", "category": "expenses"},
    {"id": "top-customers", "label": "Who are my top customers?",
     "prompt": "Who are my top customers by sales this financial year?", "category": "sales"},
    {"id": "health-check", "label": "How healthy is my business?",
     "prompt": "Give me an overall assessment of my business's financial health.", "category": "overview"},
]

# Map a rules-engine finding to a natural follow-up question.
_DYNAMIC_PROMPTS = {
    "profit-decline": ("Why is my net profit down this year?", "profitability"),
    "sales-decline": ("Why are my sales declining and how can I recover?", "sales"),
    "expense-spike": ("Why did my purchases rise so much this year?", "expenses"),
    "cash-negative": ("My cash is negative — what should I do first?", "liquidity"),
    "cash-flow-negative": ("Why is my cash flow negative this year?", "liquidity"),
    "receivables-high": ("How do I bring down my receivables?", "collections"),
    "thin-margin": ("My margin is thin — how do I improve it?", "profitability"),
    "net-loss": ("I'm making a loss — what's driving it?", "profitability"),
}


def build_suggestions(db, fy: str | None = None, limit: int = 8) -> list[dict]:
    dynamic: list[dict] = []
    try:
        context = ctx.build_context(db, fy)
        for finding in rules_engine.evaluate(context):
            spec = _DYNAMIC_PROMPTS.get(finding["id"])
            if spec:
                dynamic.append({"id": f"dyn-{finding['id']}", "label": finding["title"],
                                "prompt": spec[0], "category": spec[1]})
    except Exception:  # noqa: BLE001 — suggestions must never fail the request
        dynamic = []

    seen = {d["id"] for d in dynamic}
    combined = dynamic + [s for s in STARTERS if s["id"] not in seen]
    return combined[:limit]
