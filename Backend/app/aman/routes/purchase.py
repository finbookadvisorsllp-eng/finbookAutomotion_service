"""Purchase module routes (/api/v3/purchase) — register + Order/Debit/Receipt (Pattern B)."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.aman.core.dependencies import get_db, get_fy
from app.aman.models.common import ok, paginate
from app.aman.services import transactions_service as tx, dashboard_service
from app.aman.services.drilldown_service import get_voucher_detail

router = APIRouter(prefix="/purchase", tags=["aman:purchase"])


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
