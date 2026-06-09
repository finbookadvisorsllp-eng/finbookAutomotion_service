"""Analytics routes (/api/v3/analytics)."""
from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import dashboard_service

router = APIRouter(prefix="/analytics", tags=["aman:analytics"])


@router.get("/overview")
async def overview(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                   db=Depends(get_db)):
    def build():
        return {
            "monthlyTrend": dashboard_service.monthly_trend(db, fy)["series"],
            "expenseBreakdown": dashboard_service.expense_breakdown(db, fy),
            "topCustomers": dashboard_service.top_customers(db, fy, 10),
            "topVendors": dashboard_service.top_vendors(db, fy, 10),
            "topItems": dashboard_service.top_items(db, fy, 10),
        }
    return ok(cached_report(tenant, "analytics", build, fy=fy), meta={"fy": fy})


@router.get("/revenue-trends")
async def revenue_trends(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(dashboard_service.monthly_trend(db, fy)["series"], meta={"fy": fy})


@router.get("/expense-trends")
async def expense_trends(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(dashboard_service.expense_breakdown(db, fy), meta={"fy": fy})
