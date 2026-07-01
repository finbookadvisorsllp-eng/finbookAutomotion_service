"""Outstanding reports (/api/v3/reports/outstanding) — Receivables & Payables.

Server-side paginated, searchable, sortable. Cards/chart/table/export all read
the one response, so every number reconciles. Aging buckets are configuration
persisted per tenant.
"""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import report_cache
from app.aman.models.common import ok, paginate
from app.aman.services import outstanding_service as osvc
from app.aman.services.drilldown_service import voucher_list_for_ledger

router = APIRouter(prefix="/reports/outstanding", tags=["aman:reports:outstanding"])


def _report(db, fy, side, page, limit, search, sort, order, status):
    fn = osvc.receivables if side == "debit" else osvc.payables
    res = fn(db, fy, page=page, limit=limit, search=search, sort=sort, order=order, status=status)
    return ok(res["data"],
              pagination=paginate(res["total_records"], page, limit),
              meta={"fy": fy, "summary": res["summary"], "aging": res["aging"],
                    "buckets": res["buckets"], "side": res["side"]})


@router.get("/receivables")
async def receivables(
    fy: str = Depends(get_fy),
    page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=500),
    search: Optional[str] = Query(None), sort: Optional[str] = Query(None),
    order: str = Query("desc"), status: Optional[str] = Query(None),
    db=Depends(get_db)
):
    return _report(db, fy, "debit", page, limit, search, sort, order, status)


@router.get("/payables")
async def payables(
    fy: str = Depends(get_fy),
    page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=500),
    search: Optional[str] = Query(None), sort: Optional[str] = Query(None),
    order: str = Query("desc"), status: Optional[str] = Query(None),
    db=Depends(get_db)
):
    return _report(db, fy, "credit", page, limit, search, sort, order, status)


# ─────────────────────────── aging-bucket config (per tenant) ───────────────────────────
@router.get("/aging-config")
async def get_aging_config(db=Depends(get_db)):
    return ok({"buckets": osvc.get_aging_buckets(db)})


@router.put("/aging-config")
async def put_aging_config(payload: dict = Body(...), tenant: str = Depends(get_tenant_key),
                           db=Depends(get_db)):
    buckets = osvc.save_aging_buckets(db, payload.get("buckets") or [])
    report_cache.invalidate(tenant)  # outstanding figures depend on buckets
    return ok({"buckets": buckets})


@router.delete("/aging-config")
async def reset_aging_config(tenant: str = Depends(get_tenant_key), db=Depends(get_db)):
    buckets = osvc.reset_aging_buckets(db)
    report_cache.invalidate(tenant)
    return ok({"buckets": buckets})


# ─────────────────────────── drill-down: party -> vouchers ───────────────────────────
@router.get("/party/{ledger_id}/vouchers")
async def party_vouchers(ledger_id: str, fy: str = Depends(get_fy),
                         page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=500),
                         db=Depends(get_db)):
    rows, total = voucher_list_for_ledger(db, fy, ledger_id, page=page, limit=limit)
    return ok(rows, pagination=paginate(total, page, limit), meta={"fy": fy, "ledger": ledger_id})
