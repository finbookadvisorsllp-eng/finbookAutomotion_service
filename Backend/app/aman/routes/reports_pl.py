"""Profit & Loss routes (/api/v3/reports/profit-loss) + drilldowns."""
from fastapi import APIRouter, Depends, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok, paginate
from app.aman.services import pl_service, inventory_service
from app.aman.services.drilldown_service import voucher_list_for_ledger

router = APIRouter(prefix="/reports/profit-loss", tags=["aman:reports:profit-loss"])


@router.get("")
async def profit_loss(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                      db=Depends(get_db)):
    data = cached_report(tenant, "profit-loss", lambda: pl_service.build_profit_loss(db, fy), fy=fy)
    return ok(data, meta={"fy": fy})


@router.get("/ledger/{ledger_id}/vouchers")
async def pl_ledger_vouchers(ledger_id: str, fy: str = Depends(get_fy),
                             page: int = Query(1, ge=1), limit: int = Query(100, ge=1, le=500),
                             db=Depends(get_db)):
    rows, total = voucher_list_for_ledger(db, fy, ledger_id, page=page, limit=limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "ledger": ledger_id})


@router.get("/stock/items")
async def pl_stock_items(fy: str = Depends(get_fy), db=Depends(get_db)):
    """Closing-stock item list (L3 of the inventory branch of P&L)."""
    return ok(inventory_service.item_movements(db, fy), meta={"fy": fy})


@router.get("/stock-item/{item_name}/ledger")
async def pl_stock_item_ledger(item_name: str, fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(inventory_service.item_performance(db, fy, item_name), meta={"fy": fy})
