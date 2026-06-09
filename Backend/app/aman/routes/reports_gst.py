"""GST report routes (/api/v3/reports/gst)."""
from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import gst_service

router = APIRouter(prefix="/reports/gst", tags=["aman:reports:gst"])


@router.get("/summary")
async def gst_summary(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                      db=Depends(get_db)):
    return ok(cached_report(tenant, "gst-summary", lambda: gst_service.summary(db, fy), fy=fy),
              meta={"fy": fy})


@router.get("/gstr1")
async def gstr1(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(gst_service.gstr1(db, fy), meta={"fy": fy})


@router.get("/gstr3b")
async def gstr3b(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(gst_service.gstr3b(db, fy), meta={"fy": fy})


@router.get("/rate-breakdown")
async def rate_breakdown(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(gst_service.rate_breakdown(db, fy), meta={"fy": fy})


@router.get("/hsn-summary")
async def hsn_summary(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(gst_service.hsn_summary(db, fy), meta={"fy": fy})
