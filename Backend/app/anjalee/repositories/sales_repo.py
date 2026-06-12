from typing import List, Optional, Dict, Any
from bson import ObjectId
from datetime import datetime
from pymongo import ReturnDocument
from app.anjalee.constants.business_constants import COUNTERS_COLLECTION, COMPANIES_COLLECTION, LEDGERS_COLLECTION, STOCK_ITEMS_COLLECTION

SALES_VOUCHERS_COLLECTION = "sales_vouchers"

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
        # Resolve voucher type matching (similar to list_vouchers)
        types = [voucher_type, voucher_type.replace("_", " "), voucher_type.replace(" ", "_")]
        types = list(set(types))
        regex_pattern = "^(" + "|".join(types) + ")$"
        
        # Query matching vouchers
        query = {
            "voucherType": {"$regex": regex_pattern, "$options": "i"},
            "voucherNumber": {"$regex": f"^{prefix}-"},
            "isDeleted": {"$ne": True}
        }
        cursor = self.db[SALES_VOUCHERS_COLLECTION].find(query, {"voucherNumber": 1})
        docs = await cursor.to_list(length=1000)
        
        max_seq = 0
        for d in docs:
            v_num = d.get("voucherNumber", "")
            parts = v_num.split("-")
            if len(parts) >= 3:
                try:
                    # The last part is the sequence number
                    seq_val = int(parts[-1])
                    if seq_val > max_seq:
                        max_seq = seq_val
                except ValueError:
                    pass
                    
        next_seq = max_seq + 1
        
        # If no documents are found, fallback to the database counter
        if max_seq == 0:
            counter = await self.db[COUNTERS_COLLECTION].find_one({"_id": prefix})
            if counter:
                next_seq = counter["seq"] + 1
            else:
                next_seq = 1
                
        if consume:
            # Sync/update the counter in COUNTERS_COLLECTION
            await self.db[COUNTERS_COLLECTION].update_one(
                {"_id": prefix},
                {"$set": {"seq": next_seq}},
                upsert=True
            )
            
        return next_seq

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
        party_groups = ["Sundry Debtors", "Sundry Creditors", "Bank Accounts", "Cash-in-Hand"]
        query = {"groupName": {"$in": party_groups}}
        
        comp = None
        if company_id:
            if len(company_id) == 24:
                try:
                    comp = await self.db[COMPANIES_COLLECTION].find_one({"_id": ObjectId(company_id)})
                except Exception:
                    pass
            if not comp:
                comp = await self.db[COMPANIES_COLLECTION].find_one({
                    "$or": [
                        {"companyName": company_id},
                        {"basicCompantFormalName": company_id}
                    ]
                })
        
        if not comp:
            comp = await self.db[COMPANIES_COLLECTION].find_one()

        if comp:
            query["companyId"] = comp["_id"]
        cursor = self.db[LEDGERS_COLLECTION].find(query)
        ledgers = await cursor.to_list(length=1000)
        
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
        for l in ledgers:
            ledger_name = l.get("ledgerName", "")
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
                
            results.append({
                "id": str(l["_id"]),
                "name": ledger_name,
                "ledgerName": ledger_name,
                "gstin": gstin,
                "gstState": gst_state,
                "registrationType": registration_type
            })
        return results

    async def get_sales_ledgers(self) -> List[Dict[str, Any]]:
        cursor = self.db[LEDGERS_COLLECTION].find({"groupName": "Sales Accounts"})
        ledgers = await cursor.to_list(length=1000)
        
        import re
        slab_re = re.compile(r"(\d+(?:\.\d+)?)\s*%")
        
        results = []
        for l in ledgers:
            name = l.get("ledgerName", "")
            # Extract GST rate
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

    async def get_stock_items(self) -> List[Dict[str, Any]]:
        """Fetch stock items with name and HSN code from hsnSacDetails.hsnCode field."""
        try:
            cursor = self.db[STOCK_ITEMS_COLLECTION].find(
                {},
                {"itemName": 1, "hsnSacDetails": 1, "gstSettings": 1, "hsnCode": 1, "taxRate": 1,
                 "unit": 1, "unitOfMeasure": 1, "baseUnit": 1}
            )
            docs = await cursor.to_list(length=2000)
            results = []
            for doc in docs:
                name = doc.get("itemName", "")
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
                    cgst_val = float(cgst) if cgst is not None else 0.0
                    sgst_val = float(sgst) if sgst is not None else 0.0
                    gst_rate = cgst_val + sgst_val
                if not gst_rate:
                    gst_rate = doc.get("taxRate") or 0

                # unit field is a nested object: {baseUnit: "Nos", alternateUnit: ...}
                # Fallback to top-level baseUnit or unitOfMeasure string if needed
                unit_raw = doc.get("unit")
                if isinstance(unit_raw, dict):
                    unit = unit_raw.get("baseUnit") or ""
                elif isinstance(unit_raw, str):
                    unit = unit_raw
                else:
                    unit = doc.get("baseUnit") or doc.get("unitOfMeasure") or ""
                results.append({
                    "name": name,
                    "hsnCode": str(hsn_code),
                    "gstRate": float(gst_rate),
                    "unit": str(unit)
                })
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
