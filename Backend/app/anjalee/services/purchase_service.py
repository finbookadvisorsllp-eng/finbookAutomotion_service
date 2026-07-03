from datetime import datetime
from typing import List, Optional, Dict, Any
from app.anjalee.repositories.purchase_repo import PurchaseRepository
from app.anjalee.schemas.purchase_schemas import PurchaseVoucherCreate, StatusUpdate, CommentRequest
from app.anjalee.utils.serialization import serialize_doc
from app.anjalee.constants.business_constants import PURCHASE_PREFIXES
from app.anjalee.exceptions.custom_exceptions import TransactionNotFoundException
from app.anjalee.utils.gst_calculator import calculate_taxes

class PurchaseService:
    def __init__(self, repo: PurchaseRepository):
        self.repo = repo

    def get_summary_stats(self, voucher_type: str, company_id: Optional[str]) -> Dict[str, Any]:
        total_amount = 0.0
        count = 0
        pending_review = 0
        approved_count = 0
        
        query = {}
        if voucher_type:
            query["voucherType"] = voucher_type

        cursor = self.repo.get_summary_cursor(query=query)
        for doc in cursor:
            count += 1
            total_amount += float(doc.get("grandTotal") or 0.0)
            if doc.get("status") == "pending_review":
                pending_review += 1
            elif doc.get("status") == "approved":
                approved_count += 1
                
        return {
            "totalAmount": total_amount,
            "count": count,
            "pendingReviewCount": pending_review,
            "approvedCount": approved_count
        }

    def list_transactions(
        self, 
        voucher_type: Optional[str] = None, 
        status: Optional[str] = None, 
        search: Optional[str] = None, 
        page: int = 1, 
        limit: int = 50
    ) -> Dict[str, Any]:
        query = {}
        if voucher_type:
            query["voucherType"] = voucher_type
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"partyLedger": {"$regex": search, "$options": "i"}},
                {"voucherNumber": {"$regex": search, "$options": "i"}},
                {"invoiceNumber": {"$regex": search, "$options": "i"}}
            ]
            
        total = self.repo.count_transactions(query)
        cursor = self.repo.find_transactions(query, skip=(page - 1) * limit, limit=limit)
        
        results = [serialize_doc(doc) for doc in cursor]
            
        return {
            "results": results,
            "total": total
        }

    def _calculate_and_apply_taxes(self, doc_data: Dict[str, Any], payload: PurchaseVoucherCreate) -> None:
        sales_entries_dict = payload.purchaseLines or []
        sales_entries_dict = [e.model_dump() if hasattr(e, 'model_dump') else e for e in sales_entries_dict]
        inventory_entries_dict = payload.productLines or []
        inventory_entries_dict = [e.model_dump() if hasattr(e, 'model_dump') else e for e in inventory_entries_dict]
        
        # Calculate company/party state to determine intra/interstate
        company_state = "Madhya Pradesh"
        comp_doc = self.repo.db["companies"].find_one()
        if comp_doc and "gstDetails" in comp_doc:
            gstin = (comp_doc["gstDetails"].get("gstin") or "").strip()
            if len(gstin) >= 2:
                from app.anjalee.repositories.sales_repo import STATE_CODES
                company_state = STATE_CODES.get(gstin[:2], "Madhya Pradesh")
            else:
                company_state = comp_doc["gstDetails"].get("gstState") or "Madhya Pradesh"
                
        party_state = company_state
        if payload.partyLedger:
            ledger_doc = self.repo.db["ledgers"].find_one({"ledgerName": payload.partyLedger})
            if ledger_doc:
                pd = ledger_doc.get("partyDetails") or {}
                gst_state = pd.get("gstState") or ""
                gstin = pd.get("gstin") or ledger_doc.get("gstin") or ""
                if not gst_state and gstin and len(gstin) >= 2:
                    from app.anjalee.repositories.sales_repo import STATE_CODES
                    gst_state = STATE_CODES.get(gstin[:2], "")
                if gst_state:
                    party_state = gst_state

        tcs_amount = sum(float(item.get("amount") or 0.0) for item in payload.tcsDetails) if payload.tcsDetails else 0.0
        tds_amount = sum(float(item.get("amount") or 0.0) for item in payload.tdsDetails) if payload.tdsDetails else 0.0
        
        payload_dict = payload.model_dump()
        round_off_amount = float(payload_dict.get("roundOffAmount") or 0.0)

        tax_results = calculate_taxes(
            company_state=company_state,
            party_state=party_state,
            sales_entries=sales_entries_dict,
            inventory_entries=inventory_entries_dict,
            tcs_amount=tcs_amount,
            round_off_amount=round_off_amount,
            additional_charges=payload.additionalCharges,
            tds_amount=tds_amount,
            voucher_type=payload.voucherType
        )

        doc_data["isIntraState"] = tax_results["isIntraState"]
        doc_data["taxType"] = tax_results["taxType"]
        doc_data["baseAmount"] = tax_results["baseAmount"]
        doc_data["cgstAmount"] = tax_results["cgstAmount"]
        doc_data["sgstAmount"] = tax_results["sgstAmount"]
        doc_data["igstAmount"] = tax_results["igstAmount"]
        doc_data["cessAmount"] = tax_results.get("cessAmount", 0.0)
        doc_data["grandTotal"] = tax_results["grandTotal"]
        doc_data["gstSummary"] = tax_results["gstSummary"]

    def create_transaction(self, payload: PurchaseVoucherCreate) -> Dict[str, Any]:
        doc_data = payload.model_dump()
        doc_data["createdAt"] = datetime.now()
        doc_data["updatedAt"] = datetime.now()
        
        # Calculate and apply taxes
        self._calculate_and_apply_taxes(doc_data, payload)
        
        if not doc_data.get("voucherNumber"):
            voucher_type = doc_data["voucherType"]
            prefix = PURCHASE_PREFIXES.get(voucher_type, "PI")
                
            seq = self.repo.get_dynamic_next_sequence(voucher_type, prefix, consume=True)
            year = datetime.now().year
            doc_data["voucherNumber"] = f"{prefix}-{year}-{str(seq).zfill(4)}"
            
        inserted_id = self.repo.insert_transaction(doc_data)
        doc_data["_id"] = inserted_id
        return serialize_doc(doc_data)

    def get_transaction(self, tx_id: str) -> Dict[str, Any]:
        # 1. Search in manual entries
        doc = self.repo.find_transaction_by_id(tx_id)
        if doc:
            return serialize_doc(doc)
            
        # 2. Search in existing vouchers
        doc = self.repo.find_voucher_by_id(tx_id)
        if doc:
            ref_val = doc.get("reference")
            ref_str = ""
            if isinstance(ref_val, dict):
                ref_str = ref_val.get("reference") or ""
            elif isinstance(ref_val, str):
                ref_str = ref_val
                
            mapped = {
                "_id": str(doc["_id"]),
                "voucherType": doc.get("voucherTypeName", "purchase_invoice").lower().replace(" ", "_"),
                "voucherNumber": doc.get("voucherNumber"),
                "voucherDate": doc.get("dates", {}).get("voucherDate"),
                "invoiceNumber": ref_str or doc.get("voucherNumber"),
                "invoiceDate": doc.get("dates", {}).get("voucherDate"),
                "debitNoteDate": doc.get("debitNoteDate"),
                "referenceNumber": doc.get("referenceNumber") or doc.get("reference"),
                "partyLedger": doc.get("partyLedgerName") or doc.get("partyName"),
                "partyGstin": doc.get("gstDetails", {}).get("gstin"),
                "purchaseLedger": doc.get("purchaseLedger") or doc.get("purchaseLedgerName"),
                "consigneeLedger": doc.get("consigneeLedger"),
                "consigneeGstin": doc.get("consigneeGstin") or "",
                "gstRegistration": doc.get("gstRegistration"),
                "gstRegistrationType": doc.get("gstRegistrationType"),
                "grandTotal": doc.get("totals", {}).get("grandTotal") or doc.get("total_amount") or 0.0,
                "narration": doc.get("narration"),
                "status": "approved",
                "productLines": doc.get("inventoryEntries", []),
                "purchaseLines": doc.get("ledgerEntries", []),
                "entryMode": doc.get("entryMode") or "manual",
                "ocrMetadata": doc.get("ocrMetadata"),
                "bulkMetadata": doc.get("bulkMetadata")
            }
            return mapped
            
        raise TransactionNotFoundException()

    def update_transaction(self, tx_id: str, payload: PurchaseVoucherCreate) -> Dict[str, Any]:
        update_data = payload.model_dump()
        update_data["updatedAt"] = datetime.now()
        
        # Calculate and apply taxes
        self._calculate_and_apply_taxes(update_data, payload)
        
        success = self.repo.update_transaction(tx_id, update_data)
        if not success:
            raise TransactionNotFoundException()
            
        from app.anjalee.services.tally.tally_service import TallyPushService
        TallyPushService.handle_voucher_update_sync(self.repo.db, tx_id, "purchase_vouchers")

        doc = self.repo.find_transaction_by_id(tx_id)
        return serialize_doc(doc)

    def delete_transaction(self, tx_id: str) -> None:
        self.repo.db["tally_payloads"].delete_many({"voucherId": ObjectId(tx_id)})
        success = self.repo.delete_transaction(tx_id)
        if not success:
            raise TransactionNotFoundException()

    async def update_status(self, tx_id: str, payload: StatusUpdate) -> Dict[str, Any]:
        from app.anjalee.services.tally.tally_service import TallyPushService
        status_val = payload.status
        note = payload.note

        if status_val.lower() == "approved":
            update_op = {
                "$set": {"status": "APPROVED", "updatedAt": datetime.now()},
                "$push": {
                    "activityLog": {
                        "action": "status_change_approved",
                        "note": note,
                        "at": datetime.now()
                    }
                }
            }
            self.repo.update_transaction_custom(tx_id, update_op)
            
            try:
                await TallyPushService.generate_and_save_xml(self.repo.db, tx_id, "purchase_vouchers")
                doc = self.repo.find_transaction_by_id(tx_id)
                return serialize_doc(doc)
            except Exception as e:
                fail_op = {
                    "$set": {"status": "FAILED_TALLY", "updatedAt": datetime.now()},
                    "$push": {
                        "activityLog": {
                            "action": "tally_push_failed",
                            "note": f"Tally XML generation or validation failed: {str(e)}",
                            "at": datetime.now()
                        }
                    }
                }
                self.repo.update_transaction_custom(tx_id, fail_op)
                doc = self.repo.find_transaction_by_id(tx_id)
                return serialize_doc(doc)

        elif status_val.lower() in ["posted_to_tally", "pushed"]:
            try:
                await TallyPushService.push_saved_payload_to_tally(self.repo.db, tx_id, "purchase_vouchers")
                doc = self.repo.find_transaction_by_id(tx_id)
                return serialize_doc(doc)
            except Exception as e:
                fail_op = {
                    "$set": {"status": "FAILED_TALLY", "updatedAt": datetime.now()},
                    "$push": {
                        "activityLog": {
                            "action": "tally_push_failed",
                            "note": f"Tally XML push failed: {str(e)}",
                            "at": datetime.now()
                        }
                    }
                }
                self.repo.update_transaction_custom(tx_id, fail_op)
                doc = self.repo.find_transaction_by_id(tx_id)
                return serialize_doc(doc)
        else:
            update_op = {
                "$set": {"status": payload.status, "updatedAt": datetime.now()},
                "$push": {
                    "activityLog": {
                        "action": f"status_change_{payload.status}",
                        "note": payload.note,
                        "at": datetime.now()
                    }
                }
            }
            success = self.repo.update_transaction_custom(tx_id, update_op)
            if not success:
                raise TransactionNotFoundException()
                
            doc = self.repo.find_transaction_by_id(tx_id)
            return serialize_doc(doc)

    def add_comment(self, tx_id: str, payload: CommentRequest) -> None:
        update_op = {
            "$push": {
                "activityLog": {
                    "action": "comment_added",
                    "note": payload.note,
                    "at": datetime.now()
                }
            }
        }
        success = self.repo.update_transaction_custom(tx_id, update_op)
        if not success:
            raise TransactionNotFoundException()

    def get_party_ledgers(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.repo.get_party_ledgers(company_id=company_id)

    def get_purchase_ledgers(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.repo.get_purchase_ledgers(company_id=company_id)

    def get_stock_items(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return stock items with name and hsnCode from the stockItems collection."""
        return self.repo.get_stock_items(company_id=company_id)

    def get_invoices_by_party(self, party_name: str) -> List[Dict[str, Any]]:
        """Fetch all purchase_invoice vouchers for a party — used for Debit Note reference dropdown."""
        docs = self.repo.get_invoices_by_party(party_name)
        return [serialize_doc(doc) for doc in docs]
