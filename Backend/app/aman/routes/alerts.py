"""Alerts + Notifications routes (/api/v3/alerts, /api/v3/notifications)."""
from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db, get_fy
from app.aman.models.common import ok
from app.aman.services import dashboard_service

router = APIRouter(tags=["aman:alerts"])


@router.get("/alerts")
async def alerts(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(dashboard_service.alerts(db, fy), meta={"fy": fy})


@router.get("/notifications")
async def notifications(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(dashboard_service.notifications(db, fy), meta={"fy": fy})
