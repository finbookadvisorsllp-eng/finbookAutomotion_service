from fastapi import APIRouter, Depends, Request, HTTPException, Query
from typing import Dict, Any, Optional
import uuid
import re
import math
from datetime import datetime
from bson import ObjectId
from app.db import get_db

router = APIRouter(prefix="/ledgers", tags=["ledgers"])

def serialize_mongo_doc(doc):
    if isinstance(doc, dict):
        return {k: serialize_mongo_doc(v) for k, v in doc.items()}
    elif isinstance(doc, list):
        return [serialize_mongo_doc(v) for v in doc]
    elif isinstance(doc, ObjectId):
        return str(doc)
    elif isinstance(doc, datetime):
        return doc.isoformat()
    return doc

@router.post("")
@router.post("/")
async def create_ledger(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    """
    Create a new ledger document inside the active logged-in IAM company database under the NEW 'ledgersentry' collection.
    Formated strictly according to the 13-key schema structure of sf_tenant_6a33b5b2091da2fb4a7c3de4.
    """
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    
    # 1. Resolve company document dynamically from header or active tenant database
    comp_doc = None
    if company_header:
        if len(company_header) == 24 and re.match(r"^[0-9a-fA-F]{24}$", company_header):
            try:
                comp_doc = db["companies"].find_one({"_id": ObjectId(company_header)})
            except Exception:
                pass
        if not comp_doc:
            comp_doc = db["companies"].find_one({
                "$or": [
                    {"companyName": company_header},
                    {"basicCompantFormalName": company_header}
                ]
            })
    if not comp_doc:
        comp_doc = db["companies"].find_one()

    company_db_id = comp_doc["_id"] if comp_doc else (ObjectId(company_header) if company_header and len(company_header) == 24 and re.match(r"^[0-9a-fA-F]{24}$", company_header) else ObjectId())

    # 2. Extract inputs from form payload with defaults
    ledger_name = payload.get("ledgerName") or payload.get("name") or "New Ledger"
    group_name = payload.get("groupName") or payload.get("parentGroup") or "Sundry Debtors"
    
    # Generate ledger code
    next_num = db["ledgers_entry"].count_documents({}) + 1
    ledger_code = payload.get("ledgerCode") or f"LED{next_num:06d}"
    ledger_guid = str(uuid.uuid4())

    # Resolve parent group details
    parent_group_doc = db["groups"].find_one({"groupName": group_name})
    group_id = parent_group_doc["_id"] if parent_group_doc else None
    group_path = parent_group_doc.get("groupPath") if parent_group_doc else f"Primary > {group_name}"
    
    # Classify ledger type
    ledger_type = payload.get("ledgerType")
    if not ledger_type:
        if "debtor" in group_name.lower() or "asset" in group_name.lower():
            ledger_type = "Current Assets"
        elif "creditor" in group_name.lower() or "liability" in group_name.lower():
            ledger_type = "Current Liabilities"
        elif "sales" in group_name.lower():
            ledger_type = "Sales Accounts"
        elif "purchase" in group_name.lower():
            ledger_type = "Purchase Accounts"
        elif "tax" in group_name.lower() or "duty" in group_name.lower():
            ledger_type = "Duties & Taxes"
        else:
            ledger_type = "Indirect Expenses"

    # Extract nested fields from payload or provide defaults matching sf_tenant schema
    op_bal_amt = float(payload.get("openingBalance") or payload.get("balances", {}).get("openingBalance", {}).get("amount", 0.0))
    op_bal_type = payload.get("openingBalanceType") or payload.get("balances", {}).get("openingBalance", {}).get("type", "DEBIT")

    now = datetime.now()
    now_iso = now.isoformat()
    created_date_str = now.strftime("%Y%m%d")

    # Ensure payload dictionaries are dictionary type
    pd = payload.get("partyDetails")
    pd = pd if isinstance(pd, dict) else {}
    tax_d = payload.get("taxDetails")
    tax_d = tax_d if isinstance(tax_d, dict) else {}
    tds_d = payload.get("tdsDetails")
    tds_d = tds_d if isinstance(tds_d, dict) else {}
    bank_d = payload.get("bankDetails")
    bank_d = bank_d if isinstance(bank_d, dict) else {}
    flags_d = payload.get("flags")
    flags_d = flags_d if isinstance(flags_d, dict) else {}

    address_val = payload.get("address")
    if isinstance(address_val, list):
        address_list = address_val
    elif isinstance(address_val, str) and address_val:
        address_list = [line.strip() for line in address_val.split("\n") if line.strip()]
        add2 = payload.get("addressLine2") or payload.get("add2")
        if add2 and isinstance(add2, str):
            address_list.append(add2.strip())
    else:
        add1 = payload.get("add1") or (pd.get("address", [""])[0] if pd.get("address") and isinstance(pd.get("address"), list) else "")
        add2 = payload.get("addressLine2") or payload.get("add2") or (pd.get("address", ["", ""])[1] if pd.get("address") and isinstance(pd.get("address"), list) and len(pd.get("address")) > 1 else "")
        address_list = [add1, add2] if (add1 or add2) else []

    is_cost_center_on = flags_d.get("isCostCentresOn", payload.get("isCostCentresOn", False))
    cc_val = payload.get("costCenterId") or payload.get("costCenterName") or payload.get("costCenter") or ""
    if not is_cost_center_on:
        cc_val = ""

    user_name = payload.get("enteredBy") or payload.get("userName") or payload.get("user") or request.headers.get("x-user-name") or request.headers.get("x-username") or "Admin"

    # 3. Construct 1:1 MongoDB Document matching sf_tenant schema
    city_val = pd.get("city") or payload.get("city") or payload.get("cityId") or "—"
    new_ledger_doc = {
        "companyId": company_db_id,
        "ledgerGuid": ledger_guid,
        "ledgerCode": ledger_code,
        "ledgerName": ledger_name,
        "ledgerType": ledger_type,
        "groupId": group_id,
        "groupName": group_name,
        "groupPath": group_path,
        "nameAliases": payload.get("nameAliases") or ([payload.get("alias")] if payload.get("alias") else []),
        "status": (payload.get("status") or "ACTIVE").upper(),
        "systemReserved": False,
        "costCenterId": cc_val,
        "costCenterName": cc_val,
        "costCenter": cc_val,
        "costCenterApplicable": bool(cc_val),
        "alias": payload.get("alias"),
        "notes": payload.get("notes"),
        "creditPeriod": payload.get("creditPeriod"),
        "creditLimit": payload.get("creditLimit"),
        "interestRate": payload.get("interestRate"),
        "interestCalcMethod": payload.get("interestCalcMethod"),
        "openingBalanceDate": payload.get("openingBalanceDate") or now_iso,
        "city": city_val,
        "add1": address_list[0] if isinstance(address_list, list) and len(address_list) > 0 else "",
        "add2": address_list[1] if isinstance(address_list, list) and len(address_list) > 1 else "",
        "terms": {
            "creditPeriod": payload.get("creditPeriod"),
            "creditLimit": payload.get("creditLimit")
        },
        "interestDetails": {
            "interestRate": payload.get("interestRate"),
            "interestCalcMethod": payload.get("interestCalcMethod")
        },

        "auditInfo": {
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "syncedFromTally": False,
            "tallyAlterId": 0,
            "version": 1
        },

        "balances": {
            "openingBalance": {
                "amount": op_bal_amt,
                "type": op_bal_type.upper(),
                "asOfDate": payload.get("openingBalanceDate") or now_iso
            }
        },

        "bankDetails": {
            "bankName": bank_d.get("bankName") or payload.get("bankName"),
            "branchName": bank_d.get("branchName") or payload.get("branchName") or payload.get("branch"),
            "accountNumber": bank_d.get("accountNumber") or payload.get("accountNumber"),
            "ifscCode": bank_d.get("ifscCode") or payload.get("ifscCode"),
            "micrCode": bank_d.get("micrCode") or payload.get("micrCode"),
            "swiftCode": bank_d.get("swiftCode") or payload.get("swiftCode"),
            "virtualPaymentAddress": bank_d.get("virtualPaymentAddress") or payload.get("virtualPaymentAddress"),
            "paymentFavouring": bank_d.get("paymentFavouring") or payload.get("paymentFavouring") or ledger_name
        },

        "flags": {
            "isBillWiseOn": flags_d.get("isBillWiseOn", payload.get("isBillWiseOn", True)),
            "isCostCentresOn": flags_d.get("isCostCentresOn", payload.get("isCostCentresOn", False)),
            "affectsStock": flags_d.get("affectsStock", payload.get("affectsStock", False)),
            "forPayroll": flags_d.get("forPayroll", payload.get("forPayroll", False)),
            "isBehavedAsDuty": flags_d.get("isBehavedAsDuty", payload.get("isBehavedAsDuty", False)),
            "isEcommOperator": flags_d.get("isEcommOperator", payload.get("isEcommOperator", False)),
            "isInterestOn": flags_d.get("isInterestOn", payload.get("isInterestOn", False))
        },

        "partyDetails": {
            "partyType": pd.get("partyType") or payload.get("partyType"),
            "contactPerson": pd.get("contactPerson") or payload.get("contactPerson"),
            "phone": pd.get("phone") or payload.get("phone"),
            "mobile": pd.get("mobile") or payload.get("mobile") or payload.get("mobileNumber"),
            "email": pd.get("email") or payload.get("email") or payload.get("emailAddress"),
            "address": address_list,
            "panNumber": pd.get("panNumber") or payload.get("panNumber") or payload.get("pan"),
            "gstin": pd.get("gstin") or payload.get("gstin") or payload.get("gst"),
            "gstRegistrationType": pd.get("gstRegistrationType") or payload.get("gstRegistrationType") or payload.get("registrationType") or payload.get("type") or ("Regular" if (pd.get("gstin") or payload.get("gstin") or payload.get("gst")) else "Unregistered"),
            "gstState": pd.get("gstState") or payload.get("gstState") or payload.get("gstStateId") or payload.get("pos") or "Madhya Pradesh",
            "country": pd.get("country") or payload.get("country") or payload.get("countryId") or "India",
            "pinCode": pd.get("pinCode") or payload.get("pinCode") or payload.get("pincode"),
            "isTransporter": pd.get("isTransporter", False)
        },

        "tallyMetadata": {
            "enteredBy": user_name,
            "alteredBy": user_name,
            "createdDate": created_date_str,
            "sortPosition": 1000,
            "alterId": 1,
            "remoteAlterId": 0
        },

        "taxDetails": {
            "taxType": tax_d.get("taxType") or payload.get("taxType") or "Others",
            "gstApplicable": tax_d.get("gstApplicable") if "gstApplicable" in tax_d else (payload.get("gstApplicable") if "gstApplicable" in payload else bool(pd.get("gstin") or payload.get("gstin") or payload.get("gst"))),
            "gstType": tax_d.get("gstType") or payload.get("gstType") or "Not Applicable",
            "gstDutyHead": tax_d.get("gstDutyHead") or payload.get("gstDutyHead"),
            "gstTypeOfSupply": tax_d.get("gstTypeOfSupply") or payload.get("gstTypeOfSupply") or "Services",
            "cessValuationMethod": tax_d.get("cessValuationMethod") or payload.get("cessValuationMethod")
        },

        "tdsDetails": {
            "tdsApplicable": tds_d.get("tdsApplicable", payload.get("tdsApplicable", False)),
            "tcsApplicable": tds_d.get("tcsApplicable", payload.get("tcsApplicable", False)),
            "tdsSection": tds_d.get("tdsSection") or payload.get("tdsSectionId") or payload.get("tdsSection"),
            "tdsDeducteeType": tds_d.get("tdsDeducteeType") or payload.get("tdsDeducteeTypeId") or payload.get("tdsDeducteeType")
        }
    }

    # Run dynamic validation before saving/updating
    from app.anjalee.services.tally.xml_generator import validate_ledger_data
    try:
        validate_ledger_data(new_ledger_doc)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    # 4. Check if editing an existing record (_id or id present)
    record_id = payload.get("_id") or payload.get("id")
    target_col = payload.get("sourceCollection") or "ledgers_entry"

    if record_id and isinstance(record_id, str) and len(record_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", record_id):
        obj_id = ObjectId(record_id)
        existing = db[target_col].find_one({"_id": obj_id})
        if not existing:
            existing = db["ledgers_entry"].find_one({"_id": obj_id})
            if existing:
                target_col = "ledgers_entry"
            else:
                existing = db["ledgers"].find_one({"_id": obj_id})
                if existing:
                    target_col = "ledgers"
        if existing:
            new_ledger_doc.pop("_id", None)
            new_ledger_doc.pop("companyId", None)
            new_ledger_doc["ledgerGuid"] = existing.get("ledgerGuid") or ledger_guid
            new_ledger_doc["ledgerCode"] = existing.get("ledgerCode") or ledger_code
            new_ledger_doc["auditInfo"]["createdAt"] = existing.get("auditInfo", {}).get("createdAt", now_iso)
            new_ledger_doc["auditInfo"]["updatedAt"] = now_iso
            db[target_col].update_one({"_id": obj_id}, {"$set": new_ledger_doc})
            new_ledger_doc["_id"] = obj_id
            return {
                "success": True,
                "message": f"Ledger updated successfully in '{target_col}' collection",
                "data": serialize_mongo_doc(new_ledger_doc)
            }

    # Otherwise insert into NEW 'ledgers_entry' collection
    result = db["ledgers_entry"].insert_one(new_ledger_doc)
    new_ledger_doc["_id"] = result.inserted_id

    return {
        "success": True,
        "message": "Ledger created successfully in NEW 'ledgers_entry' collection",
        "data": serialize_mongo_doc(new_ledger_doc)
    }

@router.get("")
@router.get("/")
async def get_ledgers(
    request: Request, 
    page: int = Query(1, ge=1), 
    limit: int = Query(200, ge=1, le=10000), 
    search: str = Query(None),
    all_items: bool = Query(False, alias="all"),
    db=Depends(get_db)
):
    """
    Fetch ledgers dynamically from active logged-in IAM company database ('ledgers_entry' and 'ledgers' collections).
    Supports fast pagination, search filtering, and total counts to prevent browser payload timeouts on large company masters (e.g. 28,000+ ledgers).
    """
    query = {}
    if search and search.strip():
        search_str = search.strip()
        query = {
            "$or": [
                {"ledgerName": {"$regex": search_str, "$options": "i"}},
                {"ledger": {"$regex": search_str, "$options": "i"}},
                {"name": {"$regex": search_str, "$options": "i"}},
                {"groupName": {"$regex": search_str, "$options": "i"}},
                {"parentGroup": {"$regex": search_str, "$options": "i"}},
                {"gstin": {"$regex": search_str, "$options": "i"}},
                {"partyDetails.gstin": {"$regex": search_str, "$options": "i"}}
            ]
        }

    total_web = db["ledgers_entry"].count_documents(query)
    total_synced = db["ledgers"].count_documents(query)
    total_count = total_web + total_synced

    web_entries = []
    for doc in db["ledgers_entry"].find(query):
        s_doc = serialize_mongo_doc(doc)
        s_doc["isWebEntry"] = True
        s_doc["sourceCollection"] = "ledgers_entry"
        web_entries.append(s_doc)

    # For synced ledgers, apply pagination if all_items is False
    synced_cursor = db["ledgers"].find(query)
    if not all_items:
        synced_limit = max(0, limit - len(web_entries))
        synced_offset = max(0, (page - 1) * limit - total_web)
        synced_cursor = synced_cursor.skip(synced_offset).limit(synced_limit)
    else:
        synced_cursor = synced_cursor.limit(5000)

    synced_entries = []
    for doc in synced_cursor:
        s_doc = serialize_mongo_doc(doc)
        s_doc["isWebEntry"] = False
        s_doc["sourceCollection"] = "ledgers"
        synced_entries.append(s_doc)

    all_data = web_entries + synced_entries

    return {
        "success": True,
        "data": all_data,
        "total": total_count,
        "totalWeb": total_web,
        "totalSynced": total_synced,
        "page": page,
        "limit": limit,
        "totalPages": max(1, math.ceil(total_count / limit)) if limit > 0 else 1
    }

@router.get("/{ledger_id}/tally-xml")
async def get_ledger_tally_xml(ledger_id: str, db=Depends(get_db)):
    """
    Generate Tally-compatible XML for a specific ledger by ID.
    1. Fetch exact selected Ledger document by MongoDB _id (or ledgerGuid/ledgerName).
    2. Log/inspect the complete fetched document.
    3. Generate XML from that document only.
    4. Perform final validation against MongoDB record.
    """
    ledger_doc = None
    if len(ledger_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", ledger_id):
        obj_id = ObjectId(ledger_id)
        ledger_doc = db["ledgers_entry"].find_one({"_id": obj_id}) or db["ledgers"].find_one({"_id": obj_id})
    
    if not ledger_doc:
        ledger_doc = db["ledgers_entry"].find_one({"ledgerGuid": ledger_id}) or db["ledgers"].find_one({"ledgerGuid": ledger_id}) or db["ledgers_entry"].find_one({"ledgerName": ledger_id}) or db["ledgers"].find_one({"ledgerName": ledger_id})

    if not ledger_doc:
        raise HTTPException(status_code=404, detail=f"Ledger document not found for ID: '{ledger_id}'")

    # Step 2: Log/inspect complete fetched document
    print(f"\n=======================================================")
    print(f"[TALLY XML GENERATOR] FETCHED EXACT MONGODB LEDGER DOC (ID: {ledger_doc.get('_id')}):")
    import json
    try:
        print(json.dumps(serialize_mongo_doc(ledger_doc), indent=2))
    except Exception:
        print(ledger_doc)
    print(f"=======================================================\n")

    from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
    try:
        xml_str = TallyXmlGenerator.generate_ledger_xml(ledger_doc)
        ledger_name = ledger_doc.get("ledgerName") or ledger_doc.get("name") or "Ledger"
        clean_file_name = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', ledger_name)}_Tally.xml"
        return {
            "success": True,
            "xml": xml_str,
            "fileName": clean_file_name
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Tally XML: {str(e)}")

from pydantic import BaseModel
from typing import List

class BatchXmlRequest(BaseModel):
    ids: List[str]

@router.post("/tally-xml/batch")
async def get_batch_ledger_tally_xml(req: BatchXmlRequest, db=Depends(get_db)):
    """
    Generate Tally-compatible XML for multiple ledgers, combining their <TALLYMESSAGE> blocks.
    """
    from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
    import json
    
    xml_messages = []
    for ledger_id in req.ids:
        ledger_doc = None
        if len(ledger_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", ledger_id):
            obj_id = ObjectId(ledger_id)
            ledger_doc = db["ledgers_entry"].find_one({"_id": obj_id}) or db["ledgers"].find_one({"_id": obj_id})
        else:
            ledger_doc = db["ledgers_entry"].find_one({"ledgerGuid": ledger_id}) or db["ledgers"].find_one({"ledgerGuid": ledger_id}) or db["ledgers_entry"].find_one({"ledgerName": ledger_id}) or db["ledgers"].find_one({"ledgerName": ledger_id})
            
        if ledger_doc:
            print(f"\n=======================================================")
            print(f"[BATCH TALLY XML GENERATOR] FETCHED EXACT MONGODB LEDGER DOC (ID: {ledger_doc.get('_id')}):")
            try:
                print(json.dumps(serialize_mongo_doc(ledger_doc), indent=2))
            except Exception:
                print(ledger_doc)
            print(f"=======================================================\n")
            try:
                msg_xml = TallyXmlGenerator.generate_ledger_xml_message(ledger_doc)
                xml_messages.append(msg_xml)
            except Exception as e:
                print(f"Error generating message XML for ledger {ledger_id}: {e}")
                raise HTTPException(status_code=400, detail=str(e))
                
    if not xml_messages:
        raise HTTPException(status_code=404, detail="No valid ledgers found or generated")
        
    combined_xml = TallyXmlGenerator.wrap_messages_in_envelope(xml_messages)
    
    return {
        "success": True,
        "xml": combined_xml,
        "fileName": "Selected_Ledgers_Tally.xml"
    }

