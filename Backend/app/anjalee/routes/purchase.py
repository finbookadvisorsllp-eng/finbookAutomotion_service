from fastapi import APIRouter, Depends, Query
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.db import get_db
from app.anjalee.repositories.purchase_repo import PurchaseRepository
from app.anjalee.services.purchase_service import PurchaseService
from app.anjalee.schemas.purchase_schemas import PurchaseVoucherCreate, StatusUpdate, CommentRequest

router = APIRouter(prefix="/purchase", tags=["purchase"])

def get_purchase_service(db = Depends(get_db)) -> PurchaseService:
    repo = PurchaseRepository(db)
    return PurchaseService(repo)

@router.get("/stats")
async def get_summary_stats(
    voucherType: str = "purchase_invoice",
    companyId: Optional[str] = None,
    service: PurchaseService = Depends(get_purchase_service)
):
    stats = service.get_summary_stats(voucherType, companyId)
    return {
        "success": True,
        "data": stats
    }

# ── Specific named GET routes MUST come before /{id} so FastAPI doesn't capture them as IDs ──

@router.get("/party-ledgers")
async def get_party_ledgers(
    service: PurchaseService = Depends(get_purchase_service)
):
    data = service.get_party_ledgers()
    return {"success": True, "data": data}

@router.get("/purchase-ledgers")
async def get_purchase_ledgers(
    service: PurchaseService = Depends(get_purchase_service)
):
    data = service.get_purchase_ledgers()
    return {"success": True, "data": data}

@router.get("/stock-items")
async def get_stock_items(
    service: PurchaseService = Depends(get_purchase_service)
):
    """Return all stock items with name and hsnCode from the stockItems collection."""
    data = service.get_stock_items()
    return {"success": True, "data": data}

@router.get("/next-invoice-number")
async def get_next_invoice_number(
    voucherType: str = Query("purchase_invoice"),
    service: PurchaseService = Depends(get_purchase_service)
):
    """Return the next auto-generated invoice/voucher number for a voucher type (peek, does not consume the counter)."""
    voucher_type_raw = voucherType.lower().replace(" ", "_")
    prefix_map = {
        "purchase_invoice": "PI",
        "purchase_order": "PO",
        "debit_note": "DN",
    }
    prefix = prefix_map.get(voucher_type_raw, "PI")
    seq = service.repo.get_dynamic_next_sequence(voucher_type_raw, prefix, consume=False)
    year = datetime.now().year
    next_number = f"{prefix}-{year}-{str(seq).zfill(4)}"
    return {"success": True, "data": {"invoiceNumber": next_number}}

@router.get("/by-party-invoices", response_model=dict)
async def get_invoices_by_party(
    partyName: str = Query(..., description="Party ledger name to filter purchase invoices"),
    service: PurchaseService = Depends(get_purchase_service)
):
    """Return all purchase invoices for a given party (for Debit Note reference dropdown)."""
    data = service.get_invoices_by_party(partyName)
    return {"success": True, "data": data}

# ── Generic CRUD routes ──

@router.get("")
async def list_transactions(
    voucherType: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    service: PurchaseService = Depends(get_purchase_service)
):
    result = service.list_transactions(
        voucher_type=voucherType,
        status=status,
        search=search,
        page=page,
        limit=limit
    )
    return {
        "success": True,
        "data": result["results"],
        "pagination": {
            "total": result["total"],
            "page": page,
            "limit": limit
        }
    }

@router.post("")
async def create_transaction(
    payload: PurchaseVoucherCreate,
    service: PurchaseService = Depends(get_purchase_service)
):
    data = service.create_transaction(payload)
    return {
        "success": True,
        "data": data
    }

@router.get("/{id}")
async def get_transaction(
    id: str,
    service: PurchaseService = Depends(get_purchase_service)
):
    data = service.get_transaction(id)
    return {
        "success": True,
        "data": data
    }

@router.put("/{id}")
async def update_transaction(
    id: str,
    payload: PurchaseVoucherCreate,
    service: PurchaseService = Depends(get_purchase_service)
):
    data = service.update_transaction(id, payload)
    return {
        "success": True,
        "data": data
    }

@router.delete("/{id}")
async def delete_transaction(
    id: str,
    service: PurchaseService = Depends(get_purchase_service)
):
    service.delete_transaction(id)
    return {
        "success": True,
        "message": "Transaction deleted successfully"
    }

@router.patch("/{id}/status")
async def update_status(
    id: str,
    payload: StatusUpdate,
    service: PurchaseService = Depends(get_purchase_service)
):
    data = service.update_status(id, payload)
    return {
        "success": True,
        "data": data
    }

@router.post("/{id}/comments")
async def add_comment(
    id: str,
    payload: CommentRequest,
    service: PurchaseService = Depends(get_purchase_service)
):
    service.add_comment(id, payload)
    return {
        "success": True,
        "message": "Comment added successfully"
    }
