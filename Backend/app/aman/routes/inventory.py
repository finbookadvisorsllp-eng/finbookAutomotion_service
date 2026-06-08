"""Inventory routes (/api/v3/inventory)."""
from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import inventory_service as inv

router = APIRouter(prefix="/inventory", tags=["aman:inventory"])


@router.get("")
async def stock_summary(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                        db=Depends(get_db)):
    return ok(cached_report(tenant, "inventory", lambda: inv.stock_summary(db, fy), fy=fy),
              meta={"fy": fy})


@router.get("/slow")
async def slow_moving(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(inv.slow_moving(db, fy), meta={"fy": fy})


@router.get("/fast")
async def fast_moving(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(inv.fast_moving(db, fy), meta={"fy": fy})


@router.get("/valuation")
async def valuation(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(inv.valuation(db, fy), meta={"fy": fy})


@router.get("/alerts")
async def alerts(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(inv.stock_alerts(db, fy), meta={"fy": fy})


@router.get("/item/{item_name}/performance")
async def item_performance(item_name: str, fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(inv.item_performance(db, fy, item_name), meta={"fy": fy})
