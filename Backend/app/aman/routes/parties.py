"""Parties routes (/api/v3/parties) — customers, vendors, receivables, payables."""
from fastapi import APIRouter, Depends, HTTPException

from app.aman.core.dependencies import get_db, get_fy, get_tenant_key
from app.aman.core.cache import cached_report
from app.aman.models.common import ok
from app.aman.services import parties_service, cashbank_service

router = APIRouter(prefix="/parties", tags=["aman:parties"])


@router.get("/customers")
async def customers(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                    db=Depends(get_db)):
    return ok(cached_report(tenant, "customers", lambda: parties_service.customers(db, fy), fy=fy),
              meta={"fy": fy})


@router.get("/vendors")
async def vendors(fy: str = Depends(get_fy), tenant: str = Depends(get_tenant_key),
                  db=Depends(get_db)):
    return ok(cached_report(tenant, "vendors", lambda: parties_service.vendors(db, fy), fy=fy),
              meta={"fy": fy})


@router.get("/receivables")
async def receivables(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(parties_service.receivables(db, fy), meta={"fy": fy})


@router.get("/payables")
async def payables(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(parties_service.payables(db, fy), meta={"fy": fy})


@router.get("/credit-limit")
async def credit_limit(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(parties_service.credit_limit(db, fy), meta={"fy": fy})


@router.get("/bills-due")
async def bills_due(fy: str = Depends(get_fy), db=Depends(get_db)):
    return ok(parties_service.bills_due(db, fy), meta={"fy": fy})


@router.get("/{party_type}/{ledger_id}")
async def party_ledger(party_type: str, ledger_id: str, fy: str = Depends(get_fy), db=Depends(get_db)):
    """Party statement (reuses the cash/bank-style ledger statement)."""
    detail = cashbank_service.ledger_detail(db, fy, ledger_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Party not found")
    return ok(detail, meta={"fy": fy})
