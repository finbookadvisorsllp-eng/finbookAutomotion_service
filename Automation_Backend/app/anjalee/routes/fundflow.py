from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from app.db import get_db
from .sales import serialize_doc

router = APIRouter(prefix="/fundflow", tags=["fundflow"])

class FundFlowTransactionCreate(BaseModel):
    voucherType: str
    voucherDate: Optional[str] = None
    referenceNumber: Optional[str] = None
    partyLedger: Optional[str] = None
    againstLedger: Optional[str] = None
    amount: Optional[float] = 0.0
    drCrType: Optional[str] = "Dr"
    cashLedger: Optional[str] = None
    cashAmount: Optional[float] = 0.0
    bankLedger: Optional[str] = None
    transType: Optional[str] = None
    instNumber: Optional[str] = None
    instDate: Optional[str] = None
    utr: Optional[str] = None
    ifscCode: Optional[str] = None
    branchName: Optional[str] = None
    sourceLedger: Optional[str] = None
    transferAmount: Optional[float] = 0.0
    destinationLedger: Optional[str] = None
    amountReceived: Optional[float] = 0.0
    narration: Optional[str] = ""
    status: Optional[str] = "draft"
    billRows: Optional[List[dict]] = []
    costCenters: Optional[List[dict]] = []

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""

class CommentRequest(BaseModel):
    note: str

# ─── Statistics ───
@router.get("/stats")
async def get_summary_stats(
    voucherType: str = "bank_payment",
    companyId: Optional[str] = None,
    db = Depends(get_db)
):
    total_amount = 0.0
    count = 0
    pending_review = 0
    approved_count = 0
    
    ff_cursor = db["fund_flow_transactions"].find()
    for doc in ff_cursor:
        count += 1
        total_amount += float(doc.get("amount") or doc.get("transferAmount") or 0.0)
        if doc.get("status") == "pending_review":
            pending_review += 1
        elif doc.get("status") == "approved":
            approved_count += 1
            
    return {
        "success": True,
        "data": {
            "totalAmount": total_amount,
            "count": count,
            "pendingReviewCount": pending_review,
            "approvedCount": approved_count
        }
    }

# ─── CRUD ───
@router.get("")
async def list_transactions(
    voucherType: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db = Depends(get_db)
):
    query = {}
    if voucherType:
        query["voucherType"] = voucherType
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"partyLedger": {"$regex": search, "$options": "i"}},
            {"voucherNumber": {"$regex": search, "$options": "i"}},
            {"referenceNumber": {"$regex": search, "$options": "i"}}
        ]
        
    total = db["fund_flow_transactions"].count_documents(query)
    cursor = db["fund_flow_transactions"].find(query).sort("createdAt", -1).skip((page - 1) * limit).limit(limit)
    
    results = []
    for doc in cursor:
        results.append(serialize_doc(doc))
        
    return {
        "success": True,
        "data": results,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit
        }
    }

@router.post("")
async def create_transaction(payload: FundFlowTransactionCreate, db = Depends(get_db)):
    doc_data = payload.model_dump()
    doc_data["createdAt"] = datetime.now()
    doc_data["updatedAt"] = datetime.now()
    
    if not doc_data.get("voucherNumber"):
        prefix = "BP"
        if doc_data["voucherType"] == "cash_payment":
            prefix = "CP"
        elif doc_data["voucherType"] == "contra":
            prefix = "CT"
            
        counter = db["counters"].find_one_and_update(
            {"_id": prefix},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True
        )
        year = datetime.now().year
        doc_data["voucherNumber"] = f"{prefix}-{year}-{str(counter['seq']).padStart(4, '0')}"
        
    result = db["fund_flow_transactions"].insert_one(doc_data)
    doc_data["_id"] = str(result.inserted_id)
    return {"success": True, "data": serialize_doc(doc_data)}

@router.get("/{id}")
async def get_transaction(id: str, db = Depends(get_db)):
    # 1. Search manual entries
    try:
        doc = db["fund_flow_transactions"].find_one({"_id": ObjectId(id)})
        if doc:
            return {"success": True, "data": serialize_doc(doc)}
    except Exception:
        pass
        
    # 2. Search existing vouchers
    try:
        doc = db["vouchers"].find_one({"_id": ObjectId(id)})
        if doc:
            ref_val = doc.get("reference")
            ref_str = ""
            if isinstance(ref_val, dict):
                ref_str = ref_val.get("reference") or ""
            elif isinstance(ref_val, str):
                ref_str = ref_val
                
            mapped = {
                "_id": str(doc["_id"]),
                "voucherType": doc.get("voucherTypeName", "bank_payment").lower().replace(" ", "_"),
                "voucherNumber": doc.get("voucherNumber"),
                "voucherDate": doc.get("dates", {}).get("voucherDate"),
                "referenceNumber": ref_str or doc.get("voucherNumber"),
                "partyLedger": doc.get("partyLedgerName") or doc.get("partyName"),
                "amount": doc.get("totals", {}).get("grandTotal") or doc.get("total_amount") or 0.0,
                "narration": doc.get("narration"),
                "status": "approved",
                "entryMode": "manual"
            }
            return {"success": True, "data": mapped}
    except Exception:
        pass
        
    raise HTTPException(status_code=404, detail="Transaction not found")

@router.put("/{id}")
async def update_transaction(id: str, payload: FundFlowTransactionCreate, db = Depends(get_db)):
    try:
        query = {"_id": ObjectId(id)}
        update_data = payload.model_dump()
        update_data["updatedAt"] = datetime.now()
        
        result = db["fund_flow_transactions"].update_one(query, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
            
        doc = db["fund_flow_transactions"].find_one(query)
        return {"success": True, "data": serialize_doc(doc)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{id}")
async def delete_transaction(id: str, db = Depends(get_db)):
    try:
        result = db["fund_flow_transactions"].delete_one({"_id": ObjectId(id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return {"success": True, "message": "Transaction deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ─── Workflow Status ───
@router.patch("/{id}/status")
async def update_status(id: str, payload: StatusUpdate, db = Depends(get_db)):
    try:
        query = {"_id": ObjectId(id)}
        update_op = {
            "$set": {"status": payload.status, "updatedAt": datetime.now()},
            "$push": {
                "activityLog": {
                    "action": f"status_change_{payload.status}",
                    "note": payload.note,
                    "at": datetime.now()
                }
            }
        }
        result = db["fund_flow_transactions"].update_one(query, update_op)
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
            
        doc = db["fund_flow_transactions"].find_one(query)
        return {"success": True, "data": serialize_doc(doc)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ─── Activity Log / Comment ───
@router.post("/{id}/comments")
async def add_comment(id: str, payload: CommentRequest, db = Depends(get_db)):
    try:
        query = {"_id": ObjectId(id)}
        update_op = {
            "$push": {
                "activityLog": {
                    "action": "comment_added",
                    "note": payload.note,
                    "at": datetime.now()
                }
            }
        }
        result = db["fund_flow_transactions"].update_one(query, update_op)
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return {"success": True, "message": "Comment added successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
