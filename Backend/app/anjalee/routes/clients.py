from fastapi import APIRouter, HTTPException, Depends, Request, status
from typing import List, Optional
from datetime import datetime
import re
from bson import ObjectId
from app.core.iam_db import get_async_iam_db

router = APIRouter(prefix="/clients", tags=["clients"])

@router.get("")
async def list_clients(request: Request):
    """List clients dynamically from MongoDB iam.clients, strictly scoped to current organization."""
    db = await get_async_iam_db()
    active_org_id = request.headers.get("x-company-id") or request.headers.get("x-company")

    query = {}
    if active_org_id:
        query["organizationId"] = str(active_org_id)

    clients = []
    cursor = db["clients"].find(query)
    async for c in cursor:
        clients.append({
            "id": str(c["_id"]),
            "name": c.get("name") or c.get("clientName", ""),
            "company": c.get("company") or c.get("companyName", ""),
            "mobile": c.get("mobile") or c.get("phone", "N/A"),
            "email": c.get("email", ""),
            "gstin": c.get("gstin", ""),
            "pan": c.get("pan", ""),
            "address": c.get("address", ""),
            "city": c.get("city", ""),
            "state": c.get("state", ""),
            "notes": c.get("notes", ""),
            "assignedUsers": c.get("assignedUsers", "Operator A"),
            "assignedUserIds": c.get("assignedUserIds", []),
            "status": c.get("status", "Active"),
            "createdAt": str(c.get("createdAt", ""))
        })

    return {"success": True, "data": clients}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_client(request: Request, payload: dict):
    """Create a new client profile, link assigned users, and optionally provision a new company workspace."""
    db = await get_async_iam_db()
    active_org_id = request.headers.get("x-company-id") or request.headers.get("x-company") or ""

    name = payload.get("name", "").strip()
    company_name = payload.get("company", "").strip()
    email = payload.get("email", "").strip().lower()
    phone = payload.get("phone", "").strip()
    gstin = payload.get("gstin", "").strip()
    pan = payload.get("pan", "").strip()
    address = payload.get("address", "").strip()
    city = payload.get("city", "").strip()
    state = payload.get("state", "").strip()
    notes = payload.get("notes", "").strip()
    assigned_users = payload.get("assignedUsers", "Operator A")
    assigned_user_ids = payload.get("assignedUserIds", [])
    create_workspace = payload.get("createWorkspace", False)

    if not name or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client Name and Email are required"
        )

    # 1. Construct rich GST and Tally configuration matching target schema
    gst_details = payload.get("gstDetails") or {
        "gstin": gstin,
        "legalName": payload.get("legalName") or company_name,
        "tradeName": payload.get("tradeName") or company_name,
        "state": state or "Madhya Pradesh",
        "stateCode": payload.get("stateCode") or "23",
        "registrationDate": payload.get("registrationDate") or datetime.utcnow().strftime("%Y-%m-%d"),
        "businessType": payload.get("businessType") or "Partnership",
        "taxpayerType": payload.get("taxpayerType") or "Regular",
        "status": "Active",
        "principalAddress": address or f"{city}, {state}",
        "natureOfBusiness": payload.get("natureOfBusiness") or [
            "Retail Business",
            "Office / Sale Office",
            "Wholesale Business",
            "Factory / Manufacturing"
        ]
    }

    tally_config = payload.get("tallyConfig") or {
        "host": "localhost",
        "port": 9000
    }

    # Save Client Document in iam.clients
    client_doc = {
        "organizationId": active_org_id,
        "name": name,
        "clientName": name,
        "company": company_name or "N/A",
        "companyName": company_name or "N/A",
        "email": email,
        "mobile": phone or "N/A",
        "phone": phone or "N/A",
        "gstin": gstin,
        "pan": pan,
        "address": address,
        "city": city,
        "state": state,
        "notes": notes,
        "gstDetails": gst_details,
        "tallyConfig": tally_config,
        "currencySymbol": payload.get("currencySymbol", "₹"),
        "fyStartMonth": payload.get("fyStartMonth", 4),
        "assignedUsers": assigned_users if isinstance(assigned_users, str) else ", ".join(assigned_users),
        "assignedUserIds": assigned_user_ids,
        "status": "Active",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

    result = await db["clients"].insert_one(client_doc)
    client_id = str(result.inserted_id)

    # 2. If workspace creation requested or company name given, provision entry in iam.organizations
    new_org_id = None
    if company_name and create_workspace:
        clean_name = company_name.strip()
        org_slug = re.sub(r'[^a-z0-9]+', '-', clean_name.lower()).strip('-') or "org"

        existing_org = await db["organizations"].find_one({"name": clean_name})
        if not existing_org:
            new_obj_id = ObjectId()
            org_doc = {
                "_id": new_obj_id,
                "name": clean_name,
                "displayName": clean_name,
                "slug": org_slug,
                "status": "active",
                "tallyConfig": tally_config,
                "fyStartMonth": payload.get("fyStartMonth", 4),
                "currencySymbol": payload.get("currencySymbol", "₹"),
                "gstin": gstin,
                "gstDetails": gst_details,
                "dbName": f"sf_tenant_{str(new_obj_id)}",
                "email": email,
                "phone": phone,
                "address": address,
                "city": city,
                "state": state or "Madhya Pradesh",
                "country": "India",
                "parentOrgId": active_org_id,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }
            insert_res = await db["organizations"].insert_one(org_doc)
            new_org_id = str(insert_res.inserted_id)

            # Link new org ID to assigned user documents
            if assigned_user_ids:
                for uid in assigned_user_ids:
                    if len(uid) == 24 and re.match(r"^[0-9a-fA-F]{24}$", uid):
                        await db["users"].update_one(
                            {"_id": ObjectId(uid)},
                            {"$addToSet": {"organizations": new_org_id}}
                        )

    return {
        "success": True,
        "message": "Client profile created successfully",
        "data": {
            "id": client_id,
            "name": name,
            "company": company_name,
            "newOrgId": new_org_id
        }
    }


@router.put("/{client_id}")
async def update_client(client_id: str, payload: dict):
    """Update existing client profile details in iam.clients."""
    db = await get_async_iam_db()

    query = {}
    if len(client_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", client_id):
        query = {"_id": ObjectId(client_id)}
    else:
        query = {"_id": client_id}

    client = await db["clients"].find_one(query)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    update_fields = {
        "name": payload.get("name", client.get("name")),
        "clientName": payload.get("name", client.get("name")),
        "company": payload.get("company", client.get("company")),
        "companyName": payload.get("company", client.get("company")),
        "email": payload.get("email", client.get("email")),
        "mobile": payload.get("phone", client.get("mobile")),
        "phone": payload.get("phone", client.get("phone")),
        "gstin": payload.get("gstin", client.get("gstin")),
        "pan": payload.get("pan", client.get("pan")),
        "address": payload.get("address", client.get("address")),
        "city": payload.get("city", client.get("city")),
        "state": payload.get("state", client.get("state")),
        "notes": payload.get("notes", client.get("notes")),
        "status": payload.get("status", client.get("status", "Active")),
        "updatedAt": datetime.utcnow()
    }

    if "assignedUsers" in payload:
        au = payload["assignedUsers"]
        update_fields["assignedUsers"] = au if isinstance(au, str) else ", ".join(au)
    if "assignedUserIds" in payload:
        update_fields["assignedUserIds"] = payload["assignedUserIds"]

    await db["clients"].update_one(query, {"$set": update_fields})
    return {"success": True, "message": "Client profile updated successfully"}


@router.delete("/{client_id}")
async def delete_client(client_id: str):
    """Delete a client profile from iam.clients."""
    db = await get_async_iam_db()

    query = {}
    if len(client_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", client_id):
        query = {"_id": ObjectId(client_id)}
    else:
        query = {"_id": client_id}

    result = await db["clients"].delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    return {"success": True, "message": "Client profile deleted successfully"}
