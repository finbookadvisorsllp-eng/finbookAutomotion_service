"""Cash Flow route (/api/v3/reports/cash-flow)."""
from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import cashbank_service

router = APIRouter(prefix="/reports", tags=["aman:reports:cash-flow"])


@router.get("/cash-flow")
async def cash_flow(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                    db=Depends(get_db)):
    return ok(cached_report(tenant, "cash-flow", lambda: cashbank_service.cash_flow(db, fy), fy=fy),
              meta={"fy": fy})
