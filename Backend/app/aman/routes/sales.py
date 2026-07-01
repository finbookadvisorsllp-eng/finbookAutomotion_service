"""Sales module routes (/api/v3/sales) — register + Order/Credit/Delivery (Pattern B)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok, paginate
from app.aman.services import transactions_service as tx, dashboard_service
from app.aman.services import sales_register_service as sreg
from app.aman.services.drilldown_service import get_voucher_detail
from app.aman.services.financial_year import resolve_date_range
from app.aman.routes.export import export_response, collect_params

router = APIRouter(prefix="/sales", tags=["aman:sales"])


# ── Dynamic Sales Register (Tally-matched, company-aware, drill-down engine) ──
@router.get("/register/drilldown")
async def register_drilldown(
    report: str = Query("sales"),
    level: int = Query(0, ge=0, le=2),
    groupBy: str = Query("month"),
    groupValue: Optional[str] = Query(None),
    measure: str = Query("gross"),
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
    if report not in sreg.REPORTS:
        raise HTTPException(status_code=404, detail=f"Unknown report '{report}'")
    start, end = resolve_date_range(dateFilter, fromDate, toDate, fy)
    params = {"report": report, "level": level, "groupBy": groupBy, "groupValue": groupValue,
              "measure": measure, "voucherId": voucherId, "page": page, "limit": limit,
              "search": search, "sort": sort, "order": order, "start": start, "end": end}

    def _build():
        return sreg.drilldown(db, fy, level, params)

    # Cache the deterministic level-0 grouped views (no search / no custom range).
    if level == 0 and groupBy != "bill" and not search:
        result = cached_report(
            tenant, "sales-reg-l0", _build,
            fy=fy, doc=report, groupBy=groupBy, measure=measure,
            dateFilter=dateFilter, fromDate=fromDate, toDate=toDate)
    else:
        result = _build()

    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return ok(result.get("data"), pagination=result.get("pagination"), meta=result.get("meta"))


@router.get("/register/export")
async def register_export(
    report: str = Query("sales"),
    format: str = Query("pdf"),
    level: int = Query(0),
    groupBy: str = Query("month"),
    groupValue: Optional[str] = Query(None),
    measure: str = Query("gross"),
    voucherId: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    order: str = Query("desc"),
    dateFilter: Optional[str] = Query(None),
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    fy: str = Depends(get_fy),
    db=Depends(get_db),
):
    if report not in sreg.REPORTS:
        raise HTTPException(status_code=404, detail=f"Unknown report '{report}'")
    params = collect_params(level, None, None, None, None, voucherId,
                            search, None, sort, order, dateFilter, fromDate, toDate, fy)
    params.update({"report": report, "groupBy": groupBy, "groupValue": groupValue, "measure": measure})
    return export_response(db, "sales", fy, format, params)


@router.get("")
async def sales_register(fy: str = Depends(get_fy), page: int = Query(1, ge=1),
                         limit: int = Query(50, ge=1, le=500), search: str | None = None,
                         db=Depends(get_db)):
    rows, total = tx.register(db, fy, "sales", page, limit, search)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy})


@router.get("/stats")
async def sales_stats(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(tx.stats(db, fy, "sales"), meta={"fy": fy})


@router.get("/analysis")
async def sales_analysis(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok({
        "monthly": dashboard_service.monthly_trend(db, fy)["series"],
        "topCustomers": dashboard_service.top_customers(db, fy, 10),
        "topItems": dashboard_service.top_items(db, fy, 10),
        "stats": tx.stats(db, fy, "sales"),
    }, meta={"fy": fy})


# ── Pattern B documents ──
@router.get("/order")
async def sales_order(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(tx.monthly_drilldown(db, fy, "sales_order"), meta={"fy": fy})


@router.get("/order/month/{month_id}")
async def sales_order_month(month_id: str, fy: str = Depends(get_fy),
                            page: int = Query(1, ge=1), limit: int = Query(200, ge=1, le=500),
                            db=Depends(get_db)):
    rows, total = tx.month_vouchers(db, fy, "sales_order", month_id, page, limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "month": month_id})


@router.get("/credit-note")
async def credit_note(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(tx.monthly_drilldown(db, fy, "credit_note"), meta={"fy": fy})


@router.get("/credit-note/month/{month_id}")
async def credit_note_month(month_id: str, fy: str = Depends(get_fy),
                            page: int = Query(1, ge=1), limit: int = Query(200, ge=1, le=500),
                            db=Depends(get_db)):
    rows, total = tx.month_vouchers(db, fy, "credit_note", month_id, page, limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "month": month_id})


@router.get("/delivery-note")
async def delivery_note(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(tx.monthly_drilldown(db, fy, "delivery_note"), meta={"fy": fy})


@router.get("/delivery-note/month/{month_id}")
async def delivery_note_month(month_id: str, fy: str = Depends(get_fy),
                              page: int = Query(1, ge=1), limit: int = Query(200, ge=1, le=500),
                              db=Depends(get_db)):
    rows, total = tx.month_vouchers(db, fy, "delivery_note", month_id, page, limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "month": month_id})


@router.get("/{ident:path}")
async def sales_voucher_detail(ident: str, db=Depends(get_db)):
    detail = get_voucher_detail(db, ident)
    if not detail:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return ok(detail)
