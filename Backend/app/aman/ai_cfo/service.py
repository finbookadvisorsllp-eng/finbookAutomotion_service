"""AI CFO orchestration — the Response Generator (Task 3.3).

Ties the pieces together for a single chat turn:
  1. Resolve/create the session and persist the user's message.
  2. Build the grounded financial context (Context Engine).
  3. Assemble system + context + history + business-memory + question.
  4. Call the configured provider (OpenAI) — with graceful degradation.
  5. Attach deterministic rules-engine insights (always reconciled).
  6. Persist the assistant's answer and return a structured response.

Everything is tenant-scoped through the ``db`` handed in by the route.
"""
import re
import time

from app.aman.core.serializers import inr
from app.aman.core.cache import cached_report
from app.aman.ai_cfo.config import ai_cfo_settings as cfg
from app.aman.ai_cfo import context_builder as ctx
from app.aman.ai_cfo import prompts, rules_engine, repository as repo, monitoring
from app.aman.ai_cfo.providers import get_provider, ProviderError


# ─────────────────────────────── Section inference ───────────────────────────────
_KEYWORDS = {
    "profit": ["profit", "margin", "p&l", "pnl", "loss", "earning", "bottom line", "net"],
    "sales": ["sale", "revenue", "turnover", "top customer", "growth"],
    "expense": ["expense", "cost", "spend", "purchase", "overhead"],
    "outstanding": ["outstanding", "receivable", "payable", "overdue", "collect", "due", "debtor", "creditor"],
    "cash": ["cash", "bank", "liquidity", "cash flow", "cashflow", "balance"],
    "customer": ["customer", "client", "buyer", "party"],
    "stock": ["stock", "inventory", "item", "product"],
    "gst": ["gst", "tax", "hsn"],
}


def _infer_sections(message: str) -> list[str] | None:
    """Pick the relevant context sections from the question to keep prompts tight.

    Falls back to the full set (None) for broad/ambiguous questions so the AI never
    misses context it needs."""
    m = (message or "").lower()
    hits = [name for name, kws in _KEYWORDS.items() if any(k in m for k in kws)]
    if not hits:
        return None  # broad question → build everything
    # Always include profit + outstanding as they anchor most CFO answers.
    for anchor in ("profit", "outstanding"):
        if anchor not in hits:
            hits.append(anchor)
    return hits


# ─────────────────────────────── Fast-path (no context) ───────────────────────────────
# Greetings / small talk / meta questions don't need the (expensive) financial
# context at all — building it and shipping ~1.7k prompt tokens for a "Hi" is pure
# latency. We detect these cheaply and skip context entirely.
_SMALLTALK_RE = re.compile(
    r"^(hi+|hey+|hello+|yo|hiya|sup|howdy|greetings|"
    r"thanks?|thank\s?you|thankyou|thx|ty|cheers|"
    r"ok(ay)?|k|cool|great|nice|awesome|perfect|got it|"
    r"bye|goodbye|see\s?ya|good\s?(morning|afternoon|evening|night|day)|"
    r"how\s?are\s?you|who\s?are\s?you|what('?s| is)\s?your\s?name|"
    r"what\s?can\s?you\s?do|what\s?do\s?you\s?do|introduce\s?yourself|"
    r"help|start|test(ing)?|ping)\b[\s!.?,]*$",
    re.IGNORECASE,
)


def _is_smalltalk(message: str) -> bool:
    m = (message or "").strip()
    if not m:
        return True
    if len(m) <= 3 and m.replace("!", "").isalpha():   # 'hi', 'yo', 'ok'
        return True
    return bool(_SMALLTALK_RE.match(m))


def _select_sections(message: str):
    """Which context sections to build. ``[]`` for greetings/small talk (skip the
    heavy context build entirely), otherwise the keyword-inferred set (None=all)."""
    if _is_smalltalk(message):
        return []
    return _infer_sections(message)


def _build_context(db, fy, sections):
    """Build the grounded context, briefly cached per tenant+fy+section-set so
    back-to-back questions don't re-aggregate the report engines. Small talk
    (``sections == []``) is trivial and bypasses the cache."""
    if sections == []:
        return ctx.build_context(db, fy, [])
    tenant = getattr(db, "name", "default")
    sig = "all" if sections is None else "+".join(sorted(sections))
    return cached_report(tenant, "aicfo-context",
                         lambda: ctx.build_context(db, fy, sections),
                         fy=fy, sections=sig)


def _context_text(context, sections) -> str:
    """Render context for the prompt. For small talk (no sections) send a short
    neutral note instead of an empty financial block."""
    if sections == []:
        return "(Greeting / general message — no company financial data was looked up for this turn.)"
    return ctx.format_for_prompt(context)


# ─────────────────────────────── Degraded (no-LLM) answer ───────────────────────────────
def _degraded_answer(context: dict, insights: list[dict], reason: str) -> str:
    """A grounded, useful answer built without the model — used when the provider
    is unconfigured or unreachable. Honest about being a summary."""
    p = (context.get("sections") or {}).get("profit") or {}
    lines = ["I'm giving you a grounded summary from your live books "
             "(the AI model is currently unavailable):", ""]
    if p.get("available"):
        lines.append(f"• Revenue {inr(p.get('revenue'))}, Net Profit {inr(p.get('netProfit'))} "
                     f"(margin {p.get('profitMargin')}%).")
    for i in insights[:5]:
        lines.append(f"• {i['title']}: {i['detail']}")
    if not insights:
        lines.append("• No risk signals detected in the current figures.")
    lines.append("")
    lines.append(f"(Model unavailable: {reason})")
    return "\n".join(lines)


# ─────────────────────────────── Main entry ───────────────────────────────
def answer_chat(db, user: dict, message: str, session_id: str | None = None,
                fy: str | None = None) -> dict:
    user_sub = str(user.get("sub") or user.get("email") or "unknown")

    # 1. Session + persist the user's message.
    session = repo.get_or_create_session(db, session_id, user_sub, fy)
    sid = session["sessionId"]
    is_new = session.get("messageCount", 0) == 0
    repo.add_message(db, sid, "user", message)
    if is_new:
        repo.touch_session(db, sid, title=prompts.title_from_message(message))

    # 2. Grounded context (only the sections this question needs).
    sections = _select_sections(message)
    context = _build_context(db, fy, sections)
    context_text = _context_text(context, sections)
    context_used = [n for n, d in (context.get("sections") or {}).items()
                    if isinstance(d, dict) and d.get("available")]

    # 3. Deterministic insights (always reconciled) — attached to every answer.
    insights = rules_engine.evaluate(context)
    kinds = rules_engine.split_by_kind(insights)

    # 4. History + business memory.
    history = repo.recent_turns_for_model(db, sid, cfg.HISTORY_TURNS)
    # Drop the just-saved user turn from history (it's added as the final message).
    if history and history[-1].get("role") == "user":
        history = history[:-1]
    memory_text = _format_memory(repo.get_business_memory(db, user_sub))

    messages = prompts.build_messages(message, context_text, history, memory_text,
                                      light=(sections == []))

    # 5. Call the provider (graceful) — timed for monitoring.
    degraded = False
    provider_name = cfg.PROVIDER
    model_name = None
    tokens = {}
    error = None
    t0 = time.perf_counter()
    if not cfg.is_configured:
        answer = _degraded_answer(context, insights, "provider not configured")
        degraded = True
        error = "provider not configured"
    else:
        try:
            provider = get_provider(cfg.PROVIDER)
            result = provider.chat(messages)
            answer = result.text
            provider_name = result.provider
            model_name = result.model
            tokens = {"prompt": result.prompt_tokens, "completion": result.completion_tokens,
                      "total": result.total_tokens}
        except ProviderError as exc:
            if not cfg.GRACEFUL_DEGRADE:
                raise
            answer = _degraded_answer(context, insights, str(exc))
            degraded = True
            error = str(exc)
    latency_ms = int((time.perf_counter() - t0) * 1000)

    # 6. Persist the assistant's answer with audit metadata (incl. latency).
    repo.add_message(db, sid, "assistant", answer, meta={
        "provider": provider_name, "model": model_name, "degraded": degraded,
        "contextUsed": context_used, "tokens": tokens, "fy": context.get("fy"),
        "latencyMs": latency_ms,
    })

    # 7. Structured log line (PII-light) for monitoring / alerting.
    monitoring.log_turn(
        tenant=getattr(db, "name", "?"), user_sub=user_sub, question_len=len(message or ""),
        provider=provider_name, model=model_name, tokens=tokens, latency_ms=latency_ms,
        degraded=degraded, error=error,
    )

    return {
        "sessionId": sid,
        "answer": answer,
        "highlights": [i["title"] for i in insights[:3]],
        "recommendations": [i["detail"] for i in kinds["recommendations"][:4]],
        "warnings": [i["detail"] for i in kinds["warnings"][:4]],
        "contextUsed": context_used,
        "provider": provider_name,
        "model": model_name,
        "degraded": degraded,
        "fy": context.get("fy"),
        "tokens": tokens,
    }


def _word_chunks(text: str):
    """Split text into small chunks so the degraded/local answer also 'types'."""
    import re
    for tok in re.findall(r"\S+\s*", text or ""):
        yield tok


def stream_chat(db, user: dict, message: str, session_id: str | None = None,
                fy: str | None = None):
    """Streaming variant of :func:`answer_chat`. A generator yielding event dicts::

        {"event": "meta",  "data": {sessionId, fy, contextUsed}}
        {"event": "token", "data": {"text": "..."}}          # many
        {"event": "done",  "data": {degraded, provider, model, tokens, highlights,
                                    recommendations, warnings}}

    The full answer is accumulated and persisted (with audit meta) once the stream
    completes, so history/monitoring are identical to the non-streaming path.
    """
    user_sub = str(user.get("sub") or user.get("email") or "unknown")

    session = repo.get_or_create_session(db, session_id, user_sub, fy)
    sid = session["sessionId"]
    is_new = session.get("messageCount", 0) == 0
    repo.add_message(db, sid, "user", message)
    if is_new:
        repo.touch_session(db, sid, title=prompts.title_from_message(message))

    sections = _select_sections(message)
    context = _build_context(db, fy, sections)
    context_text = _context_text(context, sections)
    context_used = [n for n, d in (context.get("sections") or {}).items()
                    if isinstance(d, dict) and d.get("available")]
    insights = rules_engine.evaluate(context)
    kinds = rules_engine.split_by_kind(insights)

    history = repo.recent_turns_for_model(db, sid, cfg.HISTORY_TURNS)
    if history and history[-1].get("role") == "user":
        history = history[:-1]
    memory_text = _format_memory(repo.get_business_memory(db, user_sub))
    messages = prompts.build_messages(message, context_text, history, memory_text,
                                      light=(sections == []))

    yield {"event": "meta", "data": {"sessionId": sid, "fy": context.get("fy"),
                                     "contextUsed": context_used}}

    parts: list[str] = []
    degraded = False
    provider_name = cfg.PROVIDER
    model_name = None
    tokens: dict = {}
    error = None
    t0 = time.perf_counter()

    if not cfg.is_configured:
        answer = _degraded_answer(context, insights, "provider not configured")
        degraded = True
        error = "provider not configured"
        for c in _word_chunks(answer):
            parts.append(c)
            yield {"event": "token", "data": {"text": c}}
    else:
        try:
            provider = get_provider(cfg.PROVIDER)
            provider_name = getattr(provider, "name", provider_name)
            for ev in provider.chat_stream(messages):
                if ev.get("type") == "token":
                    parts.append(ev["text"])
                    yield {"event": "token", "data": {"text": ev["text"]}}
                elif ev.get("type") == "final":
                    model_name = ev.get("model") or model_name
                    tokens = ev.get("tokens") or tokens
        except ProviderError as exc:
            error = str(exc)
            if not parts:
                # Nothing streamed yet → fall back to a grounded local answer.
                answer = _degraded_answer(context, insights, str(exc))
                degraded = True
                for c in _word_chunks(answer):
                    parts.append(c)
                    yield {"event": "token", "data": {"text": c}}
            else:
                note = f"\n\n_(the answer was cut short: {exc})_"
                parts.append(note)
                degraded = True
                yield {"event": "token", "data": {"text": note}}

    latency_ms = int((time.perf_counter() - t0) * 1000)
    answer_text = "".join(parts)

    repo.add_message(db, sid, "assistant", answer_text, meta={
        "provider": provider_name, "model": model_name, "degraded": degraded,
        "contextUsed": context_used, "tokens": tokens, "fy": context.get("fy"),
        "latencyMs": latency_ms, "streamed": True,
    })
    monitoring.log_turn(
        tenant=getattr(db, "name", "?"), user_sub=user_sub, question_len=len(message or ""),
        provider=provider_name, model=model_name, tokens=tokens, latency_ms=latency_ms,
        degraded=degraded, error=error,
    )

    yield {"event": "done", "data": {
        "sessionId": sid, "degraded": degraded, "provider": provider_name,
        "model": model_name, "tokens": tokens,
        "highlights": [i["title"] for i in insights[:3]],
        "recommendations": [i["detail"] for i in kinds["recommendations"][:4]],
        "warnings": [i["detail"] for i in kinds["warnings"][:4]],
    }}


def _format_memory(rows: list[dict]) -> str | None:
    if not rows:
        return None
    parts = []
    for r in rows:
        val = r.get("value")
        parts.append(f"- {r.get('key')}: {val}")
    return "\n".join(parts) if parts else None
