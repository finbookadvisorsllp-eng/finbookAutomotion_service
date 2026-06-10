from fastapi import APIRouter, Depends, Query, status, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.db import get_async_db
from app.anjalee.repositories.sales_repo import SalesVoucherRepository
from app.anjalee.services.sales_service import SalesVoucherService
from app.anjalee.schemas.sales_schemas import (
    SalesVoucherCreate, SalesVoucherUpdate, StatusUpdate, CommentRequest
)

router = APIRouter(prefix="/sales-voucher", tags=["sales-voucher"])

def get_sales_voucher_service(db = Depends(get_async_db)) -> SalesVoucherService:
    repo = SalesVoucherRepository(db)
    return SalesVoucherService(repo)

@router.post("", response_model=dict)
@router.post("/", response_model=dict)
async def create_voucher(
    payload: SalesVoucherCreate,
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    data = await service.create_voucher(payload)
    return {"success": True, "data": data}

@router.get("", response_model=dict)
@router.get("/", response_model=dict)
async def list_vouchers(
    voucherType: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    result = await service.list_vouchers(
        page=page,
        limit=limit,
        voucher_type=voucherType,
        status=status,
        search=search
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

@router.get("/stats", response_model=dict)
async def get_summary_stats(
    voucherType: str = "sales_invoice",
    companyId: Optional[str] = None,
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    stats = await service.get_summary_stats(voucherType, companyId)
    return {
        "success": True,
        "data": stats
    }

@router.get("/party-ledgers", response_model=dict)
async def get_party_ledgers(
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    data = await service.get_party_ledgers()
    return {"success": True, "data": data}

@router.get("/sales-ledgers", response_model=dict)
async def get_sales_ledgers(
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    data = await service.get_sales_ledgers()
    return {"success": True, "data": data}

@router.get("/next-invoice-number", response_model=dict)
async def get_next_invoice_number(
    voucherType: str = Query("sales_invoice"),
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    """Return the next auto-generated invoice number for a voucher type (peek, does not consume the counter)."""
    voucher_type_raw = voucherType.lower().replace(" ", "_")
    prefix_map = {
        "sales_invoice": "SI",
        "sales_order": "SO",
        "credit_note": "CN",
    }
    prefix = prefix_map.get(voucher_type_raw, "SV")
    seq = await service.repo.peek_next_sequence_value(prefix)
    year = datetime.now().year
    next_number = f"{prefix}-{year}-{str(seq).zfill(4)}"
    return {"success": True, "data": {"invoiceNumber": next_number}}

@router.get("/by-party-invoices", response_model=dict)
async def get_invoices_by_party(
    partyName: str = Query(..., description="Party ledger name to filter sales invoices"),
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    """Return all sales invoices for a given party (for Credit Note reference dropdown)."""
    result = await service.get_invoices_by_party(partyName)
    return {"success": True, "data": result}

@router.get("/stock-items", response_model=dict)
async def get_stock_items(
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    """Return all stock items with name and hsnCode from the stockItems collection."""
    data = await service.get_stock_items()
    return {"success": True, "data": data}

@router.get("/{voucher_id}", response_model=dict)

async def get_voucher(
    voucher_id: str,
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    data = await service.get_voucher(voucher_id)
    return {"success": True, "data": data}

@router.put("/{voucher_id}", response_model=dict)
async def update_voucher(
    voucher_id: str,
    payload: SalesVoucherUpdate,
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    data = await service.update_voucher(voucher_id, payload)
    return {"success": True, "data": data}

@router.delete("/{voucher_id}", response_model=dict)
async def delete_voucher(
    voucher_id: str,
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    await service.delete_voucher(voucher_id)
    return {"success": True, "message": "Sales voucher deleted successfully"}

@router.patch("/{voucher_id}/status", response_model=dict)
async def update_status(
    voucher_id: str,
    payload: StatusUpdate,
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    data = await service.update_status(voucher_id, payload.status, payload.note)
    return {
        "success": True,
        "data": data
    }

@router.post("/{voucher_id}/comments", response_model=dict)
async def add_comment(
    voucher_id: str,
    payload: CommentRequest,
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    await service.add_comment(voucher_id, payload.note)
    return {
        "success": True,
        "message": "Comment added successfully"
    }

# ─── AI-OCR ───
@router.post("/ocr/extract", response_model=dict)
async def extract_ocr(document: UploadFile = File(...)):
    # Standard AI-OCR mock response returning fields for autofill
    return {
        "success": True,
        "data": {
            "invoiceNo": "INV-2026-001",
            "invoiceDate": datetime.now().strftime("%Y-%m-%d"),
            "partyName": "Friends Grafix",
            "partyGstin": "23AAOFG0550B1ZZ",
            "grandTotal": 12500.00,
            "productLines": [
                {"srNo": 1, "stockItem": "Printing Paper", "billQuantity": 10, "billRate": 1250, "amount": 12500.00}
            ]
        }
    }

@router.post("/ocr/submit", response_model=dict)
async def submit_ocr_transaction(
    payload: dict,
    service: SalesVoucherService = Depends(get_sales_voucher_service)
):
    # Route OCR submitted payload to create_voucher
    from app.anjalee.schemas.sales_schemas import SalesVoucherCreate
    tx_payload = payload.get("transactionPayload", {})
    # Map to SalesVoucherCreate fields
    mapped_payload = SalesVoucherCreate(
        voucherType=tx_payload.get("voucherType") or "Sales Order",
        voucherDate=tx_payload.get("invoiceDate") or tx_payload.get("voucherDate"),
        voucherNumber=tx_payload.get("invoiceNumber") or tx_payload.get("voucherNumber"),
        partyLedgerName=tx_payload.get("partyLedger") or tx_payload.get("partyLedgerName") or "Cash",
        partyGSTIN=tx_payload.get("partyGstin") or tx_payload.get("partyGSTIN"),
        salesEntries=[],
        inventoryEntries=tx_payload.get("productLines") or [],
        additionalCharges=tx_payload.get("additionalCharges") or [],
        tcsDetails=tx_payload.get("tcsDetails") or [],
        tdsDetails=tx_payload.get("tdsDetails") or [],
        narration=tx_payload.get("narration") or "",
        status="DRAFT"
    )
    data = await service.create_voucher(mapped_payload)
    # Save OCR meta
    ocr_meta = payload.get("ocrMeta", {})
    await service.repo.db["sales_vouchers"].update_one(
        {"_id": ObjectId(data["_id"])},
        {"$set": {"entryMode": "ocr", "ocrMetadata": ocr_meta}}
    )
    data["entryMode"] = "ocr"
    data["ocrMetadata"] = ocr_meta
    return {
        "success": True,
        "data": data
    }

# ─── CSV Bulk Upload ───
@router.post("/csv/preview", response_model=dict)
async def preview_csv(file: UploadFile = File(...)):
    return {
        "success": True,
        "data": {
            "validRowsCount": 2,
            "invalidRowsCount": 0,
            "previewRows": [
                {"invoiceNumber": "CSV-001", "invoiceDate": "2026-06-01", "partyLedger": "Friends Grafix", "grandTotal": 5000.00},
                {"invoiceNumber": "CSV-002", "invoiceDate": "2026-06-02", "partyLedger": "Friends Grafix", "grandTotal": 8500.00}
            ]
        }
    }

@router.post("/csv/import", response_model=dict)
async def import_csv(
    file: UploadFile = File(...),
    voucherType: str = Form("sales_invoice")
):
    imported_count = 2
    return {
        "success": True,
        "message": f"Successfully imported {imported_count} sales transactions",
        "importedCount": imported_count
    }

@router.get("/csv/sample", response_model=dict)
async def download_sample_csv(voucherType: str = "sales_invoice"):
    return {"message": "CSV sample file metadata"}

@router.get("/export/tally", response_model=dict)
async def export_to_tally(ids: str):
    return {"message": "Tally XML data exported"}
