"""Dashboard routes (/api/v3/dashboard)."""
from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import dashboard_service as ds

router = APIRouter(prefix="/dashboard", tags=["aman:dashboard"])


@router.get("/overview")
async def overview(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                   db=Depends(get_db)):
    def build():
        return {
            "kpis": ds.kpis(db, fy),
            "monthlyTrend": ds.monthly_trend(db, fy)["series"],
            "expenseBreakdown": ds.expense_breakdown(db, fy),
            "recentVouchers": ds.recent_vouchers(db, fy),
            "topCustomers": ds.top_customers(db, fy),
            "topVendors": ds.top_vendors(db, fy),
            "topItems": ds.top_items(db, fy),
            "alerts": ds.alerts(db, fy),
        }
    return ok(cached_report(tenant, "dashboard", build, fy=fy), meta={"fy": fy})


@router.get("/kpis")
async def kpis(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    return ok(cached_report(tenant, "dashboard-kpis", lambda: ds.kpis(db, fy), fy=fy), meta={"fy": fy})


@router.get("/monthly-trend")
async def monthly_trend(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(ds.monthly_trend(db, fy)["series"], meta={"fy": fy})


@router.get("/expense-breakdown")
async def expense_breakdown(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(ds.expense_breakdown(db, fy), meta={"fy": fy})


@router.get("/recent-vouchers")
async def recent_vouchers(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(ds.recent_vouchers(db, fy), meta={"fy": fy})


@router.get("/top-customers")
async def top_customers(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(ds.top_customers(db, fy), meta={"fy": fy})


@router.get("/top-vendors")
async def top_vendors(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(ds.top_vendors(db, fy), meta={"fy": fy})


@router.get("/top-items")
async def top_items(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(ds.top_items(db, fy), meta={"fy": fy})
