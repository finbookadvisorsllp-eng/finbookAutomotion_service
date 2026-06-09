"""Accounting registers (/api/v3/accounting) — Journal / Payment / Receipt / Contra."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.aman.core.dependencies import get_db, get_fy
from app.aman.models.common import ok, paginate
from app.aman.services import transactions_service as tx
from app.aman.services.drilldown_service import get_voucher_detail

router = APIRouter(prefix="/accounting", tags=["aman:accounting"])


def _register(db, fy, key, page, limit, search):
    rows, total = tx.register(db, fy, key, page, limit, search)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy})


@router.get("/journal")
async def journal(fy: str = Depends(get_fy), page: int = Query(1, ge=1),
                  limit: int = Query(50, ge=1, le=500), search: str | None = None, db=Depends(get_db)):
    return _register(db, fy, "journal", page, limit, search)


@router.get("/payment")
async def payment(fy: str = Depends(get_fy), page: int = Query(1, ge=1),
                  limit: int = Query(50, ge=1, le=500), search: str | None = None, db=Depends(get_db)):
    return _register(db, fy, "payment", page, limit, search)


@router.get("/receipt")
async def receipt(fy: str = Depends(get_fy), page: int = Query(1, ge=1),
                  limit: int = Query(50, ge=1, le=500), search: str | None = None, db=Depends(get_db)):
    return _register(db, fy, "receipt", page, limit, search)


@router.get("/contra")
async def contra(fy: str = Depends(get_fy), page: int = Query(1, ge=1),
                 limit: int = Query(50, ge=1, le=500), search: str | None = None, db=Depends(get_db)):
    return _register(db, fy, "contra", page, limit, search)


@router.get("/voucher/{ident:path}")
async def voucher(ident: str, db=Depends(get_db)):
    detail = get_voucher_detail(db, ident)
    if not detail:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return ok(detail)
