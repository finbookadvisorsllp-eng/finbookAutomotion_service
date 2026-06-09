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
    cashbank, inventory, accounting, analytics, alerts, dashboard,
)

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
    cashbank, inventory, accounting, analytics, alerts,
):
    _protected.include_router(_module.router)

aman_api_router.include_router(_protected)
