from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

class TallyBillAllocation(BaseModel):
    refNo: str
    billType: str
    amount: float

class TallyBankAllocation(BaseModel):
    date: str
    instNumber: str
    transType: str
    amount: float

class TallyCostAllocation(BaseModel):
    category: str
    name: str
    amount: float

class TallyLedgerEntry(BaseModel):
    ledgerName: str
    amount: float  # Negative for Debit, Positive for Credit
    isDeemedPositive: str  # "Yes" for Debit, "No" for Credit
    billAllocations: List[TallyBillAllocation] = []
    bankAllocations: List[TallyBankAllocation] = []
    costAllocations: List[TallyCostAllocation] = []

class TallyBatchDetails(BaseModel):
    batchName: str
    amount: float
    quantity: float

class TallyInventoryEntry(BaseModel):
    stockItem: str
    rate: float
    amount: float
    quantity: float
    salesLedger: str
    isDeemedPositive: str = "No"
    unit: str = ""
    batchDetails: List[TallyBatchDetails] = []
    gstRate: float = 18.0

class TallyVoucher(BaseModel):
    companyName: str
    voucherType: str
    voucherDate: str  # Format: YYYYMMDD
    voucherNumber: str
    referenceNumber: str = ""
    partyLedgerName: str
    narration: str = ""
    basicShipDeliveryNote: str = ""
    masterId: str = ""
    alterId: str = "1"
    isUpdate: bool = False
    ledgerEntries: List[TallyLedgerEntry] = []
    inventoryEntries: List[TallyInventoryEntry] = []
    taxEntries: List[TallyLedgerEntry] = []

class VoucherMapper:
    @staticmethod
    def map_to_tally_voucher(doc: Dict[str, Any], company_name: str = "Default Company") -> TallyVoucher:
        """
        Converts MongoDB document to unified TallyVoucher model.
        Supports:
        - Sales vouchers
        - Purchase vouchers
        - Fund flow vouchers
        """
        raw_vch_type = doc.get("voucherType") or ""
        vch_type_lower = raw_vch_type.lower()
        
        # 1. Parse Date (YYYY-MM-DD -> YYYYMMDD)
        raw_date = doc.get("voucherDate") or datetime.utcnow().strftime("%Y-%m-%d")
        vch_date = raw_date.replace("-", "").replace("/", "")
        
        # 2. Get voucher number and reference
        vch_num = doc.get("voucherNumber") or "AUTO"
        ref_num = doc.get("referenceNumber") or ""
        narr = doc.get("narration") or doc.get("remarks") or ""
        
        # 3. Derive masterId and alterId from MongoDB _id
        doc_id = str(doc.get("_id") or "")
        master_id = ""
        alter_id = "1"
        if doc_id and len(doc_id) == 24:
            try:
                master_id = str(int(doc_id[-8:], 16))
            except Exception:
                master_id = doc_id
        
        # Determine main category (Sales, Purchase, Payment, Receipt, Contra, Journal)
        category = ""
        if any(x in vch_type_lower for x in ["sales", "credit_note", "credit note"]):
            category = "sales"
        elif any(x in vch_type_lower for x in ["purchase", "debit_note", "debit note"]):
            category = "purchase"
        elif any(x in vch_type_lower for x in ["cash_payment", "bank_payment", "payment", "receipt"]):
            # Check drCrType for payments/receipts or use type mapping
            if "receipt" in vch_type_lower or doc.get("drCrType") == "Cr" or vch_type_lower == "bank_payment":
                category = "receipt"
            else:
                category = "payment"
        elif "contra" in vch_type_lower:
            category = "contra"
        else:
            category = "journal"

        if category == "sales":
            vch = VoucherMapper._map_sales(doc, company_name, vch_date, vch_num, ref_num, narr)
        elif category == "purchase":
            vch = VoucherMapper._map_purchase(doc, company_name, vch_date, vch_num, ref_num, narr)
        elif category in ["payment", "receipt", "contra"]:
            vch = VoucherMapper._map_fundflow(doc, category, company_name, vch_date, vch_num, ref_num, narr)
        else:
            # Fallback to journal/generic mapping
            vch = VoucherMapper._map_journal(doc, company_name, vch_date, vch_num, ref_num, narr)

        status_val = doc.get("status")
        is_update = (status_val == "POSTED_TO_TALLY" or doc.get("isSynced") is True)
        
        vch.masterId = master_id
        vch.alterId = alter_id
        vch.isUpdate = is_update
        return vch


    @staticmethod
    def _map_sales(doc: Dict[str, Any], company_name: str, vch_date: str, vch_num: str, ref_num: str, narr: str) -> TallyVoucher:
        # Determine Voucher Type Name
        raw_vch_type = doc.get("voucherType") or ""
        if "credit" in raw_vch_type.lower():
            vch_type_tally = "Credit Note"
        elif "order" in raw_vch_type.lower():
            vch_type_tally = "Sales Order"
        else:
            vch_type_tally = "Sales"

        party_name = doc.get("partyLedgerName") or "Cash"
        
        # Debited entry for Party Ledger (preliminary amount, to be calculated dynamically)
        party_entry = TallyLedgerEntry(
            ledgerName=party_name,
            amount=0.0,
            isDeemedPositive="Yes"
        )
        
        ledger_entries = [party_entry]
        inventory_entries = []
        tax_entries = []
        
        # Handle Sales Account allocation (without item mode)
        if doc.get("entryTab") == "without_item":
            sales_ledger = doc.get("salesLedger") or "Sales Account"
            base_amount = float(doc.get("baseAmount") or doc.get("grandTotal") or 0.0)
            ledger_entries.append(TallyLedgerEntry(
                ledgerName=sales_ledger,
                amount=base_amount,
                isDeemedPositive="No"
            ))
            
            # Map other lines from salesEntries
            for entry in doc.get("salesEntries") or []:
                amt = float(entry.get("amount") or 0.0)
                if amt > 0:
                    ledger_entries.append(TallyLedgerEntry(
                        ledgerName=entry.get("ledgerName"),
                        amount=amt,
                        isDeemedPositive="No"
                    ))
        else:
            # With Item mode: map inventory entries
            sales_ledger = doc.get("salesLedger") or "Sales Account"
            for item in doc.get("inventoryEntries") or []:
                amt = float(item.get("amount") or 0.0)
                qty = float(item.get("billQuantity") or item.get("quantity") or 0.0)
                rate = float(item.get("billRate") or item.get("rate") or 0.0)
                
                inventory_entries.append(TallyInventoryEntry(
                    stockItem=item.get("stockItem"),
                    rate=rate,
                    amount=amt,
                    quantity=qty,
                    salesLedger=sales_ledger,
                    isDeemedPositive="No",
                    unit=item.get("unit") or item.get("uom") or "",
                    gstRate=float(item.get("gstRate") or 18.0)
                ))
            
            # Also map any additional non-tax ledgers from salesEntries in with_item mode
            for entry in doc.get("salesEntries") or []:
                amt = float(entry.get("amount") or 0.0)
                if amt > 0:
                    ledger_entries.append(TallyLedgerEntry(
                        ledgerName=entry.get("ledgerName"),
                        amount=amt,
                        isDeemedPositive="No"
                    ))

        # Map non-tax additional charges (e.g. freight if stored there)
        for charge in doc.get("additionalCharges") or []:
            name = charge.get("ledgerName", "").upper()
            is_tax = "CGST" in name or "SGST" in name or "IGST" in name or "UTGST" in name
            if not is_tax:
                amt = float(charge.get("amount") or 0.0)
                if amt > 0:
                    ledger_entries.append(TallyLedgerEntry(
                        ledgerName=charge.get("ledgerName"),
                        amount=amt,
                        isDeemedPositive="No"
                    ))

        # Map taxes (CGST, SGST, IGST)
        cgst = float(doc.get("cgstAmount") or 0.0)
        sgst = float(doc.get("sgstAmount") or 0.0)
        igst = float(doc.get("igstAmount") or 0.0)
        
        # Look in additionalCharges for detailed names
        cgst_ledger = "CGST Output"
        sgst_ledger = "SGST Output"
        igst_ledger = "IGST Output"
        
        for charge in doc.get("additionalCharges") or []:
            name = charge.get("ledgerName", "").upper()
            amt = float(charge.get("amount") or 0.0)
            if "CGST" in name:
                cgst_ledger = charge.get("ledgerName")
                cgst = amt
            elif "SGST" in name:
                sgst_ledger = charge.get("ledgerName")
                sgst = amt
            elif "IGST" in name:
                igst_ledger = charge.get("ledgerName")
                igst = amt

        if cgst > 0:
            tax_entries.append(TallyLedgerEntry(
                ledgerName=cgst_ledger,
                amount=cgst,
                isDeemedPositive="No"
            ))
        if sgst > 0:
            tax_entries.append(TallyLedgerEntry(
                ledgerName=sgst_ledger,
                amount=sgst,
                isDeemedPositive="No"
            ))
        if igst > 0:
            tax_entries.append(TallyLedgerEntry(
                ledgerName=igst_ledger,
                amount=igst,
                isDeemedPositive="No"
            ))

        # Round Off
        round_off = float(doc.get("roundOffAmount") or 0.0)
        if abs(round_off) > 0.001:
            tax_entries.append(TallyLedgerEntry(
                ledgerName="Round Off",
                amount=round_off,
                isDeemedPositive="No" if round_off > 0 else "Yes"
            ))

        # Dynamic Self-Healing balancing for the Party Ledger
        credits_sum = 0.0
        for item in inventory_entries:
            credits_sum += item.amount
        for entry in ledger_entries[1:]:
            credits_sum += entry.amount
        for entry in tax_entries:
            credits_sum += entry.amount

        # Set party ledger to exact offsetting debit amount to ensure perfect balance
        party_entry.amount = -credits_sum
        party_entry.billAllocations = [TallyBillAllocation(
            refNo=vch_num,
            billType="New Ref",
            amount=-credits_sum
        )]

        return TallyVoucher(
            companyName=company_name,
            voucherType=vch_type_tally,
            voucherDate=vch_date,
            voucherNumber=vch_num,
            referenceNumber=ref_num,
            partyLedgerName=party_name,
            narration=narr,
            ledgerEntries=ledger_entries,
            inventoryEntries=inventory_entries,
            taxEntries=tax_entries
        )

    @staticmethod
    def _map_purchase(doc: Dict[str, Any], company_name: str, vch_date: str, vch_num: str, ref_num: str, narr: str) -> TallyVoucher:
        raw_vch_type = doc.get("voucherType") or ""
        if "debit" in raw_vch_type.lower():
            vch_type_tally = "Debit Note"
        elif "order" in raw_vch_type.lower():
            vch_type_tally = "Purchase Order"
        else:
            vch_type_tally = "Purchase"

        party_name = doc.get("partyLedger") or doc.get("partyLedgerName") or "Cash"
        
        # Credited entry for Party Ledger (preliminary amount, to be calculated dynamically)
        party_entry = TallyLedgerEntry(
            ledgerName=party_name,
            amount=0.0,
            isDeemedPositive="No"
        )
        
        ledger_entries = [party_entry]
        inventory_entries = []
        tax_entries = []
        
        # Determine if invoice mode or other
        entry_tab = doc.get("entryTab") or "without_item"
        
        if entry_tab == "without_item":
            pur_ledger = doc.get("purchaseLedger") or "Purchase Account"
            base_amount = float(doc.get("baseAmount") or doc.get("grandTotal") or 0.0)
            ledger_entries.append(TallyLedgerEntry(
                ledgerName=pur_ledger,
                amount=-base_amount,
                isDeemedPositive="Yes"
            ))
            
            # Map other lines from purchaseLines
            for entry in doc.get("purchaseLines") or []:
                amt = float(entry.get("amount") or 0.0)
                if amt > 0:
                    ledger_entries.append(TallyLedgerEntry(
                        ledgerName=entry.get("purchaseLedger") or entry.get("ledgerName") or entry.get("ledger"),
                        amount=-amt,
                        isDeemedPositive="Yes"
                    ))
        else:
            # With Item mode
            pur_ledger = doc.get("purchaseLedger") or "Purchase Account"
            for item in doc.get("productLines") or []:
                amt = float(item.get("amount") or 0.0)
                qty = float(item.get("billQuantity") or item.get("quantity") or 0.0)
                rate = float(item.get("billRate") or item.get("rate") or 0.0)
                
                inventory_entries.append(TallyInventoryEntry(
                    stockItem=item.get("stockItem") or item.get("name"),
                    rate=rate,
                    amount=-amt,  # Debit is negative
                    quantity=qty,
                    salesLedger=pur_ledger,
                    isDeemedPositive="Yes",
                    unit=item.get("unit") or item.get("uom") or "",
                    gstRate=float(item.get("gstRate") or 18.0)
                ))
            
            # Also map any additional non-tax purchaseLines in with_item mode
            for entry in doc.get("purchaseLines") or []:
                amt = float(entry.get("amount") or 0.0)
                if amt > 0:
                    ledger_entries.append(TallyLedgerEntry(
                        ledgerName=entry.get("purchaseLedger") or entry.get("ledgerName") or entry.get("ledger"),
                        amount=-amt,
                        isDeemedPositive="Yes"
                    ))

        # Map non-tax additional charges
        for charge in doc.get("additionalCharges") or []:
            name = charge.get("ledgerName", "").upper()
            is_tax = "CGST" in name or "SGST" in name or "IGST" in name or "UTGST" in name
            if not is_tax:
                amt = float(charge.get("amount") or 0.0)
                if amt > 0:
                    ledger_entries.append(TallyLedgerEntry(
                        ledgerName=charge.get("ledgerName"),
                        amount=-amt,
                        isDeemedPositive="Yes"
                    ))

        # Map taxes (Input CGST, Input SGST, Input IGST)
        cgst = float(doc.get("cgstAmount") or 0.0)
        sgst = float(doc.get("sgstAmount") or 0.0)
        igst = float(doc.get("igstAmount") or 0.0)
        
        cgst_ledger = "CGST Input"
        sgst_ledger = "SGST Input"
        igst_ledger = "IGST Input"
        
        for charge in doc.get("additionalCharges") or []:
            name = charge.get("ledgerName", "").upper()
            amt = float(charge.get("amount") or 0.0)
            if "CGST" in name:
                cgst_ledger = charge.get("ledgerName")
                cgst = amt
            elif "SGST" in name:
                sgst_ledger = charge.get("ledgerName")
                sgst = amt
            elif "IGST" in name:
                igst_ledger = charge.get("ledgerName")
                igst = amt

        if cgst > 0:
            tax_entries.append(TallyLedgerEntry(
                ledgerName=cgst_ledger,
                amount=-cgst,
                isDeemedPositive="Yes"
            ))
        if sgst > 0:
            tax_entries.append(TallyLedgerEntry(
                ledgerName=sgst_ledger,
                amount=-sgst,
                isDeemedPositive="Yes"
            ))
        if igst > 0:
            tax_entries.append(TallyLedgerEntry(
                ledgerName=igst_ledger,
                amount=-igst,
                isDeemedPositive="Yes"
            ))

        # Round Off
        round_off = float(doc.get("roundOffAmount") or 0.0)
        if abs(round_off) > 0.001:
            tax_entries.append(TallyLedgerEntry(
                ledgerName="Round Off",
                amount=-round_off,
                isDeemedPositive="Yes" if round_off > 0 else "No"
            ))

        # Dynamic Self-Healing balancing for Purchase
        debits_sum = 0.0
        for item in inventory_entries:
            debits_sum += abs(item.amount)
        for entry in ledger_entries[1:]:
            debits_sum += abs(entry.amount)
        for entry in tax_entries:
            debits_sum += abs(entry.amount)

        # Set party ledger to exact offsetting credit amount (positive) to ensure perfect balance
        party_entry.amount = debits_sum
        party_entry.billAllocations = [TallyBillAllocation(
            refNo=vch_num,
            billType="New Ref",
            amount=debits_sum
        )]

        return TallyVoucher(
            companyName=company_name,
            voucherType=vch_type_tally,
            voucherDate=vch_date,
            voucherNumber=vch_num,
            referenceNumber=ref_num,
            partyLedgerName=party_name,
            narration=narr,
            ledgerEntries=ledger_entries,
            inventoryEntries=inventory_entries,
            taxEntries=tax_entries
        )

    @staticmethod
    def _map_fundflow(doc: Dict[str, Any], category: str, company_name: str, vch_date: str, vch_num: str, ref_num: str, narr: str) -> TallyVoucher:
        # Determine Voucher Type Name
        if category == "payment":
            vch_type_tally = "Payment"
        elif category == "receipt":
            vch_type_tally = "Receipt"
        else:
            vch_type_tally = "Contra"

        amount = float(doc.get("amount") or doc.get("transferAmount") or doc.get("amountReceived") or 0.0)
        ledger_entries = []

        # Check if there are complex ledger rows
        ledger_rows = doc.get("ledgerRows") or []
        if ledger_rows:
            header_dr_cr = doc.get("drCrType") or ""
            default_dr_cr = "Cr" if "cr" in header_dr_cr.lower() else "Dr"
            
            # Map bill allocations from root doc
            bill_allocs = []
            for bill in doc.get("billRows") or []:
                bill_amt = float(bill.get("allocationAmount") or bill.get("amount") or amount)
                bill_ref = bill.get("refNo") or bill.get("invoiceRefNo") or bill.get("billNo") or bill.get("billRef") or vch_num
                bill_type = bill.get("billType") or "Against Ref"
                bill_allocs.append(TallyBillAllocation(
                    refNo=bill_ref,
                    billType=bill_type,
                    amount=-bill_amt if category == "payment" else bill_amt
                ))

            # Map from custom ledgerRows
            for row in ledger_rows:
                row_amt = float(row.get("amount") or 0.0)
                dr_cr = row.get("drCrType") or default_dr_cr
                
                # Debit is negative, Credit is positive
                is_dr = dr_cr == "Dr"
                mapped_amt = -row_amt if is_dr else row_amt
                
                # Check for cost center inside ledgerRows
                cost_allocs = []
                if doc.get("costCenterApplicable") or doc.get("costCenter"):
                    cc_name = doc.get("costCenter")
                    cc_cat = doc.get("costCategory") or "Primary Cost Category"
                    cc_amt = float(doc.get("costAmount") or row_amt)
                    if cc_name:
                        cost_allocs.append(TallyCostAllocation(
                            category=cc_cat,
                            name=cc_name,
                            amount=-cc_amt if is_dr else cc_amt
                        ))

                # For the party ledger row, attach the bill allocations
                row_bill_allocs = []
                if bill_allocs:
                    row_bill_allocs = bill_allocs
                elif not bill_allocs and category == "payment":
                    row_bill_allocs = [TallyBillAllocation(
                        refNo=vch_num,
                        billType="On Account",
                        amount=mapped_amt
                    )]

                ledger_entries.append(TallyLedgerEntry(
                    ledgerName=row.get("ledgerName"),
                    amount=mapped_amt,
                    isDeemedPositive="Yes" if is_dr else "No",
                    billAllocations=row_bill_allocs,
                    costAllocations=cost_allocs
                ))

            
            # Now map the header cash/bank ledger as the offset
            cb_ledger = doc.get("bankLedger") or doc.get("cashLedger") or doc.get("destinationLedger") or doc.get("sourceLedger")
            if cb_ledger:
                # Sum of ledgerRows to balance it
                total_sum = sum(e.amount for e in ledger_entries)
                offset_amt = -total_sum
                is_dr = offset_amt < 0
                
                # Bank allocations mapping
                bank_allocs = []
                if doc.get("bankLedger") and (doc.get("instNumber") or doc.get("transType")):
                    bank_allocs.append(TallyBankAllocation(
                        date=vch_date,
                        instNumber=doc.get("instNumber") or "",
                        transType=doc.get("transType") or "NEFT",
                        amount=offset_amt
                    ))

                ledger_entries.append(TallyLedgerEntry(
                    ledgerName=cb_ledger,
                    amount=offset_amt,
                    isDeemedPositive="Yes" if is_dr else "No",
                    bankAllocations=bank_allocs
                ))
        else:
            # Simple form: map partyLedger and cash/bank ledger
            party_name = doc.get("partyLedger") or doc.get("againstLedger") or "Cash"
            cb_ledger = doc.get("bankLedger") or doc.get("cashLedger") or doc.get("destinationLedger") or doc.get("sourceLedger") or "Cash Account"
            
            # Map cost allocations if present
            cost_allocs = []
            if doc.get("costCenterApplicable") or doc.get("costCenter"):
                cc_name = doc.get("costCenter")
                cc_cat = doc.get("costCategory") or "Primary Cost Category"
                cc_amt = float(doc.get("costAmount") or amount)
                if cc_name:
                    cost_allocs.append(TallyCostAllocation(
                        category=cc_cat,
                        name=cc_name,
                        amount=-cc_amt if category == "payment" else cc_amt
                    ))

            # Bill allocations mapping
            bill_allocs = []
            for bill in doc.get("billRows") or []:
                bill_amt = float(bill.get("allocationAmount") or bill.get("amount") or amount)
                bill_ref = bill.get("refNo") or bill.get("invoiceRefNo") or vch_num
                bill_type = bill.get("billType") or "Against Ref"
                bill_allocs.append(TallyBillAllocation(
                    refNo=bill_ref,
                    billType=bill_type,
                    amount=-bill_amt if category == "payment" else bill_amt
                ))
                
            if not bill_allocs and category == "payment":
                bill_allocs.append(TallyBillAllocation(
                    refNo=vch_num,
                    billType="On Account",
                    amount=-amount
                ))

            # Bank allocations mapping
            bank_allocs = []
            if doc.get("bankLedger") and (doc.get("instNumber") or doc.get("transType")):
                bank_allocs.append(TallyBankAllocation(
                    date=vch_date,
                    instNumber=doc.get("instNumber") or "",
                    transType=doc.get("transType") or "NEFT",
                    amount=-amount if category == "receipt" else amount
                ))

            if category == "payment":
                # Party is debited (negative), Cash/Bank is credited (positive)
                ledger_entries.append(TallyLedgerEntry(
                    ledgerName=party_name,
                    amount=-amount,
                    isDeemedPositive="Yes",
                    billAllocations=bill_allocs,
                    costAllocations=cost_allocs
                ))
                ledger_entries.append(TallyLedgerEntry(
                    ledgerName=cb_ledger,
                    amount=amount,
                    isDeemedPositive="No",
                    bankAllocations=bank_allocs
                ))
            elif category == "receipt":
                # Cash/Bank is debited (negative), Party is credited (positive)
                ledger_entries.append(TallyLedgerEntry(
                    ledgerName=cb_ledger,
                    amount=-amount,
                    isDeemedPositive="Yes",
                    bankAllocations=bank_allocs
                ))
                ledger_entries.append(TallyLedgerEntry(
                    ledgerName=party_name,
                    amount=amount,
                    isDeemedPositive="No",
                    billAllocations=bill_allocs,
                    costAllocations=cost_allocs
                ))
            else:
                # Contra: Destination is debited (negative), Source is credited (positive)
                dest_ledger = doc.get("destinationLedger") or cb_ledger
                src_ledger = doc.get("sourceLedger") or party_name
                ledger_entries.append(TallyLedgerEntry(
                    ledgerName=dest_ledger,
                    amount=-amount,
                    isDeemedPositive="Yes"
                ))
                ledger_entries.append(TallyLedgerEntry(
                    ledgerName=src_ledger,
                    amount=amount,
                    isDeemedPositive="No"
                ))

        return TallyVoucher(
            companyName=company_name,
            voucherType=vch_type_tally,
            voucherDate=vch_date,
            voucherNumber=vch_num,
            referenceNumber=ref_num,
            partyLedgerName=ledger_entries[0].ledgerName if ledger_entries else "Cash",
            narration=narr,
            ledgerEntries=ledger_entries
        )

    @staticmethod
    def _map_journal(doc: Dict[str, Any], company_name: str, vch_date: str, vch_num: str, ref_num: str, narr: str) -> TallyVoucher:
        # Default mapping for journal
        vch_type_tally = "Journal"
        party_name = doc.get("partyLedgerName") or "Suspense"
        
        ledger_entries = []
        for entry in doc.get("ledgerEntries") or []:
            amt = float(entry.get("amount") or 0.0)
            dr_cr = entry.get("drCrType") or "Dr"
            is_dr = dr_cr == "Dr"
            
            ledger_entries.append(TallyLedgerEntry(
                ledgerName=entry.get("ledgerName"),
                amount=-amt if is_dr else amt,
                isDeemedPositive="Yes" if is_dr else "No"
            ))
            
        if not ledger_entries:
            amt = float(doc.get("grandTotal") or doc.get("amount") or 0.0)
            ledger_entries.append(TallyLedgerEntry(
                ledgerName=party_name,
                amount=-amt,
                isDeemedPositive="Yes"
            ))
            ledger_entries.append(TallyLedgerEntry(
                ledgerName="Suspense Account",
                amount=amt,
                isDeemedPositive="No"
            ))

        return TallyVoucher(
            companyName=company_name,
            voucherType=vch_type_tally,
            voucherDate=vch_date,
            voucherNumber=vch_num,
            referenceNumber=ref_num,
            partyLedgerName=party_name,
            narration=narr,
            ledgerEntries=ledger_entries
        )
