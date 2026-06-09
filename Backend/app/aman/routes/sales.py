"""Sales module routes (/api/v3/sales) — register + Order/Credit/Delivery (Pattern B)."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.aman.core.dependencies import get_db, get_fy
from app.aman.models.common import ok, paginate
from app.aman.services import transactions_service as tx, dashboard_service
from app.aman.services.drilldown_service import get_voucher_detail

router = APIRouter(prefix="/sales", tags=["aman:sales"])


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
