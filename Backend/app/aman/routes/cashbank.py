"""Cash & Bank routes (/api/v3/cash-bank)."""
from fastapi import APIRouter, Depends, HTTPException

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import cashbank_service
from app.aman.services.drilldown_service import get_voucher_detail

router = APIRouter(prefix="/cash-bank", tags=["aman:cash-bank"])


@router.get("/dashboard")
async def dashboard(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                    db=Depends(get_db)):
    return ok(cached_report(tenant, "cashbank-dash",
                            lambda: cashbank_service.dashboard(db, fy), fy=fy), meta={"fy": fy})


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
