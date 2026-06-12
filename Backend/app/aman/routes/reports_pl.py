"""Profit & Loss routes (/api/v3/reports/profit-loss) + drilldowns."""
from fastapi import APIRouter, Depends, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok, paginate
from app.aman.services import pl_service, inventory_service
from app.aman.services.drilldown_service import voucher_list_for_ledger

router = APIRouter(prefix="/reports/profit-loss", tags=["aman:reports:profit-loss"])


@router.get("")
async def profit_loss(
    fy: str = Depends(get_fy),
    dateFilter: str | None = Query(None),
    fromDate: str | None = Query(None),
    toDate: str | None = Query(None),
    companyId: str | None = Query(None),
    tenant: str = Depends(get_tenant_key),
    db=Depends(get_db)
):
    resolved_tenant = companyId or tenant
    data = cached_report(
        resolved_tenant,
        "profit-loss",
        lambda: pl_service.build_profit_loss(db, fy, dateFilter, fromDate, toDate),
        fy=fy,
        dateFilter=dateFilter,
        fromDate=fromDate,
        toDate=toDate
    )
    return ok(data, meta={"fy": data.get("fy") or fy})


@router.get("/ledger/{ledger_id}/vouchers")
async def pl_ledger_vouchers(
    ledger_id: str,
    fy: str = Depends(get_fy),
    dateFilter: str | None = Query(None),
    fromDate: str | None = Query(None),
    toDate: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db=Depends(get_db)
):
    from app.aman.services.financial_year import resolve_date_range, date_range_filter
    start_date, end_date = resolve_date_range(dateFilter, fromDate, toDate, fy)
    date_match = date_range_filter(start_date, end_date)
    rows, total = voucher_list_for_ledger(db, fy, ledger_id, page=page, limit=limit, date_match=date_match)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "ledger": ledger_id})


@router.get("/stock/items")
async def pl_stock_items(
    fy: str = Depends(get_fy),
    dateFilter: str | None = Query(None),
    fromDate: str | None = Query(None),
    toDate: str | None = Query(None),
    db=Depends(get_db)
):
    """Closing-stock item list (L3 of the inventory branch of P&L)."""
    from app.aman.services.financial_year import resolve_date_range
    start_date, end_date = resolve_date_range(dateFilter, fromDate, toDate, fy)
    return ok(inventory_service.item_movements(db, fy, start_date, end_date), meta={"fy": fy})


@router.get("/opening-stock")
async def pl_opening_stock(
    fy: str = Depends(get_fy),
    dateFilter: str | None = Query(None),
    fromDate: str | None = Query(None),
    toDate: str | None = Query(None),
    companyId: str | None = Query(None),
    tenant: str = Depends(get_tenant_key),
    db=Depends(get_db)
):
    """Opening Stock Summary — group-level summary (L1 of the dedicated page)."""
    from app.aman.services.financial_year import resolve_date_range
    start_date, end_date = resolve_date_range(dateFilter, fromDate, toDate, fy)
    resolved_tenant = companyId or tenant
    data = cached_report(
        resolved_tenant, "opening-stock",
        lambda: inventory_service.opening_stock_summary(db, fy, start_date, end_date),
        fy=fy, dateFilter=dateFilter, fromDate=fromDate, toDate=toDate,
    )
    return ok(data, meta={"fy": fy, "asOf": data["summary"]["asOfDate"]})


@router.get("/opening-stock/items")
async def pl_opening_stock_items(
    fy: str = Depends(get_fy),
    dateFilter: str | None = Query(None),
    fromDate: str | None = Query(None),
    toDate: str | None = Query(None),
    group: str | None = Query(None),
    search: str | None = Query(None),
    sort: str | None = Query(None),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db=Depends(get_db)
):
    """Opening Stock item list (L2) — paginated, searchable, sortable, group-filterable."""
    from app.aman.services.financial_year import resolve_date_range
    start_date, end_date = resolve_date_range(dateFilter, fromDate, toDate, fy)
    rows, total, extra = inventory_service.opening_stock_items(
        db, fy, start_date, end_date, group=group, search=search,
        sort=sort, order=order, page=page, limit=limit)
    return ok(rows, pagination=paginate(total, page, limit),
              meta={"fy": fy, "group": group, "filteredValue": extra["filteredValue"]})


@router.get("/stock-item/{item_name}/ledger")
async def pl_stock_item_ledger(
    item_name: str,
    fy: str = Depends(get_fy),
    dateFilter: str | None = Query(None),
    fromDate: str | None = Query(None),
    toDate: str | None = Query(None),
    db=Depends(get_db)
):
    from app.aman.services.financial_year import resolve_date_range
    start_date, end_date = resolve_date_range(dateFilter, fromDate, toDate, fy)
    return ok(inventory_service.item_performance(db, fy, item_name, start_date, end_date), meta={"fy": fy})


