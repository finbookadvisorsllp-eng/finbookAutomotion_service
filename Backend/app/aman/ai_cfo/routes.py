"""AI CFO API routes — mounted under /api/v3/ai-cfo (subscription-gated).

Endpoints
---------
GET    /ai-cfo/health            provider/config status
POST   /ai-cfo/chat              ask the AI CFO a question
GET    /ai-cfo/history           list sessions, or messages of one session
GET    /ai-cfo/suggestions       suggested questions (dynamic + starters)
DELETE /ai-cfo/conversation      delete a conversation (session + messages)
GET    /ai-cfo/recommendations   deterministic, reconciled recommendations
GET    /ai-cfo/warnings          risk warnings
GET    /ai-cfo/alerts            critical alerts
GET    /ai-cfo/insights          all rules-engine insights
GET/POST/DELETE /ai-cfo/memory   business memory (goals/targets/preferences)

Handlers are sync ``def`` so blocking Mongo + provider I/O runs in the threadpool
(does not stall the event loop). Tenant isolation + auth are inherited from the
protected router; ``get_current_user`` gives the owner for per-user scoping.
"""
import json

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.aman.core.dependencies import get_db, get_fy, get_current_user, get_tenant_key
from app.aman.core.serializers import serialize_docs
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.ai_cfo.config import ai_cfo_settings as cfg
from app.aman.ai_cfo.schemas import ChatRequest
from app.aman.ai_cfo import service, repository as repo
from app.aman.ai_cfo import suggestions as sugg
from app.aman.ai_cfo import context_builder as ctx, rules_engine, monitoring, forecast, findings
from app.aman.ai_cfo.providers import ProviderError

router = APIRouter(prefix="/ai-cfo", tags=["aman:ai-cfo"])


# ─────────────────────────────── Health ───────────────────────────────
@router.get("/health")
def health():
    return ok({
        "feature": cfg.FEATURE_NAME,
        "provider": cfg.PROVIDER,
        "model": cfg.active_model,
        "configured": cfg.is_configured,
        "gracefulDegrade": cfg.GRACEFUL_DEGRADE,
    })


# ─────────────────────────────── Chat ───────────────────────────────
@router.post("/chat")
def chat(payload: ChatRequest, db=Depends(get_db), user: dict = Depends(get_current_user)):
    fy = payload.fy  # optional; service defaults to current FY
    try:
        result = service.answer_chat(db, user, payload.message, payload.sessionId, fy)
    except ProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"AI provider error: {exc}")
    return ok(result, meta={"fy": result.get("fy")})


@router.post("/chat/stream")
def chat_stream(payload: ChatRequest, db=Depends(get_db),
                user: dict = Depends(get_current_user)):
    """Server-Sent Events: streams the answer token-by-token as the model generates
    it (real-time 'typing'). Falls back to a grounded local answer on provider error.
    Events: ``meta`` → many ``token`` → ``done`` (or ``error``)."""
    def sse():
        try:
            for ev in service.stream_chat(db, user, payload.message, payload.sessionId, payload.fy):
                yield f"event: {ev['event']}\ndata: {json.dumps(ev['data'])}\n\n"
        except ProviderError as exc:
            yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",   # disable proxy buffering (nginx) so tokens flush
    })


# ─────────────────────────────── History ───────────────────────────────
@router.get("/history")
def history(sessionId: str | None = Query(default=None),
            limit: int = Query(default=50, ge=1, le=200),
            db=Depends(get_db), user: dict = Depends(get_current_user)):
    """No sessionId → list this user's sessions. With sessionId → its messages."""
    user_sub = str(user.get("sub") or user.get("email") or "unknown")
    if sessionId:
        msgs = repo.get_messages(db, sessionId, limit=limit)
        return ok(serialize_docs(msgs), meta={"sessionId": sessionId, "count": len(msgs)})
    sessions = repo.list_sessions(db, user_sub, limit=limit)
    return ok(serialize_docs(sessions), meta={"count": len(sessions)})


# ─────────────────────────────── Suggestions ───────────────────────────────
@router.get("/suggestions")
def suggestions(fy: str = Depends(get_fy), limit: int = Query(default=8, ge=1, le=20),
                db=Depends(get_db)):
    return ok(sugg.build_suggestions(db, fy, limit), meta={"fy": fy})


# ─────────────────────────────── Delete conversation ───────────────────────────────
@router.delete("/conversation")
def delete_conversation(sessionId: str = Query(...), db=Depends(get_db)):
    deleted = repo.delete_session(db, sessionId)
    return ok({"sessionId": sessionId, "deletedMessages": deleted})


# ─────────────────────────────── Recommendations / warnings / alerts ───────────────────────────────
def _insights(db, fy: str) -> list[dict]:
    context = ctx.build_context(db, fy)
    return rules_engine.evaluate(context)


@router.get("/insights")
def insights(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(_insights(db, fy), meta={"fy": fy})


@router.get("/health-score")
def health_score_endpoint(fy: str = Depends(get_fy), db=Depends(get_db)):
    """Deterministic 0–100 health score — **the same score Business Health shows**.

    This used to run its own 4-pillar scorer (profit 35 / liquidity 30 / collections 20
    / growth 15), which meant one company could show two different health scores in the
    same app — the AI CFO rail and the Business Health page disagreeing. There is now a
    single source of truth: Business Health's 5-pillar model. The response keeps the
    legacy ``components`` key so existing callers keep working.

    Imported inside the function: ``business_health.briefing`` imports the AI CFO
    provider, so a module-level import here would be circular.
    """
    from app.aman.business_health import pillars as bh_pillars
    from app.aman.business_health.engines import kpi as bh_kpi

    sc = bh_pillars.compute(bh_kpi.build_metrics(db, fy))
    return ok({
        "overall": sc["overall"], "grade": sc["grade"], "label": sc["label"],
        "coverage": sc["coverage"],
        "components": [
            {"key": p["key"], "label": p["label"], "score": p["score"],
             "weight": p["weight"], "band": p["band"],
             "detail": (p["drivers"][0]["detail"] if p.get("drivers") else "")}
            for p in sc["pillars"]
        ],
    }, meta={"fy": fy})


@router.get("/stats")
def stats(days: int = Query(default=30, ge=1, le=365), db=Depends(get_db)):
    """AI CFO usage stats for this tenant: volume, latency, tokens, degraded rate."""
    return ok(monitoring.usage_stats(db, days), meta={"days": days})


@router.get("/forecast")
def forecast_endpoint(fy: str = Depends(get_fy), months: int = Query(default=3, ge=1, le=12),
                      db=Depends(get_db)):
    """Sales / cash / collections outlook (transparent linear projection + caveats)."""
    return ok(forecast.build_forecast(db, fy, months), meta={"fy": fy})


@router.get("/brief")
def brief_endpoint(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    """CFO Brief: the findings engine (CFO_REASONING_MODEL.md). One unified pass that
    surfaces only *material* findings — ranked across categories, worst first — plus a
    per-category summary (so a clean category reads 'checked, all clear', never blank).
    Deterministic; the LLM only narrates this list downstream."""
    return ok(cached_report(tenant, "ai_cfo_brief", lambda: findings.build_findings(db, fy), fy=fy),
              meta={"fy": fy})


@router.get("/recommendations")
def recommendations(fy: str = Depends(get_fy), db=Depends(get_db)):
    kinds = rules_engine.split_by_kind(_insights(db, fy))
    return ok(kinds["recommendations"], meta={"fy": fy})


@router.get("/warnings")
def warnings(fy: str = Depends(get_fy), db=Depends(get_db)):
    kinds = rules_engine.split_by_kind(_insights(db, fy))
    return ok(kinds["warnings"], meta={"fy": fy})


@router.get("/alerts")
def alerts(fy: str = Depends(get_fy), db=Depends(get_db)):
    kinds = rules_engine.split_by_kind(_insights(db, fy))
    return ok(kinds["alerts"], meta={"fy": fy})


# ─────────────────────────────── Business memory ───────────────────────────────
@router.get("/memory")
def get_memory(db=Depends(get_db), user: dict = Depends(get_current_user)):
    user_sub = str(user.get("sub") or user.get("email") or "unknown")
    return ok(serialize_docs(repo.get_business_memory(db, user_sub)))


@router.post("/memory")
def set_memory(payload: dict = Body(...), db=Depends(get_db),
               user: dict = Depends(get_current_user)):
    key = (payload.get("key") or "").strip()
    if not key:
        raise HTTPException(status_code=422, detail="'key' is required")
    user_sub = str(user.get("sub") or user.get("email") or "unknown")
    doc = repo.upsert_business_memory(db, user_sub, key, payload.get("value"),
                                      payload.get("category", "general"))
    from app.aman.core.serializers import serialize_doc
    return ok(serialize_doc(doc))


@router.delete("/memory")
def delete_memory(key: str = Query(...), db=Depends(get_db),
                  user: dict = Depends(get_current_user)):
    user_sub = str(user.get("sub") or user.get("email") or "unknown")
    deleted = repo.delete_business_memory(db, user_sub, key)
    return ok({"key": key, "deleted": deleted})
