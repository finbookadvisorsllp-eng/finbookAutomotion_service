from datetime import datetime
from typing import List, Optional, Dict, Any
from app.anjalee.repositories.sales_repo import SalesRepository
from app.anjalee.schemas.sales_schemas import SalesTransactionCreate, StatusUpdate, CommentRequest
from app.anjalee.utils.serialization import serialize_doc
from app.anjalee.constants.business_constants import SALES_PREFIXES
from app.anjalee.exceptions.custom_exceptions import TransactionNotFoundException, InvalidDatabaseOperationException

class SalesService:
    def __init__(self, repo: SalesRepository):
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

    def create_transaction(self, payload: SalesTransactionCreate) -> Dict[str, Any]:
        doc_data = payload.model_dump()
        doc_data["createdAt"] = datetime.now()
        doc_data["updatedAt"] = datetime.now()
        
        if not doc_data.get("voucherNumber"):
            voucher_type = doc_data["voucherType"]
            prefix = SALES_PREFIXES.get(voucher_type, "SI")
                
            seq = self.repo.get_next_sequence_value(prefix)
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
                "voucherType": doc.get("voucherTypeName", "sales_invoice").lower().replace(" ", "_"),
                "voucherNumber": doc.get("voucherNumber"),
                "voucherDate": doc.get("dates", {}).get("voucherDate"),
                "invoiceNumber": ref_str or doc.get("voucherNumber"),
                "invoiceDate": doc.get("dates", {}).get("voucherDate"),
                "partyLedger": doc.get("partyLedgerName") or doc.get("partyName"),
                "partyGstin": doc.get("gstDetails", {}).get("gstin"),
                "grandTotal": doc.get("totals", {}).get("grandTotal") or doc.get("total_amount") or 0.0,
                "narration": doc.get("narration"),
                "status": "approved",
                "productLines": doc.get("inventoryEntries", []),
                "salesLines": doc.get("ledgerEntries", []),
                "entryMode": "manual"
            }
            return mapped
            
        raise TransactionNotFoundException()

    def update_transaction(self, tx_id: str, payload: SalesTransactionCreate) -> Dict[str, Any]:
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

    def submit_ocr_transaction(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        tx_payload = payload.get("transactionPayload", {})
        ocr_meta = payload.get("ocrMeta", {})
        
        tx_payload["entryMode"] = "ocr"
        tx_payload["ocrMetadata"] = ocr_meta
        tx_payload["createdAt"] = datetime.now()
        tx_payload["updatedAt"] = datetime.now()
        
        inserted_id = self.repo.insert_transaction(tx_payload)
        tx_payload["_id"] = inserted_id
        return serialize_doc(tx_payload)

    def calculate_without_item_sales(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates totals, GST, and TCS for "Without Item" sales entries.
        """
        state_codes = {
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

        # 1. Resolve Company State Code
        company_state_code = "23"  # Default fallback (Madhya Pradesh)
        try:
            comp = self.repo.db["companies"].find_one()
            if comp and "gstDetails" in comp:
                comp_gst = comp["gstDetails"].get("gstin") or ""
                if comp_gst and len(comp_gst.strip()) >= 2:
                    company_state_code = comp_gst.strip()[:2]
                else:
                    state_name = comp["gstDetails"].get("gstState") or ""
                    for code, name in state_codes.items():
                        if name.lower() in state_name.lower():
                            company_state_code = code
                            break
        except Exception:
            pass

        # 2. Resolve Party State Code
        party_state_code = ""
        party_gstin = payload.get("partyGstin") or ""
        if party_gstin and len(party_gstin.strip()) >= 2:
            party_state_code = party_gstin.strip()[:2]
        else:
            gst_reg = payload.get("gstRegistration") or ""
            for code, name in state_codes.items():
                if name.lower() in gst_reg.lower():
                    party_state_code = code
                    break

        # 3. Determine Tax Type
        if party_state_code:
            if party_state_code == company_state_code:
                tax_type = "CGST_SGST"
            else:
                tax_type = "IGST"
        else:
            tax_type = "CGST_SGST"

        # 4. Calculate Base Total
        base_total = 0.0
        sales_lines = payload.get("salesLines") or []
        for line in sales_lines:
            val = line.get("amount") or line.get("taxableValue") or 0.0
            base_total += float(val)

        add_charges = payload.get("additionalCharges") or []
        for line in add_charges:
            val = line.get("taxableValue") or line.get("amount") or 0.0
            base_total += float(val)

        subtotal = base_total

        # 5. GST Calculation
        gst_rate = float(payload.get("gstRate") or 18.0)
        cgst = 0.0
        sgst = 0.0
        igst = 0.0

        if tax_type == "CGST_SGST":
            cgst_rate = gst_rate / 2.0
            sgst_rate = gst_rate / 2.0
            cgst = base_total * cgst_rate / 100.0
            sgst = base_total * sgst_rate / 100.0
        else:
            igst = base_total * gst_rate / 100.0

        # 6. TCS Calculation
        tcs_total = 0.0
        tcs_details = payload.get("tcsDetails") or []
        for row in tcs_details:
            assessable = float(row.get("assessableValue") or 0.0)
            tcs_rate = float(row.get("rate") or 0.0)
            row_tcs = assessable * tcs_rate / 100.0
            tcs_total += row_tcs

        # 7. Round Off
        actual_total = base_total + cgst + sgst + igst + tcs_total
        round_off = 0.0
        grand_total = actual_total

        if payload.get("enableRoundOff", True):
            grand_total = round(actual_total)
            round_off = grand_total - actual_total

        gst_details = []
        if cgst > 0:
            gst_details.append({
                "gstType": "CGST",
                "ledgerName": "Output CGST",
                "rate": gst_rate / 2.0,
                "amount": round(cgst, 2)
            })
        if sgst > 0:
            gst_details.append({
                "gstType": "SGST",
                "ledgerName": "Output SGST",
                "rate": gst_rate / 2.0,
                "amount": round(sgst, 2)
            })
        if igst > 0:
            gst_details.append({
                "gstType": "IGST",
                "ledgerName": "Output IGST",
                "rate": gst_rate,
                "amount": round(igst, 2)
            })

        return {
            "base_total": round(base_total, 2),
            "subtotal": round(subtotal, 2),
            "cgst": round(cgst, 2),
            "sgst": round(sgst, 2),
            "igst": round(igst, 2),
            "tcs": round(tcs_total, 2),
            "round_off": round(round_off, 2),
            "grand_total": round(grand_total, 2),
            "tax_type": tax_type,
            "gstDetails": gst_details
        }
