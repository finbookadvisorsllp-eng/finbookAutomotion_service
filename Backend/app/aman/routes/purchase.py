"""Purchase module routes (/api/v3/purchase) — register + Order/Debit/Receipt (Pattern B)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok, paginate
from app.aman.services import transactions_service as tx, dashboard_service
from app.aman.services import purchase_register_service as preg
from app.aman.services.drilldown_service import get_voucher_detail
from app.aman.services.financial_year import resolve_date_range
from app.aman.routes.export import export_response, collect_params

router = APIRouter(prefix="/purchase", tags=["aman:purchase"])


# ── Dynamic Purchase Register (Tally-matched, company-aware, drill-down engine) ──
@router.get("/register/drilldown")
async def register_drilldown(
    report: str = Query("purchase"),
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
    if report not in preg.REPORTS:
        raise HTTPException(status_code=404, detail=f"Unknown report '{report}'")
    start, end = resolve_date_range(dateFilter, fromDate, toDate, fy)
    params = {"report": report, "level": level, "groupBy": groupBy, "groupValue": groupValue,
              "measure": measure, "voucherId": voucherId, "page": page, "limit": limit,
              "search": search, "sort": sort, "order": order, "start": start, "end": end}

    def _build():
        return preg.drilldown(db, fy, level, params)

    # Cache the deterministic level-0 grouped views (no search / no custom range).
    if level == 0 and groupBy != "bill" and not search:
        result = cached_report(
            tenant, "purchase-reg-l0", _build,
            fy=fy, doc=report, groupBy=groupBy, measure=measure,
            dateFilter=dateFilter, fromDate=fromDate, toDate=toDate)
    else:
        result = _build()

    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return ok(result.get("data"), pagination=result.get("pagination"), meta=result.get("meta"))


@router.get("/register/export")
async def register_export(
    report: str = Query("purchase"),
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
    if report not in preg.REPORTS:
        raise HTTPException(status_code=404, detail=f"Unknown report '{report}'")
    params = collect_params(level, None, None, None, None, voucherId,
                            search, None, sort, order, dateFilter, fromDate, toDate, fy)
    params.update({"report": report, "groupBy": groupBy, "groupValue": groupValue, "measure": measure})
    return export_response(db, "purchase", fy, format, params)


@router.get("")
async def purchase_register(fy: str = Depends(get_fy), page: int = Query(1, ge=1),
                            limit: int = Query(50, ge=1, le=500), search: str | None = None,
                            db=Depends(get_db)):
    rows, total = tx.register(db, fy, "purchase", page, limit, search)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy})


@router.get("/stats")
async def purchase_stats(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(tx.stats(db, fy, "purchase"), meta={"fy": fy})


@router.get("/trends")
async def purchase_trends(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok({
        "monthly": dashboard_service.monthly_trend(db, fy)["series"],
        "topVendors": dashboard_service.top_vendors(db, fy, 10),
        "stats": tx.stats(db, fy, "purchase"),
    }, meta={"fy": fy})


@router.get("/order")
async def purchase_order(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(tx.monthly_drilldown(db, fy, "purchase_order"), meta={"fy": fy})


@router.get("/order/month/{month_id}")
async def purchase_order_month(month_id: str, fy: str = Depends(get_fy),
                               page: int = Query(1, ge=1), limit: int = Query(200, ge=1, le=500),
                               db=Depends(get_db)):
    rows, total = tx.month_vouchers(db, fy, "purchase_order", month_id, page, limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "month": month_id})


@router.get("/debit-note")
async def debit_note(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(tx.monthly_drilldown(db, fy, "debit_note"), meta={"fy": fy})


@router.get("/debit-note/month/{month_id}")
async def debit_note_month(month_id: str, fy: str = Depends(get_fy),
                           page: int = Query(1, ge=1), limit: int = Query(200, ge=1, le=500),
                           db=Depends(get_db)):
    rows, total = tx.month_vouchers(db, fy, "debit_note", month_id, page, limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "month": month_id})


@router.get("/receipt-note")
async def receipt_note(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(tx.monthly_drilldown(db, fy, "receipt_note"), meta={"fy": fy})


@router.get("/receipt-note/month/{month_id}")
async def receipt_note_month(month_id: str, fy: str = Depends(get_fy),
                             page: int = Query(1, ge=1), limit: int = Query(200, ge=1, le=500),
                             db=Depends(get_db)):
    rows, total = tx.month_vouchers(db, fy, "receipt_note", month_id, page, limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "month": month_id})


@router.get("/{ident:path}")
async def purchase_voucher_detail(ident: str, db=Depends(get_db)):
    detail = get_voucher_detail(db, ident)
    if not detail:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return ok(detail)
