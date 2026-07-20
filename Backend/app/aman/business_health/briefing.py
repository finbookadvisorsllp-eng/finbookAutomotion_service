"""Weekly AI briefing — a short grounded narrative over the health pack.

Reuses the AI-CFO provider + grounded context so figures reconcile with the
reports. Fully graceful: if the provider is unconfigured or unreachable it returns
a deterministic summary with ``degraded: true`` — a Business Health page never
waits on, or breaks because of, the model.
"""
from datetime import datetime

from app.aman.core.serializers import inr
from app.aman.business_health.config import bh_settings as cfg
from app.aman.business_health import service


_SYSTEM = (
    "You are the AI CFO writing a short weekly business-health briefing for an SME "
    "owner. Be concrete and plain. 3–5 sentences. Use ONLY the figures provided — "
    "never invent numbers. Lead with the single most important thing, then the top "
    "action. No markdown headings."
)


def _facts(fy: str, m: dict, sc: dict, decisions: list[dict]) -> str:
    lines = [
        f"Financial year {fy}. Health score {sc.get('overall')} ({sc.get('label')}).",
        f"Sales {inr(m.get('sales'))} ({_pct(m.get('salesYoY'))} YoY). "
        f"Net profit {inr(m.get('netProfit'))} (margin {m.get('netMargin')}%).",
        f"Cash & bank {inr(m.get('cashBank'))}; runway "
        f"{m.get('runwayMonths') if m.get('runwayMonths') is not None else 'healthy'} months.",
        f"Receivables {inr(m.get('receivablesTotal'))}, payables {inr(m.get('payablesTotal'))}.",
    ]
    if m.get("concentrationTop1") is not None:
        lines.append(f"Top customer is {m['concentrationTop1']}% of sales.")
    for d in decisions[:3]:
        lines.append(f"Priority action: {d['title']} — {d.get('actionText','')}")
    return "\n".join(lines)


def _pct(v):
    return f"{v:+.1f}%" if isinstance(v, (int, float)) else "n/a"


def _deterministic(fy: str, m: dict, sc: dict, decisions: list[dict]) -> str:
    parts = [
        f"Your business health is {sc.get('overall')} out of 100 ({sc.get('label')}) for {fy}.",
        f"Sales are {inr(m.get('sales'))} at a {m.get('netMargin')}% net margin, "
        f"with {inr(m.get('cashBank'))} in cash and bank.",
    ]
    if decisions:
        d = decisions[0]
        parts.append(f"The most valuable move this week: {d['title'].lower()} — {d.get('actionText','')}")
    else:
        parts.append("No pressing actions surfaced this week — the fundamentals look steady.")
    return " ".join(parts)


def _local(fy, m, sc, decisions, ai_disabled: bool, provider=None) -> dict:
    return {"text": _deterministic(fy, m, sc, decisions), "degraded": True,
            "aiDisabled": ai_disabled, "provider": provider,
            "generatedAt": datetime.utcnow().isoformat()}


def build(db, fy: str) -> dict:
    m = service.metrics(db, fy)
    sc = service.score(m)
    decisions = service.list_decisions(db, fy, status="open", m=m)

    # R-SEC-1: no company financials leave the server unless an operator has
    # explicitly opted in. Default is a deterministic, local-only summary.
    if not cfg.BRIEFING_AI_ENABLED:
        return _local(fy, m, sc, decisions, ai_disabled=True)

    try:
        from app.aman.ai_cfo.config import ai_cfo_settings
        from app.aman.ai_cfo.providers import get_provider, ProviderError
        configured = ai_cfo_settings.is_configured
    except Exception:
        ai_cfo_settings = None
        configured = False

    if not configured:
        return _local(fy, m, sc, decisions, ai_disabled=False)

    messages = [
        {"role": "system", "content": _SYSTEM},
        {"role": "user", "content": _facts(fy, m, sc, decisions) +
         "\n\nWrite the weekly briefing now."},
    ]
    try:
        provider = get_provider(ai_cfo_settings.PROVIDER)
        result = provider.chat(messages)
        return {"text": result.text.strip(), "degraded": False, "aiDisabled": False,
                "provider": result.provider, "generatedAt": datetime.utcnow().isoformat()}
    except ProviderError:
        return _local(fy, m, sc, decisions, ai_disabled=False, provider=ai_cfo_settings.PROVIDER)
    except Exception:
        return _local(fy, m, sc, decisions, ai_disabled=False)
