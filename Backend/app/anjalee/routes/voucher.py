import logging
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db
from app.anjalee.models.ai_models import AiVoucherDraft
from app.anjalee.schemas.fundflow_schemas import FundFlowTransactionCreate
from app.anjalee.services.fundflow_service import FundFlowService
from app.anjalee.repositories.fundflow_repo import FundFlowRepository
from app.anjalee.schemas.fundflow_schemas import StatusUpdate
from pydantic import BaseModel
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voucher", tags=["voucher"])

class ApproveVoucherRequest(BaseModel):
    session_id: str
    draft: AiVoucherDraft

@router.post("/payment", response_model=Dict[str, Any])
async def approve_payment_voucher(
    payload: ApproveVoucherRequest,
    db = Depends(get_db)
):
    draft = payload.draft
    session_id = payload.session_id
    logger.info(f"Approving and posting Payment voucher for session: {session_id}")
    
    # 1. Map draft to FundFlowTransactionCreate
    is_cash = "cash" in draft.credit.lower()
    voucher_type_val = "cash_payment" if is_cash else "bank_payment"
    
    # Set bankLedger/cashLedger
    cash_ledger = draft.credit if is_cash else None
    bank_ledger = None if is_cash else draft.credit
    
    # Ledger Rows representing the debit entry for party
    ledger_rows = []
    if draft.ledger_entries:
        for entry in draft.ledger_entries:
            ledger_rows.append({
                "ledgerName": entry.ledger_name,
                "amount": entry.amount,
                "description": draft.narration or f"Payment to {entry.ledger_name}"
            })
    else:
        ledger_rows = [
            {
                "ledgerName": draft.party,
                "amount": draft.amount,
                "description": draft.narration or f"Payment to {draft.party}"
            }
        ]
    
    # Bill allocations
    bill_rows = []
    if draft.bill_allocations:
        for alloc in draft.bill_allocations:
            bill_rows.append({
                "billNo": alloc.get("bill") or alloc.get("billNo") or alloc.get("bill_name") or "",
                "allocationAmount": float(alloc.get("amount") or alloc.get("allocation_amount") or 0.0)
            })
            
    ff_payload = FundFlowTransactionCreate(
        voucherType=voucher_type_val,
        voucherDate=draft.date,
        partyLedger=draft.party,
        againstLedger=draft.credit,
        cashLedger=cash_ledger,
        bankLedger=bank_ledger,
        amount=draft.amount,
        narration=draft.narration or f"Payment of ₹{draft.amount:,.2f} made to {draft.party}",
        status="draft",
        entryMode="manual",
        billRows=bill_rows,
        ledgerRows=ledger_rows
    )
    
    try:
        repo = FundFlowRepository(db)
        service = FundFlowService(repo)
        tx_data = service.create_transaction(ff_payload)
        tx_id = tx_data.get("_id")
        v_num = tx_data.get("voucherNumber")
        approved_data = await service.update_status(tx_id, StatusUpdate(status="approved", note="Approved via AI Review"))
        posted_data = await service.update_status(tx_id, StatusUpdate(status="posted_to_tally", note="Pushed to Tally via AI Review"))
        final_status = posted_data.get("status")
        success = (final_status == "POSTED_TO_TALLY")
        
        if success:
            return {
                "success": True,
                "message": f"Successfully approved and posted Payment Voucher {v_num} to Tally ERP!",
                "data": posted_data
            }
        else:
            activity_log = posted_data.get("activityLog") or []
            error_note = "Push to Tally failed."
            for log in reversed(activity_log):
                if log.get("action") == "tally_push_failed" or "tally_push_failed" in log.get("action", ""):
                    error_note = log.get("note") or error_note
                    break
            return {
                "success": True,
                "message": f"Payment Voucher {v_num} saved in ERP, but Tally sync failed: {error_note}",
                "data": posted_data
            }
    except Exception as e:
        logger.error(f"Error approving and posting payment: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to approve and post: {str(e)}")

@router.post("/receipt", response_model=Dict[str, Any])
async def approve_receipt_voucher(
    payload: ApproveVoucherRequest,
    db = Depends(get_db)
):
    draft = payload.draft
    session_id = payload.session_id
    logger.info(f"Approving and posting Receipt voucher for session: {session_id}")
    
    is_cash = "cash" in draft.debit.lower()
    voucher_type_val = "cash_receipt" if is_cash else "bank_receipt"
    
    cash_ledger = draft.debit if is_cash else None
    bank_ledger = None if is_cash else draft.debit
    
    ledger_rows = []
    if draft.ledger_entries:
        for entry in draft.ledger_entries:
            ledger_rows.append({
                "ledgerName": entry.ledger_name,
                "amount": entry.amount,
                "description": draft.narration or f"Receipt from {entry.ledger_name}"
            })
    else:
        ledger_rows = [
            {
                "ledgerName": draft.party,
                "amount": draft.amount,
                "description": draft.narration or f"Receipt from {draft.party}"
            }
        ]
    
    # Bill allocations
    bill_rows = []
    if draft.bill_allocations:
        for alloc in draft.bill_allocations:
            bill_rows.append({
                "billNo": alloc.get("bill") or alloc.get("billNo") or alloc.get("bill_name") or "",
                "allocationAmount": float(alloc.get("amount") or alloc.get("allocation_amount") or 0.0)
            })
            
    ff_payload = FundFlowTransactionCreate(
        voucherType=voucher_type_val,
        voucherDate=draft.date,
        partyLedger=draft.party,
        againstLedger=draft.debit,
        cashLedger=cash_ledger,
        bankLedger=bank_ledger,
        amount=draft.amount,
        narration=draft.narration or f"Receipt of ₹{draft.amount:,.2f} from {draft.party}",
        status="draft",
        entryMode="manual",
        billRows=bill_rows,
        ledgerRows=ledger_rows
    )
    
    try:
        repo = FundFlowRepository(db)
        service = FundFlowService(repo)
        tx_data = service.create_transaction(ff_payload)
        tx_id = tx_data.get("_id")
        v_num = tx_data.get("voucherNumber")
        approved_data = await service.update_status(tx_id, StatusUpdate(status="approved", note="Approved via AI Review"))
        posted_data = await service.update_status(tx_id, StatusUpdate(status="posted_to_tally", note="Pushed to Tally via AI Review"))
        final_status = posted_data.get("status")
        success = (final_status == "POSTED_TO_TALLY")
        
        if success:
            return {
                "success": True,
                "message": f"Successfully approved and posted Receipt Voucher {v_num} to Tally ERP!",
                "data": posted_data
            }
        else:
            activity_log = posted_data.get("activityLog") or []
            error_note = "Push to Tally failed."
            for log in reversed(activity_log):
                if log.get("action") == "tally_push_failed" or "tally_push_failed" in log.get("action", ""):
                    error_note = log.get("note") or error_note
                    break
            return {
                "success": True,
                "message": f"Receipt Voucher {v_num} saved in ERP, but Tally sync failed: {error_note}",
                "data": posted_data
            }
    except Exception as e:
        logger.error(f"Error approving and posting receipt: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to approve and post receipt: {str(e)}")

@router.post("/contra", response_model=Dict[str, Any])
async def approve_contra_voucher(
    payload: ApproveVoucherRequest,
    db = Depends(get_db)
):
    draft = payload.draft
    session_id = payload.session_id
    logger.info(f"Approving and posting Contra voucher for session: {session_id}")
    
    voucher_type_val = "contra"
    is_from_cash = "cash" in draft.credit.lower()
    is_to_cash = "cash" in draft.debit.lower()
    
    cash_ledger = draft.credit if is_from_cash else (draft.debit if is_to_cash else None)
    bank_ledger = draft.debit if is_from_cash else (draft.credit if is_to_cash else draft.debit)
    
    ledger_rows = [
        {
            "ledgerName": draft.debit,
            "amount": draft.amount,
            "description": draft.narration or f"Transfer to {draft.debit}"
        }
    ]
    
    ff_payload = FundFlowTransactionCreate(
        voucherType=voucher_type_val,
        voucherDate=draft.date,
        partyLedger=draft.debit,
        againstLedger=draft.credit,
        cashLedger=cash_ledger,
        bankLedger=bank_ledger,
        amount=draft.amount,
        narration=draft.narration or f"Contra: Transfer of ₹{draft.amount:,.2f} from {draft.credit} to {draft.debit}",
        status="draft",
        entryMode="manual",
        billRows=[],
        ledgerRows=ledger_rows
    )
    
    try:
        repo = FundFlowRepository(db)
        service = FundFlowService(repo)
        tx_data = service.create_transaction(ff_payload)
        tx_id = tx_data.get("_id")
        v_num = tx_data.get("voucherNumber")
        approved_data = await service.update_status(tx_id, StatusUpdate(status="approved", note="Approved via AI Review"))
        posted_data = await service.update_status(tx_id, StatusUpdate(status="posted_to_tally", note="Pushed to Tally via AI Review"))
        final_status = posted_data.get("status")
        success = (final_status == "POSTED_TO_TALLY")
        
        if success:
            return {
                "success": True,
                "message": f"Successfully approved and posted Contra Voucher {v_num} to Tally ERP!",
                "data": posted_data
            }
        else:
            activity_log = posted_data.get("activityLog") or []
            error_note = "Push to Tally failed."
            for log in reversed(activity_log):
                if log.get("action") == "tally_push_failed" or "tally_push_failed" in log.get("action", ""):
                    error_note = log.get("note") or error_note
                    break
            return {
                "success": True,
                "message": f"Contra Voucher {v_num} saved in ERP, but Tally sync failed: {error_note}",
                "data": posted_data
            }
    except Exception as e:
        logger.error(f"Error approving and posting contra: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to approve and post contra: {str(e)}")
