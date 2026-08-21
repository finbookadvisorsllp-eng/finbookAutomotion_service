from typing import List, Optional, Dict, Any
from bson import ObjectId
from app.anjalee.repositories.base_repo import BaseRepository
from app.anjalee.constants.business_constants import (
    PURCHASE_COLLECTION, VOUCHERS_COLLECTION, COUNTERS_COLLECTION, LEDGERS_COLLECTION, STOCK_ITEMS_COLLECTION, COMPANIES_COLLECTION
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

    def get_dynamic_next_sequence(self, voucher_type: str, prefix: str, consume: bool = False) -> int:
        # Get current counter value
        counter = self.db[COUNTERS_COLLECTION].find_one({"_id": prefix})
        current_seq = counter["seq"] if counter else 0
        
        if consume:
            next_seq = current_seq + 1
            self.db[COUNTERS_COLLECTION].update_one(
                {"_id": prefix},
                {"$set": {"seq": next_seq}},
                upsert=True
            )
            return next_seq
        else:
            return current_seq + 1


    def get_party_ledgers(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        from app.anjalee.repositories.sales_repo import build_company_id_query
        comp_q = build_company_id_query(company_id, self.db)
        query = comp_q if comp_q else {}

        main_ledgers = list(self.db[LEDGERS_COLLECTION].find(query))
        entry_ledgers = list(self.db["ledgers_entry"].find(query))
        all_docs = entry_ledgers + main_ledgers

        if not all_docs:
            main_ledgers = list(self.db[LEDGERS_COLLECTION].find({}))
            entry_ledgers = list(self.db["ledgers_entry"].find({}))
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

        if not ledgers:
            ledgers = all_docs

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

    def get_purchase_ledgers(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        from app.anjalee.repositories.sales_repo import build_company_id_query
        comp_q = build_company_id_query(company_id, self.db)
        query = comp_q if comp_q else {}

        main_ledgers = list(self.db[LEDGERS_COLLECTION].find(query))
        entry_ledgers = list(self.db["ledgers_entry"].find(query))
        all_docs = entry_ledgers + main_ledgers

        purchase_ledgers = [
            d for d in all_docs
            if "purchase" in (d.get("groupName") or "").lower() or "purchase" in (d.get("groupPath") or "").lower() or "expense" in (d.get("groupPath") or "").lower() or "cost" in (d.get("groupPath") or "").lower()
        ]
        if not purchase_ledgers:
            purchase_ledgers = all_docs
        
        import re
        slab_re = re.compile(r"(\d+(?:\.\d+)?)\s*%")
        
        results = []
        seen_names = set()
        for l in purchase_ledgers:
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

    def get_stock_items(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch stock items with name and HSN code from hsnSacDetails.hsnCode field scoped by company."""
        try:
            from app.anjalee.repositories.sales_repo import build_company_id_query
            results = []
            comp_q = build_company_id_query(company_id, self.db)
            query = comp_q if comp_q else {}

            main_docs = list(self.db[STOCK_ITEMS_COLLECTION].find(
                query,
                {"itemName": 1, "hsnSacDetails": 1, "gstSettings": 1, "hsnCode": 1, "taxRate": 1,
                 "unit": 1, "unitOfMeasure": 1, "baseUnit": 1}
            ))
            entry_docs = list(self.db["stockitems_entry"].find(
                query,
                {"itemName": 1, "hsnSacDetails": 1, "gstSettings": 1, "hsnCode": 1, "taxRate": 1,
                 "unit": 1, "unitOfMeasure": 1, "baseUnit": 1}
            ))
            docs = entry_docs + main_docs
            for doc in docs:
                try:
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
                    results.append({
                        "name": name,
                        "hsnCode": str(hsn_code),
                        "gstRate": float(gst_rate),
                        "unit": str(unit)
                    })
                except Exception as doc_err:
                    import logging
                    logging.warning(f"Error parsing stock item document in purchase_repo: {doc_err}")
            return results
        except Exception:
            return []

    def get_invoices_by_party(self, party_name: str) -> List[Dict[str, Any]]:
        """Fetch all purchase_invoice vouchers for a party — used for Debit Note reference dropdown."""
        import re
        escaped = re.escape(party_name)
        query = {
            "voucherType": {"$regex": "^(purchase_invoice|purchase invoice)$", "$options": "i"},
            "$or": [
                {"partyLedger": {"$regex": f"^{escaped}$", "$options": "i"}},
                {"partyLedgerName": {"$regex": f"^{escaped}$", "$options": "i"}},
                {"partyName": {"$regex": f"^{escaped}$", "$options": "i"}},
            ],
            "isDeleted": {"$ne": True},
        }
        cursor = self.db[PURCHASE_COLLECTION].find(query).sort("createdAt", -1).limit(200)
        return list(cursor)
