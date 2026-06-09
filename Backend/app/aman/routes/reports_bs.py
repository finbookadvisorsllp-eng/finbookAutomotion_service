"""Balance Sheet route (/api/v3/reports/balance-sheet)."""
from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import balance_sheet_service as bs

router = APIRouter(prefix="/reports", tags=["aman:reports:balance-sheet"])


@router.get("/balance-sheet")
async def balance_sheet(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                        db=Depends(get_db)):
    data = cached_report(tenant, "balance-sheet", lambda: bs.build_balance_sheet(db, fy), fy=fy)
    return ok(data, meta={"fy": fy})
