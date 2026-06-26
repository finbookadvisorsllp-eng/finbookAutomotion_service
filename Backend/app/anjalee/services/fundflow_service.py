from datetime import datetime
from typing import List, Optional, Dict, Any
from bson import ObjectId
from app.anjalee.repositories.fundflow_repo import FundFlowRepository
from app.anjalee.schemas.fundflow_schemas import FundFlowTransactionCreate, StatusUpdate, CommentRequest
from app.anjalee.utils.serialization import serialize_doc
from app.anjalee.constants.business_constants import FUNDFLOW_PREFIXES
from app.anjalee.exceptions.custom_exceptions import TransactionNotFoundException

class FundFlowService:
    def __init__(self, repo: FundFlowRepository):
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
            total_amount += float(doc.get("amount") or doc.get("transferAmount") or 0.0)
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
                {"referenceNumber": {"$regex": search, "$options": "i"}}
            ]
            
        total = self.repo.count_transactions(query)
        cursor = self.repo.find_transactions(query, skip=(page - 1) * limit, limit=limit)
        
        results = [serialize_doc(doc) for doc in cursor]
            
        return {
            "results": results,
            "total": total
        }

    def create_transaction(self, payload: FundFlowTransactionCreate) -> Dict[str, Any]:
        doc_data = payload.model_dump()
        doc_data["createdAt"] = datetime.now()
        doc_data["updatedAt"] = datetime.now()
        
        if not doc_data.get("voucherNumber"):
            voucher_type = doc_data["voucherType"]
            prefix = FUNDFLOW_PREFIXES.get(voucher_type, "PV")
                
            seq = self.repo.get_next_sequence_value(prefix)
            year = datetime.now().year
            doc_data["voucherNumber"] = f"{prefix}-{year}-{str(seq).zfill(4)}"
            
        inserted_id = self.repo.insert_transaction(doc_data)
        doc_data["_id"] = inserted_id
        
        # Update invoice balances
        bill_rows = doc_data.get("billRows") or []
        self._update_invoice_balances(bill_rows)
        
        return serialize_doc(doc_data)

    def get_transaction(self, tx_id: str) -> Dict[str, Any]:
        # 1. Search manual entries
        doc = self.repo.find_transaction_by_id(tx_id)
        if doc:
            return serialize_doc(doc)
            
        # 2. Search existing vouchers
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
                "voucherType": doc.get("voucherTypeName", "bank_payment").lower().replace(" ", "_"),
                "voucherNumber": doc.get("voucherNumber"),
                "voucherDate": doc.get("dates", {}).get("voucherDate"),
                "referenceNumber": ref_str or doc.get("voucherNumber"),
                "partyLedger": doc.get("partyLedgerName") or doc.get("partyName"),
                "amount": doc.get("totals", {}).get("grandTotal") or doc.get("total_amount") or 0.0,
                "narration": doc.get("narration"),
                "status": "approved",
                "consigneeGstin": None,
                "entryMode": doc.get("entryMode") or "manual",
                "billRows": doc.get("billRows") or [],
                "ledgerRows": doc.get("ledgerRows") or [],
                "costCenters": doc.get("costCenters") or [],
                "costCenterApplicable": doc.get("costCenterApplicable") or False,
                "excessOption": doc.get("excessOption"),
                "remarks": doc.get("remarks")
            }
            return mapped
            
        raise TransactionNotFoundException()

    def update_transaction(self, tx_id: str, payload: FundFlowTransactionCreate) -> Dict[str, Any]:
        # Retrieve the OLD transaction first to reverse its old allocations
        old_doc = self.repo.find_transaction_by_id(tx_id)
        if not old_doc:
            raise TransactionNotFoundException()
            
        old_bill_rows = old_doc.get("billRows") or []
        self._reverse_invoice_balances(old_bill_rows, exclude_tx_id=tx_id)
        
        update_data = payload.model_dump()
        update_data["updatedAt"] = datetime.now()
        
        success = self.repo.update_transaction(tx_id, update_data)
        if not success:
            raise TransactionNotFoundException()
            
        # Update invoice balances with the NEW allocations
        new_bill_rows = update_data.get("billRows") or []
        self._update_invoice_balances(new_bill_rows)
        
        doc = self.repo.find_transaction_by_id(tx_id)
        return serialize_doc(doc)

    def delete_transaction(self, tx_id: str) -> None:
        doc = self.repo.find_transaction_by_id(tx_id)
        if not doc:
            raise TransactionNotFoundException()
            
        # Reverse invoice balances
        bill_rows = doc.get("billRows") or []
        self._reverse_invoice_balances(bill_rows, exclude_tx_id=tx_id)
        
        success = self.repo.delete_transaction(tx_id)
        if not success:
            raise TransactionNotFoundException()

    def _find_invoice_doc(self, db, bill_ref: str) -> Optional[tuple]:
        if not bill_ref:
            return None
        
        # Try vouchers
        doc = db["vouchers"].find_one({
            "$or": [
                {"voucherNumber": bill_ref},
                {"voucherGuid": bill_ref}
            ]
        })
        if doc:
            return "vouchers", doc
            
        # Try purchase_vouchers
        doc = db["purchase_vouchers"].find_one({
            "$or": [
                {"voucherNumber": bill_ref},
                {"invoiceNumber": bill_ref}
            ]
        })
        if doc:
            return "purchase_vouchers", doc
            
        # Try sales_vouchers
        doc = db["sales_vouchers"].find_one({
            "voucherNumber": bill_ref
        })
        if doc:
            return "sales_vouchers", doc
            
        return None

    def _get_bill_amount(self, coll_name: str, doc: dict) -> float:
        if coll_name == "vouchers":
            totals_obj = doc.get("totals") or {}
            return float(totals_obj.get("totalAmount") or totals_obj.get("totalDebit") or totals_obj.get("totalCredit") or 0.0)
        elif coll_name == "purchase_vouchers":
            return float(doc.get("grandTotal") or 0.0)
        elif coll_name == "sales_vouchers":
            return float(doc.get("grandTotal") or 0.0)
        return 0.0

    def _update_invoice_balances(self, bill_rows: List[Dict[str, Any]]) -> None:
        db = self.repo.db
        for row in bill_rows:
            bill_ref = row.get("billNo") or row.get("billRef") or ""
            if not bill_ref:
                continue
                
            res = self._find_invoice_doc(db, bill_ref)
            if not res:
                continue
                
            coll_name, doc = res
            invoice_amount = self._get_bill_amount(coll_name, doc)
            
            # Sum up all non-deleted fundflows' allocationAmount matching this bill_ref
            paid_amount = 0.0
            ff_records = list(db["fundflow"].find({
                "status": {"$ne": "deleted"},
                "billRows": {
                    "$elemMatch": {
                        "$or": [
                            {"billNo": bill_ref},
                            {"billRef": bill_ref}
                        ]
                    }
                }
            }))
            for ff in ff_records:
                for r in ff.get("billRows") or []:
                    r_ref = r.get("billNo") or r.get("billRef") or ""
                    if r_ref == bill_ref:
                        paid_amount += float(r.get("allocationAmount") or r.get("allocatedAmount") or r.get("allocation_amount") or 0.0)
            
            new_outstanding = max(0.0, round(invoice_amount - paid_amount, 2))
            allocation_amount = float(row.get("allocationAmount") or row.get("allocatedAmount") or row.get("allocation_amount") or 0.0)
            
            db[coll_name].update_one(
                {"_id": doc["_id"]},
                {"$set": {
                    "paid_amount": round(paid_amount, 2),
                    "paidAmount": round(paid_amount, 2),
                    "outstanding_amount": new_outstanding,
                    "outstandingAmount": new_outstanding,
                    "invoice_amount": invoice_amount,
                    "invoiceAmount": invoice_amount,
                    "allocation_amount": allocation_amount,
                    "allocationAmount": allocation_amount
                }}
            )

    def _reverse_invoice_balances(self, bill_rows: List[Dict[str, Any]], exclude_tx_id: Optional[str] = None) -> None:
        db = self.repo.db
        for row in bill_rows:
            bill_ref = row.get("billNo") or row.get("billRef") or ""
            if not bill_ref:
                continue
                
            res = self._find_invoice_doc(db, bill_ref)
            if not res:
                continue
                
            coll_name, doc = res
            invoice_amount = self._get_bill_amount(coll_name, doc)
            
            # Sum up all non-deleted fundflows' allocationAmount except exclude_tx_id
            paid_amount = 0.0
            query = {
                "status": {"$ne": "deleted"},
                "billRows": {
                    "$elemMatch": {
                        "$or": [
                            {"billNo": bill_ref},
                            {"billRef": bill_ref}
                        ]
                    }
                }
            }
            if exclude_tx_id:
                try:
                    query["_id"] = {"$ne": ObjectId(exclude_tx_id)}
                except Exception:
                    pass
                    
            ff_records = list(db["fundflow"].find(query))
            for ff in ff_records:
                for r in ff.get("billRows") or []:
                    r_ref = r.get("billNo") or r.get("billRef") or ""
                    if r_ref == bill_ref:
                        paid_amount += float(r.get("allocationAmount") or r.get("allocatedAmount") or r.get("allocation_amount") or 0.0)
            
            new_outstanding = max(0.0, round(invoice_amount - paid_amount, 2))
            
            db[coll_name].update_one(
                {"_id": doc["_id"]},
                {"$set": {
                    "paid_amount": round(paid_amount, 2),
                    "paidAmount": round(paid_amount, 2),
                    "outstanding_amount": new_outstanding,
                    "outstandingAmount": new_outstanding,
                    "invoice_amount": invoice_amount,
                    "invoiceAmount": invoice_amount
                }}
            )


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

    def get_next_voucher_number(self, voucher_type: str) -> str:
        from app.anjalee.constants.business_constants import FUNDFLOW_PREFIXES
        prefix = FUNDFLOW_PREFIXES.get(voucher_type, "PV")
        seq = self.repo.peek_next_sequence_value(prefix)
        year = datetime.now().year
        return f"{prefix}-{year}-{str(seq).zfill(4)}"

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
