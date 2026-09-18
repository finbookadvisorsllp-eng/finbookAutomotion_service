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
        limit: int = 50,
        company_id: Optional[str] = None
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
        
        from app.anjalee.services.tally.tally_service import TallyPushService
        TallyPushService.handle_voucher_update_sync(self.repo.db, tx_id, "fund_flow_vouchers")

        doc = self.repo.find_transaction_by_id(tx_id)
        return serialize_doc(doc)

    def delete_transaction(self, tx_id: str) -> None:
        doc = self.repo.find_transaction_by_id(tx_id)
        if not doc:
            raise TransactionNotFoundException()
            
        self.repo.db["tally_payloads"].delete_many({"voucherId": ObjectId(tx_id)})
        
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
                await TallyPushService.generate_and_save_xml(self.repo.db, tx_id, "fund_flow_vouchers")
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
                await TallyPushService.push_saved_payload_to_tally(self.repo.db, tx_id, "fund_flow_vouchers")
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

    def get_bank_statement(
        self,
        bank_ledger: str,
        company_id: Optional[str] = None,
        voucher_type: Optional[str] = None,
        source: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch all vouchers connected to a specific bank ledger across all collections:
        - Tally synced vouchers ('vouchers')
        - Manual / Fund Flow vouchers ('fund_flow_transactions' / 'fundflow')
        - Sales & Purchase vouchers ('sales_vouchers', 'purchase_vouchers')
        """
        db = self.repo.db
        if not bank_ledger:
            return {
                "success": True,
                "data": {
                    "vouchers": [],
                    "kpis": {"totalReceipts": 0.0, "totalPayments": 0.0, "netAmount": 0.0, "totalCount": 0}
                }
            }

        seen_ids = set()
        seen_keys = set()
        all_vouchers = []

        regex_bank = {"$regex": f"^{regex_escape(bank_ledger)}$", "$options": "i"} if bank_ledger else None

        # 1. Search in 'vouchers' collection (Tally Synced + Bulk Excel saved)
        v_query = {
            "$or": [
                {"bankLedger": regex_bank},
                {"partyLedgerName": regex_bank},
                {"ledgerEntries.ledgerName": regex_bank},
                {"ledgerRows.ledgerName": regex_bank},
                {"againstLedger": regex_bank}
            ]
        }
        v_docs = list(db["vouchers"].find(v_query).sort("createdAt", -1).limit(500))

        for doc in v_docs:
            doc_id = str(doc["_id"])
            if doc_id in seen_ids:
                continue

            v_type_raw = (doc.get("voucherTypeName") or doc.get("voucherType") or "").lower()
            v_type = "Payment"
            if "receipt" in v_type_raw or v_type_raw == "bank_payment":
                v_type = "Receipt"
            elif "contra" in v_type_raw:
                v_type = "Contra"

            # Determine opposite party name
            party_name = doc.get("partyLedgerName") or doc.get("partyName") or ""
            if not party_name or party_name.lower() == bank_ledger.lower():
                # Extract from ledgerEntries / ledgerRows
                entries = doc.get("ledgerEntries") or doc.get("ledgerRows") or []
                for e in entries:
                    e_name = e.get("ledgerName") or e.get("name") or ""
                    if e_name and e_name.lower() != bank_ledger.lower():
                        party_name = e_name
                        break

            # Determine source
            created_via = (doc.get("createdVia") or doc.get("source") or doc.get("entryMode") or "").lower()
            if "excel" in created_via:
                src = "excel_upload"
            elif "manual" in created_via:
                src = "manual_entry"
            else:
                src = "tally_sync"

            amt = 0.0
            totals_obj = doc.get("totals") or {}
            amt = float(totals_obj.get("grandTotal") or totals_obj.get("totalAmount") or doc.get("total_amount") or doc.get("amount") or 0.0)
            if amt == 0.0:
                entries = doc.get("ledgerEntries") or doc.get("ledgerRows") or []
                for e in entries:
                    if (e.get("ledgerName") or "").lower() == bank_ledger.lower():
                        amt = abs(float(e.get("amount") or 0.0))
                        break

            dates_dict = doc.get("dates") if isinstance(doc.get("dates"), dict) else {}
            v_date = (
                dates_dict.get("date") or
                dates_dict.get("effectiveDate") or
                dates_dict.get("voucherDate") or
                doc.get("voucherDate") or
                doc.get("date") or
                doc.get("createdAt")
            )
            v_num = doc.get("voucherNumber") or doc.get("voucherNumbering") or (doc.get("reference") if isinstance(doc.get("reference"), str) else "") or "—"


            key = (str(v_num), str(amt), str(v_date)[:10])
            if key in seen_keys:
                continue

            seen_ids.add(doc_id)
            seen_keys.add(key)
            all_vouchers.append({
                "id": doc_id,
                "voucherNumber": v_num,
                "voucherDate": v_date,
                "voucherType": v_type,
                "partyName": party_name or "—",
                "amount": round(amt, 2),
                "source": src,
                "status": doc.get("status") or "approved",
                "narration": doc.get("narration") or ""
            })

        # 2. Search in 'fund_flow_transactions' / 'fundflow' collection
        ff_query = {
            "$or": [
                {"bankLedger": regex_bank},
                {"againstLedger": regex_bank},
                {"partyLedger": regex_bank},
                {"ledgerRows.ledgerName": regex_bank}
            ]
        }
        ff_docs = list(db["fund_flow_transactions"].find(ff_query).sort("createdAt", -1).limit(500))
        if not ff_docs:
            ff_docs = list(db["fundflow"].find(ff_query).sort("createdAt", -1).limit(500))

        for doc in ff_docs:
            doc_id = str(doc["_id"])
            if doc_id in seen_ids:
                continue

            raw_type = (doc.get("voucherType") or "").lower()
            v_type = "Payment"
            if raw_type in ["bank_payment", "receipt"]:
                v_type = "Receipt"
            elif raw_type in ["cash_payment", "payment"]:
                v_type = "Payment"
            elif raw_type == "contra":
                v_type = "Contra"

            party_name = doc.get("partyLedger") or ""
            if not party_name or party_name.lower() == bank_ledger.lower():
                rows = doc.get("ledgerRows") or []
                for r in rows:
                    r_name = r.get("ledgerName") or ""
                    if r_name and r_name.lower() != bank_ledger.lower():
                        party_name = r_name
                        break

            created_via = (doc.get("createdVia") or doc.get("entryMode") or "").lower()
            if "excel" in created_via:
                src = "excel_upload"
            else:
                src = "manual_entry"

            amt = float(doc.get("amount") or doc.get("transferAmount") or 0.0)
            v_date = doc.get("voucherDate") or doc.get("createdAt")
            v_num = doc.get("voucherNumber") or "—"

            key = (str(v_num), str(amt), str(v_date)[:10])
            if key in seen_keys:
                continue

            seen_ids.add(doc_id)
            seen_keys.add(key)
            all_vouchers.append({
                "id": doc_id,
                "voucherNumber": v_num,
                "voucherDate": v_date,
                "voucherType": v_type,
                "partyName": party_name or "—",
                "amount": round(amt, 2),
                "source": src,
                "status": doc.get("status") or "draft",
                "narration": doc.get("narration") or ""
            })

        # Apply Filters if requested
        if voucher_type:
            all_vouchers = [v for v in all_vouchers if v["voucherType"].lower() == voucher_type.lower()]
        if source:
            all_vouchers = [v for v in all_vouchers if v["source"].lower() == source.lower()]
        if search:
            q = search.lower()
            all_vouchers = [
                v for v in all_vouchers if
                q in v["partyName"].lower() or
                q in str(v["voucherNumber"]).lower() or
                q in v["narration"].lower()
            ]

        # Calculate KPIs
        total_receipts = sum(v["amount"] for v in all_vouchers if v["voucherType"] == "Receipt")
        total_payments = sum(v["amount"] for v in all_vouchers if v["voucherType"] == "Payment")
        net_amount = total_receipts - total_payments

        return {
            "vouchers": all_vouchers,
            "kpis": {
                "totalReceipts": round(total_receipts, 2),
                "totalPayments": round(total_payments, 2),
                "netAmount": round(net_amount, 2),
                "totalCount": len(all_vouchers)
            }
        }


def regex_escape(string: str) -> str:
    import re
    return re.escape(string)

