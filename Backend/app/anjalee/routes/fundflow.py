from fastapi import APIRouter, Depends, Query, Request
from typing import Optional
from bson import ObjectId
from datetime import datetime
from app.db import get_db
from app.anjalee.repositories.fundflow_repo import FundFlowRepository
from app.anjalee.services.fundflow_service import FundFlowService
from app.anjalee.schemas.fundflow_schemas import FundFlowTransactionCreate, StatusUpdate, CommentRequest

router = APIRouter(prefix="/fundflow", tags=["fundflow"])

def get_fundflow_service(db = Depends(get_db)) -> FundFlowService:
    repo = FundFlowRepository(db)
    return FundFlowService(repo)

@router.get("/stats")
async def get_summary_stats(
    voucherType: str = "bank_payment",
    companyId: Optional[str] = None,
    service: FundFlowService = Depends(get_fundflow_service)
):
    stats = service.get_summary_stats(voucherType, companyId)
    return {
        "success": True,
        "data": stats
    }

@router.get("")
async def list_transactions(
    voucherType: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    service: FundFlowService = Depends(get_fundflow_service)
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
    payload: FundFlowTransactionCreate,
    service: FundFlowService = Depends(get_fundflow_service)
):
    data = service.create_transaction(payload)
    return {
        "success": True,
        "data": data
    }

@router.get("/ledgers")
async def get_fundflow_ledgers(
    request: Request,
    service: FundFlowService = Depends(get_fundflow_service)
):
    """
    Fetch all ledgers with names, groupNames, gstin, phone, etc. for fundflow routing.
    Matches the logic of get_party_ledgers in sales_repo.py.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    db = service.repo.db
    
    comp = None
    if company_header:
        if len(company_header) == 24:
            try:
                comp = db["companies"].find_one({"_id": ObjectId(company_header)})
            except Exception:
                pass
        if not comp:
            comp = db["companies"].find_one({
                "$or": [
                    {"companyName": company_header},
                    {"basicCompantFormalName": company_header}
                ]
            })
    if not comp:
        comp = db["companies"].find_one()

    # Query ledgers for party groups
    party_groups = ["Sundry Debtors", "Sundry Creditors", "Bank Accounts", "Cash-in-Hand", "Bank OD A/c"]
    query = {"groupName": {"$in": party_groups}}
    if comp:
        query["companyId"] = comp["_id"]

    ledgers = list(db["ledgers"].find(query))

    # 1. Identify ledger names that need GST/registration type fallback
    names_needing_fallback = []
    for l in ledgers:
        ledger_name = l.get("ledgerName", "")
        pd = l.get("partyDetails") or {}
        gstin = pd.get("gstin") or l.get("gstin") or ""
        gst_state = pd.get("gstState") or ""
        registration_type = pd.get("registrationType") or l.get("registrationType") or ""
        if ledger_name and (not gstin or not gst_state or not registration_type):
            names_needing_fallback.append(ledger_name)

    # 2. Fetch fallback voucher details in bulk in a single query
    voucher_lookup = {}
    if names_needing_fallback:
        vouchers_list = list(db["vouchers"].find({
            "$or": [
                {"partyLedgerName": {"$in": names_needing_fallback}},
                {"partyName": {"$in": names_needing_fallback}}
            ],
            "gstDetails.gstin": {"$exists": True, "$ne": ""}
        }))
        for v in vouchers_list:
            name1 = v.get("partyLedgerName")
            name2 = v.get("partyName")
            gd = v.get("gstDetails") or {}
            if name1:
                voucher_lookup[name1] = gd
            if name2:
                voucher_lookup[name2] = gd

    # 3. Assemble results using lookup map
    from app.anjalee.repositories.sales_repo import STATE_CODES

    results = []
    for l in ledgers:
        ledger_name = l.get("ledgerName", "")
        pd = l.get("partyDetails") or {}
        gstin = pd.get("gstin") or l.get("gstin") or ""
        gst_state = pd.get("gstState") or ""
        registration_type = pd.get("registrationType") or l.get("registrationType") or ""
        phone = pd.get("phone") or pd.get("mobile") or l.get("phone") or l.get("mobile") or ""

        if not gstin or not gst_state or not registration_type:
            gd = voucher_lookup.get(ledger_name) or {}
            if gd:
                if not gstin:
                    gstin = gd.get("gstin") or ""
                if not gst_state:
                    gst_state = gd.get("gstState") or ""
                if not registration_type:
                    registration_type = gd.get("registrationType") or ""

        if not registration_type:
            registration_type = "Regular" if gstin else "Consumer"

        if not gst_state and gstin and len(gstin) >= 2:
            prefix = gstin[:2]
            gst_state = STATE_CODES.get(prefix, "")

        results.append({
            "id": str(l["_id"]),
            "name": ledger_name,
            "ledgerName": ledger_name,
            "groupName": l.get("groupName", ""),
            "gstin": gstin,
            "gstState": gst_state,
            "registrationType": registration_type,
            "phone": phone
        })

    # Fetch Duties & Taxes ledgers
    duties_query = {"groupName": "Duties & Taxes"}
    if comp:
        duties_query["companyId"] = comp["_id"]
    duties_ledgers = list(db["ledgers"].find(duties_query))

    gst_ledgers = []
    tds_ledgers = []
    for l in duties_ledgers:
        ledger_name = l.get("ledgerName", "")
        pd = l.get("partyDetails") or {}
        gstin = pd.get("gstin") or l.get("gstin") or ""
        gst_state = pd.get("gstState") or ""
        registration_type = pd.get("registrationType") or l.get("registrationType") or ""
        phone = pd.get("phone") or pd.get("mobile") or l.get("phone") or l.get("mobile") or ""

        if not registration_type:
            registration_type = "Regular" if gstin else "Consumer"

        if not gst_state and gstin and len(gstin) >= 2:
            prefix = gstin[:2]
            gst_state = STATE_CODES.get(prefix, "")

        ledger_item = {
            "id": str(l["_id"]),
            "name": ledger_name,
            "ledgerName": ledger_name,
            "groupName": l.get("groupName", ""),
            "gstin": gstin,
            "gstState": gst_state,
            "registrationType": registration_type,
            "phone": phone
        }

        name_lower = ledger_name.lower()
        if "tds" in name_lower or "tcs" in name_lower or "tax collected" in name_lower:
            tds_ledgers.append(ledger_item)
        else:
            gst_ledgers.append(ledger_item)

    # Fetch cost centers from database
    cc_query = {}
    if comp:
        cc_query["companyId"] = comp["_id"]
    db_cost_centers = list(db["costCenters"].find(cc_query))

    cost_centers = []
    cost_categories = set()

    if db_cost_centers:
        for cc in db_cost_centers:
            name = cc.get("name") or cc.get("costCenterName") or cc.get("ledgerName") or ""
            category = cc.get("category") or cc.get("costCategoryName") or cc.get("categoryName") or "Primary Cost Category"
            if name:
                cost_centers.append({
                    "name": name,
                    "category": category
                })
                cost_categories.add(category)
        cost_categories = list(cost_categories)
    else:
        # Fallback values if database collection is empty
        cost_categories = ['Primary Cost Category', 'Marketing', 'Operations']
        cost_centers = [
            {"name": 'Mumbai Branch', "category": 'Primary Cost Category'},
            {"name": 'Delhi Branch', "category": 'Primary Cost Category'},
            {"name": 'Web Campaign', "category": 'Marketing'},
            {"name": 'Sales Event', "category": 'Marketing'},
            {"name": 'Backend Ops', "category": 'Operations'}
        ]

    payload_data = {
        "ledgers": results,
        "gstLedgers": gst_ledgers,
        "tdsLedgers": tds_ledgers,
        "costCenters": cost_centers,
        "costCategories": cost_categories,
        "gstRates": ['5%', '12%', '18%', '28%'],
        "tdsRates": ['1%', '2%', '5%', '10%']
    }

    return {"success": True, "data": payload_data}

@router.get("/next-voucher-number")
async def get_next_voucher_number(
    voucherType: str = Query("cash_payment"),
    service: FundFlowService = Depends(get_fundflow_service)
):
    """Return the next auto-generated voucher number for a voucher type (peek)."""
    next_number = service.get_next_voucher_number(voucherType)
    return {"success": True, "data": {"voucherNumber": next_number}}

@router.get("/party-details")
async def get_fundflow_party_details(
    partyName: str,
    fy: str = "2025-2026",
    service: FundFlowService = Depends(get_fundflow_service)
):
    """
    Fetch party details, outstanding balance, and pending bills.
    """
    db = service.repo.db
    ledger = db["ledgers"].find_one({"ledgerName": partyName})
    if not ledger:
        return {"success": False, "message": "Party ledger not found"}

    pd = ledger.get("partyDetails") or {}
    gstin = pd.get("gstin") or ledger.get("gstin") or ""
    gst_state = pd.get("gstState") or ""
    registration_type = pd.get("registrationType") or ledger.get("registrationType") or ""
    contact_person = pd.get("contactPerson") or ""
    phone = pd.get("phone") or pd.get("mobile") or ledger.get("phone") or ledger.get("mobile") or ""

    from app.anjalee.repositories.sales_repo import STATE_CODES
    if not gst_state and gstin and len(gstin) >= 2:
        prefix = gstin[:2]
        gst_state = STATE_CODES.get(prefix, "")

    from app.aman.services.accounting import compute_ledger_balances
    balances = compute_ledger_balances(db, fy)
    lb = balances.get(partyName)
    
    closing_debit = 0.0
    closing_credit = 0.0
    if lb:
        closing_debit = lb.closing_debit
        closing_credit = lb.closing_credit
    
    outstanding_amt = 0.0
    outstanding_type = "Dr"
    if closing_debit >= closing_credit:
        outstanding_amt = round(closing_debit - closing_credit, 2)
        outstanding_type = "Dr"
    else:
        outstanding_amt = round(closing_credit - closing_debit, 2)
        outstanding_type = "Cr"
        
    if outstanding_amt == 0.0:
        opening_bal = ledger.get("balances", {}).get("openingBalance") or {}
        outstanding_amt = float(opening_bal.get("amount") or 0.0)
        outstanding_type = "Dr" if (opening_bal.get("type") or "DEBIT") == "DEBIT" else "Cr"

    pending_bills = []
    
    # Query Tally vouchers
    tally_vouchers = list(db["vouchers"].find({
        "$or": [
            {"partyLedgerName": partyName},
            {"partyName": partyName}
        ],
        "voucherCategory": {"$in": ["Sales", "Purchase"]},
        "isDeleted": {"$ne": True}
    }).sort("dates.date", -1).limit(20))

    for v in tally_vouchers:
        v_date = ""
        dates_obj = v.get("dates") or {}
        if dates_obj.get("date"):
            dt = dates_obj.get("date")
            if hasattr(dt, "strftime"):
                v_date = dt.strftime("%Y-%m-%d")
            else:
                v_date = str(dt)[:10]
        
        totals_obj = v.get("totals") or {}
        amount = float(totals_obj.get("totalAmount") or totals_obj.get("totalDebit") or totals_obj.get("totalCredit") or 0.0)
        
        pending_bills.append({
            "billNo": v.get("voucherNumber") or v.get("voucherGuid") or "",
            "date": v_date,
            "billAmount": amount,
            "pendingAmount": amount,
            "source": "tally"
        })
        
    # Query purchase_vouchers
    purch_vouchers = list(db["purchase_vouchers"].find({
        "$or": [
            {"partyLedger": partyName},
            {"partyName": partyName}
        ],
        "isDeleted": {"$ne": True}
    }).sort("createdAt", -1).limit(20))

    for pv in purch_vouchers:
        v_date = pv.get("voucherDate") or pv.get("invoiceDate") or ""
        if isinstance(v_date, datetime):
            v_date = v_date.strftime("%Y-%m-%d")
        elif not isinstance(v_date, str):
            v_date = ""
        amount = float(pv.get("grandTotal") or 0.0)
        pending_bills.append({
            "billNo": pv.get("voucherNumber") or pv.get("invoiceNumber") or "",
            "date": v_date,
            "billAmount": amount,
            "pendingAmount": amount,
            "source": "purchase_voucher"
        })

    # Query sales_vouchers
    sal_vouchers = list(db["sales_vouchers"].find({
        "$or": [
            {"partyLedgerName": partyName},
            {"partyName": partyName}
        ],
        "isDeleted": {"$ne": True}
    }).sort("createdAt", -1).limit(20))

    for sv in sal_vouchers:
        v_date = sv.get("voucherDate") or ""
        if isinstance(v_date, datetime):
            v_date = v_date.strftime("%Y-%m-%d")
        elif not isinstance(v_date, str):
            v_date = ""
        amount = float(sv.get("grandTotal") or 0.0)
        pending_bills.append({
            "billNo": sv.get("voucherNumber") or "",
            "date": v_date,
            "billAmount": amount,
            "pendingAmount": amount,
            "source": "sales_voucher"
        })

    seen_bills = set()
    unique_bills = []
    for b in pending_bills:
        if b["billNo"] and b["billNo"] not in seen_bills:
            seen_bills.add(b["billNo"])
            unique_bills.append(b)

    unique_bills.sort(key=lambda x: x["date"], reverse=True)

    return {
        "success": True,
        "data": {
            "ledgerName": partyName,
            "groupName": ledger.get("groupName", ""),
            "gstin": gstin,
            "gstState": gst_state,
            "registrationType": registration_type,
            "contactPerson": contact_person,
            "phone": phone,
            "outstandingBalance": outstanding_amt,
            "outstandingType": outstanding_type,
            "pendingBills": unique_bills[:10]
        }
    }


@router.get("/{id}")
async def get_transaction(
    id: str,
    service: FundFlowService = Depends(get_fundflow_service)
):
    data = service.get_transaction(id)
    return {
        "success": True,
        "data": data
    }

@router.put("/{id}")
async def update_transaction(
    id: str,
    payload: FundFlowTransactionCreate,
    service: FundFlowService = Depends(get_fundflow_service)
):
    data = service.update_transaction(id, payload)
    return {
        "success": True,
        "data": data
    }

@router.delete("/{id}")
async def delete_transaction(
    id: str,
    service: FundFlowService = Depends(get_fundflow_service)
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
    service: FundFlowService = Depends(get_fundflow_service)
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
    service: FundFlowService = Depends(get_fundflow_service)
):
    service.add_comment(id, payload)
    return {
        "success": True,
        "message": "Comment added successfully"
    }
