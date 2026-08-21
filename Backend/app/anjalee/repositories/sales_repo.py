from typing import List, Optional, Dict, Any
from bson import ObjectId
from datetime import datetime
from pymongo import ReturnDocument
from app.anjalee.constants.business_constants import COUNTERS_COLLECTION, COMPANIES_COLLECTION, LEDGERS_COLLECTION, STOCK_ITEMS_COLLECTION

SALES_VOUCHERS_COLLECTION = "sales_vouchers"

def build_company_id_query(company_id: Optional[Any], db: Optional[Any] = None) -> dict:
    if not company_id:
        return {}
    raw_str = str(company_id).strip()
    match_set = {raw_str}
    
    if len(raw_str) == 24:
        try:
            match_set.add(ObjectId(raw_str))
        except Exception:
            pass

    if db is not None:
        try:
            query_or = []
            if len(raw_str) == 24 and ObjectId.is_valid(raw_str):
                query_or.append({"_id": ObjectId(raw_str)})
            query_or.extend([
                {"_id": raw_str},
                {"companyName": raw_str},
                {"basicCompantFormalName": raw_str},
                {"name": raw_str}
            ])
            for c in db["companies"].find({"$or": query_or}):
                if c.get("_id"):
                    match_set.add(c["_id"])
                    match_set.add(str(c["_id"]))
                name = c.get("companyName") or c.get("basicCompantFormalName") or c.get("name")
                if name:
                    match_set.add(name)
        except Exception:
            pass

        try:
            query_or = []
            if len(raw_str) == 24 and ObjectId.is_valid(raw_str):
                query_or.append({"_id": ObjectId(raw_str)})
            query_or.extend([
                {"_id": raw_str},
                {"displayName": raw_str},
                {"name": raw_str},
                {"companyName": raw_str}
            ])
            for o in db["organizations"].find({"$or": query_or}):
                if o.get("_id"):
                    match_set.add(o["_id"])
                    match_set.add(str(o["_id"]))
                name = o.get("displayName") or o.get("name") or o.get("companyName")
                if name:
                    match_set.add(name)
        except Exception:
            pass

    match_list = list(match_set)
    return {"$or": [{"companyId": {"$in": match_list}}, {"orgId": {"$in": match_list}}]}

class SalesVoucherRepository:
    def __init__(self, db):
        self.db = db

    async def insert_voucher(self, doc_data: Dict[str, Any]) -> str:
        result = await self.db[SALES_VOUCHERS_COLLECTION].insert_one(doc_data)
        return str(result.inserted_id)

    async def count_vouchers(self, query: Dict[str, Any]) -> int:
        # Filter out soft deleted vouchers
        query["isDeleted"] = {"$ne": True}
        return await self.db[SALES_VOUCHERS_COLLECTION].count_documents(query)

    async def find_vouchers(self, query: Dict[str, Any], skip: int, limit: int) -> List[Dict[str, Any]]:
        # Filter out soft deleted vouchers
        query["isDeleted"] = {"$ne": True}
        cursor = self.db[SALES_VOUCHERS_COLLECTION].find(query).sort("createdAt", -1).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def find_voucher_by_id(self, voucher_id: str) -> Optional[Dict[str, Any]]:
        try:
            doc = await self.db[SALES_VOUCHERS_COLLECTION].find_one({
                "_id": ObjectId(voucher_id),
                "isDeleted": {"$ne": True}
            })
            return doc
        except Exception:
            return None

    async def update_voucher(self, voucher_id: str, update_data: Dict[str, Any]) -> bool:
        try:
            result = await self.db[SALES_VOUCHERS_COLLECTION].update_one(
                {"_id": ObjectId(voucher_id), "isDeleted": {"$ne": True}},
                {"$set": update_data}
            )
            return result.matched_count > 0
        except Exception:
            return False

    async def delete_voucher(self, voucher_id: str) -> bool:
        try:
            result = await self.db[SALES_VOUCHERS_COLLECTION].delete_one(
                {"_id": ObjectId(voucher_id)}
            )
            return result.deleted_count > 0
        except Exception:
            return False

    def get_summary_cursor(self, query: Optional[Dict[str, Any]] = None) -> Any:
        q = query or {}
        q["isDeleted"] = {"$ne": True}
        return self.db[SALES_VOUCHERS_COLLECTION].find(q, {"grandTotal": 1, "status": 1})

    async def update_voucher_custom(self, voucher_id: str, update_op: Dict[str, Any]) -> bool:
        try:
            result = await self.db[SALES_VOUCHERS_COLLECTION].update_one(
                {"_id": ObjectId(voucher_id), "isDeleted": {"$ne": True}},
                update_op
            )
            return result.matched_count > 0
        except Exception:
            return False

    async def get_next_sequence_value(self, sequence_id: str) -> int:
        counter = await self.db[COUNTERS_COLLECTION].find_one_and_update(
            {"_id": sequence_id},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        return counter["seq"]

    async def peek_next_sequence_value(self, sequence_id: str) -> int:
        """Read the NEXT sequence value without consuming it (for auto-fill preview)."""
        counter = await self.db[COUNTERS_COLLECTION].find_one({"_id": sequence_id})
        current_seq = counter["seq"] if counter else 0
        return current_seq + 1

    async def get_dynamic_next_sequence(self, voucher_type: str, prefix: str, consume: bool = False) -> int:
        # Get current counter value
        counter = await self.db[COUNTERS_COLLECTION].find_one({"_id": prefix})
        current_seq = counter["seq"] if counter else 0
        
        if consume:
            next_seq = current_seq + 1
            await self.db[COUNTERS_COLLECTION].update_one(
                {"_id": prefix},
                {"$set": {"seq": next_seq}},
                upsert=True
            )
            return next_seq
        else:
            return current_seq + 1

    async def get_company_state(self) -> str:
        # Lookup first company doc
        comp = await self.db[COMPANIES_COLLECTION].find_one()
        if comp and "gstDetails" in comp:
            # Try to resolve from gstin first
            gstin = (comp["gstDetails"].get("gstin") or "").strip()
            if len(gstin) >= 2:
                prefix = gstin[:2]
                state_name = STATE_CODES.get(prefix)
                if state_name:
                    return state_name
            # Fallback to gstState field
            state_name = comp["gstDetails"].get("gstState")
            if state_name:
                return state_name
        return "Madhya Pradesh"  # Default fallback

    async def get_party_details(self, party_ledger_id_or_name: str) -> Dict[str, Any]:
        query = {}
        try:
            query["_id"] = ObjectId(party_ledger_id_or_name)
        except Exception:
            query["ledgerName"] = party_ledger_id_or_name

        ledger = await self.db[LEDGERS_COLLECTION].find_one(query)
        if ledger:
            ledger_name = ledger.get("ledgerName", "")
            pd = ledger.get("partyDetails") or {}
            gstin = pd.get("gstin") or ledger.get("gstin") or ""
            gst_state = pd.get("gstState") or ""
            registration_type = pd.get("registrationType") or ledger.get("registrationType") or ""
            
            # Fallback to vouchers collection if GSTIN or gstState is missing
            if not gstin or not gst_state or not registration_type:
                voucher = await self.db["vouchers"].find_one({
                    "$or": [
                        {"partyLedgerName": ledger_name},
                        {"partyName": ledger_name}
                    ],
                    "gstDetails.gstin": {"$exists": True, "$ne": ""}
                })
                if voucher:
                    gd = voucher.get("gstDetails") or {}
                    if not gstin:
                        gstin = gd.get("gstin") or ""
                    if not gst_state:
                        gst_state = gd.get("gstState") or ""
                    if not registration_type:
                        registration_type = gd.get("registrationType") or ""
            
            # Default registrationType to Regular if still empty but has GSTIN
            if not registration_type:
                registration_type = "Regular" if gstin else "Consumer"

            # Resolve state from GSTIN prefix if missing
            if not gst_state and gstin and len(gstin) >= 2:
                prefix = gstin[:2]
                gst_state = STATE_CODES.get(prefix, "")
                
            return {
                "id": str(ledger["_id"]),
                "name": ledger_name,
                "gstin": gstin,
                "gstState": gst_state,
                "registrationType": registration_type
            }
        return {"id": "", "name": str(party_ledger_id_or_name), "gstin": "", "gstState": "", "registrationType": "Consumer"}

    async def get_party_ledgers(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        comp_q = build_company_id_query(company_id, self.db)
        query = comp_q if comp_q else {}

        main_cursor = self.db[LEDGERS_COLLECTION].find(query)
        entry_cursor = self.db["ledgers_entry"].find(query)
        main_ledgers = await main_cursor.to_list(length=None)
        entry_ledgers = await entry_cursor.to_list(length=None)
        all_docs = entry_ledgers + main_ledgers

        if not all_docs:
            main_ledgers = await self.db[LEDGERS_COLLECTION].find({}).to_list(length=None)
            entry_ledgers = await self.db["ledgers_entry"].find({}).to_list(length=None)
            all_docs = entry_ledgers + main_ledgers

        party_groups = {"sundry debtors", "sundry creditors", "debtors", "creditors", "cash-in-hand", "bank accounts", "bank od a/c"}
        ledgers = []
        for d in all_docs:
            g_name = (d.get("groupName") or "").lower().strip()
            g_path = (d.get("groupPath") or "").lower()
            l_type = (d.get("ledgerType") or "").lower()
            pd = d.get("partyDetails") or {}

            is_party = (
                g_name in party_groups
                or "sundry debtors" in g_path
                or "sundry creditors" in g_path
                or "debtors" in g_path
                or "creditors" in g_path
                or "debtor" in l_type
                or "creditor" in l_type
                or bool(pd.get("gstin"))
            )
            if is_party:
                ledgers.append(d)

        if len(ledgers) < 5:
            ledgers = all_docs
        
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
            voucher_cursor = self.db["vouchers"].find({
                "$or": [
                    {"partyLedgerName": {"$in": names_needing_fallback}},
                    {"partyName": {"$in": names_needing_fallback}}
                ],
                "gstDetails.gstin": {"$exists": True, "$ne": ""}
            })
            vouchers_list = await voucher_cursor.to_list(length=1000)
            for v in vouchers_list:
                name1 = v.get("partyLedgerName")
                name2 = v.get("partyName")
                gd = v.get("gstDetails") or {}
                if name1:
                    voucher_lookup[name1] = gd
                if name2:
                    voucher_lookup[name2] = gd

        # 3. Assemble results using the lookup map in memory
        results = []
        seen_names = set()
        for l in ledgers:
            ledger_name = l.get("ledgerName", "")
            if not ledger_name or ledger_name in seen_names:
                continue
            seen_names.add(ledger_name)
            pd = l.get("partyDetails") or {}
            gstin = pd.get("gstin") or l.get("gstin") or ""
            gst_state = pd.get("gstState") or ""
            registration_type = pd.get("registrationType") or l.get("registrationType") or ""
            
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
                
            pd_full = l.get("partyDetails") or {}
            results.append({
                "id": str(l["_id"]),
                "name": ledger_name,
                "ledgerName": ledger_name,
                "gstin": gstin,
                "gstState": gst_state,
                "registrationType": registration_type,
                "address": pd_full.get("address") or [],
                "email": pd_full.get("email") or "",
                "phone": pd_full.get("phone") or "",
                "panNumber": pd_full.get("panNumber") or l.get("panNumber") or pd_full.get("panNo") or "",
                "groupName": l.get("groupName") or ""
            })
        return results

    async def get_sales_ledgers(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        comp_q = build_company_id_query(company_id, self.db)
        query = comp_q if comp_q else {}

        main_cursor = self.db[LEDGERS_COLLECTION].find(query)
        entry_cursor = self.db["ledgers_entry"].find(query)
        main_ledgers = await main_cursor.to_list(length=None)
        entry_ledgers = await entry_cursor.to_list(length=None)
        all_docs = entry_ledgers + main_ledgers
        
        sales_ledgers = [
            d for d in all_docs
            if "sales" in (d.get("groupName") or "").lower() or "sales" in (d.get("groupPath") or "").lower() or "revenue" in (d.get("groupPath") or "").lower() or "income" in (d.get("groupPath") or "").lower()
        ]
        if not sales_ledgers:
            sales_ledgers = all_docs

        import re
        slab_re = re.compile(r"(\d+(?:\.\d+)?)\s*%")
        
        results = []
        seen_names = set()
        for l in sales_ledgers:
            name = l.get("ledgerName", "")
            if not name or name in seen_names:
                continue
            seen_names.add(name)
            m = slab_re.search(name)
            rate = float(m.group(1)) if m else 0.0
            gst_applicable = True
            if "exempt" in name.lower() or "nil" in name.lower():
                gst_applicable = False
                
            results.append({
                "id": str(l["_id"]),
                "name": name,
                "gstApplicable": gst_applicable,
                "taxRate": rate
            })
        return results

    async def get_stock_items(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch stock items with name and HSN code from hsnSacDetails.hsnCode field, scoped by company."""
        try:
            comp_q = build_company_id_query(company_id, self.db)
            query = comp_q if comp_q else {}

            projection = {
                "itemName": 1, "hsnSacDetails": 1, "gstSettings": 1, "hsnCode": 1, "taxRate": 1,
                "unit": 1, "unitOfMeasure": 1, "baseUnit": 1, "inventory": 1, "stockGroupName": 1, "auditInfo": 1, "isWebEntry": 1
            }
            main_docs = await self.db[STOCK_ITEMS_COLLECTION].find(query, projection).to_list(length=None)
            entry_docs = await self.db["stockitems_entry"].find(query, projection).to_list(length=None)
            for d in entry_docs:
                d["isWebEntry"] = True
            docs = entry_docs + main_docs

            results = []
            for doc in docs:
                try:
                    name = doc.get("itemName") or doc.get("name") or ""
                    if not name:
                        continue
                    # Primary: hsnSacDetails.hsnCode/hsn  Fallback: top-level hsnCode
                    hsn_sac = doc.get("hsnSacDetails") or {}
                    hsn_code = (
                        hsn_sac.get("hsnCode")
                        or hsn_sac.get("hsn")
                        or doc.get("hsnCode")
                        or ""
                    )
                    # Primary: gstSettings.gstRate/igstRate  Fallback: cgstRate + sgstRate, then top-level taxRate
                    gst_settings = doc.get("gstSettings") or {}
                    gst_rate = gst_settings.get("gstRate") or gst_settings.get("igstRate")
                    if gst_rate is None or gst_rate == 0:
                        cgst = gst_settings.get("cgstRate")
                        sgst = gst_settings.get("sgstRate")
                        try:
                            cgst_val = float(cgst) if cgst is not None else 0.0
                        except (ValueError, TypeError):
                            cgst_val = 0.0
                        try:
                            sgst_val = float(sgst) if sgst is not None else 0.0
                        except (ValueError, TypeError):
                            sgst_val = 0.0
                        gst_rate = cgst_val + sgst_val
                    if not gst_rate:
                        gst_rate = doc.get("taxRate") or 0

                    try:
                        gst_rate = float(gst_rate)
                    except (ValueError, TypeError):
                        # Try parsing digits
                        import re
                        if isinstance(gst_rate, str):
                            m = re.search(r"(\d+(?:\.\d+)?)", gst_rate)
                            gst_rate = float(m.group(1)) if m else 0.0
                        else:
                            gst_rate = 0.0

                    # unit field is a nested object: {baseUnit: "Nos", alternateUnit: ...}
                    # Fallback to top-level baseUnit or unitOfMeasure string if needed
                    unit_raw = doc.get("unit")
                    if isinstance(unit_raw, dict):
                        unit = unit_raw.get("baseUnit") or ""
                    elif isinstance(unit_raw, str):
                        unit = unit_raw
                    else:
                        unit = doc.get("baseUnit") or doc.get("unitOfMeasure") or ""

                    try:
                        qty = float(((doc.get("inventory") or {}).get("openingStock") or {}).get("quantity") or doc.get("qty") or 0.0)
                    except (ValueError, TypeError):
                        qty = 0.0

                    try:
                        value = float(((doc.get("inventory") or {}).get("openingStock") or {}).get("value") or doc.get("value") or 0.0)
                    except (ValueError, TypeError):
                        value = 0.0

                    rate_raw = ((doc.get("inventory") or {}).get("openingStock") or {}).get("rate") or doc.get("rate") or 0.0
                    try:
                        rate = float(rate_raw)
                    except (ValueError, TypeError):
                        rate = 0.0
                        if isinstance(rate_raw, str):
                            import re
                            m = re.match(r"^\s*([+-]?\d+(?:\.\d+)?)\s*", rate_raw)
                            if m:
                                try:
                                    rate = float(m.group(1))
                                except ValueError:
                                    pass

                    if rate == 0.0 and qty > 0.0:
                        rate = round(value / qty, 2)
                    group = doc.get("stockGroupName") or doc.get("group") or ""
                    is_synced = doc.get("auditInfo", {}).get("syncedFromTally", False)
                    if is_synced is None:
                        is_synced = not doc.get("isWebEntry", False)

                    results.append({
                        "name": name,
                        "hsnCode": str(hsn_code),
                        "gstRate": float(gst_rate),
                        "unit": str(unit),
                        "group": group,
                        "qty": qty,
                        "rate": rate,
                        "value": value,
                        "isSynced": is_synced,
                        "isWebEntry": bool(doc.get("isWebEntry", False)),
                        "sourceCollection": "stockitems_entry" if doc.get("isWebEntry") else "stockItems"
                    })
                except Exception as doc_err:
                    import logging
                    logging.warning(f"Error parsing stock item document: {doc_err}")
            return results
        except Exception as e:
            return []

STATE_CODES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
    "24": "Gujarat", "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
    "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
    "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
    "38": "Ladakh"
}
