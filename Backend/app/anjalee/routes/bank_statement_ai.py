import os
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request, status
from pydantic import BaseModel

from app.db import get_db
from app.anjalee.services.bank_statement_ai_service import BankStatementAIService

logger = logging.getLogger("bank_statement_ai_router")

router = APIRouter(prefix="/bank/ai-statement", tags=["bank-statement-ai"])

UPLOAD_DIR = os.path.join("uploads", "bank-statements")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class TransactionUpdateRequest(BaseModel):
    voucherDate: Optional[str] = None
    voucherNumber: Optional[str] = None
    voucherType: Optional[str] = None
    partyLedger: Optional[str] = None
    bankLedger: Optional[str] = None
    amount: Optional[float] = None
    paymentMode: Optional[str] = None
    instType: Optional[str] = None
    instNumber: Optional[str] = None
    instDate: Optional[str] = None
    narration: Optional[str] = None


class SaveVouchersRequest(BaseModel):
    batch_id: str
    item_ids: List[str]


@router.post("/upload")
async def upload_bank_statement(
    request: Request,
    file: UploadFile = File(...),
    bankLedger: str = Form(...),
    db = Depends(get_db)
):
    """
    Upload Bank Statement (PDF, XLSX, XLS, CSV).
    Extracts transaction lines, runs AI categorization & master ledger matching,
    checks duplicate fingerprints, and returns draft review batch.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".pdf", ".xlsx", ".xls", ".csv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a PDF or Excel/CSV bank statement."
        )

    # Save uploaded file locally
    saved_filename = f"stmt_{os.urandom(6).hex()}{file_ext}"
    saved_path = os.path.join(UPLOAD_DIR, saved_filename)
    
    contents = await file.read()
    with open(saved_path, "wb") as f:
        f.write(contents)

    service = BankStatementAIService(db)
    try:
        batch_res = service.process_and_create_batch_draft(
            file_path=saved_path,
            file_name=file.filename,
            file_type=file_ext,
            bank_ledger=bankLedger,
            company_id=company_header
        )
        return {
            "success": True,
            "data": batch_res
        }
    except Exception as e:
        logger.error(f"Error processing bank statement upload: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process bank statement: {str(e)}"
        )


@router.get("/batches")
async def get_all_batches(
    request: Request,
    db = Depends(get_db)
):
    """
    Fetch all processed AI bank statement documents sorted by creation date.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    service = BankStatementAIService(db)
    batches = service.get_all_batches(company_id=company_header)
    return {
        "success": True,
        "data": batches
    }


@router.get("/review/{batch_id}")
async def get_batch_review(
    batch_id: str,
    db = Depends(get_db)
):
    """
    Fetch statement draft batch for review with item list & summary counts.
    """
    service = BankStatementAIService(db)
    batch_doc = service.get_batch_draft(batch_id)
    if not batch_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statement draft batch not found")

    return {
        "success": True,
        "data": batch_doc
    }


@router.put("/transaction/{batch_id}/{item_id}")
async def update_batch_item(
    batch_id: str,
    item_id: str,
    payload: TransactionUpdateRequest,
    db = Depends(get_db)
):
    """
    Accountant edit item fields (voucherType, partyLedger, amount, etc.) matching manual voucher entry schema.
    """
    service = BankStatementAIService(db)
    updates = payload.model_dump(exclude_unset=True)
    updated_item = service.update_draft_item(batch_id, item_id, updates)
    if not updated_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft item not found")

    return {
        "success": True,
        "data": updated_item
    }


@router.post("/save-vouchers")
async def save_approved_vouchers(
    request: Request,
    payload: SaveVouchersRequest,
    db = Depends(get_db)
):
    """
    Converts approved draft items into actual accounting vouchers with source='bank_statement'.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    service = BankStatementAIService(db)
    res = service.convert_and_save_vouchers(payload.batch_id, payload.item_ids, company_id=company_header)
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("error", "Failed to save vouchers"))

    return res


@router.delete("/batch/{batch_id}")
async def delete_bank_statement_batch(
    batch_id: str,
    db = Depends(get_db)
):
    """
    Completely deletes a bank statement draft batch and its uploaded document file.
    """
    service = BankStatementAIService(db)
    success = service.delete_batch(batch_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bank statement draft batch not found or already deleted"
        )
    return {
        "success": True,
        "message": "Bank statement draft deleted successfully"
    }
