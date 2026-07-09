"""Production logging + usage monitoring for the AI CFO (Phase 13).

Two responsibilities:
  * ``log_turn`` — emit a structured log line per chat turn (question length,
    provider/model, tokens, latency, degraded/error) via the stdlib logger. Safe
    for any log aggregator; never logs the raw financial answer or PII beyond the
    user id already on the token.
  * ``usage_stats`` — aggregate the audit metadata we already persist on each
    assistant message (``ai_conversations.meta``) into a usage summary for a
    ``/stats`` endpoint: volume, avg latency, token totals, degraded rate.

No new collection is required — the assistant messages already carry the meta.
"""
import logging
from datetime import datetime, timedelta

from app.aman.ai_cfo.config import ai_cfo_settings as cfg

logger = logging.getLogger("aman.ai_cfo")


def log_turn(*, tenant: str, user_sub: str, question_len: int, provider: str,
             model: str | None, tokens: dict, latency_ms: int, degraded: bool,
             error: str | None = None) -> None:
    """Structured, PII-light log line for one chat turn."""
    payload = {
        "event": "ai_cfo_turn",
        "tenant": tenant,
        "user": user_sub,
        "qLen": question_len,
        "provider": provider,
        "model": model,
        "tokens": tokens.get("total", 0),
        "latencyMs": latency_ms,
        "degraded": degraded,
    }
    if error:
        payload["error"] = error[:300]
        logger.warning("ai_cfo_turn_failed %s", payload)
    else:
        logger.info("ai_cfo_turn %s", payload)


def usage_stats(db, days: int = 30) -> dict:
    """Aggregate assistant-message metadata into a usage summary for ``days`` back."""
    since = datetime.utcnow() - timedelta(days=max(1, days))
    coll = db[cfg.CONVERSATIONS_COLLECTION]
    cur = coll.find(
        {"role": "assistant", "createdAt": {"$gte": since}},
        projection={"meta": 1, "createdAt": 1},
    )
    total = 0
    degraded = 0
    tok_prompt = tok_completion = tok_total = 0
    latencies: list[int] = []
    by_model: dict[str, int] = {}
    for doc in cur:
        meta = doc.get("meta") or {}
        total += 1
        if meta.get("degraded"):
            degraded += 1
        tks = meta.get("tokens") or {}
        tok_prompt += int(tks.get("prompt", 0) or 0)
        tok_completion += int(tks.get("completion", 0) or 0)
        tok_total += int(tks.get("total", 0) or 0)
        if isinstance(meta.get("latencyMs"), (int, float)):
            latencies.append(int(meta["latencyMs"]))
        model = meta.get("model") or "unknown"
        by_model[model] = by_model.get(model, 0) + 1

    avg_latency = round(sum(latencies) / len(latencies)) if latencies else 0
    return {
        "windowDays": days,
        "totalTurns": total,
        "degradedTurns": degraded,
        "degradedRate": round(degraded / total * 100, 1) if total else 0.0,
        "tokens": {"prompt": tok_prompt, "completion": tok_completion, "total": tok_total},
        "avgLatencyMs": avg_latency,
        "byModel": by_model,
    }
