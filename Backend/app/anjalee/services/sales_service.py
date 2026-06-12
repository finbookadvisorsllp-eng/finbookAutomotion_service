from datetime import datetime
from typing import Dict, Any, List, Optional
from bson import ObjectId
from app.anjalee.repositories.sales_repo import SalesVoucherRepository
from app.anjalee.schemas.sales_schemas import SalesVoucherCreate, SalesVoucherUpdate
from app.anjalee.utils.gst_calculator import calculate_taxes
from app.anjalee.utils.serialization import serialize_doc
from fastapi import HTTPException, status

class SalesVoucherService:
    def __init__(self, repo: SalesVoucherRepository):
        self.repo = repo

    async def create_voucher(self, payload: SalesVoucherCreate) -> Dict[str, Any]:
        # 1. Resolve Company State and ID
        company_state = await self.repo.get_company_state()
        comp_doc = await self.repo.db["companies"].find_one()
        company_id = comp_doc["_id"] if comp_doc else None

        # 2. Resolve Party State and Details
        party_details = await self.repo.get_party_details(payload.partyLedgerName)
        party_state = party_details["gstState"] or company_state

        # 3. Generate Sequential Voucher Number if not provided or if series is Default
        # Change by Anjalee: Use Tally-style type-specific prefix for voucher numbering
        voucher_type_raw = (payload.voucherType or "sales_invoice").lower().replace(" ", "_")
        voucher_number = payload.voucherNumber
        if not voucher_number or payload.voucherSeries == "Default":
            prefix_map = {
                "sales_invoice": "SI",
                "sales_order": "SO",
                "credit_note": "CN",
            }
            prefix = prefix_map.get(voucher_type_raw, "SV")
            seq = await self.repo.get_dynamic_next_sequence(voucher_type_raw, prefix, consume=True)
            year = datetime.now().year
            voucher_number = f"{prefix}-{year}-{str(seq).zfill(4)}"

        # 4. Convert Pydantic entries to dictionaries for calculation
        sales_entries_dict = [entry.model_dump() for entry in payload.salesEntries] if payload.salesEntries else []
        inventory_entries_dict = [entry.model_dump() for entry in payload.inventoryEntries] if payload.inventoryEntries else []

        # Sum TCS details if tcsAmount is not explicitly provided
        tcs_amount = payload.tcsAmount
        if not tcs_amount and payload.tcsDetails:
            tcs_amount = sum(float(item.get("amount") or 0.0) for item in payload.tcsDetails)

        # 5. GST and Totals Calculations
        tax_results = calculate_taxes(
            company_state=company_state,
            party_state=party_state,
            sales_entries=sales_entries_dict,
            inventory_entries=inventory_entries_dict,
            tcs_amount=tcs_amount,
            round_off_amount=payload.roundOffAmount,
            additional_charges=payload.additionalCharges
        )

        # 6. Map to MongoDB schema
        doc_data = {
            "companyId": company_id,
            "voucherNumber": voucher_number,
            "voucherDate": payload.voucherDate or datetime.utcnow().strftime("%Y-%m-%d"),
            "voucherType": payload.voucherType or "Sales Order",
            "voucherSeries": payload.voucherSeries or "Default",
            "referenceNumber": payload.referenceNumber,
            "creditNoteDate": payload.creditNoteDate,
            "salesLedger": payload.salesLedger,
            "consigneeLedger": payload.consigneeLedger,
            "partyLedgerId": ObjectId(party_details["id"]) if party_details["id"] else None,
            "partyLedgerName": party_details["name"],
            "partyGSTIN": party_details["gstin"] or payload.partyGSTIN or "",
            "gstRegistrationType": payload.gstRegistrationType,
            "partyState": party_state,
            "companyState": company_state,
            "isIntraState": tax_results["isIntraState"],
            "taxType": tax_results["taxType"],
            "baseAmount": tax_results["baseAmount"],
            "cgstAmount": tax_results["cgstAmount"],
            "sgstAmount": tax_results["sgstAmount"],
            "igstAmount": tax_results["igstAmount"],
            "tcsAmount": tcs_amount,
            "roundOffAmount": payload.roundOffAmount,
            "grandTotal": tax_results["grandTotal"],
            "entryTab": payload.entryTab or ("with_item" if inventory_entries_dict else "without_item"),
            "gstRegistration": payload.gstRegistration,
            "salesEntries": [
                {
                    "ledgerId": ObjectId(entry.ledgerId) if entry.ledgerId else None,
                    "ledgerName": entry.ledgerName,
                    "description": entry.description or "",
                    "hsnSacCode": entry.hsnSacCode or "",
                    "gstRate": entry.gstRate,
                    "amount": entry.amount
                } for entry in payload.salesEntries
            ],
            "inventoryEntries": [
                {
                    "stockItemId": ObjectId(entry.stockItemId) if entry.stockItemId else None,
                    "stockItem": entry.stockItem,
                    "description": entry.description or "",
                    "hsnSacCode": entry.hsnSacCode or "",
                    "billQuantity": entry.billQuantity,
                    "billRate": entry.billRate,
                    "discountPercent": entry.discountPercent,
                    "amount": entry.amount,
                    "rcm": entry.rcm,
                    "taxabilityType": entry.taxabilityType,
                    "gstRate": entry.gstRate
                } for entry in payload.inventoryEntries
            ] if payload.inventoryEntries else [],
            "additionalCharges": payload.additionalCharges or [],
            "tcsDetails": payload.tcsDetails or [],
            "tdsDetails": payload.tdsDetails or [],
            "gstSummary": tax_results["gstSummary"],
            "narration": payload.narration or "",
            # Change by Anjalee: Save invoiceNumber (customer-facing bill number) to DB
            "invoiceNumber": payload.invoiceNumber or "",
            "status": (payload.status or "DRAFT").upper(),
            "isDeleted": False,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }

        inserted_id = await self.repo.insert_voucher(doc_data)
        doc_data["_id"] = inserted_id
        return serialize_doc(doc_data)

    async def list_vouchers(
        self, 
        page: int = 1, 
        limit: int = 50,
        voucher_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        skip = (page - 1) * limit
        query = {}

        if voucher_type:
            types = [voucher_type, voucher_type.replace("_", " "), voucher_type.replace(" ", "_")]
            types = list(set(types))
            regex_pattern = "^(" + "|".join(types) + ")$"
            query["voucherType"] = {"$regex": regex_pattern, "$options": "i"}

        if status:
            statuses = [s.strip().upper() for s in status.split(",")]
            query["status"] = {"$in": statuses}

        if search:
            query["$or"] = [
                {"partyLedgerName": {"$regex": search, "$options": "i"}},
                {"voucherNumber": {"$regex": search, "$options": "i"}},
                {"partyGSTIN": {"$regex": search, "$options": "i"}}
            ]

        total = await self.repo.count_vouchers(query)
        vouchers = await self.repo.find_vouchers(query, skip=skip, limit=limit)
        results = [serialize_doc(doc) for doc in vouchers]
        return {
            "results": results,
            "total": total
        }

    async def get_voucher(self, voucher_id: str) -> Dict[str, Any]:
        doc = await self.repo.find_voucher_by_id(voucher_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sales voucher with ID {voucher_id} not found"
            )
        return serialize_doc(doc)

    async def update_voucher(self, voucher_id: str, payload: SalesVoucherUpdate) -> Dict[str, Any]:
        existing_doc = await self.repo.find_voucher_by_id(voucher_id)
        if not existing_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sales voucher with ID {voucher_id} not found"
            )

        update_fields = {}
        dump = payload.model_dump(exclude_unset=True)

        # Merge fields
        merged_doc = {**existing_doc, **dump}

        # Resolve party details if partyLedgerName changed
        party_ledger_name = merged_doc.get("partyLedgerName")
        party_details = await self.repo.get_party_details(party_ledger_name)
        party_state = party_details["gstState"] or merged_doc.get("companyState")

        # Convert entries to dicts for tax calculation
        sales_entries = merged_doc.get("salesEntries") or []
        sales_entries_dict = []
        for e in sales_entries:
            if isinstance(e, dict):
                sales_entries_dict.append(e)
            else:
                sales_entries_dict.append(e.model_dump())

        inventory_entries = merged_doc.get("inventoryEntries") or []
        inventory_entries_dict = []
        for e in inventory_entries:
            if isinstance(e, dict):
                inventory_entries_dict.append(e)
            else:
                inventory_entries_dict.append(e.model_dump())

        # Sum TCS details if tcsAmount is not explicitly provided
        tcs_amount = merged_doc.get("tcsAmount") or 0.0
        tcs_details = merged_doc.get("tcsDetails") or []
        if not tcs_amount and tcs_details:
            tcs_amount = sum(float(item.get("amount") or 0.0) for item in tcs_details)

        # Recalculate taxes
        tax_results = calculate_taxes(
            company_state=merged_doc.get("companyState") or "Madhya Pradesh",
            party_state=party_state,
            sales_entries=sales_entries_dict,
            inventory_entries=inventory_entries_dict,
            tcs_amount=tcs_amount,
            round_off_amount=merged_doc.get("roundOffAmount") or 0.0,
            additional_charges=merged_doc.get("additionalCharges")
        )

        # Fields to set in update
        update_data = {
            "voucherNumber": merged_doc.get("voucherNumber"),
            "voucherDate": merged_doc.get("voucherDate"),
            "voucherType": merged_doc.get("voucherType"),
            "voucherSeries": merged_doc.get("voucherSeries"),
            "referenceNumber": merged_doc.get("referenceNumber"),
            "creditNoteDate": merged_doc.get("creditNoteDate"),
            "salesLedger": merged_doc.get("salesLedger"),
            "consigneeLedger": merged_doc.get("consigneeLedger"),
            "partyLedgerId": ObjectId(party_details["id"]) if party_details["id"] else None,
            "partyLedgerName": party_details["name"],
            "partyGSTIN": party_details["gstin"] or merged_doc.get("partyGSTIN") or "",
            "gstRegistrationType": merged_doc.get("gstRegistrationType"),
            "partyState": party_state,
            "companyState": merged_doc.get("companyState"),
            "isIntraState": tax_results["isIntraState"],
            "taxType": tax_results["taxType"],
            "baseAmount": tax_results["baseAmount"],
            "cgstAmount": tax_results["cgstAmount"],
            "sgstAmount": tax_results["sgstAmount"],
            "igstAmount": tax_results["igstAmount"],
            "tcsAmount": tcs_amount,
            "roundOffAmount": merged_doc.get("roundOffAmount") or 0.0,
            "grandTotal": tax_results["grandTotal"],
            "entryTab": merged_doc.get("entryTab") or ("with_item" if inventory_entries_dict else "without_item"),
            "gstRegistration": merged_doc.get("gstRegistration"),
            "salesEntries": [
                {
                    "ledgerId": ObjectId(entry["ledgerId"]) if entry.get("ledgerId") else None,
                    "ledgerName": entry["ledgerName"],
                    "description": entry.get("description") or "",
                    "hsnSacCode": entry.get("hsnSacCode") or "",
                    "gstRate": entry.get("gstRate") or 0.0,
                    "amount": entry.get("amount") or 0.0
                } for entry in sales_entries_dict
            ],
            "inventoryEntries": [
                {
                    "stockItemId": ObjectId(entry["stockItemId"]) if entry.get("stockItemId") else None,
                    "stockItem": entry["stockItem"],
                    "description": entry.get("description") or "",
                    "hsnSacCode": entry.get("hsnSacCode") or "",
                    "billQuantity": entry.get("billQuantity") or 0.0,
                    "billRate": entry.get("billRate") or 0.0,
                    "discountPercent": entry.get("discountPercent") or 0.0,
                    "amount": entry.get("amount") or 0.0,
                    "rcm": entry.get("rcm") or False,
                    "taxabilityType": entry.get("taxabilityType") or "Taxable",
                    "gstRate": entry.get("gstRate") or 0.0
                } for entry in inventory_entries_dict
            ] if inventory_entries_dict else [],
            "additionalCharges": merged_doc.get("additionalCharges") or [],
            "tcsDetails": merged_doc.get("tcsDetails") or [],
            "tdsDetails": merged_doc.get("tdsDetails") or [],
            "gstSummary": tax_results["gstSummary"],
            "narration": merged_doc.get("narration") or "",
            # Change by Anjalee: Persist invoiceNumber (customer-facing bill number) on update
            "invoiceNumber": merged_doc.get("invoiceNumber") or "",
            "status": (merged_doc.get("status") or "DRAFT").upper(),
            "updatedAt": datetime.utcnow()
        }

        success = await self.repo.update_voucher(voucher_id, update_data)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update voucher"
            )

        updated_doc = await self.repo.find_voucher_by_id(voucher_id)
        return serialize_doc(updated_doc)

    async def delete_voucher(self, voucher_id: str) -> None:
        success = await self.repo.delete_voucher(voucher_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sales voucher with ID {voucher_id} not found"
            )

    async def get_party_ledgers(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return await self.repo.get_party_ledgers(company_id=company_id)

    async def get_sales_ledgers(self) -> List[Dict[str, Any]]:
        return await self.repo.get_sales_ledgers()

    async def get_stock_items(self) -> List[Dict[str, Any]]:
        """Return stock items with name and hsnCode from the stockItems collection."""
        return await self.repo.get_stock_items()

    async def get_invoices_by_party(self, party_name: str) -> List[Dict[str, Any]]:
        """Change by Anjalee: Fetch all sales_invoice vouchers for a party — used for Credit Note reference dropdown."""
        import re
        escaped = re.escape(party_name)
        query = {
            "voucherType": {"$regex": "^sales.invoice$".replace(".", "_"), "$options": "i"},
            "partyLedgerName": {"$regex": f"^{escaped}$", "$options": "i"},
            "isDeleted": {"$ne": True},
        }
        # Also match 'sales invoice' with space variant
        query["voucherType"] = {"$regex": "^(sales_invoice|sales invoice)$", "$options": "i"}
        cursor = self.repo.db["sales_vouchers"].find(query).sort("createdAt", -1).limit(200)
        docs = await cursor.to_list(length=200)
        return [serialize_doc(doc) for doc in docs]

    async def get_summary_stats(self, voucher_type: str, company_id: Optional[str]) -> Dict[str, Any]:
        total_amount = 0.0
        count = 0
        pending_review = 0
        approved_count = 0
        
        query = {}
        if voucher_type:
            types = [voucher_type, voucher_type.replace("_", " "), voucher_type.replace(" ", "_")]
            types = list(set(types))
            regex_pattern = "^(" + "|".join(types) + ")$"
            query["voucherType"] = {"$regex": regex_pattern, "$options": "i"}

        cursor = self.repo.get_summary_cursor(query=query)
        async for doc in cursor:
            count += 1
            total_amount += float(doc.get("grandTotal") or 0.0)
            st = doc.get("status") or ""
            if st.lower() == "pending_review":
                pending_review += 1
            elif st.lower() == "approved":
                approved_count += 1
                
        return {
            "totalAmount": total_amount,
            "count": count,
            "pendingReviewCount": pending_review,
            "approvedCount": approved_count
        }

    async def update_status(self, voucher_id: str, status_val: str, note: Optional[str] = "") -> Dict[str, Any]:
        update_op = {
            "$set": {"status": status_val.upper(), "updatedAt": datetime.utcnow()},
            "$push": {
                "activityLog": {
                    "action": f"status_change_{status_val.lower()}",
                    "note": note,
                    "at": datetime.utcnow()
                }
            }
        }
        success = await self.repo.update_voucher_custom(voucher_id, update_op)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Sales voucher with ID {voucher_id} not found"
            )
            
        doc = await self.repo.find_voucher_by_id(voucher_id)
        return serialize_doc(doc)

    async def add_comment(self, voucher_id: str, note: str) -> None:
        update_op = {
            "$push": {
                "activityLog": {
                    "action": "comment_added",
                    "note": note,
                    "at": datetime.utcnow()
                }
            }
        }
        success = await self.repo.update_voucher_custom(voucher_id, update_op)
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Sales voucher with ID {voucher_id} not found"
            )
