"""Cash & Bank routes (/api/v3/cash-bank).

The generic ``/cash-bank/drilldown`` endpoint is the Tally-like engine — one URL
serves every level (summary → ledgers → monthly → date-wise → voucher) for the
selected company, with server-side pagination / search / sort / filters. The
legacy ``/dashboard`` / ``/ledger`` endpoints are kept for back-compat.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import cashbank_service
from app.aman.services import cashbank_drilldown_service as drill
from app.aman.services.drilldown_service import get_voucher_detail
from app.aman.services.financial_year import resolve_date_range
from app.aman.routes.export import export_response, collect_params

router = APIRouter(prefix="/cash-bank", tags=["aman:cash-bank"])


@router.get("/dashboard")
async def dashboard(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                    db=Depends(get_db)):
    return ok(cached_report(tenant, "cashbank-dash",
                            lambda: cashbank_service.dashboard(db, fy), fy=fy), meta={"fy": fy})


@router.get("/drilldown")
async def drilldown(
    level: int = Query(0, ge=0, le=4),
    category: Optional[str] = Query(None),
    group: Optional[str] = Query(None),
    ledgerId: Optional[str] = Query(None),
    ledgerName: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    voucherId: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=0, le=500),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    order: str = Query("asc"),
    voucherType: Optional[str] = Query(None),
    dateFilter: Optional[str] = Query(None),
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    fy: str = Depends(get_fy),
    tenant: str = Depends(get_tenant_key),
    db=Depends(get_db),
):
    start, end = resolve_date_range(dateFilter, fromDate, toDate, fy)
    params = {
        "level": level, "category": category, "group": group, "ledgerId": ledgerId,
        "ledgerName": ledgerName, "month": month, "voucherId": voucherId,
        "page": page, "limit": limit, "search": search, "sort": sort, "order": order,
        "voucherType": voucherType, "start": start, "end": end,
    }

    def _build():
        return drill.drilldown(db, fy, level, params)

    # Cache the deterministic, non-paginated levels (summary / monthly).
    if level in (0, 2) and not search:
        result = cached_report(
            tenant, f"cashbank-drill-l{level}", _build,
            fy=fy, group=group, ledgerId=ledgerId, ledgerName=ledgerName,
            dateFilter=dateFilter, fromDate=fromDate, toDate=toDate)
    else:
        result = _build()

    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return ok(result.get("data"), pagination=result.get("pagination"), meta=result.get("meta"))


@router.get("/export")
async def export(
    format: str = Query("pdf"),
    level: int = Query(0),
    category: Optional[str] = Query(None),
    group: Optional[str] = Query(None),
    ledgerId: Optional[str] = Query(None),
    ledgerName: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    voucherId: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    voucherType: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    order: str = Query("asc"),
    dateFilter: Optional[str] = Query(None),
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    fy: str = Depends(get_fy),
    db=Depends(get_db),
):
    params = collect_params(level, group, ledgerId, ledgerName, month, voucherId,
                            search, voucherType, sort, order, dateFilter, fromDate, toDate, fy,
                            category=category)
    return export_response(db, "cash-bank", fy, format, params)


@router.get("/ledger/{account_id}")
async def ledger(account_id: str, fy: str = Depends(get_fy), db=Depends(get_db)):
    detail = cashbank_service.ledger_detail(db, fy, account_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Account not found")
    return ok(detail, meta={"fy": fy})


@router.get("/voucher/{ident:path}")
async def voucher(ident: str, db=Depends(get_db)):
    detail = get_voucher_detail(db, ident)
    if not detail:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return ok(detail)
