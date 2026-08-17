from fastapi import APIRouter, Depends, Request, HTTPException
from typing import Dict, Any, Optional
import uuid
import re
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
    return comp_doc["_id"] if comp_doc else (ObjectId(company_header) if company_header and len(company_header) == 24 and re.match(r"^[0-9a-fA-F]{24}$", company_header) else ObjectId())


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
@router.post("/stock-items")
@router.post("/stock-items/")
async def create_stock_item_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    item_name = payload.get("itemName") or payload.get("name") or "New Stock Item"
    group_name = payload.get("stockGroupName") or payload.get("stockGroup") or payload.get("group") or "Primary"
    category_name = payload.get("stockCategoryName") or payload.get("stockCategory") or "Primary"
    
    unit_val = payload.get("uom") or payload.get("unit") or "Nos"
    base_unit_str = unit_val if isinstance(unit_val, str) else (unit_val.get("baseUnit") or "Nos")

    next_num = db["stockitems_entry"].count_documents({}) + 1
    item_code = payload.get("itemCode") or f"ITEM{next_num:06d}"

    sg_doc = db["stockGroups"].find_one({"groupName": group_name}) or db["stockgroups_entry"].find_one({"groupName": group_name})
    sg_id = sg_doc["_id"] if sg_doc else None
    sg_path = sg_doc.get("groupPath") if sg_doc else f"Primary > {group_name}"

    sc_doc = db["stockCategories"].find_one({"categoryName": category_name}) or db["stockcategories_entry"].find_one({"categoryName": category_name})
    sc_id = sc_doc["_id"] if sc_doc else None

    now = datetime.now()
    now_iso = now.isoformat()

    hsn_code = payload.get("hsnCode") if "hsnCode" in payload and payload["hsnCode"] is not None else (payload.get("hsn", "") if "hsn" in payload and payload["hsn"] is not None else "")
    
    # Safe gst_rate conversion
    gst_val = payload.get("gstRate") or payload.get("gst")
    if isinstance(gst_val, dict):
        gst_val = gst_val.get("gstRate") or gst_val.get("igstRate")
    gst_rate = parse_float(gst_val, 18.0)

    unit_obj = payload.get("unit") or {}
    if not isinstance(unit_obj, dict):
        unit_obj = {}
    
    base_unit_str = unit_obj.get("baseUnit") if "baseUnit" in unit_obj and unit_obj["baseUnit"] is not None else (payload.get("baseUnit") if "baseUnit" in payload and payload["baseUnit"] is not None else base_unit_str)
    alt_unit_str = unit_obj.get("alternateUnit") if "alternateUnit" in unit_obj and unit_obj["alternateUnit"] is not None else payload.get("alternateUnit", "Not Applicable")
    conv_factor = parse_float(unit_obj.get("conversionFactor") or payload.get("conversionFactor"), 1.0)

    gst_settings = payload.get("gstSettings") or {}
    if not isinstance(gst_settings, dict):
        gst_settings = {}

    hsn_sac = payload.get("hsnSacDetails") or {}
    if not isinstance(hsn_sac, dict):
        hsn_sac = {}

    pricing_obj = payload.get("pricing") or {}
    if not isinstance(pricing_obj, dict):
        pricing_obj = {}

    inv_obj = payload.get("inventory") or {}
    if not isinstance(inv_obj, dict):
        inv_obj = {}
    op_stock = inv_obj.get("openingStock") or {}
    if not isinstance(op_stock, dict):
        op_stock = {}

    op_qty = parse_float(payload.get("openingQty") or payload.get("openingQuantity") or op_stock.get("qty") or op_stock.get("quantity"), 0.0)
    op_rate = parse_float(payload.get("purchasePrice") or payload.get("openingRate") or op_stock.get("rate"), 0.0)
    op_val = parse_float(payload.get("openingValue") or op_stock.get("value") or op_stock.get("amount"), (op_qty * op_rate))

    hsn_val = hsn_sac.get("hsnCode") if "hsnCode" in hsn_sac and hsn_sac["hsnCode"] is not None else (payload.get("hsnCode") if "hsnCode" in payload and payload["hsnCode"] is not None else (payload.get("hsn") if "hsn" in payload and payload["hsn"] is not None else ""))

    # 1. Basic Info
    basic_info = payload.get("basicInfo") or {}
    if not isinstance(basic_info, dict):
        basic_info = {}
        
    basic_info_doc = {
        "description": basic_info.get("description") or payload.get("description") or "",
        "manufacturer": basic_info.get("manufacturer") or payload.get("manufacturer") or "",
        "modelNumber": basic_info.get("modelNumber") or payload.get("modelNumber") or "",
        "partNumber": basic_info.get("partNumber") or payload.get("partNumber") or "",
        "barcode": basic_info.get("barcode") or payload.get("barcode") or "",
        "remarks": basic_info.get("remarks") or payload.get("remarks") or ""
    }

    # 2. Unit Object
    unit_doc = {
        "baseUnit": base_unit_str,
        "alternateUnit": alt_unit_str,
        "conversionFactor": conv_factor,
        "vatBaseUnit": unit_obj.get("vatBaseUnit") if "vatBaseUnit" in unit_obj else payload.get("vatBaseUnit", ""),
        "baseUnitSymbol": unit_obj.get("baseUnitSymbol") or payload.get("baseUnitSymbol") or "",
        "alternateUnitSymbol": unit_obj.get("alternateUnitSymbol") or payload.get("alternateUnitSymbol") or "",
        "decimalPlaces": int(unit_obj.get("decimalPlaces") if "decimalPlaces" in unit_obj else payload.get("decimalPlaces", 2)),
        "isSimpleUnit": bool(unit_obj.get("isSimpleUnit", payload.get("isSimpleUnit", True))),
        "isCompoundUnit": bool(unit_obj.get("isCompoundUnit", payload.get("isCompoundUnit", False)))
    }

    # 3. Inventory Object
    as_of_date = op_stock.get("asOfDate") or payload.get("openingStockDate") or payload.get("asOfDate") or now.strftime("%Y-%m-%d")
    inventory_doc = {
        "openingStock": {
            "qty": op_qty,
            "rate": op_rate,
            "amount": op_val,
            "asOfDate": as_of_date
        },
        "negativeStockAllowed": inv_obj.get("negativeStockAllowed", payload.get("negativeStockAllowed", True)),
        "reorderLevel": parse_float(inv_obj.get("reorderLevel") or payload.get("reorderLevel"), 0.0),
        "reorderQuantity": parse_float(inv_obj.get("reorderQuantity") or payload.get("reorderQuantity"), 0.0),
        "minimumStockLevel": parse_float(inv_obj.get("minimumStockLevel") or payload.get("minimumStockLevel"), 0.0),
        "maximumStockLevel": parse_float(inv_obj.get("maximumStockLevel") or payload.get("maximumStockLevel"), 0.0)
    }

    # 4. Pricing Object
    std_cost = parse_float(pricing_obj.get("standardCost") or payload.get("standardCost"), 0.0)
    std_price = parse_float(pricing_obj.get("standardSellingPrice") or payload.get("standardSellingPrice"), 0.0)
    price_eff_from = pricing_obj.get("priceEffectiveFrom") or payload.get("priceEffectiveFrom") or now.strftime("%Y-%m-%d")
    price_hist = pricing_obj.get("priceHistory") or payload.get("priceHistory") or []
    pricing_hist = pricing_obj.get("pricingHistory") or payload.get("pricingHistory") or []

    pricing_doc = {
        "costingMethod": pricing_obj.get("costingMethod") or payload.get("costingMethod") or "FIFO",
        "valuationMethod": pricing_obj.get("valuationMethod") or payload.get("valuationMethod") or "At Actual Cost",
        "mrp": parse_float(payload.get("mrp") or (pricing_obj.get("MRP", {}).get("rates", [{}])[0].get("mrpRate") if isinstance(pricing_obj.get("MRP"), dict) else 0.0), 0.0),
        "purchasePrice": parse_float(payload.get("purchasePrice"), op_rate),
        "salesPrice": parse_float(payload.get("salesPrice"), 0.0),
        "standardCost": std_cost,
        "standardSellingPrice": std_price,
        "priceEffectiveFrom": price_eff_from,
        "priceHistory": price_hist,
        "pricingHistory": pricing_hist,
        "brand": payload.get("brand") or "",
        "MRP": {
            "fromDate": (pricing_obj.get("MRP", {}).get("fromDate") if isinstance(pricing_obj.get("MRP"), dict) else None) or payload.get("mrpFromDate") or now.strftime("%Y-%m-%d"),
            "totalVerCount": (pricing_obj.get("MRP", {}).get("totalVerCount") if isinstance(pricing_obj.get("MRP"), dict) else None) or payload.get("mrpTotalVerCount") or 1,
            "verCount": (pricing_obj.get("MRP", {}).get("verCount") if isinstance(pricing_obj.get("MRP"), dict) else None) or payload.get("mrpVerCount") or 1,
            "rates": payload.get("mrpRates") or (pricing_obj.get("MRP", {}).get("rates") if isinstance(pricing_obj.get("MRP"), dict) and isinstance(pricing_obj.get("MRP").get("rates"), list) else [])
        }
    }

    # 5. GST Settings
    gst_settings_doc = {
        "applicableFrom": gst_settings.get("applicableFrom") or payload.get("gstApplicableFrom") or now.strftime("%Y-%m-%d"),
        "taxability": gst_settings.get("taxability") or payload.get("taxability") or "Taxable",
        "gstRate": gst_rate,
        "cgstRate": gst_rate / 2.0,
        "sgstRate": gst_rate / 2.0,
        "igstRate": gst_rate,
        "cessRate": parse_float(gst_settings.get("cessRate") or payload.get("cessRate"), 0.0),
        "stateCessRate": parse_float(gst_settings.get("stateCessRate") or payload.get("stateCessRate"), 0.0),
        "sourceOfGstDetails": gst_settings.get("sourceOfGstDetails") or payload.get("sourceOfGstDetails") or "Specified in Stock Item",
        "reverseChargeApplicable": bool(gst_settings.get("reverseChargeApplicable", payload.get("reverseChargeApplicable", False)))
    }

    # 6. HSN Details
    hsn_sac_doc = {
        "hsnCode": hsn_val,
        "applicableFrom": hsn_sac.get("applicableFrom") or now.strftime("%Y-%m-%d"),
        "hsn": hsn_val,
        "hsnClassificationName": hsn_sac.get("hsnClassificationName") if "hsnClassificationName" in hsn_sac else payload.get("hsnClassificationName", ""),
        "srcOfHsnDetails": hsn_sac.get("srcOfHsnDetails") or "Specified in Stock Item",
        "description": hsn_sac.get("description") or payload.get("hsnDescription") or ""
    }

    # 7. Tracking
    tracking_doc = {
        "trackBatches": bool(payload.get("trackBatches", False)),
        "trackExpiry": bool(payload.get("trackExpiry", False)),
        "trackManufacturingDate": bool(payload.get("trackManufacturingDate", False)),
        "trackSerialNumbers": bool(payload.get("trackSerialNumbers", False))
    }

    # 8. Batches List Formatting with Auto-Calculation
    raw_batches = payload.get("batches") or []
    formatted_batches = []
    if isinstance(raw_batches, list):
        for b in raw_batches:
            if isinstance(b, dict):
                b_qty = parse_float(b.get("quantity") or b.get("qty"), 0.0)
                b_rate = parse_float(b.get("rate") or b.get("purchaseRate"), 0.0)
                b_amt = parse_float(b.get("amount") or b.get("value"), b_qty * b_rate)
                formatted_batches.append({
                    "batchName": b.get("batchName") or "",
                    "manufacturingDate": b.get("manufacturingDate") or b.get("mfdOn"),
                    "expiryDate": b.get("expiryDate") or b.get("expOn"),
                    "quantity": b_qty,
                    "rate": b_rate,
                    "amount": b_amt
                })

    # 9. Perishable Settings
    perish_obj = payload.get("perishableSettings") or {}
    if not isinstance(perish_obj, dict):
        perish_obj = {}
    perishable_settings_doc = {
        "isPerishable": bool(perish_obj.get("isPerishable", payload.get("isPerishable", payload.get("trackExpiry", False)))),
        "shelfLifeDays": int(perish_obj.get("shelfLifeDays") or payload.get("shelfLifeDays") or 0),
        "expiryWarningDays": int(perish_obj.get("expiryWarningDays") or payload.get("expiryWarningDays") or 0)
    }

    # 10. Serial Number Settings
    serial_obj = payload.get("serialNumberSettings") or {}
    if not isinstance(serial_obj, dict):
        serial_obj = {}
    serial_settings_doc = {
        "enabled": bool(serial_obj.get("enabled", payload.get("trackSerialNumbers", False))),
        "prefix": serial_obj.get("prefix") or payload.get("serialPrefix") or "",
        "startingNumber": serial_obj.get("startingNumber") or payload.get("serialStartingNumber") or ""
    }

    # 11. BOM Object
    bom_obj = payload.get("bom") or {}
    if not isinstance(bom_obj, dict):
        bom_obj = {}
    bom_components = bom_obj.get("components") or payload.get("bomComponents") or []
    bom_doc = {
        "enabled": bool(bom_obj.get("enabled", bool(bom_components))),
        "bomName": bom_obj.get("bomName") or payload.get("bomName") or "",
        "bomBasicQty": parse_float(bom_obj.get("bomBasicQty") or payload.get("bomBasicQty"), 1.0),
        "components": bom_components
    }

    # 12. Additional Info
    add_info = payload.get("additionalInfo") or {}
    if not isinstance(add_info, dict):
        add_info = {}
    additional_info_doc = {
        "countryOfOrigin": add_info.get("countryOfOrigin") or payload.get("countryOfOrigin") or "",
        "productType": add_info.get("productType") or payload.get("productType") or "",
        "notes": add_info.get("notes") or payload.get("notes") or ""
    }

    # 13. Flags Object (Supports both spelling variations for backward compatibility)
    is_perish_flag = bool(payload.get("trackExpiry", False)) or bool(perishable_settings_doc["isPerishable"])
    flags_doc = {
        "isCostCenter": False,
        "isBatchWise": bool(payload.get("trackBatches", False)),
        "isPerishable": is_perish_flag,
        "isCostTrackingOn": False,
        "isCostTrachingOn": False,
        "asOriginal": False,
        "isActive": (payload.get("status") or "ACTIVE").upper() == "ACTIVE"
    }

    doc = {
        "companyId": company_db_id,
        "itemGuid": payload.get("itemGuid") or str(uuid.uuid4()),
        "itemCode": item_code,
        "itemName": item_name,
        "stockGroupId": sg_id,
        "stockGroupName": group_name,
        "stockGroupPath": sg_path,
        "group": group_name,
        "stockCategoryId": sc_id,
        "stockCategoryName": category_name,
        "category": category_name,
        "hsnCode": hsn_val,
        "hsn": hsn_val,
        "gstRate": f"{gst_rate}%" if isinstance(gst_rate, (int, float)) else str(gst_rate or "18%"),
        "uom": base_unit_str,

        "basicInfo": basic_info_doc,
        "unit": unit_doc,
        "hsnSacDetails": hsn_sac_doc,
        "gstSettings": gst_settings_doc,
        "pricing": pricing_doc,
        "inventory": inventory_doc,
        "tracking": tracking_doc,
        "batches": formatted_batches,
        "perishableSettings": perishable_settings_doc,
        "serialNumberSettings": serial_settings_doc,
        "bom": bom_doc,
        "additionalInfo": additional_info_doc,
        "flags": flags_doc,

        "auditInfo": {
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "tallyAlterId": 0,
            "version": 1
        },

        "status": (payload.get("status") or "ACTIVE").upper(),
        "brand": payload.get("brand") or "",
        "purchasePrice": parse_float(payload.get("purchasePrice"), op_rate),
        "salesPrice": parse_float(payload.get("salesPrice"), 0.0),
        "mrp": parse_float(payload.get("mrp"), 0.0),
        "mrpRates": payload.get("mrpRates") or (pricing_obj.get("MRP", {}).get("rates") if isinstance(pricing_obj.get("MRP"), dict) and isinstance(pricing_obj.get("MRP").get("rates"), list) else []),
        "BOM": payload.get("BOM", []),
        "nameAliases": payload.get("nameAliases", [])
    }

    return save_or_update_doc(db, "stockitems_entry", "stockItems", doc, payload, "Stock item")




# ─────────────── 2. UNIT ENTRY — units_entry ───────────────
@router.post("/units")
@router.post("/units/")
async def create_unit_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    unit_name = payload.get("unitName") or payload.get("name") or "New Unit"
    symbol = payload.get("symbol") or unit_name
    next_num = db["units_entry"].count_documents({}) + 1
    unit_code = payload.get("unitCode") or f"UNIT{next_num:04d}"

    now_iso = datetime.now().isoformat()
    
    conversion_obj = payload.get("conversion") or {}
    if not isinstance(conversion_obj, dict):
        conversion_obj = {}

    is_base = conversion_obj.get("isBaseUnit", payload.get("isBaseUnit", True))
    base_unit = conversion_obj.get("baseUnit") or payload.get("baseUnit")
    
    try:
        conv_factor = float(conversion_obj.get("conversionFactor") or payload.get("conversionFactor") or 1.0)
    except ValueError:
        conv_factor = 1.0

    try:
        dec_places = int(conversion_obj.get("decimalPlaces") or payload.get("decimalPlaces") or 2)
    except ValueError:
        dec_places = 2

    conversion = {
        "isBaseUnit": bool(is_base),
        "baseUnit": base_unit,
        "conversionFactor": conv_factor,
        "decimalPlaces": dec_places
    }

    doc = {
        "companyId": company_db_id,
        "unitGuid": str(uuid.uuid4()),
        "unitCode": unit_code,
        "unitName": unit_name,
        "symbol": symbol,
        "conversion": conversion,
        "decimalPlaces": dec_places,
        "flags": {
            "asOriginal": False,
            "isDeleted": False,
            "isGstExcluded": bool(payload.get("isGstExcluded", False))
        },
        "auditInfo": {
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "version": 1
        },
        "status": (payload.get("status") or "ACTIVE").upper(),
        "alternateUnits": payload.get("alternateUnits", [])
    }

    return save_or_update_doc(db, "units_entry", "units", doc, payload, "Unit")


# ─────────────── 3. STOCK GROUP ENTRY — stockgroups_entry ───────────────
@router.post("/stock-groups")
@router.post("/stock-groups/")
async def create_stock_group_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    group_name = payload.get("groupName") or payload.get("name") or "New Stock Group"
    parent_name = payload.get("parentGroup") or payload.get("parentGroupName") or "Primary"
    
    parent_doc = db["stockGroups"].find_one({"groupName": parent_name}) or db["stockgroups_entry"].find_one({"groupName": parent_name})
    parent_id = parent_doc["_id"] if parent_doc else None

    next_num = db["stockgroups_entry"].count_documents({}) + 1
    group_code = payload.get("groupCode") or f"GRP{next_num:04d}"
    now_iso = datetime.now().isoformat()

    doc = {
        "companyId": company_db_id,
        "groupGuid": str(uuid.uuid4()),
        "groupCode": group_code,
        "groupName": group_name,
        "parentGroup": parent_id,
        "parentGroupName": parent_name,
        "groupPath": f"{parent_name} > {group_name}",
        "baseUnits": payload.get("baseUnits", "Nos"),
        "additionalUnits": payload.get("additionalUnits", "Not Applicable"),
        "costingMethod": payload.get("costingMethod", "FIFO"),
        "valuationMethod": payload.get("valuationMethod", "Last Sale Price"),
        "hsnDetails": { "hsnCode": payload.get("hsnCode") },
        "gstDetails": { "gstApplicable": True, "applicableFrom": datetime.now().strftime("%Y-%m-%d") },
        "behaviour": { "affectsStock": True, "isBatchWiseOn": False, "allowNegativeStock": True },
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 },
        "status": (payload.get("status") or "ACTIVE").upper()
    }

    return save_or_update_doc(db, "stockgroups_entry", "stockGroups", doc, payload, "Stock group")


# ─────────────── 4. STOCK CATEGORY ENTRY — stockcategories_entry ───────────────
@router.post("/stock-categories")
@router.post("/stock-categories/")
async def create_stock_category_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    cat_name = payload.get("stockCategoryName") or payload.get("categoryName") or payload.get("name") or "New Stock Category"
    parent_name = payload.get("parentCategory") or payload.get("parentCategoryName") or "Primary"
    
    parent_doc = db["stockCategories"].find_one({"categoryName": parent_name}) or db["stockcategories_entry"].find_one({"categoryName": parent_name})
    parent_id = parent_doc["_id"] if parent_doc else None

    now_iso = datetime.now().isoformat()

    doc = {
        "companyId": company_db_id,
        "categoryGuid": str(uuid.uuid4()),
        "categoryName": cat_name,
        "categoryPath": f"{parent_name} > {cat_name}" if parent_name != "Primary" else cat_name,
        "parentCategory": parent_id,
        "parentCategoryName": parent_name,
        "level": 1,
        "isSecurityOnWhenEntered": False,
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 },
        "status": (payload.get("status") or "ACTIVE").upper()
    }

    return save_or_update_doc(db, "stockcategories_entry", "stockCategories", doc, payload, "Stock category")


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


# ─────────────── 6. COST CENTER ENTRY — costcenters_entry ───────────────
@router.post("/cost-centers")
@router.post("/cost-centers/")
async def create_cost_center_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    company_db_id = resolve_company_db_id(request, db)

    cc_name = payload.get("costCenterName") or payload.get("name") or "New Cost Center"
    parent_name = payload.get("parentId") or payload.get("parentName") or "Primary / None"
    if isinstance(parent_name, dict):
        parent_name = parent_name.get("costCenterName") or parent_name.get("name") or "Primary / None"
    
    category_name = payload.get("costCategoryId") or payload.get("costCategoryName") or "Primary Cost Category"
    if isinstance(category_name, dict):
        category_name = category_name.get("costCategoryName") or category_name.get("name") or "Primary Cost Category"

    parent_doc = db["costCenters"].find_one({"costCenterName": parent_name}) or db["costcenters_entry"].find_one({"costCenterName": parent_name})
    parent_id = parent_doc["_id"] if parent_doc else None

    next_num = db["costcenters_entry"].count_documents({}) + 1
    cc_code = payload.get("costCenterCode") or f"CC{next_num:06d}"
    now_iso = datetime.now().isoformat()

    doc = {
        "companyId": company_db_id,
        "costCenterGuid": str(uuid.uuid4()),
        "costCenterCode": cc_code,
        "costCenterName": cc_name,
        "costCategoryId": None,
        "costCategoryName": category_name,
        "parentId": parent_id,
        "parentName": parent_name,
        "parentGroupPath": f"{parent_name} > {cc_name}",
        "level": 1,
        "flags": {
            "asOriginal": False,
            "affectStock": False,
            "forPayRoll": False,
            "forJobCosting": False,
            "isEmployeeGroup": False
        },
        "employeeDetails": {},
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 },
        "status": (payload.get("status") or "ACTIVE").upper()
    }

    return save_or_update_doc(db, "costcenters_entry", "costCenters", doc, payload, "Cost center")


# ─────────────── 6B. BOM ENTRY — boms_entry ───────────────
@router.post("/boms")
@router.post("/boms/")
async def create_or_update_bom_entry(payload: Dict[str, Any], request: Request, db=Depends(get_db)):
    comp_id = resolve_company_db_id(request, db)
    now_iso = datetime.now().isoformat()
    bom_name = payload.get("bomName") or payload.get("name") or "Standard Assembly BOM"
    finished_item = payload.get("finishedItemName") or payload.get("stockItemName") or ""
    basic_qty = payload.get("basicQty") or 1
    unit = payload.get("unit") or "Pcs"
    items = payload.get("items") or []

    doc = {
        "companyId": comp_id,
        "isWebEntry": True,
        "sourceCollection": "boms_entry",
        "tallyStatus": payload.get("tallyStatus") or "Draft",
        "isSynced": payload.get("isSynced", False),
        "bomName": bom_name,
        "finishedItemName": finished_item,
        "basicQty": basic_qty,
        "unit": unit,
        "items": items,
        "componentsCount": len(items),
        "auditInfo": { "createdAt": now_iso, "updatedAt": now_iso, "version": 1 },
        "status": (payload.get("status") or "ACTIVE").upper()
    }

    return save_or_update_doc(db, "boms_entry", "boms", doc, payload, "BOM Master")


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
        xml_str = TallyXmlGenerator.generate_stock_item_xml(master_doc, db=db)

        m_name = master_doc.get("itemName") or master_doc.get("name") or "StockItem"
    elif "ledger" in col and "group" not in col:
        xml_str = TallyXmlGenerator.generate_ledger_xml(master_doc)
        m_name = master_doc.get("ledgerName") or master_doc.get("name") or "Ledger"
    elif "stockgroup" in col or ("stock" in col and "group" in col):
        gname = master_doc.get("groupName") or master_doc.get("name") or "Stock Group"
        parent = resolve_parent_name(master_doc, "stockgroups_entry", "Primary")
        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER><VERSION>1</VERSION><TALLYREQUEST>IMPORT</TALLYREQUEST><TYPE>DATA</TYPE><ID>All Masters</ID></HEADER>',
            '  <BODY><DESC><STATICVARIABLES /></DESC><DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'    <STOCKGROUP NAME="{escape_xml(gname)}" ACTION="Create">',
            f'      <PARENT>{escape_xml(parent)}</PARENT>',
            '    </STOCKGROUP>',
            '  </TALLYMESSAGE></DATA></BODY>',
            '</ENVELOPE>'
        ]
        xml_str = "\n".join(lines)
        m_name = gname
    elif "stockcategor" in col or ("stock" in col and "categor" in col):
        cname = master_doc.get("stockCategoryName") or master_doc.get("categoryName") or master_doc.get("name") or "Stock Category"
        parent = resolve_parent_name(master_doc, "stockcategories_entry", "Primary")
        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER><VERSION>1</VERSION><TALLYREQUEST>IMPORT</TALLYREQUEST><TYPE>DATA</TYPE><ID>All Masters</ID></HEADER>',
            '  <BODY><DESC><STATICVARIABLES /></DESC><DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'    <STOCKCATEGORY NAME="{escape_xml(cname)}" ACTION="Create">',
            f'      <PARENT>{escape_xml(parent)}</PARENT>',
            '    </STOCKCATEGORY>',
            '  </TALLYMESSAGE></DATA></BODY>',
            '</ENVELOPE>'
        ]
        xml_str = "\n".join(lines)
        m_name = cname
    elif "unit" in col:
        uname = master_doc.get("unitName") or master_doc.get("symbol") or master_doc.get("name") or "Unit"
        code = master_doc.get("unitCode") or master_doc.get("symbol") or uname
        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER><VERSION>1</VERSION><TALLYREQUEST>IMPORT</TALLYREQUEST><TYPE>DATA</TYPE><ID>All Masters</ID></HEADER>',
            '  <BODY><DESC><STATICVARIABLES /></DESC><DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'    <UNIT NAME="{escape_xml(uname)}" ACTION="Create">',
            f'      <ORIGINALNAME>{escape_xml(code)}</ORIGINALNAME>',
            '      <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>',
            '    </UNIT>',
            '  </TALLYMESSAGE></DATA></BODY>',
            '</ENVELOPE>'
        ]
        xml_str = "\n".join(lines)
        m_name = uname
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
        gname = master_doc.get("groupName") or master_doc.get("name") or "Ledger Group"
        parent = resolve_parent_name(master_doc, "groups_entry", "Primary")
        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER><VERSION>1</VERSION><TALLYREQUEST>IMPORT</TALLYREQUEST><TYPE>DATA</TYPE><ID>All Masters</ID></HEADER>',
            '  <BODY><DESC><STATICVARIABLES /></DESC><DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'    <GROUP NAME="{escape_xml(gname)}" ACTION="Create">',
            f'      <PARENT>{escape_xml(parent)}</PARENT>',
            '    </GROUP>',
            '  </TALLYMESSAGE></DATA></BODY>',
            '</ENVELOPE>'
        ]
        xml_str = "\n".join(lines)
        m_name = gname

    elif "bom" in col:
        bname = master_doc.get("bomName") or master_doc.get("name") or "BOM Master"
        finished = master_doc.get("finishedItemName") or master_doc.get("stockItemName") or "Finished Item"
        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER><VERSION>1</VERSION><TALLYREQUEST>IMPORT</TALLYREQUEST><TYPE>DATA</TYPE><ID>All Masters</ID></HEADER>',
            '  <BODY><DESC><STATICVARIABLES /></DESC><DATA><TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'    <STOCKITEM NAME="{escape_xml(finished)}" ACTION="Create">',
            '      <MULTICOMPONENTLIST.LIST>',
            f'        <COMPONENTLISTNAME>{escape_xml(bname)}</COMPONENTLISTNAME>',
            '      </MULTICOMPONENTLIST.LIST>',
            '    </STOCKITEM>',
            '  </TALLYMESSAGE></DATA></BODY>',
            '</ENVELOPE>'
        ]
        xml_str = "\n".join(lines)
        m_name = bname
    else:
        xml_str = TallyXmlGenerator.generate_ledger_xml(master_doc)
        m_name = master_doc.get("ledgerName") or master_doc.get("name") or "Master"

    clean_file_name = f"{re.sub(r'[^a-zA-Z0-9_-]', '_', m_name)}_Tally.xml"
    return {
        "success": True,
        "xml": xml_str,
        "fileName": clean_file_name
    }

