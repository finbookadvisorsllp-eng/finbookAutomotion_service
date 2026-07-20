"""Aman (LiveTally) router registration — everything under /api/v3.

Public routes (auth, health) are open; all report/data routes are gated by
``require_aman_subscription`` so an anjalee token can never reach /api/v3.
"""
from datetime import datetime

from fastapi import APIRouter, Depends

from app.aman.core.dependencies import require_aman_subscription
from app.aman.core.cache import report_cache
from . import (
    auth, companies, setup, reports_tb, reports_pl, reports_bs, reports_gst,
    reports_cashflow, daybook, outstanding, sales, purchase, parties,
    cashbank, inventory, accounting, analytics, alerts, dashboard, export,
)
# AI CFO lives in its own package (app.aman.ai_cfo) so it stays easy to evolve
# and test in isolation. It is subscription-gated like every other data route.
from app.aman.ai_cfo.routes import router as ai_cfo_router
# Business Health is a sibling self-contained package (app.aman.business_health):
# it orchestrates the report services into scores, risks, opportunities and a
# tracked Decision Ledger. Subscription-gated and company-scoped like the rest.
from app.aman.business_health.routes import router as business_health_router

aman_api_router = APIRouter(prefix="/api/v3")


@aman_api_router.get("/health", tags=["aman:health"])
async def health():
    return {"success": True, "app": "aman", "prefix": "/api/v3",
            "message": "LiveTally (aman) API running",
            "timestamp": datetime.utcnow().isoformat(),
            "cache": report_cache.stats()}


# ─── Public ───
aman_api_router.include_router(auth.router)

# ─── Protected (subscription-gated) ───
_protected = APIRouter(dependencies=[Depends(require_aman_subscription)])
for _module in (
    companies, setup, dashboard, reports_tb, reports_pl, reports_bs, reports_gst,
    reports_cashflow, daybook, outstanding, sales, purchase, parties,
    cashbank, inventory, accounting, analytics, alerts, export,
):
    _protected.include_router(_module.router)

# AI CFO + Business Health routers (imported directly from their own packages).
_protected.include_router(ai_cfo_router)
_protected.include_router(business_health_router)

aman_api_router.include_router(_protected)
