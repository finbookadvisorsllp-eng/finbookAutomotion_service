"""Inventory routes (/api/v3/inventory).

Every report is fully dynamic, company-aware (``x-company-id`` -> tenant DB) and
period-aware (FY or custom range). Stock movement/valuation is derived from the
``stockItems`` masters + ``vouchers`` inventory entries — no hardcoded figures.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import inventory_service as inv
from app.aman.services.financial_year import resolve_date_range

router = APIRouter(prefix="/inventory", tags=["aman:inventory"])


def _range(dateFilter, fromDate, toDate, fy):
    return resolve_date_range(dateFilter, fromDate, toDate, fy)


@router.get("")
async def stock_summary(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                        dateFilter: Optional[str] = None, fromDate: Optional[str] = None,
                        toDate: Optional[str] = None, db=Depends(get_db)):
    start, end = _range(dateFilter, fromDate, toDate, fy)
    return ok(cached_report(tenant, "inv-summary",
                            lambda: inv.stock_summary(db, None, start, end),
                            fy=fy, fromDate=fromDate, toDate=toDate),
              meta={"fy": fy})


@router.get("/drilldown")
async def drilldown(
    level: int = Query(0, ge=0, le=3),
    group: Optional[str] = Query(None),
    item: Optional[str] = Query(None),
    voucherId: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=0, le=500),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    order: str = Query("desc"),
    dateFilter: Optional[str] = Query(None),
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    fy: str = Depends(get_fy),
    tenant: str = Depends(get_tenant_key),
    db=Depends(get_db),
):
    start, end = _range(dateFilter, fromDate, toDate, fy)
    params = {"level": level, "group": group, "item": item, "voucherId": voucherId,
              "page": page, "limit": limit, "search": search, "sort": sort, "order": order,
              "start": start, "end": end}

    def _build():
        return inv.inventory_drilldown(db, fy, level, params)

    # Cache the deterministic group / item levels (no search) — keeps drill fast.
    if level in (0, 1) and not search:
        result = cached_report(tenant, "inv-drill", _build,
                               fy=fy, level=level, group=group, page=page, limit=limit,
                               sort=sort, order=order, fromDate=fromDate, toDate=toDate)
    else:
        result = _build()
    return ok(result.get("data"), pagination=result.get("pagination"), meta=result.get("meta"))


@router.get("/slow")
async def slow_moving(
    days: int = Query(90, ge=1, le=3650),
    search: Optional[str] = Query(None), sort: Optional[str] = Query(None),
    order: str = Query("desc"), page: int = Query(1, ge=1), limit: int = Query(0, ge=0, le=500),
    dateFilter: Optional[str] = Query(None), fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None), fy: str = Depends(get_fy), db=Depends(get_db),
):
    start, end = _range(dateFilter, fromDate, toDate, fy)
    r = inv.slow_moving(db, None, start, end, days=days, search=search, sort=sort,
                        order=order, page=page, limit=limit)
    return ok(r["items"], pagination=r["pagination"], meta={"fy": fy, "summary": r["summary"]})


@router.get("/fast")
async def fast_moving(
    top: int = Query(0, ge=0, le=1000),
    search: Optional[str] = Query(None), sort: Optional[str] = Query(None),
    order: str = Query("desc"), page: int = Query(1, ge=1), limit: int = Query(0, ge=0, le=500),
    dateFilter: Optional[str] = Query(None), fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None), fy: str = Depends(get_fy), db=Depends(get_db),
):
    start, end = _range(dateFilter, fromDate, toDate, fy)
    r = inv.fast_moving(db, None, start, end, top=top, search=search, sort=sort,
                        order=order, page=page, limit=limit)
    return ok(r["items"], pagination=r["pagination"], meta={"fy": fy, "summary": r["summary"]})


@router.get("/valuation")
async def valuation(
    search: Optional[str] = Query(None), group: Optional[str] = Query(None),
    sort: Optional[str] = Query(None), order: str = Query("desc"),
    page: int = Query(1, ge=1), limit: int = Query(0, ge=0, le=500),
    dateFilter: Optional[str] = Query(None), fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None), fy: str = Depends(get_fy), db=Depends(get_db),
):
    start, end = _range(dateFilter, fromDate, toDate, fy)
    r = inv.valuation(db, None, start, end, search=search, group=group, sort=sort,
                      order=order, page=page, limit=limit)
    return ok(r["items"], pagination=r["pagination"],
              meta={"fy": fy, "totalValue": r["totalValue"], "byGroup": r["byGroup"],
                    "byMethod": r["byMethod"]})


@router.get("/alerts")
async def alerts(
    search: Optional[str] = Query(None), page: int = Query(1, ge=1), limit: int = Query(0, ge=0, le=500),
    dateFilter: Optional[str] = Query(None), fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None), fy: str = Depends(get_fy), db=Depends(get_db),
):
    start, end = _range(dateFilter, fromDate, toDate, fy)
    r = inv.stock_alerts(db, None, start, end, search=search, page=page, limit=limit)
    return ok(r["items"], pagination=r["pagination"],
              meta={"fy": fy, "summary": r["summary"], "dataGaps": r["dataGaps"]})


@router.get("/performance")
async def performance(
    search: Optional[str] = Query(None), group: Optional[str] = Query(None),
    sort: Optional[str] = Query(None), order: str = Query("desc"),
    page: int = Query(1, ge=1), limit: int = Query(0, ge=0, le=500),
    dateFilter: Optional[str] = Query(None), fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None), fy: str = Depends(get_fy), db=Depends(get_db),
):
    start, end = _range(dateFilter, fromDate, toDate, fy)
    r = inv.performance_list(db, None, start, end, search=search, group=group, sort=sort,
                             order=order, page=page, limit=limit)
    return ok(r["items"], pagination=r["pagination"], meta={"fy": fy, "summary": r["summary"]})


@router.get("/item/{item_name:path}/performance")
async def item_performance(item_name: str, fy: str = Depends(get_fy),
                           dateFilter: Optional[str] = None, fromDate: Optional[str] = None,
                           toDate: Optional[str] = None, db=Depends(get_db)):
    start, end = _range(dateFilter, fromDate, toDate, fy)
    return ok(inv.item_performance(db, None, item_name, start, end), meta={"fy": fy})
