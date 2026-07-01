"""Dashboard routes (/api/v3/dashboard)."""
from fastapi import APIRouter, Depends, Query

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
            "receivablesAging": ds.receivables_aging(db, fy),
            "cashFlow": ds.cash_flow(db, fy),
            "recentVouchers": ds.recent_vouchers(db, fy, 50),
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


@router.get("/receivables-aging")
async def receivables_aging(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    return ok(cached_report(tenant, "dashboard-aging", lambda: ds.receivables_aging(db, fy), fy=fy), meta={"fy": fy})


@router.get("/cash-flow")
async def cash_flow(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    return ok(cached_report(tenant, "dashboard-cashflow", lambda: ds.cash_flow(db, fy), fy=fy), meta={"fy": fy})


@router.get("/recent-vouchers")
async def recent_vouchers(fy: str = Depends(get_fy), limit: int = Query(50, ge=1, le=200), db=Depends(get_db)):
    return ok(ds.recent_vouchers(db, fy, limit), meta={"fy": fy})


@router.get("/top-customers")
async def top_customers(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(ds.top_customers(db, fy), meta={"fy": fy})


@router.get("/top-vendors")
async def top_vendors(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(ds.top_vendors(db, fy), meta={"fy": fy})


@router.get("/top-items")
async def top_items(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(ds.top_items(db, fy), meta={"fy": fy})
