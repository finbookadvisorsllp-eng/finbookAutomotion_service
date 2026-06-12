from datetime import datetime
from typing import List, Optional, Dict, Any
from app.anjalee.repositories.purchase_repo import PurchaseRepository
from app.anjalee.schemas.purchase_schemas import PurchaseVoucherCreate, StatusUpdate, CommentRequest
from app.anjalee.utils.serialization import serialize_doc
from app.anjalee.constants.business_constants import PURCHASE_PREFIXES
from app.anjalee.exceptions.custom_exceptions import TransactionNotFoundException

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

    def create_transaction(self, payload: PurchaseVoucherCreate) -> Dict[str, Any]:
        doc_data = payload.model_dump()
        doc_data["createdAt"] = datetime.now()
        doc_data["updatedAt"] = datetime.now()
        
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
                "gstRegistration": doc.get("gstRegistration"),
                "gstRegistrationType": doc.get("gstRegistrationType"),
                "grandTotal": doc.get("totals", {}).get("grandTotal") or doc.get("total_amount") or 0.0,
                "narration": doc.get("narration"),
                "status": "approved",
                "productLines": doc.get("inventoryEntries", []),
                "purchaseLines": doc.get("ledgerEntries", []),
                "entryMode": "manual"
            }
            return mapped
            
        raise TransactionNotFoundException()

    def update_transaction(self, tx_id: str, payload: PurchaseVoucherCreate) -> Dict[str, Any]:
        update_data = payload.model_dump()
        update_data["updatedAt"] = datetime.now()
        
        success = self.repo.update_transaction(tx_id, update_data)
        if not success:
            raise TransactionNotFoundException()
            
        doc = self.repo.find_transaction_by_id(tx_id)
        return serialize_doc(doc)

    def delete_transaction(self, tx_id: str) -> None:
        success = self.repo.delete_transaction(tx_id)
        if not success:
            raise TransactionNotFoundException()

    def update_status(self, tx_id: str, payload: StatusUpdate) -> Dict[str, Any]:
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

    def get_party_ledgers(self) -> List[Dict[str, Any]]:
        return self.repo.get_party_ledgers()

    def get_purchase_ledgers(self) -> List[Dict[str, Any]]:
        return self.repo.get_purchase_ledgers()

    def get_stock_items(self) -> List[Dict[str, Any]]:
        """Return stock items with name and hsnCode from the stockItems collection."""
        return self.repo.get_stock_items()

    def get_invoices_by_party(self, party_name: str) -> List[Dict[str, Any]]:
        """Fetch all purchase_invoice vouchers for a party — used for Debit Note reference dropdown."""
        docs = self.repo.get_invoices_by_party(party_name)
        return [serialize_doc(doc) for doc in docs]
