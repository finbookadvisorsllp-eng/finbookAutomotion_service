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

    async def get_party_ledgers(self) -> List[Dict[str, Any]]:
        party_groups = ["Sundry Debtors", "Sundry Creditors", "Bank Accounts", "Cash-in-Hand"]
        cursor = self.db[LEDGERS_COLLECTION].find({"groupName": {"$in": party_groups}})
        ledgers = await cursor.to_list(length=1000)
        
        results = []
        for l in ledgers:
            ledger_name = l.get("ledgerName", "")
            pd = l.get("partyDetails") or {}
            gstin = pd.get("gstin") or l.get("gstin") or ""
            gst_state = pd.get("gstState") or ""
            registration_type = pd.get("registrationType") or l.get("registrationType") or ""
            
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
            
            if not registration_type:
                registration_type = "Regular" if gstin else "Consumer"

            if not gst_state and gstin and len(gstin) >= 2:
                prefix = gstin[:2]
                gst_state = STATE_CODES.get(prefix, "")
                
            results.append({
                "id": str(l["_id"]),
                "name": ledger_name,
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
        """Fetch stock items with name and HSN code from hsnDetails.hsnCode field."""
        try:
            cursor = self.db[STOCK_ITEMS_COLLECTION].find(
                {},
                {"itemName": 1, "hsnDetails": 1, "hsnCode": 1, "gstDetails": 1, "taxRate": 1}
            )
            docs = await cursor.to_list(length=2000)
            results = []
            for doc in docs:
                name = doc.get("itemName", "")
                if not name:
                    continue
                # Primary: hsnDetails.hsnCode  Fallback: top-level hsnCode
                hsn_details = doc.get("hsnDetails") or {}
                hsn_code = (
                    hsn_details.get("hsnCode")
                    or hsn_details.get("hsn")
                    or doc.get("hsnCode")
                    or ""
                )
                gst_details = doc.get("gstDetails") or {}
                gst_rate = (
                    gst_details.get("taxRate")
                    or gst_details.get("gstRate")
                    or doc.get("taxRate")
                    or 0
                )
                results.append({
                    "name": name,
                    "hsnCode": str(hsn_code),
                    "gstRate": float(gst_rate)
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
