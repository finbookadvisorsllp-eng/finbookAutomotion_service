import os
import re
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
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
        "data": updated_item,
        "affectedCount": updated_item.get("affectedCount", 1)
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


class BankRuleRequest(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = "customer_specific"  # customer_specific, bank_specific, system
    bankLedger: str
    pattern: str
    matchType: Optional[str] = "contains"  # contains, startswith, exact, tokens, regex
    partyLedger: str
    partyLedgerId: Optional[str] = None
    voucherType: Optional[str] = "Auto"
    direction: Optional[str] = "any"  # any, debit, credit
    excludeKeywords: Optional[str] = None
    confidenceThreshold: Optional[float] = 95.0
    status: Optional[str] = "active"


class BankRuleUpdateRequest(BaseModel):
    name: Optional[str] = None
    scope: Optional[str] = None
    bankLedger: Optional[str] = None
    pattern: Optional[str] = None
    matchType: Optional[str] = None
    partyLedger: Optional[str] = None
    partyLedgerId: Optional[str] = None
    voucherType: Optional[str] = None
    direction: Optional[str] = None
    excludeKeywords: Optional[str] = None
    confidenceThreshold: Optional[float] = None
    status: Optional[str] = None


class TestRuleRequest(BaseModel):
    bankLedger: str
    pattern: str
    matchType: Optional[str] = "contains"
    partyLedger: Optional[str] = None
    voucherType: Optional[str] = "Auto"
    direction: Optional[str] = "any"
    excludeKeywords: Optional[str] = None
    batch_id: Optional[str] = None
    sample_narrations: Optional[List[str]] = None


class DiscoverPatternsRequest(BaseModel):
    batch_id: str
    bank_ledger: str


class ApproveSuggestionRequest(BaseModel):
    candidatePattern: str
    matchType: Optional[str] = "contains"
    partyLedger: Optional[str] = None
    partyLedgerId: Optional[str] = None
    voucherType: Optional[str] = "Auto"
    scope: Optional[str] = "customer_specific"
    regexRule: Optional[str] = None
    partyPosition: Optional[int] = None
    txnIdPosition: Optional[int] = None
    vpaPosition: Optional[int] = None
    transactionType: Optional[str] = None
    bankLedger: Optional[str] = None
    batch_id: Optional[str] = None
    # Multi-party ledger mappings from expanded panel:
    # [{"party": "RAJAT PHARMACEUTICALS", "mappedLedger": "Rajat Pharma A/c", "confidence": 95}]
    partyLedgerMappings: Optional[List[Dict[str, Any]]] = None


class PatternFeedbackRequest(BaseModel):
    transactionId: str
    narration: str
    bankLedger: str
    correctedLedger: str
    correctedVoucherType: Optional[str] = None
    previousPrediction: Optional[Dict[str, Any]] = None


class ApplyRulesRequest(BaseModel):
    batch_id: str
    bank_ledger: str





def get_default_candidate_suggestions(bank_ledger: Optional[str] = None, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
    from app.anjalee.services.bank_pattern_engine import get_default_transaction_types_library
    return get_default_transaction_types_library(bank_ledger=bank_ledger)


@router.get("/rules")
async def get_bank_rules(
    request: Request,
    bankLedger: Optional[str] = None,
    scope: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db = Depends(get_db)
):
    """
    Retrieve saved bank pattern-to-ledger mapping rules with filtering and scope isolation.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    
    query: Dict[str, Any] = {}
    if status and status != "all":
        query["status"] = status

    if scope and scope != "all":
        query["scope"] = scope
        if bankLedger and scope in ["bank_specific", "bank"]:
            clean_bl = bankLedger.strip()
            bl_regex = re.compile(f"^{re.escape(clean_bl)}$", re.I)
            query["$or"] = [{"bankLedger": bl_regex}, {"bank_ledger": bl_regex}]
    else:
        # Default: show rules belonging to this bank, company, or global system
        scope_or = [{"scope": "system"}]
        if company_header and company_header != "default":
            scope_or.append({"companyId": company_header})
            scope_or.append({"company_id": company_header})
        if bankLedger:
            clean_bl = bankLedger.strip()
            bl_regex = re.compile(f"^{re.escape(clean_bl)}$", re.I)
            scope_or.append({"bankLedger": bl_regex})
            scope_or.append({"bank_ledger": bl_regex})
        query["$or"] = scope_or

    if search:
        s_reg = {"$regex": re.escape(search), "$options": "i"}
        query["$and"] = query.get("$and", []) + [{"$or": [{"pattern": s_reg}, {"partyLedger": s_reg}, {"name": s_reg}]}]

    rules_cursor = db["bank_mapping_rules"].find(query).sort("createdAt", -1)
    rules = []
    has_system_rule = False
    for r in rules_cursor:
        r["_id"] = str(r["_id"])
        if "createdAt" in r and hasattr(r["createdAt"], "isoformat"):
            r["createdAt"] = r["createdAt"].isoformat()
        if r.get("scope") in ["system", "bank_specific"]:
            has_system_rule = True
        rules.append(r)

    # Only return actual rules saved in the database for this company/bank
    return {"success": True, "count": len(rules), "data": rules}


@router.post("/rules")
async def create_bank_rule(
    request: Request,
    payload: BankRuleRequest,
    db = Depends(get_db)
):
    """Save a new pattern-to-ledger mapping rule with scope and advanced conditions."""
    from datetime import datetime
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    
    pattern_val = payload.pattern.strip()
    party_val = payload.partyLedger.strip()
    if not pattern_val or not party_val:
        raise HTTPException(status_code=400, detail="Pattern and Party Ledger are required")
    
    rule_name = (payload.name or "").strip() or f"{pattern_val} -> {party_val}"

    rule_doc = {
        "name": rule_name,
        "scope": (payload.scope or "customer_specific").lower(),
        "bankLedger": payload.bankLedger.strip(),
        "pattern": pattern_val,
        "matchType": (payload.matchType or "contains").lower(),
        "partyLedger": party_val,
        "partyLedgerId": payload.partyLedgerId,
        "voucherType": payload.voucherType or "Auto",
        "direction": (payload.direction or "any").lower(),
        "excludeKeywords": payload.excludeKeywords,
        "confidenceThreshold": payload.confidenceThreshold or 95.0,
        "status": (payload.status or "active").lower(),
        "companyId": company_header,
        "matchedCount": 0,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    res = db["bank_mapping_rules"].insert_one(rule_doc)
    rule_doc["_id"] = str(res.inserted_id)
    return {"success": True, "data": rule_doc, "message": "Rule created successfully"}


@router.put("/rules/{rule_id}")
async def update_bank_rule(
    rule_id: str,
    payload: BankRuleUpdateRequest,
    db = Depends(get_db)
):
    """Update an existing mapping rule."""
    from bson import ObjectId
    from datetime import datetime
    try:
        oid = ObjectId(rule_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rule ID")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided for update")
    
    updates["updatedAt"] = datetime.utcnow()
    res = db["bank_mapping_rules"].update_one({"_id": oid}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")

    updated_doc = db["bank_mapping_rules"].find_one({"_id": oid})
    if updated_doc:
        updated_doc["_id"] = str(updated_doc["_id"])
    return {"success": True, "data": updated_doc, "message": "Rule updated successfully"}


@router.patch("/rules/{rule_id}/status")
async def toggle_rule_status(
    rule_id: str,
    db = Depends(get_db)
):
    """Toggle rule status between active and disabled."""
    from bson import ObjectId
    from datetime import datetime
    try:
        oid = ObjectId(rule_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rule ID")

    rule = db["bank_mapping_rules"].find_one({"_id": oid})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    new_status = "disabled" if rule.get("status") == "active" else "active"
    db["bank_mapping_rules"].update_one(
        {"_id": oid},
        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}}
    )
    return {"success": True, "status": new_status, "message": f"Rule is now {new_status}"}


@router.post("/rules/{rule_id}/duplicate")
async def duplicate_bank_rule(
    rule_id: str,
    db = Depends(get_db)
):
    """Duplicates an existing mapping rule."""
    from bson import ObjectId
    from datetime import datetime
    try:
        oid = ObjectId(rule_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rule ID")

    rule = db["bank_mapping_rules"].find_one({"_id": oid})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    new_rule = dict(rule)
    new_rule.pop("_id", None)
    new_rule["name"] = f"Copy of {rule.get('name') or rule.get('pattern')}"
    new_rule["status"] = "draft"
    new_rule["matchedCount"] = 0
    new_rule["createdAt"] = datetime.utcnow()
    new_rule["updatedAt"] = datetime.utcnow()

    res = db["bank_mapping_rules"].insert_one(new_rule)
    new_rule["_id"] = str(res.inserted_id)
    return {"success": True, "data": new_rule, "message": "Rule duplicated as Draft"}


@router.delete("/rules/{rule_id}")
async def delete_bank_rule(
    rule_id: str,
    db = Depends(get_db)
):
    """Delete a bank mapping rule by ID."""
    from bson import ObjectId
    try:
        oid = ObjectId(rule_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid rule ID")
    res = db["bank_mapping_rules"].delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"success": True, "message": "Rule deleted successfully"}


@router.post("/rules/test")
async def test_bank_rule(
    request: Request,
    payload: TestRuleRequest,
    db = Depends(get_db)
):
    """
    Simulates a rule against statement transactions or sample narrations before saving.
    Returns matched count, non-matched count, sample matches, and conflict detection.
    """
    from app.anjalee.services.bank_pattern_engine import (
        NarrationNormalizationService,
        RulesBasedMatchingService,
        PartyLedgerResolutionService
    )
    from bson import ObjectId

    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    items_to_test = []

    if payload.batch_id:
        batch = db["bank_statement_drafts"].find_one({"_id": ObjectId(payload.batch_id)})
        if batch:
            items_to_test = [it.get("narration") for it in batch.get("items", []) if it.get("narration")]

    if not items_to_test and payload.sample_narrations:
        items_to_test = payload.sample_narrations

    if not items_to_test:
        # Pull recent narrations for the bank ledger from database
        recent_batch = db["bank_statement_drafts"].find_one(
            {"bank_ledger": payload.bankLedger},
            sort=[("created_at", -1)]
        )
        if recent_batch:
            items_to_test = [it.get("narration") for it in recent_batch.get("items", []) if it.get("narration")][:100]

    test_rule = {
        "name": "Test Rule",
        "pattern": payload.pattern,
        "matchType": payload.matchType or "contains",
        "partyLedger": payload.partyLedger,
        "voucherType": payload.voucherType or "Auto",
        "direction": payload.direction or "any",
        "excludeKeywords": payload.excludeKeywords
    }

    rules_svc = RulesBasedMatchingService(db)
    matched_samples = []
    non_matched_samples = []

    for narr in items_to_test[:150]:
        res = rules_svc.match_transaction(
            narration=narr,
            amount=100.0,
            is_credit=False,
            applicable_rules=[test_rule]
        )
        party_cand, _ = NarrationNormalizationService.extract_party_candidate(narr)
        channel, _ = NarrationNormalizationService.detect_channel(narr)

        if res:
            matched_samples.append({
                "narration": narr,
                "channel": channel,
                "extractedParty": party_cand,
                "suggestedLedger": payload.partyLedger,
                "voucherType": res.get("voucherType")
            })
        else:
            if len(non_matched_samples) < 10:
                non_matched_samples.append({
                    "narration": narr,
                    "channel": channel,
                    "extractedParty": party_cand
                })

    return {
        "success": True,
        "tested_count": len(items_to_test),
        "matched_count": len(matched_samples),
        "non_matched_count": len(items_to_test) - len(matched_samples),
        "sample_matches": matched_samples[:20],
        "sample_non_matches": non_matched_samples[:10],
        "has_matches": len(matched_samples) > 0
    }


@router.post("/rules/discover")
async def discover_bank_patterns(
    request: Request,
    payload: DiscoverPatternsRequest,
    db = Depends(get_db)
):
    """
    Runs Engine B AI Pattern Discovery on a statement batch.
    Clusters unmatched narrations and returns candidate pattern suggestions.
    """
    from app.anjalee.services.bank_pattern_engine import AIPatternDiscoveryService
    from bson import ObjectId

    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    batch = db["bank_statement_drafts"].find_one({"_id": ObjectId(payload.batch_id)})
    if not batch:
        raise HTTPException(status_code=404, detail="Statement batch not found")

    items = batch.get("items", [])
    discovery_svc = AIPatternDiscoveryService(db)
    suggestions = discovery_svc.cluster_and_discover(
        batch_items=items,
        bank_ledger=payload.bank_ledger,
        company_id=company_header
    )

    return {
        "success": True,
        "discovered_count": len(suggestions),
        "data": suggestions,
        "message": f"Discovered {len(suggestions)} new pattern candidate(s) for review."
    }


@router.get("/rules/suggestions")
async def get_pattern_suggestions(
    request: Request,
    bankLedger: Optional[str] = None,
    batch_id: Optional[str] = None,
    db = Depends(get_db)
):
    """
    Retrieve candidate pattern suggestions waiting for human review.
    Dynamically discovers patterns from active statement drafts or fund flow vouchers.
    """
    try:
        company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
        
        raw_items = []
        source_id = "batch"

        # 1. Query by batch_id if valid
        clean_batch_id = (batch_id or "").strip()
        if clean_batch_id and clean_batch_id.lower() not in ["undefined", "null", "none"]:
            b_query = {}
            try:
                if len(clean_batch_id) == 24 and ObjectId.is_valid(clean_batch_id):
                    b_query = {"$or": [{"_id": ObjectId(clean_batch_id)}, {"batch_id": clean_batch_id}]}
                else:
                    b_query = {"batch_id": clean_batch_id}
            except Exception:
                b_query = {"batch_id": clean_batch_id}
            
            batch = db["bank_statement_drafts"].find_one(b_query)
            if batch and batch.get("items"):
                source_id = str(batch.get("_id") or batch.get("batch_id"))
                raw_items = list(batch.get("items", []))

        # 2. If no batch items yet and bankLedger provided, get items from the latest matching draft
        if not raw_items and bankLedger:
            clean_bl = bankLedger.strip()
            bl_regex = re.compile(f"^{re.escape(clean_bl)}$", re.I)
            b = db["bank_statement_drafts"].find_one(
                {"$or": [{"bank_ledger": bl_regex}, {"bankLedger": bl_regex}]},
                sort=[("created_at", -1), ("_id", -1)]
            )
            if not b:
                bl_sub = re.compile(f"{re.escape(clean_bl)}", re.I)
                b = db["bank_statement_drafts"].find_one(
                    {"$or": [{"bank_ledger": bl_sub}, {"bankLedger": bl_sub}]},
                    sort=[("created_at", -1), ("_id", -1)]
                )
            if b and b.get("items"):
                source_id = str(b.get("_id") or b.get("batch_id"))
                raw_items = list(b.get("items", []))

        # 3. If still no items, check latest draft in database
        if not raw_items:
            b = db["bank_statement_drafts"].find_one({}, sort=[("created_at", -1), ("_id", -1)])
            if b and b.get("items"):
                source_id = str(b.get("_id") or b.get("batch_id"))
                raw_items = list(b.get("items", []))

        # 4. Process ONLY the uploaded bank statement document transactions for this bank
        if not raw_items:
            # If no uploaded statement exists yet for this bank account, return default taxonomy library with 0 detected
            from app.anjalee.services.bank_pattern_engine import get_default_transaction_types_library
            default_library = get_default_transaction_types_library(bank_ledger=bankLedger)
            return {"success": True, "count": 0, "isDefaultLibrary": True, "data": default_library}

        # 5. Run PatternDiscoveryEngine if items found
        if raw_items:
            try:
                from app.anjalee.services.bank_pattern_engine import PatternDiscoveryEngine
                engine = PatternDiscoveryEngine(db)
                discovered = engine.discover_patterns_from_transactions(
                    raw_items,
                    bank_ledger=bankLedger or "BANK AC",
                    company_id=company_header
                )
                for idx, s in enumerate(discovered):
                    s_id = f"disc_{source_id}_{idx}"
                    s["_id"] = s_id
                    s["id"] = s_id
                    if "created_at" in s and hasattr(s["created_at"], "isoformat"):
                        s["created_at"] = s["created_at"].isoformat()
                    s["reviewStatus"] = s.get("reviewStatus") or "needs_review"
                    s["status"] = s.get("status") or "needs_review"
                    try:
                        s_copy = dict(s)
                        s_copy.pop("_id", None)
                        db["bank_pattern_suggestions"].update_one(
                            {"pattern": s["pattern"], "bankLedger": bankLedger or "BANK AC"},
                            {"$set": s_copy},
                            upsert=True
                        )
                    except Exception:
                        pass

                if discovered:
                    return {"success": True, "count": len(discovered), "isDefaultLibrary": False, "data": discovered}
            except Exception as pe:
                logger.error(f"Error in dynamic pattern discovery: {pe}", exc_info=True)

        # 6. Fallback to default candidate suggestions for this bank
        default_candidates = get_default_candidate_suggestions(bank_ledger=bankLedger, company_id=company_header)
        return {"success": True, "count": 0, "isDefaultLibrary": True, "data": default_candidates}
    except Exception as e:
        logger.error(f"Unexpected error in get_pattern_suggestions: {e}", exc_info=True)
        fallback = get_default_candidate_suggestions(bank_ledger=bankLedger, company_id=company_header)
        return {"success": True, "count": 0, "isDefaultLibrary": True, "data": fallback}


class PatternExtractPreviewRequest(BaseModel):
    separator: str = "/"
    partyPosition: int = 2
    txnIdPosition: Optional[int] = 1
    transactions: Optional[List[Dict[str, Any]]] = []


@router.post("/patterns/extract-preview")
async def extract_pattern_preview(
    payload: PatternExtractPreviewRequest,
    request: Request,
    db = Depends(get_db)
):
    """
    Live interactive extraction of party names across matching transactions
    when user modifies token index. Resolves against Tally master ledgers.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    from app.anjalee.services.bank_pattern_engine import PartyLedgerResolutionService, NarrationNormalizationService
    resolution_svc = PartyLedgerResolutionService(db)
    company_masters = resolution_svc.get_company_master_ledgers(company_header)

    sep = payload.separator or "/"
    party_pos = payload.partyPosition
    txns = payload.transactions or []

    distinct_parties = {}
    for tx in txns:
        narr = tx.get("narration") or ""
        norm = NarrationNormalizationService.normalize_text(narr)
        if sep == ' ':
            tokens = [t.strip() for t in re.split(r'\s+', norm) if t.strip()]
        else:
            tokens = [t.strip() for t in norm.split(sep) if t.strip()]

        party_val = None
        if 0 <= party_pos < len(tokens):
            cand = tokens[party_pos].strip()
            if len(cand) >= 2 and cand.upper() not in NarrationNormalizationService.STOP_WORDS:
                party_val = cand

        if not party_val:
            party_val = "Unspecified Party"

        tx_info = {
            "id": str(tx.get("id") or ""),
            "date": tx.get("date") or "",
            "amount": tx.get("amount") or 0,
            "reference": tx.get("reference") or "—",
            "narration": narr
        }

        if party_val not in distinct_parties:
            res = resolution_svc.resolve_party_ledger(party_val, narr, company_id=company_header, company_masters=company_masters)
            distinct_parties[party_val] = {
                "party": party_val,
                "count": 1,
                "mappedLedger": res.get("resolvedLedger") or "Unmapped",
                "confidence": res.get("confidence", 0),
                "sampleTransactions": [tx_info]
            }
        else:
            distinct_parties[party_val]["count"] += 1
            if len(distinct_parties[party_val]["sampleTransactions"]) < 10:
                distinct_parties[party_val]["sampleTransactions"].append(tx_info)

    parties_list = sorted(distinct_parties.values(), key=lambda p: p["count"], reverse=True)
    return {
        "success": True,
        "partyPosition": party_pos,
        "separator": sep,
        "distinctParties": parties_list,
        "distinctPartiesCount": len(parties_list)
    }


@router.post("/rules/suggestions/{suggestion_id}/approve")
async def approve_pattern_suggestion(
    suggestion_id: str,
    payload: ApproveSuggestionRequest,
    request: Request,
    db = Depends(get_db)
):
    """
    Converts an AI-discovered pattern suggestion into an approved active rule.
    """
    from bson import ObjectId
    from datetime import datetime

    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    suggestion = None
    if len(suggestion_id) == 24:
        try:
            oid = ObjectId(suggestion_id)
            suggestion = db["bank_pattern_suggestions"].find_one({"_id": oid})
        except Exception:
            suggestion = None
    if not suggestion:
        suggestion = db["bank_pattern_suggestions"].find_one({"$or": [{"_id": suggestion_id}, {"id": suggestion_id}]})

    pattern_val = (payload.candidatePattern or (suggestion.get("candidatePattern") if suggestion else "") or "").strip()
    party_val = (payload.partyLedger or (suggestion.get("suggestedLedger") if suggestion else "") or "").strip()
    bank_ledger_val = payload.bankLedger or (suggestion.get("bankLedger") if suggestion else "BANK AC")

    if not pattern_val:
        raise HTTPException(status_code=400, detail="Pattern structure is required")

    rule_name = f"Pattern Rule: {pattern_val}"
    if party_val and party_val != "Unmapped":
        rule_name += f" -> {party_val}"

    match_type = payload.matchType or ("regex" if payload.regexRule else "contains")
    stored_pattern = payload.regexRule if (payload.regexRule and match_type == "regex") else pattern_val

    party_mappings = payload.partyLedgerMappings or []
    aliases_saved = 0
    if party_mappings:
        from datetime import datetime as _dt
        for pm in party_mappings:
            party_name = (pm.get("party") or "").strip()
            mapped_ledger = (pm.get("mappedLedger") or "").strip()
            if not party_name or not mapped_ledger or mapped_ledger in ("Unmapped", ""):
                continue
            try:
                alias_doc = {
                    "partyName": party_name,
                    "resolvedLedger": mapped_ledger,
                    "bankLedger": bank_ledger_val,
                    "confidence": pm.get("confidence", 100),
                    "source": "user_mapped",
                    "companyId": company_header,
                    "updatedAt": _dt.utcnow()
                }
                db["bank_party_aliases"].update_one(
                    {"partyName": party_name, "companyId": company_header},
                    {"$set": alias_doc},
                    upsert=True
                )
                aliases_saved += 1
            except Exception as ae:
                logger.warning(f"Failed to save party alias '{party_name}': {ae}")

    rule_doc = {
        "name": rule_name,
        "scope": (payload.scope or "customer_specific").lower(),
        "bankLedger": bank_ledger_val,
        "pattern": stored_pattern,
        "structuralPattern": pattern_val,
        "matchType": match_type.lower(),
        "partyPosition": payload.partyPosition,
        "txnIdPosition": payload.txnIdPosition,
        "vpaPosition": payload.vpaPosition,
        "transactionType": payload.transactionType or (suggestion.get("transactionType") if suggestion else None) or (suggestion.get("channel") if suggestion else None),
        "partyLedger": party_val if party_val and party_val != "Unmapped" else None,
        "partyLedgerId": payload.partyLedgerId,
        "partyLedgerMappings": party_mappings,
        "batch_id": payload.batch_id,
        "voucherType": payload.voucherType or "Auto",
        "direction": "any",
        "confidenceThreshold": 95.0,
        "status": "active",
        "companyId": company_header,
        "originSuggestionId": suggestion_id,
        "matchedCount": 0,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

    res = db["bank_mapping_rules"].insert_one(rule_doc)
    rule_doc["_id"] = str(res.inserted_id)

    # Mark suggestion as approved if found in DB
    if suggestion:
        try:
            db["bank_pattern_suggestions"].update_one(
                {"_id": suggestion["_id"]},
                {"$set": {"reviewStatus": "approved", "approvedAt": datetime.utcnow()}}
            )
        except Exception:
            pass

    # Reprocess affected stored draft transactions with this newly approved rule without requiring re-upload
    reprocessed_cnt = 0
    updated_batch_data = None
    try:
        service = BankStatementAIService(db)
        result = service.reprocess_drafts_with_rule(rule_doc, company_id=company_header, target_batch_id=payload.batch_id)
        reprocessed_cnt = result or 0  # guard against None
        if payload.batch_id:
            updated_batch_data = service.get_batch_draft(payload.batch_id)
    except Exception as re_err:
        logger.warning(f"Error reprocessing drafts on pattern approval: {re_err}")

    msg = f"Reusable pattern rule approved for '{pattern_val}'."
    if reprocessed_cnt > 0:
        msg += f" Automatically mapped {reprocessed_cnt} stored transaction(s) without re-upload!"
    if aliases_saved > 0:
        msg += f" Saved {aliases_saved} party→master ledger mapping(s)."

    return {
        "success": True,
        "data": rule_doc,
        "reprocessed_count": reprocessed_cnt,
        "aliases_saved": aliases_saved,
        "updated_batch": updated_batch_data,
        "message": msg
    }


@router.post("/rules/suggestions/{suggestion_id}/reject")
async def reject_pattern_suggestion(
    suggestion_id: str,
    db = Depends(get_db)
):
    """Reject an AI candidate suggestion."""
    from bson import ObjectId
    from datetime import datetime
    updated = False
    if len(suggestion_id) == 24:
        try:
            oid = ObjectId(suggestion_id)
            res = db["bank_pattern_suggestions"].update_one(
                {"_id": oid},
                {"$set": {"reviewStatus": "rejected", "rejectedAt": datetime.utcnow()}}
            )
            if res.modified_count > 0:
                updated = True
        except Exception:
            pass
    if not updated:
        try:
            db["bank_pattern_suggestions"].update_one(
                {"$or": [{"_id": suggestion_id}, {"id": suggestion_id}]},
                {"$set": {"reviewStatus": "rejected", "rejectedAt": datetime.utcnow()}}
            )
        except Exception:
            pass

    return {"success": True, "message": "Pattern suggestion rejected."}


@router.post("/rules/feedback")
async def record_pattern_feedback(
    request: Request,
    payload: PatternFeedbackRequest,
    db = Depends(get_db)
):
    """
    Submits user correction to learn customer party aliases and improve pattern ranking.
    """
    from app.anjalee.services.bank_pattern_engine import PatternFeedbackService
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    
    svc = PatternFeedbackService(db)
    res = svc.record_feedback(
        transaction_id=payload.transactionId,
        narration=payload.narration,
        bank_ledger=payload.bankLedger,
        corrected_ledger=payload.correctedLedger,
        corrected_voucher_type=payload.correctedVoucherType,
        previous_prediction=payload.previousPrediction,
        company_id=company_header
    )
    return res


@router.post("/rules/apply-to-batch")
async def apply_rules_to_batch(
    request: Request,
    payload: ApplyRulesRequest,
    db = Depends(get_db)
):
    """Apply all rules for bankLedger to the draft items in a batch."""
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    service = BankStatementAIService(db)
    res = service.apply_rules_to_batch(payload.batch_id, payload.bank_ledger, company_id=company_header)
    return res


class ConfirmLedgerMappingRequest(BaseModel):
    bankLedger: str
    pattern: str
    selectedLedger: str
    selectedLedgerId: Optional[str] = None
    transactionIds: Optional[List[str]] = None
    createRule: Optional[bool] = True


@router.get("/ledger-mappings")
async def get_ledger_mappings(
    request: Request,
    bankLedger: str,
    batch_id: Optional[str] = None,
    search: Optional[str] = None,
    filter: Optional[str] = "all",
    db = Depends(get_db)
):
    """
    Fetches extracted transaction patterns grouped by pattern/party for the 4-column Ledger Mapping table.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    service = BankStatementAIService(db)
    mappings = service.get_ledger_mappings(
        bank_ledger=bankLedger,
        company_id=company_header,
        batch_id=batch_id,
        search=search,
        filter_type=filter
    )
    return {"success": True, "count": len(mappings), "data": mappings}


@router.post("/ledger-mappings/confirm")
async def confirm_ledger_mapping(
    request: Request,
    payload: ConfirmLedgerMappingRequest,
    db = Depends(get_db)
):
    """
    Assigns / confirms counterpart party ledger for an extracted pattern group across statement items.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    service = BankStatementAIService(db)
    res = service.confirm_ledger_mapping(
        bank_ledger=payload.bankLedger,
        pattern=payload.pattern,
        selected_ledger=payload.selectedLedger,
        transaction_ids=payload.transactionIds,
        company_id=company_header,
        create_rule=payload.createRule if payload.createRule is not None else True
    )
    return res



