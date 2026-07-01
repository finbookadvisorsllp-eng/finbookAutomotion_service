"""Cash Flow routes (/api/v3/reports/cash-flow) — Tally direct-method + drill-down."""
from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok, paginate
from app.aman.services import cashflow_service
from app.aman.services.financial_year import resolve_date_range, date_range_filter
from app.aman.services.drilldown_service import voucher_list_for_ledger

router = APIRouter(prefix="/reports", tags=["aman:reports:cash-flow"])


@router.get("/cash-flow")
async def cash_flow(
    fy: str = Depends(get_fy),
    dateFilter: Optional[str] = Query(None),
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    tenant: str = Depends(get_tenant_key),
    db=Depends(get_db),
):
    """Full Cash Flow statement: opening/closing pool, Operating/Investing/Financing
    tree (group → ledger), monthly series. Cards/charts/table all read this one
    response, so every figure reconciles (Opening + Inflow − Outflow = Closing)."""
    start, end = resolve_date_range(dateFilter, fromDate, toDate, fy)
    data = cached_report(
        tenant, "cash-flow",
        lambda: cashflow_service.build_cash_flow(db, fy, start, end),
        fy=fy, dateFilter=dateFilter, fromDate=fromDate, toDate=toDate,
    )
    return ok(data, meta={"fy": fy})


@router.get("/cash-flow/ledger/{ledger_id}/vouchers")
async def cash_flow_ledger_vouchers(
    ledger_id: str, fy: str = Depends(get_fy),
    dateFilter: Optional[str] = Query(None),
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=500),
    db=Depends(get_db),
):
    """Leaf drill: paginated cash/bank vouchers moving a given ledger."""
    start, end = resolve_date_range(dateFilter, fromDate, toDate, fy)
    date_match = date_range_filter(start, end)
    rows, total = voucher_list_for_ledger(db, fy, ledger_id, page=page, limit=limit, date_match=date_match)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "ledger": ledger_id})
