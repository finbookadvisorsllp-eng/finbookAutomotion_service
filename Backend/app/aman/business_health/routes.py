"""Business Health API routes — mounted under /api/v3/business-health.

Included on the aman *protected* router, so every endpoint inherits
``require_aman_subscription`` (an anjalee token can never reach it) and the tenant
database is resolved from ``x-company-id`` — all intelligence is company-scoped by
construction (approved decision).

Read/derived endpoints share one cached grounded-metrics build so a request costs
one heavy compute at most. Ledger writes are always live. The weekly snapshot is
written lazily from BOTH /overview and /score (approved), so history accrues even
for users who only open the score page. The AI briefing is a separate lazy call.
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status

from app.aman.core.dependencies import (
    get_db, get_fy, get_tenant_key, get_current_user, require_company_access,
)
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services.financial_year import is_valid_fy

from app.aman.business_health.config import bh_settings as cfg
from app.aman.business_health import service, briefing, snapshots
from app.aman.business_health.engines import kpi, risk, opportunity
from app.aman.business_health.schemas import (
    SimulateRequest, ActRequest, SnoozeRequest, DismissRequest,
)

# Every Business Health route additionally requires that the caller is authorized
# for the company named in x-company-id (per-company isolation, R-SEC-2).
router = APIRouter(prefix=cfg.ROUTE_PREFIX, tags=["aman:business-health"],
                   dependencies=[Depends(require_company_access)])


# ─────────────────────────── shared cached metrics ───────────────────────────
def _metrics(db, tenant: str, fy: str) -> dict:
    """One reconciled metrics build per (tenant, fy), reused across endpoints."""
    return cached_report(tenant, "bh_metrics", lambda: service.metrics(db, fy), fy=fy)


def _user_sub(user: dict) -> str:
    return str(user.get("sub") or user.get("email") or "unknown")


# ─────────────────────────── Health probe ───────────────────────────
@router.get("/health")
def health():
    """Readiness + configuration probe (no DB). Surfaces the scoring model so a
    misconfiguration (e.g. pillar weights not summing to 100) is visible at once."""
    try:
        from app.aman.ai_cfo.config import ai_cfo_settings
        briefing_ready = ai_cfo_settings.is_configured
    except Exception:  # noqa: BLE001
        briefing_ready = False
    return ok({
        "feature": cfg.FEATURE_NAME, "version": cfg.VERSION,
        "prefix": f"/api/v3{cfg.ROUTE_PREFIX}", "decisionScope": cfg.DECISION_SCOPE,
        "pillars": [{"key": k, "label": cfg.PILLAR_LABELS.get(k, k), "weight": w}
                    for k, w in cfg.PILLAR_WEIGHTS.items()],
        "weightsValid": cfg.weights_valid,
        "collections": {"decisions": cfg.DECISIONS_COLLECTION, "snapshots": cfg.SNAPSHOTS_COLLECTION},
        "briefingConfigured": briefing_ready, "briefingAiEnabled": cfg.BRIEFING_AI_ENABLED,
        "cacheEnabled": cfg.CACHE_ENABLED,
    })


# ─────────────────────────── Composed landing ───────────────────────────
@router.get("/overview")
def overview(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    m = _metrics(db, tenant, fy)
    sc = service.score(m)
    return ok(service.build_overview(db, fy, m, sc), meta={"fy": fy})


# ─────────────────────────── Score / pillars / KPIs ───────────────────────────
@router.get("/score")
def score(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    m = _metrics(db, tenant, fy)
    sc = service.score(m)
    # Approved: also accrue weekly history when a user opens only the score page.
    snapshots.maybe_write_weekly(db, fy, sc, m)
    return ok(sc, meta={"fy": fy})


# ─────────────────────────── Impact tracker (since onboarding) ───────────────────────────
@router.get("/impact")
def impact(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    """"How much better is this business since it joined?" — before→after vitals vs
    the onboarding baseline snapshot, the overall-score delta, and the realised ₹
    impact of acted decisions. Also accrues weekly history from this page."""
    m = _metrics(db, tenant, fy)
    sc = service.score(m)
    snapshots.maybe_write_weekly(db, fy, sc, m)
    return ok(service.build_impact(db, fy, m, sc), meta={"fy": fy})


@router.get("/pillars")
def pillars_endpoint(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    m = _metrics(db, tenant, fy)
    return ok(service.score(m)["pillars"], meta={"fy": fy})


@router.get("/kpis")
def kpis(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    m = _metrics(db, tenant, fy)
    return ok(cached_report(tenant, "bh_kpis", lambda: kpi.vital_signs(m), fy=fy), meta={"fy": fy})


# ─────────────────────────── Insights / risks / opportunities ───────────────────────────
@router.get("/insights")
def insights(fy: str = Depends(get_fy), type: str | None = Query(default=None),
             tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    m = _metrics(db, tenant, fy)
    return ok(service.insights(db, fy, m, type), meta={"fy": fy})


@router.get("/risks")
def risks(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    m = _metrics(db, tenant, fy)
    return ok(cached_report(tenant, "bh_risks", lambda: risk.evaluate(m), fy=fy), meta={"fy": fy})


@router.get("/opportunities")
def opportunities(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    m = _metrics(db, tenant, fy)
    return ok(cached_report(tenant, "bh_opps", lambda: opportunity.evaluate(db, m), fy=fy), meta={"fy": fy})


# ─────────────────────────── Simulator ───────────────────────────
@router.post("/simulate")
def simulate(payload: SimulateRequest = Body(...), fy: str = Depends(get_fy),
             tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    use_fy = payload.fy if (payload.fy and is_valid_fy(payload.fy)) else fy
    base = _metrics(db, tenant, use_fy)
    base_overall = service.score(base).get("overall")
    sim_metrics = service.metrics(db, use_fy, overrides=payload.overrides or {})
    from app.aman.business_health import pillars
    return ok(pillars.simulate(sim_metrics, base_overall), meta={"fy": use_fy})


# ─────────────────────────── Decision Ledger ───────────────────────────
@router.get("/decisions")
def decisions(fy: str = Depends(get_fy), status: str | None = Query(default=None),
              tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    m = _metrics(db, tenant, fy)
    return ok(service.list_decisions(db, fy, status, m=m), meta={"fy": fy})


@router.post("/decisions/generate")
def generate(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    m = _metrics(db, tenant, fy)
    return ok(service.generate_decisions(db, fy, m), meta={"fy": fy})


@router.post("/decisions/{decision_id}/act")
def act(decision_id: str, payload: ActRequest = Body(default=ActRequest()),
        db=Depends(get_db), user: dict = Depends(get_current_user)):
    d = service.act(db, decision_id, _user_sub(user), payload.note)
    if d is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")
    return ok(d)


@router.post("/decisions/{decision_id}/snooze")
def snooze(decision_id: str, payload: SnoozeRequest = Body(default=SnoozeRequest()), db=Depends(get_db)):
    d = service.snooze(db, decision_id, payload.days, payload.until)
    if d is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")
    return ok(d)


@router.post("/decisions/{decision_id}/dismiss")
def dismiss(decision_id: str, payload: DismissRequest = Body(default=DismissRequest()), db=Depends(get_db)):
    d = service.dismiss(db, decision_id, payload.reason)
    if d is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")
    return ok(d)


# ─────────────────────────── Briefing / trend ───────────────────────────
@router.get("/briefing")
def briefing_endpoint(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    return ok(cached_report(tenant, "bh_briefing", lambda: briefing.build(db, fy),
                            ttl=cfg.BRIEFING_CACHE_TTL, fy=fy), meta={"fy": fy})


@router.get("/trend")
def trend(fy: str = Depends(get_fy), limit: int = Query(default=12, ge=1, le=52), db=Depends(get_db)):
    return ok(snapshots.trend_series(db, fy, limit), meta={"fy": fy})
