"""Trial Balance routes (/api/v3/reports) + shared voucher-detail endpoint."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok, paginate
from app.aman.services import trial_balance_service as tb
from app.aman.services.drilldown_service import get_voucher_detail

router = APIRouter(prefix="/reports", tags=["aman:reports:trial-balance"])


@router.get("/trial-balance")
async def trial_balance(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                        db=Depends(get_db)):
    data = cached_report(tenant, "trial-balance",
                         lambda: tb.build_trial_balance(db, fy), fy=fy)
    return ok(data, meta={"fy": fy})


@router.get("/trial-balance/group/{group_id}/ledgers")
async def tb_group_ledgers(group_id: str, fy: str = Depends(get_fy),
                           tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    data = cached_report(tenant, "tb-group", lambda: tb.group_ledgers(db, fy, group_id),
                         fy=fy, group=group_id)
    return ok(data, meta={"fy": fy})


@router.get("/trial-balance/ledger/{ledger_id}/vouchers")
async def tb_ledger_vouchers(ledger_id: str, fy: str = Depends(get_fy),
                             page: int = Query(1, ge=1), limit: int = Query(100, ge=1, le=500),
                             db=Depends(get_db)):
    rows, total = tb.ledger_vouchers(db, fy, ledger_id, page, limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "ledger": ledger_id})


@router.get("/voucher/{ident:path}")
async def voucher_detail(ident: str, db=Depends(get_db)):
    """Shared voucher-detail endpoint used by every drill-down (L4).

    Uses a ``:path`` converter because Tally voucher numbers contain '/'
    (e.g. 'FG-145/2025-26'). An ObjectId works here too.
    """
    detail = get_voucher_detail(db, ident)
    if not detail:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return ok(detail)
