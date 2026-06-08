"""Outstanding reports (/api/v3/reports/outstanding)."""
from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import parties_service

router = APIRouter(prefix="/reports/outstanding", tags=["aman:reports:outstanding"])


@router.get("/receivables")
async def receivables(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                      db=Depends(get_db)):
    return ok(cached_report(tenant, "outstanding-rec",
                            lambda: parties_service.receivables(db, fy), fy=fy), meta={"fy": fy})


@router.get("/payables")
async def payables(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                   db=Depends(get_db)):
    return ok(cached_report(tenant, "outstanding-pay",
                            lambda: parties_service.payables(db, fy), fy=fy), meta={"fy": fy})
