"""Balance Sheet routes (/api/v3/reports/balance-sheet) + drill-down."""
from fastapi import APIRouter, Depends, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok, paginate
from app.aman.services import balance_sheet_service as bs
from app.aman.services.drilldown_service import voucher_list_for_ledger

router = APIRouter(prefix="/reports", tags=["aman:reports:balance-sheet"])


@router.get("/balance-sheet")
async def balance_sheet(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                        db=Depends(get_db)):
    """Full Balance Sheet: recursive assets/liabilities tree + KPIs + charts.

    The KPI cards and every chart are derived from this single response, so the
    whole dashboard stays consistent with the statement and the Trial Balance.
    """
    data = cached_report(tenant, "balance-sheet", lambda: bs.build_balance_sheet(db, fy), fy=fy)
    return ok(data, meta={"fy": fy})


@router.get("/balance-sheet/group/{group_id}/children")
async def bs_group_children(group_id: str, fy: str = Depends(get_fy),
                            tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    """Immediate children (sub-groups + ledgers) of any node — lazy drill-down."""
    data = cached_report(tenant, "bs-group", lambda: bs.group_children(db, fy, group_id),
                         fy=fy, group=group_id)
    return ok(data, meta={"fy": fy})


@router.get("/balance-sheet/ledger/{ledger_id}/vouchers")
async def bs_ledger_vouchers(ledger_id: str, fy: str = Depends(get_fy),
                             page: int = Query(1, ge=1), limit: int = Query(100, ge=1, le=500),
                             db=Depends(get_db)):
    """Leaf drill: paginated vouchers that move a given ledger in the FY."""
    rows, total = voucher_list_for_ledger(db, fy, ledger_id, page=page, limit=limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "ledger": ledger_id})
