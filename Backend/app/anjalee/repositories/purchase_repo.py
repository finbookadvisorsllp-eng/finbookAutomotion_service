from typing import List, Optional, Dict, Any
from bson import ObjectId
from app.anjalee.repositories.base_repo import BaseRepository
from app.anjalee.constants.business_constants import (
    PURCHASE_COLLECTION, VOUCHERS_COLLECTION, COUNTERS_COLLECTION, LEDGERS_COLLECTION, STOCK_ITEMS_COLLECTION
)
from pymongo import ReturnDocument

class PurchaseRepository(BaseRepository):
    def get_summary_cursor(self, query: Optional[Dict[str, Any]] = None) -> Any:
        q = query or {}
        return self.db[PURCHASE_COLLECTION].find(q, {"grandTotal": 1, "status": 1})

    def count_transactions(self, query: Dict[str, Any]) -> int:
        return self.db[PURCHASE_COLLECTION].count_documents(query)

    def find_transactions(self, query: Dict[str, Any], skip: int, limit: int) -> List[Dict[str, Any]]:
        return list(
            self.db[PURCHASE_COLLECTION]
            .find(query)
            .sort("createdAt", -1)
            .skip(skip)
            .limit(limit)
        )

    def get_next_sequence_value(self, sequence_id: str) -> int:
        counter = self.db[COUNTERS_COLLECTION].find_one_and_update(
            {"_id": sequence_id},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        return counter["seq"]

    def insert_transaction(self, doc_data: Dict[str, Any]) -> str:
        result = self.db[PURCHASE_COLLECTION].insert_one(doc_data)
        return str(result.inserted_id)

    def find_transaction_by_id(self, tx_id: str) -> Optional[Dict[str, Any]]:
        try:
            return self.db[PURCHASE_COLLECTION].find_one({"_id": ObjectId(tx_id)})
        except Exception:
            return None

    def find_voucher_by_id(self, voucher_id: str) -> Optional[Dict[str, Any]]:
        try:
            return self.db[VOUCHERS_COLLECTION].find_one({"_id": ObjectId(voucher_id)})
        except Exception:
            return None

    def update_transaction(self, tx_id: str, update_data: Dict[str, Any]) -> bool:
        try:
            result = self.db[PURCHASE_COLLECTION].update_one(
                {"_id": ObjectId(tx_id)},
                {"$set": update_data}
            )
            return result.matched_count > 0
        except Exception:
            return False

    def delete_transaction(self, tx_id: str) -> bool:
        try:
            result = self.db[PURCHASE_COLLECTION].delete_one({"_id": ObjectId(tx_id)})
            return result.deleted_count > 0
        except Exception:
            return False

    def update_transaction_custom(self, tx_id: str, update_op: Dict[str, Any]) -> bool:
        try:
            result = self.db[PURCHASE_COLLECTION].update_one(
                {"_id": ObjectId(tx_id)},
                update_op
            )
            return result.matched_count > 0
        except Exception:
            return False

    def peek_next_sequence_value(self, sequence_id: str) -> int:
        """Read the NEXT sequence value without consuming it (for auto-fill preview)."""
        counter = self.db[COUNTERS_COLLECTION].find_one({"_id": sequence_id})
        current_seq = counter["seq"] if counter else 0
        return current_seq + 1

    def get_party_ledgers(self) -> List[Dict[str, Any]]:
        party_groups = ["Sundry Debtors", "Sundry Creditors", "Bank Accounts", "Cash-in-Hand"]
        ledgers = list(self.db[LEDGERS_COLLECTION].find({"groupName": {"$in": party_groups}}))
        
        results = []
        for l in ledgers:
            ledger_name = l.get("ledgerName", "")
            pd = l.get("partyDetails") or {}
            gstin = pd.get("gstin") or l.get("gstin") or ""
            gst_state = pd.get("gstState") or ""
            registration_type = pd.get("registrationType") or l.get("registrationType") or ""
            
            # Fallback to vouchers collection if GSTIN or gstState is missing
            if not gstin or not gst_state or not registration_type:
                voucher = self.db["vouchers"].find_one({
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
                from app.anjalee.repositories.sales_repo import STATE_CODES
                gst_state = STATE_CODES.get(prefix, "")
                
            results.append({
                "id": str(l["_id"]),
                "name": ledger_name,
                "gstin": gstin,
                "gstState": gst_state,
                "registrationType": registration_type
            })
        return results

    def get_purchase_ledgers(self) -> List[Dict[str, Any]]:
        ledgers = list(self.db[LEDGERS_COLLECTION].find({"groupName": "Purchase Accounts"}))
        
        import re
        slab_re = re.compile(r"(\d+(?:\.\d+)?)\s*%")
        
        results = []
        for l in ledgers:
            name = l.get("ledgerName", "")
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

    def get_stock_items(self) -> List[Dict[str, Any]]:
        """Fetch stock items with name and HSN code from hsnDetails.hsnCode field."""
        try:
            results = []
            for doc in self.db[STOCK_ITEMS_COLLECTION].find(
                {},
                {"itemName": 1, "hsnDetails": 1, "hsnCode": 1, "gstDetails": 1, "taxRate": 1}
            ):
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
        except Exception:
            return []
