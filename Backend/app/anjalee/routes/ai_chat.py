import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from app.db import get_async_db
from app.anjalee.services.ai_chat_service import AiChatService
from app.anjalee.models.ai_models import ChatMessageRequest, ChatMessageResponse, ChatSession, AiVoucherDraft, AiInvoiceItem
from typing import Dict, Any, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["ai-chat"])

def get_ai_chat_service(db = Depends(get_async_db)) -> AiChatService:
    return AiChatService(db)

@router.get("/page-load")
async def get_page_load(
    service: AiChatService = Depends(get_ai_chat_service)
):
    return await service.get_page_load_data()

@router.post("/message", response_model=ChatMessageResponse)
async def post_chat_message(
    payload: ChatMessageRequest,
    service: AiChatService = Depends(get_ai_chat_service)
):
    result = await service.process_chat(payload.session_id, payload.message)
    session = await service.get_session(payload.session_id)
    
    missing, actions = service._evaluate_missing_and_actions(session.current_draft, session.state)
    meta = session.metadata or {}
    meta["missing_fields"] = missing
    meta["suggested_actions"] = actions
    
    session.metadata = meta
    await service.save_session(session)
    
    return ChatMessageResponse(
        reply=result["reply"],
        draft=result.get("draft"),
        state=result["state"],
        history=session.history,
        draft_json=result.get("draft_json"),
        metadata=meta
    )

@router.get("/session/{session_id}", response_model=ChatSession)
async def get_session_state(
    session_id: str,
    service: AiChatService = Depends(get_ai_chat_service)
):
    session = await service.get_session(session_id)
    
    missing, actions = service._evaluate_missing_and_actions(session.current_draft, session.state)
    session.metadata = session.metadata or {}
    session.metadata["missing_fields"] = missing
    session.metadata["suggested_actions"] = actions
    
    return session

@router.post("/reset/{session_id}")
async def reset_session(
    session_id: str,
    service: AiChatService = Depends(get_ai_chat_service)
):
    session = await service.get_session(session_id)
    session.history = []
    session.current_draft = None
    session.draft_json = None
    session.state = "idle"
    session.metadata = {}
    await service.save_session(session)
    return {"status": "success", "message": f"Session '{session_id}' reset successfully."}

@router.post("/draft/update")
async def update_draft_manually(
    session_id: str = Query(...),
    draft: AiVoucherDraft = Depends(),
    service: AiChatService = Depends(get_ai_chat_service)
):
    # Depends() parses query/body, let's accept direct body input
    pass

@router.post("/draft/update-body")
async def update_draft_manually_body(
    payload: Dict[str, Any],
    session_id: str = Query(...),
    service: AiChatService = Depends(get_ai_chat_service)
):
    session = await service.get_session(session_id)
    
    # Parse the incoming draft
    draft_data = payload.get("draft")
    if not draft_data:
        raise HTTPException(status_code=400, detail="Missing draft data")
        
    draft = AiVoucherDraft(**draft_data)
    await service._update_draft_fields_and_narration(draft)
    session.current_draft = draft
    
    v_type_lower = draft.voucher_type.lower() if draft.voucher_type else ""
    is_invoice_type = any(x in v_type_lower for x in ["sales", "purchase", "debit", "credit"])
    if is_invoice_type:
        draft.entry_mode = "item_invoice" if draft.items else "accounting"
        if session.current_draft:
            session.current_draft.entry_mode = draft.entry_mode
        gst_calc = await service._calculate_invoice_gst_entries(
            draft.party,
            [item.model_dump() for item in draft.items],
            draft.voucher_type,
            additional_charges=draft.additional_charges
        )
        session.current_draft.amount = round(gst_calc["total_amount"])
        session.current_draft.gst_rate = gst_calc["gst_rate"]
        session.current_draft.base_amount = gst_calc["base_amount"]
        session.current_draft.cgst_amount = gst_calc["cgst_amount"]
        session.current_draft.sgst_amount = gst_calc["sgst_amount"]
        session.current_draft.igst_amount = gst_calc["igst_amount"]
        session.current_draft.cess_amount = gst_calc["cess_amount"]
        session.current_draft.is_intra_state = gst_calc["is_intra_state"]
        session.current_draft.tax_type = gst_calc["tax_type"]
        
        from app.anjalee.models.ai_models import AiVoucherLedgerEntry, AiInvoiceItem
        session.current_draft.ledger_entries = [AiVoucherLedgerEntry(**e) for e in gst_calc["ledger_entries"]]
        if gst_calc.get("resolved_additional_charges"):
            session.current_draft.additional_charges = gst_calc["resolved_additional_charges"]
        if gst_calc.get("items"):
            session.current_draft.items = [AiInvoiceItem(**it) for it in gst_calc["items"]]
    else:
        session.current_draft.ledger_entries = []

    session.draft_json = await service.generate_target_voucher_json(session.current_draft)
    await service.save_session(session)
    return {
        "status": "success",
        "draft": session.current_draft,
        "draft_json": session.draft_json
    }

@router.post("/draft/save")
async def save_draft_manually(
    session_id: str = Query(...),
    service: AiChatService = Depends(get_ai_chat_service)
):
    session = await service.get_session(session_id)
    result = await service._handle_save_voucher(session)
    return result

@router.get("/draft/load")
async def load_saved_voucher(
    session_id: str = Query(...),
    voucher_number: str = Query(...),
    voucher_type: str = Query("sales_invoice"),
    service: AiChatService = Depends(get_ai_chat_service)
):
    session = await service.get_session(session_id)
    
    is_sales = "sales" in voucher_type.lower() or "credit" in voucher_type.lower()
    is_fundflow = "payment" in voucher_type.lower() or "receipt" in voucher_type.lower() or "contra" in voucher_type.lower()
    
    if is_fundflow:
        collection = "fund_flow_vouchers"
    elif is_sales:
        collection = "sales_vouchers"
    else:
        collection = "purchase_vouchers"
        
    doc = await service.db[collection].find_one({"voucherNumber": voucher_number, "isDeleted": {"$ne": True}})
    if not doc:
        doc = await service.db[collection].find_one({"voucherNumber": voucher_number})
        
    if not doc:
        found = await service._find_voucher_doc(voucher_number=voucher_number)
        if found:
            doc, voucher_type = found
        else:
            raise HTTPException(status_code=404, detail=f"Voucher {voucher_number} not found.")

    draft = await service._load_voucher_to_draft(doc, voucher_type)
    
    session.current_draft = draft
    session.draft_json = await service.generate_target_voucher_json(draft)
    session.state = "awaiting_confirmation"
    
    party = draft.party
    reply = f"I have loaded Voucher #{voucher_number} for '{party}' into the manual form. You can now edit it manually or with the chatbot."
    session.history.append({"role": "assistant", "content": reply})
    await service.save_session(session)

    return {
        "status": "success",
        "reply": reply,
        "draft": draft,
        "draft_json": session.draft_json,
        "state": session.state
    }

@router.get("/ledger/")
@router.get("/ledger/{name}")
async def get_ledger_details(
    name: str = "",
    service: AiChatService = Depends(get_ai_chat_service)
):
    if not name:
        return {
            "name": "",
            "group": "",
            "gstin": "",
            "state": "",
            "creditLimit": 0.0,
            "outstanding": 0.0,
            "partyDetails": {}
        }
    doc = await service.db["ledgers"].find_one({"ledgerName": {"$regex": f"^{name}$", "$options": "i"}})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Ledger '{name}' not found")
        
    pd = doc.get("partyDetails") or {}
    gstin = pd.get("gstin") or ""
    state = pd.get("gstState") or ""
    limit = float(doc.get("creditLimit") or pd.get("creditLimit") or 500000.0)
    
    opening_bal = doc.get("balances", {}).get("openingBalance", {})
    op_amount = float(opening_bal.get("amount") or 0.0)
    op_type = opening_bal.get("type") or "DEBIT"
    balance = op_amount if op_type == "DEBIT" else -op_amount
    
    async for v in service.db["sales_vouchers"].find({"partyLedgerName": doc["ledgerName"], "isDeleted": {"$ne": True}}):
        balance += float(v.get("grandTotal") or 0.0)
        
    async for v in service.db["purchase_vouchers"].find({"partyLedger": doc["ledgerName"], "isDeleted": {"$ne": True}}):
        balance -= float(v.get("grandTotal") or 0.0)
        
    return {
        "name": doc["ledgerName"],
        "group": doc.get("groupName", ""),
        "gstin": gstin,
        "state": state,
        "creditLimit": limit,
        "outstanding": balance,
        "partyDetails": pd
    }

@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    service: AiChatService = Depends(get_ai_chat_service)
):
    # Delete all draft vouchers created in this session
    await service.db["sales_vouchers"].delete_many({"sessionId": session_id})
    await service.db["purchase_vouchers"].delete_many({"sessionId": session_id})
    await service.db["fund_flow_vouchers"].delete_many({"sessionId": session_id})
    
    await service.db["ai_sessions"].delete_one({"session_id": session_id})
    return {"status": "success", "message": f"Session '{session_id}' and its draft vouchers deleted successfully."}


class ValidateRequest(BaseModel):
    query: Optional[str] = None
    session_id: Optional[str] = None
    draft: Optional[Dict[str, Any]] = None

@router.post("/validate")
async def validate_query_or_draft(
    payload: ValidateRequest,
    service: AiChatService = Depends(get_ai_chat_service)
):
    from app.anjalee.validation import get_validation_engine
    from app.anjalee.services.llm_service import llm_service
    
    # 1. Resolve draft context
    draft = None
    if payload.draft:
        draft = AiVoucherDraft(**payload.draft)
    elif payload.session_id:
        session = await service.get_session(payload.session_id)
        if session and session.current_draft:
            draft = session.current_draft
            
    # 2. If natural language query is provided, extract/update
    if payload.query:
        # Use NLU to parse message
        history = []
        if payload.session_id:
            session = await service.get_session(payload.session_id)
            if session:
                history = session.history
                
        current_draft_dict = draft.model_dump() if draft else None
        parsed = llm_service.parse_user_message(payload.query, history, current_draft_dict)
        
        # If no draft existed, build a fresh one from parsed NLU data
        if not draft:
            draft = AiVoucherDraft()
            
        if parsed.get("voucher_type"):
            draft.voucher_type = parsed["voucher_type"]
        if parsed.get("party"):
            draft.party = parsed["party"]
        if parsed.get("amount") is not None:
            draft.amount = float(parsed["amount"])
        if parsed.get("date"):
            draft.date = parsed["date"]
        if parsed.get("narration"):
            draft.narration = parsed["narration"]
        if parsed.get("bank"):
            if (draft.voucher_type or "").lower() in ["payment", "contra"]:
                draft.credit = parsed["bank"]
            else:
                draft.debit = parsed["bank"]
                
        # Parse items
        if parsed.get("items"):
            draft.entry_mode = "item_invoice"
            for it in parsed["items"]:
                qty = float(it.get("quantity") or 0.0)
                rate = float(it.get("rate") or 0.0)
                disc = float(it.get("discount_percent") or 0.0)
                draft.items.append(AiInvoiceItem(
                    item_name=it["item_name"],
                    quantity=qty,
                    rate=rate,
                    amount=round((qty * rate) * (1.0 - disc / 100.0), 2),
                    discount_percent=disc
                ))
                
        # Parse additional charges
        if parsed.get("additional_charges"):
            for ac in parsed["additional_charges"]:
                draft.additional_charges.append({
                    "ledger_name": ac["ledger_name"],
                    "amount": float(ac.get("amount") or 0.0)
                })

    if not draft:
        raise HTTPException(status_code=400, detail="Could not determine voucher context or draft. Please provide a query, session_id, or draft.")

    # 3. Execute validation engine
    engine = get_validation_engine()
    result = await engine.validate_draft(draft, service.db)
    return result


