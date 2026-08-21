from fastapi import APIRouter, Depends, Request, HTTPException
from typing import Dict, Any, Optional
import uuid
import re
import math
from datetime import datetime
from bson import ObjectId
from app.db import get_db

router = APIRouter(prefix="/masters", tags=["masters"])

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

def parse_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    try:
        clean_str = str(val).replace('%', '').replace(',', '').strip()
        return float(clean_str) if clean_str else default
    except (ValueError, TypeError):
        return default


def resolve_company_db_id(request: Request, db) -> ObjectId:
    company_header = request.headers.get("x-company-id") or request.headers.get("x-company")
    if company_header and isinstance(company_header, str):
        company_header = company_header.strip()
        if len(company_header) == 24 and re.match(r"^[0-9a-fA-F]{24}$", company_header):
            return ObjectId(company_header)
        comp_doc = db["companies"].find_one({
            "$or": [
                {"companyName": company_header},
                {"basicCompantFormalName": company_header},
                {"name": company_header}
            ]
        })
        if comp_doc and comp_doc.get("_id"):
            return comp_doc["_id"]

    comp_doc = db["companies"].find_one()
    return comp_doc["_id"] if comp_doc else ObjectId()


def fetch_and_paginate_master(db, std_col: str, entry_col: str, request: Request, search_fields: list):
    params = request.query_params
    try:
        page = int(params.get("page", 1))
        if page < 1:
            page = 1
    except Exception:
        page = 1

    try:
        limit = int(params.get("limit", 200))
        if limit < 1:
            limit = 200
    except Exception:
        limit = 200

    search = (params.get("search") or params.get("q") or "").strip()
    is_all = params.get("all") == "true" or limit >= 5000

    query = {}
    if search:
        regex_pattern = {"$regex": f".*{re.escape(search)}.*", "$options": "i"}
        or_search = [{field: regex_pattern} for field in search_fields]
        query = {"$or": or_search}

    docs_entry = list(db[entry_col].find(query))
    for d in docs_entry:
        d["isWebEntry"] = True
        d["isSynced"] = False
        d["sourceCollection"] = entry_col

    docs_std = list(db[std_col].find(query))
    for d in docs_std:
        if "isWebEntry" not in d:
            d["isWebEntry"] = False
        if "isSynced" not in d:
            d["isSynced"] = True
        if "sourceCollection" not in d:
            d["sourceCollection"] = std_col

    raw_docs = docs_entry + docs_std
    seen_ids = set()
    all_items = []
    for d in raw_docs:
        d_id = str(d.get("_id"))
        if d_id in seen_ids:
            continue
        seen_ids.add(d_id)
        all_items.append(serialize_mongo_doc(d))

    total_web = len(docs_entry)
    total_synced = len(docs_std)
    total = len(all_items)
    if is_all:
        paginated_data = all_items
        total_pages = 1
    else:
        total_pages = max(1, math.ceil(total / limit)) if limit > 0 else 1
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_data = all_items[start_idx:end_idx]

    return {
        "success": True,
        "total": total,
        "totalWeb": total_web,
        "totalSynced": total_synced,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
        "count": len(paginated_data),
        "data": paginated_data
    }


def save_or_update_doc(db, entry_col: str, std_col: str, doc: dict, payload: dict, msg_prefix: str):
    record_id = payload.get("_id") or payload.get("id")
    target_col = payload.get("sourceCollection") or entry_col

    if record_id and isinstance(record_id, str) and len(record_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", record_id):
        obj_id = ObjectId(record_id)
        existing = db[target_col].find_one({"_id": obj_id})
        if not existing:
            existing = db[entry_col].find_one({"_id": obj_id})
            if existing:
                target_col = entry_col
            else:
                existing = db[std_col].find_one({"_id": obj_id})
                if existing:
                    target_col = std_col

        if existing:
            doc.pop("_id", None)
            doc.pop("companyId", None)
            now_iso = datetime.now().isoformat()
            if "auditInfo" in doc and isinstance(doc["auditInfo"], dict):
                doc["auditInfo"]["createdAt"] = existing.get("auditInfo", {}).get("createdAt", doc["auditInfo"].get("createdAt", now_iso))
                doc["auditInfo"]["updatedAt"] = now_iso
            db[target_col].update_one({"_id": obj_id}, {"$set": doc})
            doc["_id"] = obj_id
            return {"success": True, "message": f"{msg_prefix} updated in '{target_col}'", "data": serialize_mongo_doc(doc)}

    res = db[entry_col].insert_one(doc)
    doc["_id"] = res.inserted_id
    return {"success": True, "message": f"{msg_prefix} created in '{entry_col}'", "data": serialize_mongo_doc(doc)}


# ─────────────── 1. STOCK ITEMS ENTRY — stockitems_entry ───────────────
@router.get("/stock-items")
@router.get("/stock-items/")
async def get_stock_items(request: Request, db=Depends(get_db)):
    search_fields = ["itemName", "name", "itemCode", "stockItemCode", "sku", "alias", "stockGroupName", "group", "stockCategoryName", "category", "hsnCode", "barcode"]
    return fetch_and_paginate_master(db, "stockItems", "stockitems_entry", request, search_fields)


@router.get("/stock-items/{item_id}")
async def get_stock_item_by_id(item_id: str, request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    q_filter = {"_id": ObjectId(item_id)} if ObjectId.is_valid(item_id) else {"_id": item_id}
    
    doc = db["stockitems_entry"].find_one(q_filter) or db["stockItems"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Stock Item Master record not found")
    return {"success": True, "data": serialize_mongo_doc(doc)}


@router.post("/stock-items")
@router.post("/stock-items/")
async def create_stock_item_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    item_name = (payload.get("itemName") or payload.get("name") or "").strip()
    if not item_name:
        raise HTTPException(status_code=400, detail="Stock Item Name is required")

    item_nature = (payload.get("itemNature") or "GOODS").upper().strip()
    if item_nature not in ["GOODS", "SERVICE"]:
        item_nature = "GOODS"

    record_id = str(payload.get("_id") or payload.get("id") or "").strip()

    # Company tenant isolation & case-insensitive duplicate check for Stock Item Name
    dup_name_query = {
        "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}],
        "$or": [
            {"itemName": {"$regex": f"^{re.escape(item_name)}$", "$options": "i"}},
            {"name": {"$regex": f"^{re.escape(item_name)}$", "$options": "i"}}
        ]
    }
    existing_items = list(db["stockitems_entry"].find(dup_name_query)) + list(db["stockItems"].find(dup_name_query))
    for dup in existing_items:
        dup_id = str(dup.get("_id") or dup.get("id") or "")
        if record_id and dup_id and dup_id == record_id:
            continue
        raise HTTPException(status_code=400, detail=f"Stock Item Name '{item_name}' already exists in this company")

    # Duplicate check for Item Code / SKU if provided
    item_code = (payload.get("itemCode") or payload.get("stockItemCode") or payload.get("sku") or "").strip()
    if item_code:
        dup_code_query = {
            "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}],
            "$or": [
                {"itemCode": {"$regex": f"^{re.escape(item_code)}$", "$options": "i"}},
                {"stockItemCode": {"$regex": f"^{re.escape(item_code)}$", "$options": "i"}},
                {"sku": {"$regex": f"^{re.escape(item_code)}$", "$options": "i"}}
            ]
        }
        code_dups = list(db["stockitems_entry"].find(dup_code_query)) + list(db["stockItems"].find(dup_code_query))
        for dup in code_dups:
            dup_id = str(dup.get("_id") or dup.get("id") or "")
            if record_id and dup_id and dup_id == record_id:
                continue
            raise HTTPException(status_code=400, detail=f"Item Code / SKU '{item_code}' already exists in this company")

    # Duplicate check for Barcode / EAN if provided
    barcode = (payload.get("barcode") or (payload.get("basicInfo") or {}).get("barcode") or "").strip()
    if barcode:
        dup_barcode_query = {
            "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}],
            "$or": [
                {"barcode": {"$regex": f"^{re.escape(barcode)}$", "$options": "i"}},
                {"basicInfo.barcode": {"$regex": f"^{re.escape(barcode)}$", "$options": "i"}}
            ]
        }
        barcode_dups = list(db["stockitems_entry"].find(dup_barcode_query)) + list(db["stockItems"].find(dup_barcode_query))
        for dup in barcode_dups:
            dup_id = str(dup.get("_id") or dup.get("id") or "")
            if record_id and dup_id and dup_id == record_id:
                continue
            raise HTTPException(status_code=400, detail=f"Barcode / EAN '{barcode}' already exists in this company")

    # Stock Group Validation for Goods
    group_name = (payload.get("stockGroupName") or payload.get("group") or payload.get("stockGroup") or "").strip()
    if item_nature == "GOODS" and not group_name:
        group_name = "Primary"

    # Unit Validation for Goods
    unit_val = payload.get("uom") or payload.get("unit") or payload.get("unitName") or payload.get("baseUnit") or "Nos"
    base_unit_str = unit_val if isinstance(unit_val, str) else (unit_val.get("baseUnit") or "Nos")

    # Auto-generate item code if empty
    if not item_code:
        next_num = db["stockitems_entry"].count_documents({}) + 1
        item_code = f"ITEM{next_num:06d}"

    sg_doc = db["stockGroups"].find_one({"groupName": group_name}) or db["stockgroups_entry"].find_one({"groupName": group_name}) if group_name else None
    sg_id = sg_doc["_id"] if sg_doc else payload.get("stockGroupId")
    sg_path = sg_doc.get("groupPath") if sg_doc else f"Primary > {group_name}"

    category_name = (payload.get("stockCategoryName") or payload.get("stockCategory") or payload.get("category") or "").strip()
    sc_doc = db["stockCategories"].find_one({"categoryName": category_name}) or db["stockcategories_entry"].find_one({"categoryName": category_name}) if category_name else None
    sc_id = sc_doc["_id"] if sc_doc else payload.get("stockCategoryId")

    now = datetime.now()
    now_iso = now.isoformat()

    alias = (payload.get("alias") or "").strip()
    description = (payload.get("description") or (payload.get("basicInfo") or {}).get("description") or "").strip()
    remarks = (payload.get("remarks") or (payload.get("basicInfo") or {}).get("remarks") or "").strip()
    status = (payload.get("status") or "ACTIVE").upper().strip()

    # Feature Configuration & Overrides
    # Feature Configuration & Overrides
    business_type = (payload.get("businessType") or "GENERAL_TRADING").upper().strip()
    feature_overrides = payload.get("featureOverrides") if isinstance(payload.get("featureOverrides"), dict) else {}
    effective_features = payload.get("effectiveFeatures") if isinstance(payload.get("effectiveFeatures"), dict) else {}

    # ── Identification Fields (Active Only) ──
    ident_input = payload.get("identification") if isinstance(payload.get("identification"), dict) else {}
    ident_doc = {}
    
    if effective_features.get("barcode"):
        b_val = (ident_input.get("barcode") or payload.get("barcode") or "").strip()
        ident_doc["barcode"] = b_val if b_val else None

    if effective_features.get("brand"):
        br_val = (ident_input.get("brand") or payload.get("brand") or "").strip()
        ident_doc["brand"] = br_val if br_val else None

    if effective_features.get("manufacturer"):
        m_val = (ident_input.get("manufacturer") or payload.get("manufacturer") or "").strip()
        ident_doc["manufacturer"] = m_val if m_val else None

    if effective_features.get("model"):
        mo_val = (ident_input.get("modelNumber") or payload.get("modelNumber") or "").strip()
        ident_doc["modelNumber"] = mo_val if mo_val else None

    if effective_features.get("partNumber"):
        p_val = (ident_input.get("partNumber") or payload.get("partNumber") or "").strip()
        ident_doc["partNumber"] = p_val if p_val else None

    # ── Inventory Fields (Active Only) ──
    inv_input = payload.get("inventory") if isinstance(payload.get("inventory"), dict) else {}
    maintain_inv = bool(inv_input.get("maintainInventory", payload.get("maintainInventory", True if item_nature == "GOODS" else False)))
    allow_neg = bool(inv_input.get("allowNegativeStock", payload.get("allowNegativeStock", False)))

    op_stock = inv_input.get("openingStock") if isinstance(inv_input.get("openingStock"), dict) else {}
    op_qty = parse_float(inv_input.get("openingQuantity") or payload.get("openingQuantity") or payload.get("openingQty") or op_stock.get("qty") or op_stock.get("quantity"), 0.0)
    op_rate = parse_float(inv_input.get("openingRate") or payload.get("openingRate") or payload.get("purchasePrice") or op_stock.get("rate"), 0.0)
    op_val = parse_float(inv_input.get("openingValue") or payload.get("openingValue") or op_stock.get("value") or op_stock.get("amount"), (op_qty * op_rate))

    default_godown_id = inv_input.get("defaultGodownId") or payload.get("defaultGodownId")
    default_godown_name = (inv_input.get("defaultGodownName") or payload.get("defaultGodownName") or payload.get("defaultGodown") or "Main Location").strip()

    inv_doc = {
        "maintainInventory": maintain_inv,
        "allowNegativeStock": allow_neg,
        "openingQuantity": op_qty,
        "openingRate": op_rate,
        "openingValue": op_val,
        "defaultGodownId": default_godown_id if default_godown_id else None,
        "defaultGodownName": default_godown_name if default_godown_name else None
    }

    if effective_features.get("alternateUnit"):
        alt_u = (inv_input.get("alternateUnitName") or payload.get("alternateUnitName") or "").strip()
        inv_doc["alternateUnitName"] = alt_u if alt_u else None

    if effective_features.get("packaging"):
        ps = (inv_input.get("packSize") or payload.get("packSize") or "").strip()
        upp = parse_float(inv_input.get("unitsPerPack") or payload.get("unitsPerPack"), 1.0)
        inv_doc["packSize"] = ps if ps else None
        inv_doc["unitsPerPack"] = upp if upp > 0 else None

    if effective_features.get("reorderLevel"):
        rl = parse_float(inv_input.get("reorderLevel") or payload.get("reorderLevel"), 0.0)
        inv_doc["reorderLevel"] = rl if rl > 0 else None

    if effective_features.get("minimumStock"):
        ms = parse_float(inv_input.get("minimumStock") or payload.get("minimumStock"), 0.0)
        inv_doc["minimumStock"] = ms if ms > 0 else None

    if effective_features.get("maximumStock"):
        max_s = parse_float(inv_input.get("maximumStock") or payload.get("maximumStock"), 0.0)
        inv_doc["maximumStock"] = max_s if max_s > 0 else None

    # ── Tracking Fields (Active Only) ──
    tracking_input = payload.get("tracking") if isinstance(payload.get("tracking"), dict) else {}
    tracking_doc = {}

    if effective_features.get("batchTracking"):
        tracking_doc["maintainBatch"] = bool(tracking_input.get("maintainBatch", payload.get("maintainBatch", False)))
        if effective_features.get("expiryTracking"):
            tracking_doc["trackExpiry"] = bool(tracking_input.get("trackExpiry", payload.get("trackExpiry", False)))
        if effective_features.get("manufacturingDate"):
            tracking_doc["trackManufacturingDate"] = bool(tracking_input.get("trackManufacturingDate", payload.get("trackManufacturingDate", False)))

    if effective_features.get("serialTracking"):
        tracking_doc["serialTracking"] = bool(tracking_input.get("serialTracking", payload.get("serialTracking", False)))
        sp = (tracking_input.get("serialPrefix") or payload.get("serialPrefix") or "").strip()
        sno = (tracking_input.get("startingSerialNo") or payload.get("startingSerialNo") or "").strip()
        tracking_doc["serialPrefix"] = sp if sp else None
        tracking_doc["startingSerialNo"] = sno if sno else None

    # ── Pricing Fields (Active Only) ──
    pricing_input = payload.get("pricing") if isinstance(payload.get("pricing"), dict) else {}
    purchase_rate = parse_float(pricing_input.get("purchaseRate") or payload.get("purchaseRate") or payload.get("purchasePrice"), op_rate)
    sales_rate = parse_float(pricing_input.get("salesRate") or payload.get("salesRate") or payload.get("salesPrice"), 0.0)
    min_sales_rate = parse_float(pricing_input.get("minSalesRate") or payload.get("minSalesRate"), 0.0)
    trade_disc = parse_float(pricing_input.get("tradeDiscountPercent") or payload.get("tradeDiscountPercent"), 0.0)

    pricing_doc = {
        "purchaseRate": purchase_rate,
        "salesRate": sales_rate,
        "minSalesRate": min_sales_rate if min_sales_rate > 0 else None,
        "tradeDiscountPercent": trade_disc if trade_disc > 0 else None
    }

    if effective_features.get("mrp"):
        mrp_val = parse_float(pricing_input.get("mrp") or payload.get("mrp"), 0.0)
        pricing_doc["mrp"] = mrp_val if mrp_val > 0 else None

    if effective_features.get("standardCost"):
        sc_val = parse_float(pricing_input.get("standardCost") or payload.get("standardCost"), 0.0)
        pricing_doc["standardCost"] = sc_val if sc_val > 0 else None

    # ── Manufacturing & BOM (Active Only) ──
    mfg_doc = {}
    if effective_features.get("bom"):
        mfg_input = payload.get("manufacturing") if isinstance(payload.get("manufacturing"), dict) else {}
        mfg_doc["enableBOM"] = bool(mfg_input.get("enableBOM", payload.get("enableBOM", False)))
        bom_id = mfg_input.get("bomId") or payload.get("bomId")
        mfg_doc["bomId"] = str(bom_id).strip() if bom_id else None

    # ── Warranty (Active Only) ──
    warranty_doc = {}
    if effective_features.get("warranty"):
        w_input = payload.get("warranty") if isinstance(payload.get("warranty"), dict) else {}
        warranty_doc["enabled"] = bool(w_input.get("enabled", payload.get("warrantyEnabled", False)))
        wp = str(w_input.get("period") or payload.get("warrantyPeriod") or "").strip()
        wu = str(w_input.get("unit") or payload.get("warrantyUnit") or "Months").strip()
        warranty_doc["period"] = wp if wp else None
        warranty_doc["unit"] = wu if wu else None

    # Tax Fields
    tax_input = payload.get("tax") if isinstance(payload.get("tax"), dict) else {}
    taxability = tax_input.get("taxability") or payload.get("taxability") or "Taxable"
    hsn_id = tax_input.get("hsnId") or payload.get("hsnId")
    hsn_code = (tax_input.get("hsnCode") or payload.get("hsnCode") or payload.get("hsn") or "").strip()
    sac_id = tax_input.get("sacId") or payload.get("sacId")
    sac_code = (tax_input.get("sacCode") or payload.get("sacCode") or payload.get("sac") or "").strip()
    
    gst_val = tax_input.get("gstRate") or payload.get("gstRate") or payload.get("gst")
    if isinstance(gst_val, dict):
        gst_val = gst_val.get("gstRate") or gst_val.get("igstRate")
    gst_rate = parse_float(gst_val, 18.0)

    # ── Assemble Master Document ──
    doc = {
        "companyId": company_db_id,
        "stockItemGuid": payload.get("stockItemGuid") or payload.get("itemGuid") or str(uuid.uuid4()),
        "stockItemCode": item_code,
        "itemCode": item_code,

        "itemName": item_name,
        "name": item_name,
        "alias": alias if alias else None,

        "itemNature": item_nature,
        "businessType": business_type,
        "featureOverrides": feature_overrides,
        "effectiveFeatures": effective_features,
        "isWebEntry": True,
        "isSynced": False,
        "sourceCollection": "stockitems_entry",

        "stockGroupId": sg_id,
        "stockGroupName": group_name,
        "group": group_name,
        "stockGroupPath": sg_path,

        "stockCategoryId": sc_id,
        "stockCategoryName": category_name,
        "category": category_name,
        "valuationMethod": (payload.get("valuationMethod") or "Avg. Cost").strip(),
        "costingMethod": (payload.get("costingMethod") or "Avg. Cost").strip(),

        "unitId": payload.get("unitId"),
        "unitName": base_unit_str,
        "uom": base_unit_str,
        "baseUnit": base_unit_str,

        "description": description if description else None,
        "remarks": remarks if remarks else None,

        "status": status,

        "inventory": inv_doc,
        "tax": {
            "taxability": taxability,
            "hsnId": hsn_id if hsn_id else None,
            "hsnCode": hsn_code if hsn_code else None,
            "sacId": sac_id if sac_id else None,
            "sacCode": sac_code if sac_code else None,
            "gstRate": gst_rate,
            "cgstRate": (gst_rate / 2.0) if gst_rate > 0 else 0.0,
            "sgstRate": (gst_rate / 2.0) if gst_rate > 0 else 0.0,
            "igstRate": gst_rate,
            "cessRate": parse_float(payload.get("cessRate") or tax_input.get("cessRate"), 0.0),
            "reverseCharge": bool(tax_input.get("reverseCharge", False)),
            "isNonGst": bool(tax_input.get("isNonGst", False))
        },
        "pricing": pricing_doc
    }

    # Conditionally attach optional feature sub-documents ONLY if feature is active
    if ident_doc:
        doc["identification"] = ident_doc
        if "barcode" in ident_doc and ident_doc["barcode"]:
            doc["barcode"] = ident_doc["barcode"]
        if "brand" in ident_doc and ident_doc["brand"]:
            doc["brand"] = ident_doc["brand"]

    if tracking_doc:
        doc["tracking"] = tracking_doc

    if mfg_doc:
        doc["manufacturing"] = mfg_doc

    if warranty_doc:
        doc["warranty"] = warranty_doc

    # Backward compatibility flat fields
    doc["hsnCode"] = hsn_code if item_nature == "GOODS" and hsn_code else (sac_code if sac_code else None)
    doc["hsn"] = doc["hsnCode"]
    doc["gstRate"] = f"{gst_rate}%" if isinstance(gst_rate, (int, float)) else str(gst_rate)
    doc["openingQty"] = op_qty
    doc["openingRate"] = op_rate
    doc["openingValue"] = op_val
    doc["purchasePrice"] = purchase_rate
    doc["salesPrice"] = sales_rate
    doc["mrp"] = pricing_doc.get("mrp")

    doc["auditInfo"] = {
        "createdAt": now_iso,
        "updatedAt": now_iso,
        "enteredBy": payload.get("enteredBy") or "system",
        "alteredBy": payload.get("alteredBy") or "system",
        "version": 1
    }

    return save_or_update_doc(db, "stockitems_entry", "stockItems", doc, payload, "Stock item")


@router.put("/stock-items/{item_id}")
async def update_stock_item_entry(item_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    payload["_id"] = item_id
    payload["id"] = item_id
    return await create_stock_item_entry(payload, request, db)


@router.delete("/stock-items/{item_id}")
async def delete_stock_item_entry(item_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(item_id)} if ObjectId.is_valid(item_id) else {"_id": item_id}
    res1 = db["stockitems_entry"].delete_one(q_filter)
    res2 = db["stockItems"].delete_one(q_filter)
    if res1.deleted_count == 0 and res2.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Stock Item Master record not found")
    return {"success": True, "message": "Stock Item Master record deleted successfully"}


@router.get("/stock-items/{item_id}/xml")
@router.post("/stock-items/xml")
async def generate_stock_item_tally_xml(item_id: str = None, payload: Dict[str, Any] = None, request: Request = None, db=Depends(get_db)):
    """Generates Tally Prime compliant XML for a specific Stock Item."""
    target_id = item_id or (payload.get("id") if payload else None) or (payload.get("_id") if payload else None)
    if not target_id:
        raise HTTPException(status_code=400, detail="Stock Item ID is required")

    q_filter = {"_id": ObjectId(target_id)} if ObjectId.is_valid(target_id) else {"_id": target_id}
    doc = db["stockitems_entry"].find_one(q_filter) or db["stockItems"].find_one(q_filter)

    if not doc:
        raise HTTPException(status_code=404, detail=f"Stock Item record '{target_id}' not found")

    from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
    xml_content = TallyXmlGenerator.generate_stock_item_xml(doc, db=db)

    item_name = doc.get("itemName") or doc.get("name") or "StockItem"
    filename = f"StockItem_{item_name.replace(' ', '_')}.xml"

    from fastapi.responses import Response
    return Response(content=xml_content, media_type="application/xml", headers={
        "Content-Disposition": f'attachment; filename="{filename}"'
    })





# ─────────────── 2. UNIT ENTRY — units_entry & units ───────────────

def normalize_and_migrate_unit_doc(doc: dict, db=None) -> dict:
    """Ensures existing MongoDB unit records adhere to normalized schema without losing data."""
    if not isinstance(doc, dict):
        return doc

    uname = (doc.get("name") or doc.get("unitName") or doc.get("symbol") or "Unit").strip()
    formal_name = (doc.get("formalName") or doc.get("formal_name") or "").strip()
    
    raw_type = str(doc.get("unitType") or doc.get("type") or "").strip().lower()
    is_comp = raw_type in ["compound", "derived unit"] or bool(doc.get("flags", {}).get("isCompound")) or bool(doc.get("firstUnitId")) or bool(doc.get("firstUnit"))
    
    unit_type = "compound" if is_comp else "simple"
    
    dec_places = doc.get("decimalPlaces")
    if dec_places is None:
        dec_places = (doc.get("conversion") or {}).get("decimalPlaces", 2)
    try:
        dec_places = int(dec_places)
    except (ValueError, TypeError):
        dec_places = 2

    first_unit_id = doc.get("firstUnitId")
    first_unit_name = (doc.get("firstUnitName") or doc.get("firstUnit") or (doc.get("compound") or {}).get("firstUnit") or "").strip() or None
    
    second_unit_id = doc.get("secondUnitId")
    second_unit_name = (doc.get("secondUnitName") or doc.get("secondUnit") or (doc.get("compound") or {}).get("secondUnit") or "").strip() or None
    
    conv_factor = doc.get("conversionFactor") or (doc.get("compound") or {}).get("conversionFactor")
    if not is_comp:
        first_unit_id = None
        first_unit_name = None
        second_unit_id = None
        second_unit_name = None
        conv_factor = None
    else:
        try:
            conv_factor = float(conv_factor) if conv_factor is not None else 1.0
        except (ValueError, TypeError):
            conv_factor = 1.0

    status_raw = str(doc.get("status") or "active").lower()
    gst_uqc = doc.get("gstUqc") or doc.get("uqc") or ""

    # Standardized normalized schema keys
    doc["name"] = uname
    doc["unitName"] = uname
    doc["symbol"] = uname
    doc["unitSymbol"] = uname
    doc["formalName"] = formal_name
    doc["unitType"] = unit_type
    doc["type"] = "Compound" if is_comp else "Simple"
    doc["decimalPlaces"] = dec_places
    
    doc["firstUnitId"] = str(first_unit_id) if first_unit_id else None
    doc["firstUnitName"] = first_unit_name
    doc["secondUnitId"] = str(second_unit_id) if second_unit_id else None
    doc["secondUnitName"] = second_unit_name
    doc["conversionFactor"] = conv_factor

    doc["firstUnit"] = first_unit_name
    doc["secondUnit"] = second_unit_name
    doc["gstUqc"] = gst_uqc
    doc["uqc"] = gst_uqc
    
    doc["compound"] = {
        "firstUnit": first_unit_name,
        "firstUnitId": str(first_unit_id) if first_unit_id else None,
        "conversionFactor": conv_factor if is_comp else None,
        "secondUnit": second_unit_name,
        "secondUnitId": str(second_unit_id) if second_unit_id else None,
    } if is_comp else None

    doc["conversion"] = {
        "isBaseUnit": not is_comp,
        "decimalPlaces": dec_places,
        "conversionFactor": conv_factor if is_comp else 1.0
    }
    
    doc["flags"] = {
        "asOriginal": False,
        "isDeleted": False,
        "isCompound": is_comp
    }
    
    doc["status"] = "ACTIVE" if status_raw in ["active", "pushed_to_tally"] else ("INACTIVE" if status_raw == "inactive" else status_raw.upper())
    return doc


@router.get("/units")
@router.get("/units/")
async def get_units(request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    query = {"$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}]}
    
    raw_docs = list(db["units_entry"].find(query)) + list(db["units"].find(query))
    
    seen_ids = set()
    units = []
    for d in raw_docs:
        d_id = str(d.get("_id"))
        if d_id in seen_ids:
            continue
        seen_ids.add(d_id)
        norm_doc = normalize_and_migrate_unit_doc(d, db)
        units.append(serialize_mongo_doc(norm_doc))
        
    return {"success": True, "count": len(units), "data": units}


@router.get("/units/{unit_id}")
async def get_unit_by_id(unit_id: str, request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    q_filter = {"_id": ObjectId(unit_id)} if ObjectId.is_valid(unit_id) else {"_id": unit_id}
    
    doc = db["units_entry"].find_one(q_filter) or db["units"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Unit Master record not found")
        
    norm_doc = normalize_and_migrate_unit_doc(doc, db)
    return {"success": True, "data": serialize_mongo_doc(norm_doc)}


@router.post("/units")
@router.post("/units/")
async def create_unit_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    uname = (payload.get("name") or payload.get("unitName") or payload.get("symbol") or "").strip()
    if not uname:
        raise HTTPException(status_code=400, detail="Unit Name / Symbol is required")
        
    formal_name = (payload.get("formalName") or payload.get("formal_name") or "").strip()
    record_id = payload.get("_id") or payload.get("id")

    # Case-insensitive Uniqueness Check scoped to tenant/company
    dup_query = {
        "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}],
        "$or": [
            {"name": {"$regex": f"^{re.escape(uname)}$", "$options": "i"}},
            {"symbol": {"$regex": f"^{re.escape(uname)}$", "$options": "i"}},
            {"unitName": {"$regex": f"^{re.escape(uname)}$", "$options": "i"}}
        ]
    }
    
    existing_list = list(db["units_entry"].find(dup_query)) + list(db["units"].find(dup_query))
    for existing_dup in existing_list:
        e_id = str(existing_dup.get("_id"))
        if record_id and str(record_id) == e_id:
            continue
        raise HTTPException(status_code=400, detail=f"Unit '{uname}' already exists (case-insensitive check)")

    # Validate decimal places
    try:
        dec_places = int(payload.get("decimalPlaces") if payload.get("decimalPlaces") is not None else 2)
        if dec_places < 0 or dec_places > 4:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="Decimal Places must be a valid integer between 0 and 4")

    unit_type_raw = str(payload.get("unitType") or payload.get("type") or "simple").strip().lower()
    is_compound = unit_type_raw in ["compound", "derived unit"]
    
    first_unit_id = payload.get("firstUnitId")
    first_unit_name = (payload.get("firstUnitName") or payload.get("firstUnit") or "").strip()
    second_unit_id = payload.get("secondUnitId")
    second_unit_name = (payload.get("secondUnitName") or payload.get("secondUnit") or "").strip()
    
    conv_factor = None
    if is_compound:
        if not first_unit_name and not first_unit_id:
            raise HTTPException(status_code=400, detail="First Unit is required for Compound Unit")
        if not second_unit_name and not second_unit_id:
            raise HTTPException(status_code=400, detail="Second Unit is required for Compound Unit")
        if (first_unit_id and second_unit_id and str(first_unit_id) == str(second_unit_id)) or (first_unit_name and second_unit_name and first_unit_name.lower() == second_unit_name.lower()):
            raise HTTPException(status_code=400, detail="First Unit and Second Unit cannot be the same")
            
        try:
            conv_factor = float(payload.get("conversionFactor") or 0)
            if conv_factor <= 0:
                raise ValueError()
        except Exception:
            raise HTTPException(status_code=400, detail="Conversion Factor must be greater than 0")

        # Validate that referenced units exist in MongoDB
        f_filter = {"_id": ObjectId(first_unit_id)} if first_unit_id and ObjectId.is_valid(first_unit_id) else {
            "$or": [{"name": {"$regex": f"^{re.escape(first_unit_name)}$", "$options": "i"}}, {"symbol": {"$regex": f"^{re.escape(first_unit_name)}$", "$options": "i"}}]
        }
        s_filter = {"_id": ObjectId(second_unit_id)} if second_unit_id and ObjectId.is_valid(second_unit_id) else {
            "$or": [{"name": {"$regex": f"^{re.escape(second_unit_name)}$", "$options": "i"}}, {"symbol": {"$regex": f"^{re.escape(second_unit_name)}$", "$options": "i"}}]
        }
        
        f_doc = db["units_entry"].find_one(f_filter) or db["units"].find_one(f_filter)
        s_doc = db["units_entry"].find_one(s_filter) or db["units"].find_one(s_filter)
        
        if not f_doc:
            raise HTTPException(status_code=400, detail=f"Referenced First Unit '{first_unit_name}' does not exist in database")
        if not s_doc:
            raise HTTPException(status_code=400, detail=f"Referenced Second Unit '{second_unit_name}' does not exist in database")
            
        first_unit_id = str(f_doc["_id"])
        first_unit_name = f_doc.get("name") or f_doc.get("symbol") or first_unit_name
        second_unit_id = str(s_doc["_id"])
        second_unit_name = s_doc.get("name") or s_doc.get("symbol") or second_unit_name

    now_iso = datetime.now().isoformat()
    next_num = db["units_entry"].count_documents({}) + 1
    unit_code = payload.get("unitCode") or f"UNIT{next_num:04d}"

    doc = {
        "companyId": company_db_id,
        "tenantId": company_db_id,
        "unitGuid": str(uuid.uuid4()),
        "unitCode": unit_code,
        "name": uname,
        "unitName": uname,
        "symbol": uname,
        "formalName": formal_name,
        "unitType": "compound" if is_compound else "simple",
        "decimalPlaces": dec_places,
        "firstUnitId": first_unit_id,
        "firstUnitName": first_unit_name,
        "secondUnitId": second_unit_id,
        "secondUnitName": second_unit_name,
        "conversionFactor": conv_factor,
        "gstUqc": payload.get("gstUqc") or payload.get("uqc") or "",
        "status": (payload.get("status") or "ACTIVE").upper(),
        "auditInfo": {
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "version": 1
        }
    }
    
    norm_doc = normalize_and_migrate_unit_doc(doc, db)
    return save_or_update_doc(db, "units_entry", "units", norm_doc, payload, "Unit")


@router.put("/units/{unit_id}")
async def update_unit_entry(unit_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    payload["_id"] = unit_id
    payload["id"] = unit_id
    return await create_unit_entry(payload, request, db)


@router.delete("/units/{unit_id}")
async def delete_unit_entry(unit_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(unit_id)} if ObjectId.is_valid(unit_id) else {"_id": unit_id}
    res1 = db["units_entry"].delete_one(q_filter)
    res2 = db["units"].delete_one(q_filter)
    if res1.deleted_count == 0 and res2.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Unit Master record not found")
    return {"success": True, "message": "Unit Master record deleted successfully"}



# ─────────────── 3. STOCK GROUP ENTRY — stockgroups_entry ───────────────
@router.post("/stock-groups")
@router.post("/stock-groups/")
async def create_stock_group_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    group_name = payload.get("groupName") or payload.get("name") or "New Stock Group"
    alias = payload.get("alias") or ""
    parent_name = payload.get("parentGroup") or payload.get("parentGroupName") or "Primary"
    if parent_name == "Primary / Root Group":
        parent_name = "Primary"
    
    parent_doc = db["stockGroups"].find_one({"groupName": parent_name}) or db["stockgroups_entry"].find_one({"groupName": parent_name})
    parent_id = parent_doc["_id"] if parent_doc else None

    next_num = db["stockgroups_entry"].count_documents({}) + 1
    group_code = payload.get("groupCode") or f"GRP{next_num:04d}"
    now_iso = datetime.now().isoformat()

    behaviour_in = payload.get("behaviour") if isinstance(payload.get("behaviour"), dict) else {}
    is_addable = bool(behaviour_in.get("isAddable") if "isAddable" in behaviour_in else payload.get("isAddable", True))
    is_batch_wise = bool(behaviour_in.get("isBatchWiseOn") if "isBatchWiseOn" in behaviour_in else payload.get("isBatchWiseOn", False))
    maintain_mrp = bool(behaviour_in.get("maintainMrp") if "maintainMrp" in behaviour_in else payload.get("maintainMrp", False))
    maintain_expiry = bool(behaviour_in.get("maintainExpiry") if "maintainExpiry" in behaviour_in else payload.get("maintainExpiry", False))

    gst_in = payload.get("gstDetails") if isinstance(payload.get("gstDetails"), dict) else {}
    hsn_in = payload.get("hsnDetails") if isinstance(payload.get("hsnDetails"), dict) else {}

    is_gst = bool(gst_in.get("gstApplicable") if "gstApplicable" in gst_in else payload.get("gstApplicable", True))
    hsn_code = str(hsn_in.get("hsnCode") or gst_in.get("hsnCode") or payload.get("hsnCode") or "").strip()
    gst_rate = str(gst_in.get("gstRate") or payload.get("gstRate") or "18%").strip()
    taxability = str(gst_in.get("taxability") or payload.get("taxability") or "Taxable").strip()

    group_path = payload.get("groupPath") or (f"{parent_name} > {group_name}" if parent_name != "Primary" else f"Primary > {group_name}")
    level = payload.get("level") or (1 if parent_name == "Primary" else 2)

    doc = {
        "companyId": company_db_id,
        "groupGuid": str(uuid.uuid4()),
        "groupCode": group_code,
        "groupName": group_name,
        "name": group_name,
        "alias": alias,
        "parentGroup": parent_name,
        "parentGroupName": parent_name,
        "parentId": parent_id,
        "groupPath": group_path,
        "level": level,

        "behaviour": {
            "affectsStock": True,
            "isAddable": is_addable,
            "isBatchWiseOn": is_batch_wise,
            "maintainMrp": maintain_mrp,
            "maintainExpiry": maintain_expiry
        },
        "isAddable": is_addable,
        "isBatchWiseOn": is_batch_wise,
        "maintainMrp": maintain_mrp,
        "maintainExpiry": maintain_expiry,

        "hsnDetails": { "hsnCode": hsn_code },
        "gstDetails": {
            "gstApplicable": is_gst,
            "hsnCode": hsn_code,
            "gstRate": gst_rate,
            "taxability": taxability,
            "applicableFrom": datetime.now().strftime("%Y-%m-%d")
        },
        "gstApplicable": is_gst,
        "hsnCode": hsn_code,
        "gstRate": gst_rate,
        "taxability": taxability,

        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 },
        "status": (payload.get("status") or "ACTIVE").upper()
    }

    return save_or_update_doc(db, "stockgroups_entry", "stockGroups", doc, payload, "Stock group")



# ─────────────── 4. STOCK CATEGORY ENTRY — stockcategories_entry ───────────────
@router.post("/stock-categories")
@router.post("/stock-categories/")
async def create_stock_category_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    cat_name = (payload.get("stockCategoryName") or payload.get("categoryName") or payload.get("name") or "").strip()
    if not cat_name:
        raise HTTPException(status_code=400, detail="Stock Category Name is required")

    alias = (payload.get("alias") or "").strip()
    parent_name = (payload.get("parentCategory") or payload.get("parentCategoryName") or payload.get("parentName") or "Primary").strip()
    if parent_name in ["Primary / Root Category", "Primary / Root Group"]:
        parent_name = "Primary"
        
    record_id = payload.get("_id") or payload.get("id")

    # Case-insensitive Uniqueness Check
    dup_query = {
        "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}],
        "$or": [
            {"stockCategoryName": {"$regex": f"^{re.escape(cat_name)}$", "$options": "i"}},
            {"categoryName": {"$regex": f"^{re.escape(cat_name)}$", "$options": "i"}},
            {"name": {"$regex": f"^{re.escape(cat_name)}$", "$options": "i"}}
        ]
    }
    existing_list = list(db["stockcategories_entry"].find(dup_query)) + list(db["stockCategories"].find(dup_query))
    for existing_dup in existing_list:
        e_id = str(existing_dup.get("_id"))
        if record_id and str(record_id) == e_id:
            continue
        raise HTTPException(status_code=400, detail=f"Stock Category '{cat_name}' already exists")

    # Self-Parent & Circular Relationship Validation
    if parent_name != "Primary":
        if parent_name.lower() == cat_name.lower():
            raise HTTPException(status_code=400, detail="A Stock Category cannot be its own parent")

        curr = parent_name
        visited = set()
        while curr and curr != "Primary":
            if curr.lower() == cat_name.lower():
                raise HTTPException(status_code=400, detail=f"Selecting '{parent_name}' creates a circular parent relationship")
            if curr.lower() in visited:
                break
            visited.add(curr.lower())

            p_doc = db["stockCategories"].find_one({"categoryName": curr}) or db["stockcategories_entry"].find_one({"categoryName": curr}) or \
                    db["stockCategories"].find_one({"name": curr}) or db["stockcategories_entry"].find_one({"name": curr})
            if not p_doc:
                break
            curr = p_doc.get("parentCategory") or p_doc.get("parentCategoryName") or p_doc.get("parentName") or "Primary"

    parent_doc = db["stockCategories"].find_one({"categoryName": parent_name}) or db["stockcategories_entry"].find_one({"categoryName": parent_name})
    parent_id = parent_doc["_id"] if parent_doc else None

    level = 1 if parent_name == "Primary" else (parent_doc.get("level", 1) + 1 if parent_doc else 2)
    category_path = f"Primary > {cat_name}" if parent_name == "Primary" else f"{parent_doc.get('categoryPath', 'Primary > ' + parent_name)} > {cat_name}"

    now_iso = datetime.now().isoformat()

    doc = {
        "companyId": company_db_id,
        "tenantId": company_db_id,
        "categoryGuid": str(uuid.uuid4()),
        "stockCategoryName": cat_name,
        "categoryName": cat_name,
        "name": cat_name,
        "alias": alias,
        "categoryPath": category_path,
        "parentCategory": parent_id or parent_name,
        "parentCategoryName": parent_name,
        "parentName": parent_name,
        "level": level,
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 },
        "status": (payload.get("status") or "ACTIVE").upper()
    }

    return save_or_update_doc(db, "stockcategories_entry", "stockCategories", doc, payload, "Stock category")


@router.put("/stock-categories/{cat_id}")
async def update_stock_category_entry(cat_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    payload["_id"] = cat_id
    payload["id"] = cat_id
    return await create_stock_category_entry(payload, request, db)


@router.delete("/stock-categories/{cat_id}")
async def delete_stock_category_entry(cat_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(cat_id)} if ObjectId.is_valid(cat_id) else {"_id": cat_id}
    cat_doc = db["stockcategories_entry"].find_one(q_filter) or db["stockCategories"].find_one(q_filter)
    
    if not cat_doc:
        raise HTTPException(status_code=404, detail="Stock Category not found")

    cname = cat_doc.get("stockCategoryName") or cat_doc.get("categoryName") or cat_doc.get("name")

    # Hard-deletion Guard: Check if Stock Items reference this Stock Category
    if cname:
        item_ref_query = {
            "$or": [
                {"stockCategoryName": cname},
                {"stockCategory": cname},
                {"category": cname},
                {"stockCategoryName": {"$regex": f"^{re.escape(cname)}$", "$options": "i"}},
                {"stockCategory": {"$regex": f"^{re.escape(cname)}$", "$options": "i"}}
            ]
        }
        ref_item = db["stockitems_entry"].find_one(item_ref_query) or db["stockItems"].find_one(item_ref_query)
        if ref_item:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete Stock Category '{cname}' because it is referenced by existing Stock Items (e.g. '{ref_item.get('itemName') or ref_item.get('name')}'). Please set status to INACTIVE instead."
            )

    res1 = db["stockcategories_entry"].delete_one(q_filter)
    res2 = db["stockCategories"].delete_one(q_filter)
    return {"success": True, "message": f"Stock Category '{cname}' deleted successfully"}



# ─────────────── 4B. GODOWN ENTRY — godownEntries ───────────────

@router.get("/godown-entries")
@router.get("/godown-entries/")
async def get_godown_entries(request: Request, db=Depends(get_db)):
    search_fields = ["godownName", "name", "alias", "godownCode", "parentName", "stateName", "locationType"]
    return fetch_and_paginate_master(db, "godowns", "godownEntries", request, search_fields)


@router.get("/godown-entries/{godown_id}")
async def get_godown_entry_by_id(godown_id: str, request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    q_filter = {"_id": ObjectId(godown_id)} if ObjectId.is_valid(godown_id) else {"_id": godown_id}
    doc = db["godownEntries"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Godown Master record not found")
    return {"success": True, "data": serialize_mongo_doc(doc)}


@router.post("/godown-entries")
@router.post("/godown-entries/")
async def create_godown_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    gname = (payload.get("godownName") or payload.get("name") or "").strip()
    if not gname:
        raise HTTPException(status_code=400, detail="Godown / Warehouse Name is required")

    alias = (payload.get("alias") or "").strip()
    parent_name = (payload.get("parentName") or payload.get("parentGodown") or payload.get("parentCategory") or "Primary").strip()
    if parent_name in ["Primary / Root Godown", "Primary / Root Category", "Primary / Root Group"]:
        parent_name = "Primary"

    record_id = payload.get("_id") or payload.get("id")

    # Case-insensitive Uniqueness Check scoped to company in godownEntries ONLY
    dup_query = {
        "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}],
        "$or": [
            {"godownName": {"$regex": f"^{re.escape(gname)}$", "$options": "i"}},
            {"name": {"$regex": f"^{re.escape(gname)}$", "$options": "i"}}
        ]
    }
    existing_list = list(db["godownEntries"].find(dup_query))
    for existing_dup in existing_list:
        e_id = str(existing_dup.get("_id"))
        if record_id and str(record_id) == e_id:
            continue
        raise HTTPException(status_code=400, detail=f"Godown '{gname}' already exists in godownEntries")

    # Self-Parent & Circular Hierarchy Validation
    parent_id = None
    level = 0
    godown_path = gname

    if parent_name != "Primary":
        if parent_name.lower() == gname.lower():
            raise HTTPException(status_code=400, detail="A Godown cannot be its own parent")

        # Check circular dependency in godownEntries
        curr = parent_name
        visited = set()
        while curr and curr != "Primary":
            if curr.lower() == gname.lower():
                raise HTTPException(status_code=400, detail=f"Selecting '{parent_name}' creates a circular parent relationship")
            if curr.lower() in visited:
                break
            visited.add(curr.lower())

            p_doc = db["godownEntries"].find_one({"$or": [{"godownName": curr}, {"name": curr}]})
            if not p_doc:
                break
            curr = p_doc.get("parentName") or p_doc.get("parentGodown") or "Primary"

        parent_doc = db["godownEntries"].find_one({"$or": [{"godownName": parent_name}, {"name": parent_name}]})
        if parent_doc:
            parent_id = str(parent_doc.get("_id"))
            level = (parent_doc.get("level") or 0) + 1
            parent_path = parent_doc.get("godownPath") or parent_name
            godown_path = f"{parent_path} / {gname}"
        else:
            godown_path = f"{parent_name} / {gname}"
            level = 1

    next_num = db["godownEntries"].count_documents({}) + 1
    godown_code = payload.get("godownCode") or f"GW-{next_num:06d}"
    godown_guid = payload.get("godownGuid") or str(uuid.uuid4())
    now_iso = datetime.now().isoformat()

    doc = {
        "companyId": company_db_id,
        "tenantId": company_db_id,
        "godownGuid": godown_guid,
        "godownCode": godown_code,
        "godownName": gname,
        "name": gname,
        "alias": alias if alias else None,
        "parentId": parent_id,
        "parentName": parent_name if parent_name != "Primary" else None,
        "godownPath": godown_path,
        "level": level,
        "locationType": payload.get("locationType") or "Warehouse",
        "address": payload.get("address") or None,
        "stateName": payload.get("stateName") or payload.get("state") or None,
        "pincode": payload.get("pincode") or None,
        "status": (payload.get("status") or "ACTIVE").upper(),
        "source": "MANUAL",
        "tallySync": payload.get("tallySync") or {
            "syncStatus": "NOT_SYNCED",
            "tallyGuid": None,
            "tallyAlterId": None,
            "remoteAlterId": None,
            "lastSyncedAt": None,
            "lastSyncError": None
        },
        "auditInfo": {
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "enteredBy": payload.get("enteredBy") or None,
            "alteredBy": payload.get("alteredBy") or None,
            "version": 1
        }
    }

    if record_id:
        q_filter = {"_id": ObjectId(record_id)} if ObjectId.is_valid(record_id) else {"_id": record_id}
        doc["_id"] = ObjectId(record_id) if ObjectId.is_valid(record_id) else record_id
        db["godownEntries"].replace_one(q_filter, doc, upsert=True)
    else:
        res = db["godownEntries"].insert_one(doc)
        doc["_id"] = res.inserted_id

    return {"success": True, "message": "Godown record saved successfully", "data": serialize_mongo_doc(doc)}


@router.put("/godown-entries/{godown_id}")
async def update_godown_entry(godown_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    payload["_id"] = godown_id
    payload["id"] = godown_id
    return await create_godown_entry(payload, request, db)


@router.patch("/godown-entries/{godown_id}/status")
async def toggle_godown_status(godown_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(godown_id)} if ObjectId.is_valid(godown_id) else {"_id": godown_id}
    doc = db["godownEntries"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Godown Master record not found")
    
    new_status = payload.get("status")
    if not new_status:
        current_status = str(doc.get("status") or "ACTIVE").upper()
        new_status = "INACTIVE" if current_status == "ACTIVE" else "ACTIVE"
    else:
        new_status = str(new_status).upper()

    db["godownEntries"].update_one(q_filter, {"$set": {"status": new_status, "auditInfo.updatedAt": datetime.now().isoformat()}})
    return {"success": True, "message": f"Godown status set to '{new_status}'", "status": new_status}


@router.delete("/godown-entries/{godown_id}")
async def delete_godown_entry(godown_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(godown_id)} if ObjectId.is_valid(godown_id) else {"_id": godown_id}
    doc = db["godownEntries"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Godown Master record not found")

    gname = doc.get("godownName") or doc.get("name")

    # Soft reference guard check: check if referenced in stock items or vouchers
    if gname:
        ref_query = {
            "$or": [
                {"godownName": gname},
                {"godown": gname},
                {"batches.godownName": gname},
                {"bomComponents.godownName": gname}
            ]
        }
        ref_item = db["stockitems_entry"].find_one(ref_query) or db["stockItems"].find_one(ref_query)
        if ref_item:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete Godown '{gname}' because it is referenced by existing Stock Items (e.g. '{ref_item.get('itemName') or ref_item.get('name')}'). Please set status to INACTIVE instead."
            )

    db["godownEntries"].delete_one(q_filter)
    return {"success": True, "message": f"Godown '{gname}' deleted successfully from godownEntries"}


@router.post("/godown-entries/{godown_id}/push-to-tally")
async def push_godown_to_tally(godown_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(godown_id)} if ObjectId.is_valid(godown_id) else {"_id": godown_id}
    doc = db["godownEntries"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Godown Master record not found")

    from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
    try:
        xml_str = TallyXmlGenerator.generate_godown_xml(doc)
        now_iso = datetime.now().isoformat()
        tally_sync_data = {
            "syncStatus": "SYNCED",
            "lastSyncedAt": now_iso,
            "lastSyncError": None
        }
        db["godownEntries"].update_one(q_filter, {"$set": {"tallySync": tally_sync_data, "tallyPayloads": {"xml": xml_str, "generatedAt": now_iso}}})
        return {"success": True, "message": f"Godown '{doc.get('godownName')}' pushed to Tally successfully!", "xml": xml_str}
    except Exception as e:
        now_iso = datetime.now().isoformat()
        db["godownEntries"].update_one(q_filter, {"$set": {"tallySync.syncStatus": "FAILED", "tallySync.lastSyncError": str(e), "tallySync.lastSyncedAt": now_iso}})
        raise HTTPException(status_code=400, detail=f"Failed to push Godown to Tally: {e}")




# ─────────────── 5. LEDGER GROUP ENTRY — groups_entry ───────────────
@router.post("/ledger-groups")
@router.post("/ledger-groups/")
async def create_ledger_group_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    group_name = payload.get("groupName") or payload.get("name") or "New Ledger Group"
    parent_name = payload.get("parentGroup") or payload.get("parentGroupName") or "Primary"
    
    parent_doc = db["groups"].find_one({"groupName": parent_name}) or db["groups_entry"].find_one({"groupName": parent_name})
    parent_id = parent_doc["_id"] if parent_doc else None

    next_num = db["groups_entry"].count_documents({}) + 1
    group_code = payload.get("groupCode") or f"GRP{next_num:04d}"
    now_iso = datetime.now().isoformat()

    nature_val = payload.get("nature") or "Assets"
    if isinstance(nature_val, dict):
        nature_val = nature_val.get("classification") or nature_val.get("nature") or "Assets"

    doc = {
        "companyId": company_db_id,
        "groupGuid": str(uuid.uuid4()),
        "groupCode": group_code,
        "groupName": group_name,
        "parentGroup": parent_id,
        "parentGroupName": parent_name,
        "groupPath": f"{parent_name} > {group_name}" if parent_name != "Primary" else group_name,
        "nature": {
            "affectsGrossProfit": False,
            "affectsNetProfit": True,
            "classification": nature_val
        },
        "behaviour": {
            "isDebitPositive": True,
            "isRevenue": False,
            "isStock": False,
            "isBillWiseOn": True
        },
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 },
        "status": (payload.get("status") or "ACTIVE").upper(),
        "nameAliases": [],
        "reservedName": ""
    }

    return save_or_update_doc(db, "groups_entry", "groups", doc, payload, "Ledger group")


@router.get("/ledger-groups")
@router.get("/ledger-groups/")
async def get_ledger_groups(request: Request, db=Depends(get_db)):
    search_fields = ["groupName", "name", "alias", "groupCode", "parentGroupName", "parentGroup", "nature"]
    return fetch_and_paginate_master(db, "groups", "groups_entry", request, search_fields)


@router.get("/stock-groups")
@router.get("/stock-groups/")
async def get_stock_groups(request: Request, db=Depends(get_db)):
    search_fields = ["groupName", "name", "alias", "groupCode", "parentGroupName", "parentGroup", "hsnCode"]
    return fetch_and_paginate_master(db, "stockGroups", "stockgroups_entry", request, search_fields)


@router.get("/units")
@router.get("/units/")
async def get_units(request: Request, db=Depends(get_db)):
    search_fields = ["unitName", "name", "symbol", "formalName", "unitCode", "gstUqc"]
    return fetch_and_paginate_master(db, "units", "units_entry", request, search_fields)


@router.get("/stock-categories")
@router.get("/stock-categories/")
async def get_stock_categories(request: Request, db=Depends(get_db)):
    search_fields = ["categoryName", "stockCategoryName", "name", "alias", "parentCategoryName", "parentCategory"]
    return fetch_and_paginate_master(db, "stockCategories", "stockcategories_entry", request, search_fields)


# ─────────────── 6. COST CENTER ENTRY — costcenters_entry & costCenters ───────────────
@router.get("/cost-centers")
@router.get("/cost-centers/")
async def get_cost_centers(request: Request, db=Depends(get_db)):
    search_fields = ["costCenterName", "name", "alias", "costCenterCode", "costCategoryName", "costCategoryId", "parentName"]
    return fetch_and_paginate_master(db, "costCenters", "costcenters_entry", request, search_fields)


@router.get("/cost-centers/{cost_center_id}")
async def get_cost_center_by_id(cost_center_id: str, request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    q_filter = {"_id": ObjectId(cost_center_id)} if ObjectId.is_valid(cost_center_id) else {"_id": cost_center_id}

    doc = db["costcenters_entry"].find_one(q_filter) or db["costCenters"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Cost Center Master record not found")
    return {"success": True, "data": serialize_mongo_doc(doc)}


@router.post("/cost-centers")
@router.post("/cost-centers/")
async def create_cost_center_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    cc_name = (payload.get("costCenterName") or payload.get("name") or "").strip()
    if not cc_name:
        raise HTTPException(status_code=400, detail="Cost Center Name is required")

    record_id = payload.get("_id") or payload.get("id")

    # Tenant-isolated case-insensitive duplicate check for Cost Center Name
    dup_query = {
        "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}],
        "$or": [
            {"costCenterName": {"$regex": f"^{re.escape(cc_name)}$", "$options": "i"}},
            {"name": {"$regex": f"^{re.escape(cc_name)}$", "$options": "i"}}
        ]
    }
    existing_list = list(db["costcenters_entry"].find(dup_query)) + list(db["costCenters"].find(dup_query))
    for existing_dup in existing_list:
        e_id = str(existing_dup.get("_id"))
        if record_id and str(record_id) == e_id:
            continue
        raise HTTPException(status_code=400, detail=f"Cost Center '{cc_name}' already exists in this company")

    # Duplicate check for Cost Center Code if provided
    cc_code = (payload.get("costCenterCode") or payload.get("code") or "").strip()
    if cc_code:
        code_dup_query = {
            "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}],
            "$or": [
                {"costCenterCode": {"$regex": f"^{re.escape(cc_code)}$", "$options": "i"}},
                {"code": {"$regex": f"^{re.escape(cc_code)}$", "$options": "i"}}
            ]
        }
        code_dups = list(db["costcenters_entry"].find(code_dup_query)) + list(db["costCenters"].find(code_dup_query))
        for dup in code_dups:
            e_id = str(dup.get("_id"))
            if record_id and str(record_id) == e_id:
                continue
            raise HTTPException(status_code=400, detail=f"Cost Center Code '{cc_code}' already exists in this company")

    parent_name = payload.get("parentId") or payload.get("parentName") or "Primary / None"
    if isinstance(parent_name, dict):
        parent_name = parent_name.get("costCenterName") or parent_name.get("name") or "Primary / None"
    parent_name = str(parent_name).strip()

    # Prevent self-parenting and circular hierarchy
    if parent_name and parent_name not in ["Primary / None", "Primary", "None"]:
        if parent_name.lower() == cc_name.lower():
            raise HTTPException(status_code=400, detail="A Cost Center cannot be its own parent")

        # Check circular dependency
        curr = parent_name
        visited = set()
        while curr and curr not in ["Primary / None", "Primary", "None"]:
            if curr.lower() == cc_name.lower():
                raise HTTPException(status_code=400, detail=f"Selecting '{parent_name}' creates a circular parent relationship")
            if curr.lower() in visited:
                break
            visited.add(curr.lower())

            p_doc = db["costcenters_entry"].find_one({"$or": [{"costCenterName": curr}, {"name": curr}]}) or db["costCenters"].find_one({"$or": [{"costCenterName": curr}, {"name": curr}]})
            if not p_doc:
                break
            curr = p_doc.get("parentId") or p_doc.get("parentName") or "Primary / None"

    category_name = payload.get("costCategoryId") or payload.get("costCategoryName") or "Primary Cost Category"
    if isinstance(category_name, dict):
        category_name = category_name.get("costCategoryName") or category_name.get("name") or "Primary Cost Category"

    parent_doc = db["costCenters"].find_one({"costCenterName": parent_name}) or db["costcenters_entry"].find_one({"costCenterName": parent_name})
    parent_id = str(parent_doc["_id"]) if parent_doc else None

    alias = (payload.get("alias") or "").strip()
    description = (payload.get("description") or "").strip()

    is_active = bool(payload.get("isActive", True) if "isActive" in payload else str(payload.get("status", "ACTIVE")).upper() == "ACTIVE")
    status_str = "ACTIVE" if is_active else "INACTIVE"

    now_iso = datetime.now().isoformat()

    doc = {
        "companyId": company_db_id,
        "tenantId": company_db_id,
        "costCenterGuid": str(uuid.uuid4()),
        "costCenterCode": cc_code if cc_code else f"CC-{(db['costcenters_entry'].count_documents({}) + 1):04d}",
        "code": cc_code if cc_code else f"CC-{(db['costcenters_entry'].count_documents({}) + 1):04d}",
        "costCenterName": cc_name,
        "name": cc_name,
        "alias": alias if alias else None,
        "description": description if description else None,
        "costCategoryId": category_name,
        "costCategoryName": category_name,
        "parentId": parent_id,
        "parentName": parent_name,
        "parentGroupPath": f"{parent_name} > {cc_name}" if parent_name not in ["Primary / None", "Primary"] else cc_name,
        "level": 1,
        "isActive": is_active,
        "status": status_str,
        "flags": {
            "asOriginal": False,
            "affectStock": False,
            "forPayRoll": False,
            "forJobCosting": False,
            "isEmployeeGroup": False
        },
        "isWebEntry": True,
        "isSynced": False,
        "sourceCollection": "costcenters_entry",
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 }
    }

    return save_or_update_doc(db, "costcenters_entry", "costCenters", doc, payload, "Cost center")


@router.put("/cost-centers/{record_id}")
async def update_cost_center_entry(record_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    payload["_id"] = record_id
    payload["id"] = record_id
    return await create_cost_center_entry(payload, request, db)


# ─────────────── 6A2. COST CATEGORIES — costcategories_entry & costCategories ───────────────

@router.get("/cost-categories")
@router.get("/cost-categories/")
async def get_cost_categories(request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    query = {"$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}]}

    docs_entry = list(db["costcategories_entry"].find(query))
    for d in docs_entry:
        d["isWebEntry"] = True
        d["isSynced"] = False
        d["sourceCollection"] = "costcategories_entry"
        if not d.get("categoryName") and d.get("name"):
            d["categoryName"] = d["name"]

    docs_std = list(db["costCategories"].find(query))
    for d in docs_std:
        if "isWebEntry" not in d:
            d["isWebEntry"] = False
        if "isSynced" not in d:
            d["isSynced"] = True
        if "sourceCollection" not in d:
            d["sourceCollection"] = "costCategories"
        if not d.get("categoryName") and d.get("name"):
            d["categoryName"] = d["name"]

    # Fetch all cost centers to group by cost category
    all_ccs = list(db["costcenters_entry"].find(query)) + list(db["costCenters"].find(query))

    category_map = {}
    for cc in all_ccs:
        c_cat = (cc.get("costCategoryName") or cc.get("costCategoryId") or cc.get("costCategory") or cc.get("category") or "Primary Cost Category").strip()
        if c_cat not in category_map:
            category_map[c_cat] = []
        cc_name = cc.get("costCenterName") or cc.get("name")
        if cc_name:
            category_map[c_cat].append(cc_name)

    raw_docs = docs_entry + docs_std

    existing_names = set(d.get("categoryName") or d.get("name") for d in raw_docs if d.get("categoryName") or d.get("name"))

    # Include any category referenced by cost centers that isn't in raw_docs yet
    for cat_name in category_map.keys():
        if cat_name not in existing_names:
            raw_docs.append({
                "categoryName": cat_name,
                "name": cat_name,
                "alias": "Primary" if cat_name == "Primary Cost Category" else "",
                "allocateRevenueItems": True,
                "allocateNonRevenueItems": False,
                "status": "ACTIVE",
                "isActive": True,
                "isWebEntry": False,
                "sourceCollection": "costCategories"
            })
            existing_names.add(cat_name)

    if not raw_docs:
        raw_docs = [{
            "categoryName": "Primary Cost Category",
            "name": "Primary Cost Category",
            "alias": "Primary",
            "allocateRevenueItems": True,
            "allocateNonRevenueItems": False,
            "status": "ACTIVE",
            "isActive": True,
            "isWebEntry": False,
            "sourceCollection": "costCategories"
        }]

    seen_ids = set()
    categories = []
    for d in raw_docs:
        c_name = d.get("categoryName") or d.get("name") or "Primary Cost Category"
        d_id = str(d.get("_id")) if d.get("_id") else c_name
        if d_id in seen_ids:
            continue
        seen_ids.add(d_id)

        associated = category_map.get(c_name, [])
        d["costCentersCount"] = len(associated)
        d["associatedCenters"] = associated
        categories.append(serialize_mongo_doc(d))

    return {"success": True, "count": len(categories), "data": categories}


@router.get("/cost-categories/{category_id}")
async def get_cost_category_by_id(category_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(category_id)} if ObjectId.is_valid(category_id) else {"_id": category_id}
    doc = db["costcategories_entry"].find_one(q_filter) or db["costCategories"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Cost Category record not found")
    return {"success": True, "data": serialize_mongo_doc(doc)}


@router.post("/cost-categories")
@router.post("/cost-categories/")
async def create_cost_category_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    cat_name = (payload.get("categoryName") or payload.get("costCategoryName") or payload.get("name") or "").strip()
    if not cat_name:
        raise HTTPException(status_code=400, detail="Cost Category Name is required")

    record_id = payload.get("_id") or payload.get("id")

    # Duplicate check for Category Name
    dup_query = {
        "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}],
        "$or": [
            {"categoryName": {"$regex": f"^{re.escape(cat_name)}$", "$options": "i"}},
            {"costCategoryName": {"$regex": f"^{re.escape(cat_name)}$", "$options": "i"}},
            {"name": {"$regex": f"^{re.escape(cat_name)}$", "$options": "i"}}
        ]
    }
    dups = list(db["costcategories_entry"].find(dup_query)) + list(db["costCategories"].find(dup_query))
    for dup in dups:
        e_id = str(dup.get("_id"))
        if record_id and str(record_id) == e_id:
            continue
        raise HTTPException(status_code=400, detail=f"Cost Category '{cat_name}' already exists in this company")

    alias = (payload.get("alias") or "").strip()
    description = (payload.get("description") or "").strip()
    is_active = bool(payload.get("isActive", True) if "isActive" in payload else str(payload.get("status", "ACTIVE")).upper() == "ACTIVE")
    status_str = "ACTIVE" if is_active else "INACTIVE"
    now_iso = datetime.now().isoformat()

    doc = {
        "companyId": company_db_id,
        "tenantId": company_db_id,
        "categoryName": cat_name,
        "costCategoryName": cat_name,
        "name": cat_name,
        "alias": alias if alias else None,
        "allocateRevenueItems": bool(payload.get("allocateRevenueItems", True)),
        "allocateNonRevenueItems": bool(payload.get("allocateNonRevenueItems", True)),
        "description": description if description else None,
        "status": status_str,
        "isActive": is_active,
        "isWebEntry": True,
        "isSynced": False,
        "sourceCollection": "costcategories_entry",
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 }
    }

    return save_or_update_doc(db, "costcategories_entry", "costCategories", doc, payload, "Cost category")


@router.put("/cost-categories/{record_id}")
async def update_cost_category_entry(record_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    payload["_id"] = record_id
    payload["id"] = record_id
    return await create_cost_category_entry(payload, request, db)


@router.patch("/cost-categories/{record_id}/status")
async def toggle_cost_category_status(record_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(record_id)} if ObjectId.is_valid(record_id) else {"_id": record_id}
    doc = db["costcategories_entry"].find_one(q_filter) or db["costCategories"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Cost Category record not found")

    new_status = payload.get("status")
    if not new_status:
        current_status = str(doc.get("status") or "ACTIVE").upper()
        new_status = "INACTIVE" if current_status == "ACTIVE" else "ACTIVE"
    else:
        new_status = str(new_status).upper()

    col = doc.get("sourceCollection") or "costcategories_entry"
    db[col].update_one(q_filter, {"$set": {"status": new_status, "isActive": new_status == "ACTIVE", "auditInfo.updatedAt": datetime.now().isoformat()}})
    return {"success": True, "message": f"Cost Category status updated to '{new_status}'", "status": new_status}


@router.delete("/cost-categories/{record_id}")
async def delete_cost_category_entry(record_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(record_id)} if ObjectId.is_valid(record_id) else {"_id": record_id}
    doc = db["costcategories_entry"].find_one(q_filter) or db["costCategories"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Cost Category record not found")

    c_name = doc.get("categoryName") or doc.get("name")
    if c_name and c_name.strip().lower() == "primary cost category":
        raise HTTPException(status_code=400, detail="Primary Cost Category cannot be deleted")

    # Check reference in cost centers or classes
    ref_cc = db["costcenters_entry"].find_one({"costCategoryName": c_name}) or db["costCenters"].find_one({"costCategoryName": c_name})
    if ref_cc:
        col = doc.get("sourceCollection") or "costcategories_entry"
        db[col].update_one(q_filter, {"$set": {"status": "INACTIVE", "isActive": False, "auditInfo.updatedAt": datetime.now().isoformat()}})
        raise HTTPException(status_code=400, detail=f"Cost Category '{c_name}' is referenced by Cost Centres (e.g. '{ref_cc.get('costCenterName')}') and cannot be deleted. Status set to INACTIVE instead.")

    col = doc.get("sourceCollection") or "costcategories_entry"
    db[col].delete_one(q_filter)
    return {"success": True, "message": f"Cost Category '{c_name}' deleted successfully"}


# ─────────────── 6A3. COST CENTRE CLASSES — costcentreclasses_entry & costCentreClasses ───────────────

@router.get("/cost-centre-classes")
@router.get("/cost-centre-classes/")
async def get_cost_centre_classes(request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    query = {"$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}]}

    docs_entry = list(db["costcentreclasses_entry"].find(query))
    for d in docs_entry:
        d["isWebEntry"] = True
        d["isSynced"] = False
        d["sourceCollection"] = "costcentreclasses_entry"
        if not d.get("className") and d.get("name"):
            d["className"] = d["name"]

    docs_std = list(db["costCentreClasses"].find(query))
    for d in docs_std:
        if "isWebEntry" not in d:
            d["isWebEntry"] = False
        if "isSynced" not in d:
            d["isSynced"] = True
        if "sourceCollection" not in d:
            d["sourceCollection"] = "costCentreClasses"
        if not d.get("className") and d.get("name"):
            d["className"] = d["name"]

    raw_docs = docs_entry + docs_std
    seen_ids = set()
    classes = []
    for d in raw_docs:
        d_id = str(d.get("_id"))
        if d_id in seen_ids:
            continue
        seen_ids.add(d_id)
        allocs = d.get("allocations") or []
        d["allocationsCount"] = len(allocs)
        classes.append(serialize_mongo_doc(d))
    return {"success": True, "count": len(classes), "data": classes}


@router.get("/cost-centre-classes/{class_id}")
async def get_cost_centre_class_by_id(class_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(class_id)} if ObjectId.is_valid(class_id) else {"_id": class_id}
    doc = db["costcentreclasses_entry"].find_one(q_filter) or db["costCentreClasses"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Cost Centre Class record not found")
    return {"success": True, "data": serialize_mongo_doc(doc)}


@router.post("/cost-centre-classes")
@router.post("/cost-centre-classes/")
async def create_cost_centre_class_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    class_name = (payload.get("className") or payload.get("name") or "").strip()
    if not class_name:
        raise HTTPException(status_code=400, detail="Cost Centre Class Name is required")

    record_id = payload.get("_id") or payload.get("id")

    # Duplicate check for Class Name
    dup_query = {
        "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}],
        "$or": [
            {"className": {"$regex": f"^{re.escape(class_name)}$", "$options": "i"}},
            {"name": {"$regex": f"^{re.escape(class_name)}$", "$options": "i"}}
        ]
    }
    dups = list(db["costcentreclasses_entry"].find(dup_query)) + list(db["costCentreClasses"].find(dup_query))
    for dup in dups:
        e_id = str(dup.get("_id"))
        if record_id and str(record_id) == e_id:
            continue
        raise HTTPException(status_code=400, detail=f"Cost Centre Class '{class_name}' already exists in this company")

    allocations = payload.get("allocations") or []
    if not allocations or len(allocations) == 0:
        raise HTTPException(status_code=400, detail="At least one allocation row is required in a Cost Centre Class")

    # Validate allocations total percentage = 100%
    total_pct = sum(parse_float(a.get("percentage") or a.get("pct"), 0.0) for a in allocations if isinstance(a, dict))
    if round(total_pct, 2) != 100.0:
        raise HTTPException(status_code=400, detail=f"Total allocation must equal 100%. Current total: {total_pct:.2f}%.")

    alias = (payload.get("alias") or "").strip()
    description = (payload.get("description") or "").strip()
    is_active = bool(payload.get("isActive", True) if "isActive" in payload else str(payload.get("status", "ACTIVE")).upper() == "ACTIVE")
    status_str = "ACTIVE" if is_active else "INACTIVE"
    now_iso = datetime.now().isoformat()

    doc = {
        "companyId": company_db_id,
        "tenantId": company_db_id,
        "className": class_name,
        "name": class_name,
        "alias": alias if alias else None,
        "allocations": allocations,
        "description": description if description else None,
        "status": status_str,
        "isActive": is_active,
        "isWebEntry": True,
        "isSynced": False,
        "sourceCollection": "costcentreclasses_entry",
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 }
    }

    return save_or_update_doc(db, "costcentreclasses_entry", "costCentreClasses", doc, payload, "Cost centre class")


@router.put("/cost-centre-classes/{record_id}")
async def update_cost_centre_class_entry(record_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    payload["_id"] = record_id
    payload["id"] = record_id
    return await create_cost_centre_class_entry(payload, request, db)


@router.patch("/cost-centre-classes/{record_id}/status")
async def toggle_cost_centre_class_status(record_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(record_id)} if ObjectId.is_valid(record_id) else {"_id": record_id}
    doc = db["costcentreclasses_entry"].find_one(q_filter) or db["costCentreClasses"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Cost Centre Class record not found")

    new_status = payload.get("status")
    if not new_status:
        current_status = str(doc.get("status") or "ACTIVE").upper()
        new_status = "INACTIVE" if current_status == "ACTIVE" else "ACTIVE"
    else:
        new_status = str(new_status).upper()

    col = doc.get("sourceCollection") or "costcentreclasses_entry"
    db[col].update_one(q_filter, {"$set": {"status": new_status, "isActive": new_status == "ACTIVE", "auditInfo.updatedAt": datetime.now().isoformat()}})
    return {"success": True, "message": f"Cost Centre Class status updated to '{new_status}'", "status": new_status}


@router.delete("/cost-centre-classes/{record_id}")
async def delete_cost_centre_class_entry(record_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(record_id)} if ObjectId.is_valid(record_id) else {"_id": record_id}
    doc = db["costcentreclasses_entry"].find_one(q_filter) or db["costCentreClasses"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Cost Centre Class record not found")

    c_name = doc.get("className") or doc.get("name")
    col = doc.get("sourceCollection") or "costcentreclasses_entry"
    db[col].delete_one(q_filter)
    return {"success": True, "message": f"Cost Centre Class '{c_name}' deleted successfully"}


# ─────────────── 6B. BOM ENTRY — boms_entry & boms ───────────────

@router.get("/boms")
@router.get("/boms/")
async def get_all_boms(request: Request, db=Depends(get_db)):
    comp_id = resolve_company_db_id(request, db)
    query = {"$or": [{"companyId": comp_id}, {"companyId": str(comp_id)}, {"tenantId": comp_id}, {"tenantId": str(comp_id)}]}

    docs_entry = list(db["boms_entry"].find(query))
    for d in docs_entry:
        d["isWebEntry"] = True
        d["isSynced"] = False
        d["sourceCollection"] = "boms_entry"
        if not d.get("bomName") and d.get("name"):
            d["bomName"] = d["name"]

    docs_std = list(db["boms"].find(query))
    for d in docs_std:
        if "isWebEntry" not in d:
            d["isWebEntry"] = False
        if "isSynced" not in d:
            d["isSynced"] = True
        if "sourceCollection" not in d:
            d["sourceCollection"] = "boms"
        if not d.get("bomName") and d.get("name"):
            d["bomName"] = d["name"]

    raw_docs = docs_entry + docs_std
    seen_ids = set()
    boms_list = []
    for d in raw_docs:
        d_id = str(d.get("_id"))
        if d_id in seen_ids:
            continue
        seen_ids.add(d_id)
        boms_list.append(serialize_mongo_doc(d))
    return {"success": True, "count": len(boms_list), "data": boms_list}


@router.get("/boms/for-item/{item_ref}")
async def get_boms_for_item(item_ref: str, request: Request, db=Depends(get_db)):
    comp_id = resolve_company_db_id(request, db)
    query = {
        "$and": [
            {"$or": [{"companyId": comp_id}, {"companyId": str(comp_id)}, {"tenantId": comp_id}, {"tenantId": str(comp_id)}]},
            {"$or": [
                {"finishedItemId": item_ref},
                {"finishedItemName": {"$regex": f"^{re.escape(item_ref)}$", "$options": "i"}},
                {"stockItemName": {"$regex": f"^{re.escape(item_ref)}$", "$options": "i"}}
            ]}
        ]
    }
    docs_entry = list(db["boms_entry"].find(query))
    docs_std = list(db["boms"].find(query))
    all_boms = [serialize_mongo_doc(d) for d in (docs_entry + docs_std)]
    return {"success": True, "count": len(all_boms), "data": all_boms}


@router.get("/boms/active-for-item/{item_ref}")
async def get_active_bom_for_item(item_ref: str, request: Request, db=Depends(get_db)):
    comp_id = resolve_company_db_id(request, db)
    query = {
        "$and": [
            {"$or": [{"companyId": comp_id}, {"companyId": str(comp_id)}, {"tenantId": comp_id}, {"tenantId": str(comp_id)}]},
            {"$or": [
                {"status": {"$in": ["ACTIVE", "Active"]}},
                {"status": {"$exists": False}}
            ]},
            {"$or": [
                {"finishedItemId": item_ref},
                {"finishedItemName": {"$regex": f"^{re.escape(item_ref)}$", "$options": "i"}},
                {"stockItemName": {"$regex": f"^{re.escape(item_ref)}$", "$options": "i"}}
            ]}
        ]
    }
    docs_entry = list(db["boms_entry"].find(query))
    docs_std = list(db["boms"].find(query))
    active_boms = [serialize_mongo_doc(d) for d in (docs_entry + docs_std)]
    return {"success": True, "count": len(active_boms), "data": active_boms}


@router.get("/boms/{bom_id}")
async def get_bom_by_id(bom_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(bom_id)} if ObjectId.is_valid(bom_id) else {"_id": bom_id}
    doc = db["boms_entry"].find_one(q_filter) or db["boms"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="BOM Master record not found")
    return {"success": True, "data": serialize_mongo_doc(doc)}


@router.post("/boms")
@router.post("/boms/")
async def create_or_update_bom_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    comp_id = resolve_company_db_id(request, db)
    now_iso = datetime.now().isoformat()
    bom_name = str(payload.get("bomName") or payload.get("name") or "").strip()
    finished_item = str(payload.get("finishedItemName") or payload.get("stockItemName") or "").strip()
    finished_item_id = payload.get("finishedItemId")
    version = str(payload.get("version") or "v1").strip()
    basic_qty = parse_float(payload.get("basicQty") or payload.get("baseQuantity") or payload.get("outputQty"), 1.0)
    unit = str(payload.get("unit") or payload.get("baseUnit") or payload.get("outputUnit") or "Pcs").strip()
    unit_id = payload.get("baseUnitId")
    prod_godown_id = payload.get("defaultProductionGodownId")
    prod_godown_name = str(payload.get("defaultProductionGodownName") or payload.get("defaultProductionGodown") or "").strip()

    items = payload.get("items") or payload.get("components") or []

    if not bom_name:
        raise HTTPException(status_code=400, detail="BOM Name is required")
    if not finished_item:
        raise HTTPException(status_code=400, detail="Target Finished Stock Item is required")
    if basic_qty <= 0:
        raise HTTPException(status_code=400, detail="Base Production Quantity must be greater than 0")
    if not items or len(items) == 0:
        raise HTTPException(status_code=400, detail="At least one component item is required in the BOM")

    record_id = payload.get("_id") or payload.get("id")

    # Case-insensitive duplicate check for bomName + version per company
    dup_query = {
        "$or": [{"companyId": comp_id}, {"companyId": str(comp_id)}, {"tenantId": comp_id}, {"tenantId": str(comp_id)}],
        "bomName": {"$regex": f"^{re.escape(bom_name)}$", "$options": "i"},
        "version": {"$regex": f"^{re.escape(version)}$", "$options": "i"}
    }
    dups = list(db["boms_entry"].find(dup_query)) + list(db["boms"].find(dup_query))
    for dup in dups:
        e_id = str(dup.get("_id"))
        if record_id and str(record_id) == e_id:
            continue
        raise HTTPException(status_code=400, detail=f"BOM '{bom_name}' with version '{version}' already exists in this company")

    finished_lower = finished_item.lower()
    for comp in items:
        if isinstance(comp, dict):
            c_name = str(comp.get("stockItemName") or comp.get("itemName") or "").strip().lower()
            c_id = comp.get("itemId") or comp.get("id")
            if c_name == finished_lower or (finished_item_id and c_id and str(c_id) == str(finished_item_id)):
                raise HTTPException(
                    status_code=400,
                    detail=f"Finished Stock Item '{finished_item}' cannot be added as its own component!"
                )

    seen_components = set()
    formatted_components = []
    for comp in items:
        if isinstance(comp, dict):
            c_name = str(comp.get("stockItemName") or comp.get("itemName") or "").strip()
            if not c_name:
                continue
            c_lower = c_name.lower()
            if c_lower in seen_components:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate component item '{c_name}' is not allowed in the same BOM!"
                )
            seen_components.add(c_lower)

            c_qty = parse_float(comp.get("actualQty") or comp.get("qty") or comp.get("quantity"), 0.0)
            if c_qty <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Component quantity for '{c_name}' must be greater than 0"
                )

            formatted_components.append({
                "itemId": comp.get("itemId") or comp.get("id"),
                "itemName": c_name,
                "stockItemName": c_name,
                "quantity": c_qty,
                "actualQty": c_qty,
                "unitId": comp.get("unitId"),
                "unitName": str(comp.get("unitName") or comp.get("unit") or "Pcs").strip(),
                "unit": str(comp.get("unitName") or comp.get("unit") or "Pcs").strip(),
                "scrapPercentage": parse_float(comp.get("scrapPercentage") or comp.get("scrap") or 0.0, 0.0),
                "sourceGodownId": comp.get("sourceGodownId"),
                "sourceGodownName": str(comp.get("sourceGodownName") or comp.get("sourceGodown") or "").strip(),
                "notes": str(comp.get("notes") or "").strip()
            })

    is_active = bool(payload.get("isActive", True) if "isActive" in payload else str(payload.get("status", "ACTIVE")).upper() == "ACTIVE")
    status_str = "ACTIVE" if is_active else "INACTIVE"

    doc = {
        "companyId": comp_id,
        "tenantId": comp_id,
        "bomCode": payload.get("bomCode") or f"BOM-{(db['boms_entry'].count_documents({}) + 1):04d}",
        "bomName": bom_name,
        "name": bom_name,
        "version": version,
        "finishedItemId": finished_item_id,
        "finishedItemName": finished_item,
        "stockItemName": finished_item,
        "baseQuantity": basic_qty,
        "basicQty": basic_qty,
        "baseUnitId": unit_id,
        "baseUnit": unit,
        "unit": unit,
        "defaultProductionGodownId": prod_godown_id,
        "defaultProductionGodownName": prod_godown_name,
        "components": formatted_components,
        "items": formatted_components,
        "componentsCount": len(formatted_components),
        "effectiveFrom": payload.get("effectiveFrom") or None,
        "effectiveTo": payload.get("effectiveTo") or None,
        "description": str(payload.get("description") or payload.get("notes") or "").strip(),
        "status": status_str,
        "isActive": is_active,
        "isWebEntry": True,
        "isSynced": False,
        "sourceCollection": "boms_entry",
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 }
    }

    return save_or_update_doc(db, "boms_entry", "boms", doc, payload, "BOM Master")


@router.put("/boms/{record_id}")
async def update_bom_entry(record_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    payload["_id"] = record_id
    payload["id"] = record_id
    return await create_or_update_bom_entry(payload, request, db)


@router.patch("/boms/{record_id}/status")
async def toggle_bom_status(record_id: str, payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(record_id)} if ObjectId.is_valid(record_id) else {"_id": record_id}
    doc = db["boms_entry"].find_one(q_filter) or db["boms"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="BOM Master record not found")

    new_status = payload.get("status")
    if not new_status:
        current_status = str(doc.get("status") or "ACTIVE").upper()
        new_status = "INACTIVE" if current_status == "ACTIVE" else "ACTIVE"
    else:
        new_status = str(new_status).upper()

    col = doc.get("sourceCollection") or "boms_entry"
    db[col].update_one(q_filter, {"$set": {"status": new_status, "isActive": new_status == "ACTIVE", "auditInfo.updatedAt": datetime.now().isoformat()}})
    return {"success": True, "message": f"BOM status updated to '{new_status}'", "status": new_status}


@router.delete("/boms/{record_id}")
async def delete_bom_entry(record_id: str, request: Request, db=Depends(get_db)):
    q_filter = {"_id": ObjectId(record_id)} if ObjectId.is_valid(record_id) else {"_id": record_id}
    doc = db["boms_entry"].find_one(q_filter) or db["boms"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="BOM Master record not found")

    b_name = doc.get("bomName") or doc.get("name")

    # Check if BOM is used in manufacturing / production vouchers
    ref_query = {
        "$or": [
            {"bomName": b_name},
            {"bomId": record_id},
            {"bomId": str(record_id)}
        ]
    }
    used_voucher = db["sales_vouchers"].find_one(ref_query) or db["vouchers"].find_one(ref_query)
    if used_voucher:
        # Prevent hard deletion; set to INACTIVE
        col = doc.get("sourceCollection") or "boms_entry"
        db[col].update_one(q_filter, {"$set": {"status": "INACTIVE", "isActive": False, "auditInfo.updatedAt": datetime.now().isoformat()}})
        raise HTTPException(
            status_code=400,
            detail=f"BOM '{b_name}' has been used in production transactions and cannot be deleted. Its status has been set to INACTIVE instead."
        )

    col = doc.get("sourceCollection") or "boms_entry"
    db[col].delete_one(q_filter)
    return {"success": True, "message": f"BOM '{b_name}' deleted successfully"}


# ─────────────── 6C. TDS MASTER ENTRY — tds_entry ───────────────
@router.post("/tds")
@router.post("/tds/")
async def create_or_update_tds_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    comp_id = resolve_company_db_id(request, db)
    now_iso = datetime.now().isoformat()
    tds_name = str(payload.get("tdsName") or payload.get("name") or "").strip()
    section_code = str(payload.get("sectionCode") or payload.get("section") or "").strip()

    if not tds_name:
        raise HTTPException(status_code=400, detail="TDS Name / Nature is required")
    if not section_code:
        raise HTTPException(status_code=400, detail="TDS Section Code is required")

    rate = parse_float(payload.get("applicableRate") or payload.get("rate"), 0.0)
    threshold = parse_float(payload.get("thresholdLimit") or payload.get("threshold"), 0.0)
    deductee_types = payload.get("deducteeTypes") or ["Company Resident", "Individual/HUF"]

    doc = {
        "companyId": comp_id,
        "isWebEntry": True,
        "sourceCollection": "tds_entry",
        "tdsName": tds_name,
        "name": tds_name,
        "sectionCode": section_code,
        "section": section_code,
        "deducteeTypes": deductee_types if isinstance(deductee_types, list) else [str(deductee_types)],
        "applicableRate": rate,
        "rate": rate,
        "thresholdLimit": threshold,
        "threshold": threshold,
        "effectiveFrom": payload.get("effectiveFrom") or now_iso[:10],
        "effectiveTo": payload.get("effectiveTo") or None,
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 },
        "status": (payload.get("status") or "ACTIVE").upper()
    }

    return save_or_update_doc(db, "tds_entry", "tdsMasters", doc, payload, "TDS Master")


# ─────────────── 6D. TCS MASTER ENTRY — tcs_entry ───────────────
@router.post("/tcs")
@router.post("/tcs/")
async def create_or_update_tcs_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    comp_id = resolve_company_db_id(request, db)
    now_iso = datetime.now().isoformat()
    tcs_name = str(payload.get("tcsName") or payload.get("name") or "").strip()
    section_code = str(payload.get("sectionCode") or payload.get("section") or "").strip()

    if not tcs_name:
        raise HTTPException(status_code=400, detail="TCS Name / Nature is required")
    if not section_code:
        raise HTTPException(status_code=400, detail="TCS Section Code is required")

    rate = parse_float(payload.get("applicableRate") or payload.get("rate"), 0.0)
    threshold = parse_float(payload.get("thresholdLimit") or payload.get("threshold"), 0.0)
    buyer_types = payload.get("buyerTypes") or ["Company Resident", "Resident Buyer"]

    doc = {
        "companyId": comp_id,
        "isWebEntry": True,
        "sourceCollection": "tcs_entry",
        "tcsName": tcs_name,
        "name": tcs_name,
        "sectionCode": section_code,
        "section": section_code,
        "buyerTypes": buyer_types if isinstance(buyer_types, list) else [str(buyer_types)],
        "applicableRate": rate,
        "rate": rate,
        "thresholdLimit": threshold,
        "threshold": threshold,
        "effectiveFrom": payload.get("effectiveFrom") or now_iso[:10],
        "effectiveTo": payload.get("effectiveTo") or None,
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 },
        "status": (payload.get("status") or "ACTIVE").upper()
    }

    return save_or_update_doc(db, "tcs_entry", "tcsMasters", doc, payload, "TCS Master")


# ─────────────── 6E. DYNAMIC STATUTORY TDS RESOLUTION ───────────────
@router.get("/tds/resolve")
@router.get("/tds/resolve/")
async def resolve_tds_statutory_rule(
    masterId: str = None,
    sectionCode: str = None,
    date: str = None,
    deducteeType: str = None,
    hasPan: bool = True,
    db=Depends(get_db)
):
    query_date = date or datetime.now().strftime("%Y-%m-%d")
    tds_doc = None

    if masterId:
        tds_doc = db["system_tds_masters"].find_one({"_id": masterId})
        if not tds_doc:
            tds_doc = db["tds_entry"].find_one({"_id": masterId})
        if not tds_doc and ObjectId.is_valid(masterId):
            tds_doc = db["tds_entry"].find_one({"_id": ObjectId(masterId)})
    if not tds_doc and sectionCode:
        tds_doc = db["system_tds_masters"].find_one({"sectionCode": sectionCode})
        if not tds_doc:
            tds_doc = db["tds_entry"].find_one({"sectionCode": sectionCode})

    if not tds_doc:
        raise HTTPException(status_code=404, detail="TDS Master record not found")

    eff_from = tds_doc.get("effectiveFrom") or "2000-01-01"
    eff_to = tds_doc.get("effectiveTo") or "2099-12-31"

    if not (eff_from <= query_date <= eff_to):
        raise HTTPException(
            status_code=400,
            detail=f"TDS Section '{tds_doc.get('sectionCode')}' is not effective on date {query_date} (Validity: {eff_from} to {eff_to})"
        )

    rates_by_type = tds_doc.get("ratesByDeducteeType") or {}
    base_rate = parse_float(tds_doc.get("applicableRate") or tds_doc.get("rate"), 0.0)

    resolved_rate = base_rate
    if deducteeType and deducteeType in rates_by_type:
        resolved_rate = parse_float(rates_by_type[deducteeType], base_rate)
    elif "default" in rates_by_type:
        resolved_rate = parse_float(rates_by_type["default"], base_rate)

    pan_penalty_applied = False
    if not hasPan:
        pan_rules = tds_doc.get("defaultPanRules") or {}
        without_pan_rate = parse_float(pan_rules.get("withoutPanRate"), 20.0)
        if without_pan_rate > resolved_rate:
            resolved_rate = without_pan_rate
            pan_penalty_applied = True

    return {
        "success": True,
        "masterId": str(tds_doc.get("_id")),
        "tdsName": tds_doc.get("tdsName") or tds_doc.get("name"),
        "sectionCode": tds_doc.get("sectionCode") or tds_doc.get("section"),
        "legacySectionCode": tds_doc.get("legacySectionCode") or tds_doc.get("sectionCode"),
        "statutorySectionMapping": tds_doc.get("statutorySectionMapping") or f"Section {tds_doc.get('sectionCode')} IT Act",
        "deducteeType": deducteeType or (tds_doc.get("deducteeTypes") or ["Company Resident"])[0],
        "resolvedRate": resolved_rate,
        "thresholdLimit": parse_float(tds_doc.get("thresholdLimit") or tds_doc.get("threshold"), 0.0),
        "hasPan": hasPan,
        "panPenaltyApplied": pan_penalty_applied,
        "effectiveFrom": eff_from,
        "effectiveTo": eff_to,
        "isSystemPredefined": tds_doc.get("isSystemPredefined", False)
    }


# ─────────────── 6F. DYNAMIC STATUTORY TCS RESOLUTION ───────────────
@router.get("/tcs/resolve")
@router.get("/tcs/resolve/")
async def resolve_tcs_statutory_rule(
    masterId: str = None,
    sectionCode: str = None,
    date: str = None,
    buyerType: str = None,
    hasPan: bool = True,
    db=Depends(get_db)
):
    query_date = date or datetime.now().strftime("%Y-%m-%d")
    tcs_doc = None

    if masterId:
        tcs_doc = db["system_tcs_masters"].find_one({"_id": masterId})
        if not tcs_doc:
            tcs_doc = db["tcs_entry"].find_one({"_id": masterId})
        if not tcs_doc and ObjectId.is_valid(masterId):
            tcs_doc = db["tcs_entry"].find_one({"_id": ObjectId(masterId)})
    if not tcs_doc and sectionCode:
        tcs_doc = db["system_tcs_masters"].find_one({"sectionCode": sectionCode})
        if not tcs_doc:
            tcs_doc = db["tcs_entry"].find_one({"sectionCode": sectionCode})

    if not tcs_doc:
        raise HTTPException(status_code=404, detail="TCS Master record not found")

    eff_from = tcs_doc.get("effectiveFrom") or "2000-01-01"
    eff_to = tcs_doc.get("effectiveTo") or "2099-12-31"

    if not (eff_from <= query_date <= eff_to):
        raise HTTPException(
            status_code=400,
            detail=f"TCS Section '{tcs_doc.get('sectionCode')}' is not effective on date {query_date} (Validity: {eff_from} to {eff_to})"
        )

    rates_by_type = tcs_doc.get("ratesByBuyerType") or {}
    base_rate = parse_float(tcs_doc.get("applicableRate") or tcs_doc.get("rate"), 0.0)

    resolved_rate = base_rate
    if buyerType and buyerType in rates_by_type:
        resolved_rate = parse_float(rates_by_type[buyerType], base_rate)
    elif "default" in rates_by_type:
        resolved_rate = parse_float(rates_by_type["default"], base_rate)

    pan_penalty_applied = False
    if not hasPan:
        pan_rules = tcs_doc.get("defaultPanRules") or {}
        without_pan_rate = parse_float(pan_rules.get("withoutPanRate"), 5.0)
        if without_pan_rate > resolved_rate:
            resolved_rate = without_pan_rate
            pan_penalty_applied = True

    return {
        "success": True,
        "masterId": str(tcs_doc.get("_id")),
        "tcsName": tcs_doc.get("tcsName") or tcs_doc.get("name"),
        "sectionCode": tcs_doc.get("sectionCode") or tcs_doc.get("section"),
        "legacySectionCode": tcs_doc.get("legacySectionCode") or tcs_doc.get("sectionCode"),
        "statutorySectionMapping": tcs_doc.get("statutorySectionMapping") or f"Section {tcs_doc.get('sectionCode')} IT Act",
        "buyerType": buyerType or (tcs_doc.get("buyerTypes") or ["Company Resident"])[0],
        "resolvedRate": resolved_rate,
        "thresholdLimit": parse_float(tcs_doc.get("thresholdLimit") or tcs_doc.get("threshold"), 0.0),
        "hasPan": hasPan,
        "panPenaltyApplied": pan_penalty_applied,
        "effectiveFrom": eff_from,
        "effectiveTo": eff_to,
        "isSystemPredefined": tcs_doc.get("isSystemPredefined", False)
    }


# ─────────────── 7. PUSH MASTER ENTRY TO TALLY ───────────────

@router.post("/push-to-tally")
@router.post("/push-to-tally/")
async def push_master_to_tally(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    collection_name = payload.get("collectionName") or "ledgers_entry"
    doc_id = payload.get("id") or payload.get("_id")
    master_name = payload.get("name") or "Master Item"

    if not doc_id:
        raise HTTPException(status_code=400, detail="Master document ID is required")

    try:
        query_filter = {"_id": ObjectId(doc_id)} if len(str(doc_id)) == 24 and re.match(r"^[0-9a-fA-F]{24}$", str(doc_id)) else {"_id": doc_id}
    except Exception:
        query_filter = {"_id": doc_id}

    now_iso = datetime.now().isoformat()
    update_data = {
        "status": "PUSHED_TO_TALLY",
        "tallyStatus": "Pushed",
        "isSynced": True,
        "pushedToTallyAt": now_iso,
        "updatedAt": now_iso
    }

    # Generate XML if pushing a ledger or stock item and save to tallyPayloads
    if "ledger" in collection_name:
        ledger_doc = db[collection_name].find_one(query_filter)
        if not ledger_doc and master_name:
            ledger_doc = db[collection_name].find_one({"ledgerName": master_name})
        
        if ledger_doc:
            from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
            try:
                xml_str = TallyXmlGenerator.generate_ledger_xml(ledger_doc)
                update_data["tallyPayloads"] = {
                    "xml": xml_str,
                    "generatedAt": now_iso
                }
            except Exception as e:
                print(f"Error generating ledger XML on push: {e}")

    elif "stock" in collection_name or "item" in collection_name:
        stock_doc = db[collection_name].find_one(query_filter)
        if not stock_doc and master_name:
            stock_doc = db[collection_name].find_one({"itemName": master_name}) or db[collection_name].find_one({"name": master_name})
        
        if stock_doc:
            from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
            try:
                xml_str = TallyXmlGenerator.generate_stock_item_xml(stock_doc)
                update_data["tallyPayloads"] = {
                    "xml": xml_str,
                    "generatedAt": now_iso
                }
            except Exception as e:
                print(f"Error generating stock item XML on push: {e}")

    elif "unit" in collection_name:
        unit_doc = db[collection_name].find_one(query_filter)
        if not unit_doc and master_name:
            unit_doc = db[collection_name].find_one({"symbol": master_name}) or db[collection_name].find_one({"unitName": master_name})
        
        if unit_doc:
            from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
            try:
                xml_str = TallyXmlGenerator.generate_unit_xml(unit_doc)
                update_data["tallyPayloads"] = {
                    "xml": xml_str,
                    "generatedAt": now_iso
                }
            except Exception as e:
                print(f"Error generating unit XML on push: {e}")

    elif "stockgroup" in collection_name or "stock_group" in collection_name:
        sg_doc = db[collection_name].find_one(query_filter)
        if not sg_doc and master_name:
            sg_doc = db[collection_name].find_one({"groupName": master_name}) or db[collection_name].find_one({"name": master_name})
        
        if sg_doc:
            from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
            try:
                xml_str = TallyXmlGenerator.generate_stock_group_xml(sg_doc)
                update_data["tallyPayloads"] = {
                    "xml": xml_str,
                    "generatedAt": now_iso
                }
            except Exception as e:
                print(f"Error generating stock group XML on push: {e}")

    elif "godown" in collection_name:
        g_doc = db[collection_name].find_one(query_filter)
        if not g_doc and master_name:
            g_doc = db[collection_name].find_one({"godownName": master_name}) or db[collection_name].find_one({"name": master_name})
        
        if g_doc:
            from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
            try:
                xml_str = TallyXmlGenerator.generate_godown_xml(g_doc)
                update_data["tallyPayloads"] = {
                    "xml": xml_str,
                    "generatedAt": now_iso
                }
            except Exception as e:
                print(f"Error generating godown XML on push: {e}")

    elif "vouchertype" in collection_name or "voucher_type" in collection_name or "vchtype" in collection_name:
        vt_doc = db[collection_name].find_one(query_filter)
        if not vt_doc and master_name:
            vt_doc = db[collection_name].find_one({"voucherTypeName": master_name}) or db[collection_name].find_one({"name": master_name})
        
        if vt_doc:
            from app.anjalee.services.tally.xml_generator import TallyXmlGenerator
            try:
                xml_str = TallyXmlGenerator.generate_voucher_type_xml(vt_doc)
                update_data["tallyPayloads"] = {
                    "xml": xml_str,
                    "generatedAt": now_iso
                }
            except Exception as e:
                print(f"Error generating voucher type XML on push: {e}")


    res = db[collection_name].update_one(query_filter, {"$set": update_data})

    if res.matched_count == 0 and master_name:
        name_key = "ledgerName" if "ledger" in collection_name else ("itemName" if "stockitem" in collection_name else ("unitName" if "unit" in collection_name else ("groupName" if "group" in collection_name else "costCenterName")))
        db[collection_name].update_one({name_key: master_name}, {"$set": update_data})

    return {
        "success": True,
        "message": f"Master '{master_name}' pushed to Tally successfully!",
        "data": {
            "id": str(doc_id),
            "collectionName": collection_name,
            "status": "PUSHED_TO_TALLY",
            "pushedAt": now_iso
        }
    }


# ─────────────── 8. DELETE MASTER WEB ENTRY ───────────────
@router.delete("/entry")
@router.delete("/entry/")
async def delete_master_entry(collectionName: str, id: str, request: Request, db=Depends(get_db)):
    if not collectionName or not id:
        raise HTTPException(status_code=400, detail="collectionName and id are required")

    try:
        query_filter = {"_id": ObjectId(id)} if len(str(id)) == 24 and re.match(r"^[0-9a-fA-F]{24}$", str(id)) else {"_id": id}
    except Exception:
        query_filter = {"_id": id}

    res = db[collectionName].delete_one(query_filter)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Master document not found in collection")

    return {
        "success": True,
        "message": f"Document '{id}' deleted from collection '{collectionName}' successfully!"
    }


# ─────────────── 9. GENERATE MASTER TALLY XML ───────────────
@router.get("/tally-xml")
@router.get("/tally-xml/")
@router.post("/tally-xml")
@router.post("/tally-xml/")
async def generate_master_tally_xml(payload: Dict[str, Any] = None, collectionName: str = None, id: str = None, request: Request = None, db=Depends(get_db)):
    if payload:
        collection_name = payload.get("collectionName") or collectionName or "ledgers_entry"
        doc_id = payload.get("id") or payload.get("_id") or id
    else:
        collection_name = collectionName or "ledgers_entry"
        doc_id = id

    if not doc_id:
        raise HTTPException(status_code=400, detail="Master document ID is required")

    try:
        query_filter = {"_id": ObjectId(doc_id)} if len(str(doc_id)) == 24 and re.match(r"^[0-9a-fA-F]{24}$", str(doc_id)) else {"_id": doc_id}
    except Exception:
        query_filter = {"_id": doc_id}

    master_doc = db[collection_name].find_one(query_filter)
    if not master_doc:
        master_name = payload.get("name") if payload else None
        if master_name:
            name_key = "ledgerName" if "ledger" in collection_name else ("itemName" if "stockitem" in collection_name else ("unitName" if "unit" in collection_name else ("groupName" if "group" in collection_name else "costCenterName")))
            master_doc = db[collection_name].find_one({name_key: master_name})

    if not master_doc:
        raise HTTPException(status_code=404, detail=f"Master document not found for ID '{doc_id}' in '{collection_name}'")

    from app.anjalee.services.tally.xml_generator import TallyXmlGenerator, escape_xml
    col = collection_name.lower()

    def resolve_parent_name(doc: dict, target_col: str, default: str = "Primary") -> str:
        p_name = doc.get("parentGroupName") or doc.get("parentCategoryName") or doc.get("parentName")
        if p_name and isinstance(p_name, str) and not re.match(r"^[0-9a-fA-F]{24}$", p_name):
            return p_name
        
        raw_p = doc.get("parentGroup") or doc.get("parentCategory") or doc.get("parentId")
        if raw_p:
            if isinstance(raw_p, str) and not re.match(r"^[0-9a-fA-F]{24}$", raw_p):
                return raw_p
            try:
                p_id = ObjectId(raw_p) if len(str(raw_p)) == 24 else raw_p
                p_doc = db[target_col].find_one({"_id": p_id}) or db[target_col.replace("_entry", "")].find_one({"_id": p_id})
                if p_doc:
                    return p_doc.get("groupName") or p_doc.get("categoryName") or p_doc.get("name") or default
            except Exception:
                pass

        return default

    if "stockitem" in col or "stock_item" in col or "item" in col:
        try:
            xml_str = TallyXmlGenerator.generate_stock_item_xml(master_doc, db=db)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        m_name = master_doc.get("itemName") or master_doc.get("name") or "StockItem"
    elif "ledger" in col and "group" not in col:
        xml_str = TallyXmlGenerator.generate_ledger_xml(master_doc)
        m_name = master_doc.get("ledgerName") or master_doc.get("name") or "Ledger"
    elif "stockgroup" in col or ("stock" in col and "group" in col):
        xml_str = TallyXmlGenerator.generate_stock_group_xml(master_doc)
        m_name = master_doc.get("groupName") or master_doc.get("name") or "Stock Group"
    elif "stockcategor" in col or ("stock" in col and "categor" in col):
        xml_str = TallyXmlGenerator.generate_stock_category_xml(master_doc)
        m_name = master_doc.get("stockCategoryName") or master_doc.get("categoryName") or master_doc.get("name") or "Stock Category"
    elif "unit" in col:
        xml_str = TallyXmlGenerator.generate_unit_xml(master_doc)
        m_name = master_doc.get("symbol") or master_doc.get("unitName") or master_doc.get("name") or "Unit"
    elif "godown" in col:
        xml_str = TallyXmlGenerator.generate_godown_xml(master_doc)
        m_name = master_doc.get("godownName") or master_doc.get("name") or "Godown"

    elif "cost" in col and "center" in col:
        ccname = master_doc.get("costCenterName") or master_doc.get("name") or "Cost Center"
        cat = master_doc.get("costCategoryId") or master_doc.get("costCategoryName") or "Primary Cost Category"
        parent = resolve_parent_name(master_doc, "costcenters_entry", "")
        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER><VERSION>1</VERSION><TALLYREQUEST>IMPORT</TALLYREQUEST><TYPE>DATA</TYPE><ID>All Masters</ID></HEADER>',
            '  <BODY><DESC><STATICVARIABLES /></DESC><DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'    <COSTCENTRE NAME="{escape_xml(ccname)}" ACTION="Create">',
            f'      <CATEGORY>{escape_xml(cat)}</CATEGORY>',
        ]
        if parent and parent != "Primary / None" and parent != "Primary":
            lines.append(f'      <PARENT>{escape_xml(parent)}</PARENT>')
        lines.extend([
            '    </COSTCENTRE>',
            '  </TALLYMESSAGE></DATA></BODY>',
            '</ENVELOPE>'
        ])
        xml_str = "\n".join(lines)
        m_name = ccname
    elif "group" in col:
        xml_str = TallyXmlGenerator.generate_ledger_group_xml(master_doc)
        m_name = master_doc.get("groupName") or master_doc.get("name") or "Ledger Group"

    elif "bom" in col:
        xml_str = TallyXmlGenerator.generate_bom_xml(master_doc)
        m_name = master_doc.get("bomName") or master_doc.get("name") or "BOM Master"
    elif "vouchertype" in col or "voucher_type" in col or "vchtype" in col:
        xml_str = TallyXmlGenerator.generate_voucher_type_xml(master_doc)
        m_name = master_doc.get("voucherTypeName") or master_doc.get("name") or "VoucherType"
    elif "costcategory" in col or "cost_category" in col:
        xml_str = TallyXmlGenerator.generate_cost_category_xml(master_doc)
        m_name = master_doc.get("categoryName") or master_doc.get("costCategoryName") or master_doc.get("name") or "CostCategory"
    elif "costcentreclass" in col or "cost_centre_class" in col or "costclass" in col:
        xml_str = TallyXmlGenerator.generate_cost_centre_class_xml(master_doc)
        m_name = master_doc.get("className") or master_doc.get("name") or "CostCentreClass"
    elif "costcenter" in col or "cost_center" in col:
        xml_str = TallyXmlGenerator.generate_cost_center_xml(master_doc)
        m_name = master_doc.get("costCenterName") or master_doc.get("name") or "CostCenter"
    else:
        xml_str = TallyXmlGenerator.generate_ledger_xml(master_doc)
        m_name = master_doc.get("ledgerName") or master_doc.get("name") or "Master"

    clean_file_name = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', m_name)}_Tally.xml"
    return {
        "success": True,
        "xml": xml_str,
        "fileName": clean_file_name
    }


# ─────────────── 10. VOUCHER TYPE ENTRY — vouchertypes_entry & voucherTypes ───────────────

@router.get("/voucher-types")
@router.get("/voucher-types/")
async def get_voucher_types(request: Request, db=Depends(get_db)):
    search_fields = ["voucherTypeName", "name", "alias", "voucherTypeCode", "parent", "numberingMethod"]
    return fetch_and_paginate_master(db, "voucherTypes", "vouchertypes_entry", request, search_fields)


@router.get("/voucher-types/{vtype_id}")
async def get_voucher_type_by_id(vtype_id: str, request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    q_filter = {"_id": ObjectId(vtype_id)} if ObjectId.is_valid(vtype_id) else {"_id": vtype_id}

    doc = db["vouchertypes_entry"].find_one(q_filter) or db["voucherTypes"].find_one(q_filter) or db["vouchertypes"].find_one(q_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Voucher Type Master record not found")
    return {"success": True, "data": serialize_mongo_doc(doc)}


@router.post("/voucher-types")
@router.post("/voucher-types/")
async def create_voucher_type_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    vname = (payload.get("voucherTypeName") or payload.get("name") or "").strip()
    if not vname:
        raise HTTPException(status_code=400, detail="Voucher Type Name is required")

    record_id = payload.get("_id") or payload.get("id")

    # Tenant-isolated case-insensitive uniqueness check for Voucher Type Name
    dup_query = {
        "$or": [{"companyId": company_db_id}, {"companyId": str(company_db_id)}, {"tenantId": company_db_id}, {"tenantId": str(company_db_id)}],
        "$or": [
            {"voucherTypeName": {"$regex": f"^{re.escape(vname)}$", "$options": "i"}},
            {"name": {"$regex": f"^{re.escape(vname)}$", "$options": "i"}}
        ]
    }

    existing_list = list(db["vouchertypes_entry"].find(dup_query)) + list(db["voucherTypes"].find(dup_query))
    for existing_dup in existing_list:
        e_id = str(existing_dup.get("_id"))
        if record_id and str(record_id) == e_id:
            continue
        raise HTTPException(status_code=400, detail=f"Voucher Type '{vname}' already exists (case-insensitive check)")

    parent_vtype = (payload.get("parent") or payload.get("parentGroup") or payload.get("parentVoucherType") or "Sales").strip()
    category = (payload.get("voucherCategory") or parent_vtype).upper().strip()
    status_str = str(payload.get("status") or "ACTIVE").upper().strip()

    now_iso = datetime.now().isoformat()
    doc = {
        "companyId": company_db_id,
        "tenantId": company_db_id,
        "voucherTypeName": vname,
        "name": vname,
        "voucherTypeCode": (payload.get("voucherTypeCode") or f"VCH-{vname[:3].upper()}").strip(),
        "abbreviation": (payload.get("abbreviation") or payload.get("mailingName") or vname).strip(),
        "parent": parent_vtype,
        "parentGroup": parent_vtype,
        "parentVoucherType": parent_vtype,
        "voucherCategory": category,
        "status": status_str,

        "behavior": payload.get("behavior", {}),
        "flags": payload.get("flags", {}),

        "numberingMethod": payload.get("numberingMethod", "Automatic"),
        "startingNumber": payload.get("startingNumber", 1),
        "beginningNumber": payload.get("beginningNumber", 1),
        "numberWidth": payload.get("numberWidth", 4),
        "widthOfNumber": payload.get("widthOfNumber", 4),
        "prefix": payload.get("prefix", ""),
        "suffix": payload.get("suffix", ""),
        "numbering": payload.get("numbering", {}),

        "defaultPrintTitle": payload.get("defaultPrintTitle", "TAX INVOICE"),
        "printing": payload.get("printing", {}),
        "enablePOS": bool(payload.get("enablePOS")),
        "enableCostCentre": bool(payload.get("enableCostCentre")),
        "enableBillWise": bool(payload.get("enableBillWise")),
        "enableNarration": bool(payload.get("enableNarration")),
        "voucherClass": payload.get("voucherClass", {}),

        "isWebEntry": True,
        "isSynced": False,
        "sourceCollection": "vouchertypes_entry",
        "auditInfo": {
            "createdAt": now_iso,
            "updatedAt": now_iso
        }
    }

    res = save_or_update_doc(db, "vouchertypes_entry", "voucherTypes", doc, payload, "Voucher Type Master")
    return res


@router.put("/voucher-types/{record_id}")
@router.put("/generic/{collection_name}/{record_id}")
async def update_generic_master_entry(record_id: str, payload: Dict[str, Any], request: Request, collection_name: str = "vouchertypes_entry", db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)
    payload["_id"] = record_id
    payload["id"] = record_id
    target_col = collection_name if collection_name else "vouchertypes_entry"
    payload["sourceCollection"] = target_col
    res = save_or_update_doc(db, target_col, target_col.replace("_entry", ""), payload, payload, f"Master entry in '{target_col}'")
    return res


