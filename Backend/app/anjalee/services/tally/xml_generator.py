import os
import xml.etree.ElementTree as ET
from typing import List
from app.anjalee.services.tally.voucher_mapper import TallyVoucher, TallyLedgerEntry, TallyInventoryEntry

def escape_xml(val: str) -> str:
    """Escapes XML special characters."""
    if not val:
        return ""
    val_str = str(val)
    return (val_str.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace('"', "&quot;")
                   .replace("'", "&apos;"))

def format_qty(qty: float, unit: str) -> str:
    """Formats quantity with its Unit of Measure suffix."""
    qty_val = abs(qty)
    qty_str = f"{int(qty_val)}" if qty_val.is_integer() else f"{qty_val:.2f}"
    if unit:
        return f"{qty_str} {unit}"
    return qty_str

def format_rate(rate: float, unit: str) -> str:
    """Formats rate with its Unit of Measure divisor suffix."""
    rate_val = abs(rate)
    if unit:
        return f"{rate_val:.2f}/{unit}"
    return f"{rate_val:.2f}"

class TallyXmlGenerator:
    TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "templates")

    @classmethod
    def load_template(cls, voucher_type: str) -> str:
        """Loads XML template file by type."""
        vch_type_lower = voucher_type.lower()
        if "sales" in vch_type_lower or "credit" in vch_type_lower:
            filename = "sales.xml"
        elif "purchase" in vch_type_lower or "debit" in vch_type_lower:
            filename = "purchase.xml"
        elif "payment" in vch_type_lower:
            filename = "payment.xml"
        elif "receipt" in vch_type_lower:
            filename = "receipt.xml"
        elif "contra" in vch_type_lower:
            filename = "contra.xml"
        else:
            filename = "journal.xml"

        filepath = os.path.join(cls.TEMPLATE_DIR, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Template not found at: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()

    @classmethod
    def validate_voucher(cls, voucher: TallyVoucher, all_ledgers: List[TallyLedgerEntry]) -> None:
        """
        Validates the voucher data and checks that all required masters exist.
        Throws ValueError on validation failure.
        """
        # 1. Company exists
        if not voucher.companyName:
            raise ValueError("Validation Failed: Required master 'Company Name' is missing.")

        # 2. Voucher Type exists
        if not voucher.voucherType:
            raise ValueError("Validation Failed: Required master 'Voucher Type' is missing.")

        # 3. Party Ledger exists
        if not voucher.partyLedgerName:
            raise ValueError("Validation Failed: Required master 'Party Ledger' is missing.")

        vch_type_lower = voucher.voucherType.lower()
        is_sales_or_purchase = "sales" in vch_type_lower or "purchase" in vch_type_lower or "credit" in vch_type_lower or "debit" in vch_type_lower

        if is_sales_or_purchase:
            # 4. Sales/Purchase Ledger, Stock Items, Units exist for With Item
            if voucher.inventoryEntries:
                for idx, inv in enumerate(voucher.inventoryEntries, 1):
                    if not inv.stockItem:
                        raise ValueError(f"Validation Failed: Required master 'Stock Item' is missing in item entry {idx}.")
                    if not inv.unit:
                        raise ValueError(f"Validation Failed: Required master 'Unit of Measure' is missing for stock item '{inv.stockItem}'.")
                    if not inv.salesLedger:
                        raise ValueError(f"Validation Failed: Required master 'Sales/Purchase Ledger' is missing for stock item '{inv.stockItem}'.")
            else:
                # Without Item - ensure there is a Sales/Purchase ledger
                if len(voucher.ledgerEntries) < 2:
                    raise ValueError("Validation Failed: Required master 'Sales/Purchase Ledger' is missing in ledger entries.")
                for idx, entry in enumerate(voucher.ledgerEntries):
                    if not entry.ledgerName:
                        raise ValueError(f"Validation Failed: Required master 'Ledger' name is missing at entry index {idx + 1}.")

            # 5. GST Ledgers exist (if GST is applicable)
            for idx, tax in enumerate(voucher.taxEntries, 1):
                if not tax.ledgerName:
                    raise ValueError(f"Validation Failed: Required master 'GST Ledger' name is missing in tax entry {idx}.")
        else:
            # Non-sales/purchase: check ledger names
            for idx, entry in enumerate(voucher.ledgerEntries):
                if not entry.ledgerName:
                    raise ValueError(f"Validation Failed: Required master 'Ledger' name is missing at entry index {idx + 1}.")

        # 6. Cost Centres exist (if used)
        for entry in all_ledgers:
            if entry.costAllocations:
                for cost in entry.costAllocations:
                    if not cost.category:
                        raise ValueError(f"Validation Failed: Required master 'Cost Category' is missing under ledger '{entry.ledgerName}'.")
                    if not cost.name:
                        raise ValueError(f"Validation Failed: Required master 'Cost Centre' is missing under ledger '{entry.ledgerName}'.")

        # 7. Check at least one ledger entry
        if not all_ledgers:
            raise ValueError("Validation Failed: Voucher must contain at least one ledger entry.")

        # 8. Balancing Verification (verify debit total equals credit total)
        ledger_sum = sum(e.amount for e in all_ledgers)
        if abs(ledger_sum) > 0.05:
            raise ValueError(
                f"Validation Failed: Voucher is unbalanced. Sum of debits and credits is {ledger_sum:.2f}."
            )

    @classmethod
    def validate_xml_syntax(cls, xml_str: str) -> None:
        """Validates XML syntax by parsing it with ElementTree."""
        try:
            cleaned_xml = xml_str.strip()
            ET.fromstring(cleaned_xml)
        except ET.ParseError as e:
            raise ValueError(f"XML Syntax Validation Failed: {e}")

    @classmethod
    def generate_xml(cls, voucher: TallyVoucher) -> str:
        """Generates Tally-compliant XML string from TallyVoucher object."""
        # 1. Compile all ledger impacts to perform the balancing check with Tally signs
        all_ledgers = []
        for entry in voucher.ledgerEntries:
            is_dr = (entry.isDeemedPositive == "Yes")
            amt = -abs(entry.amount) if is_dr else abs(entry.amount)
            all_ledgers.append(TallyLedgerEntry(
                ledgerName=entry.ledgerName,
                amount=amt,
                isDeemedPositive=entry.isDeemedPositive,
                costAllocations=entry.costAllocations
            ))
            
        for entry in voucher.taxEntries:
            is_dr = (entry.isDeemedPositive == "Yes")
            amt = -abs(entry.amount) if is_dr else abs(entry.amount)
            all_ledgers.append(TallyLedgerEntry(
                ledgerName=entry.ledgerName,
                amount=amt,
                isDeemedPositive=entry.isDeemedPositive,
                costAllocations=entry.costAllocations
            ))
            
        for inv in voucher.inventoryEntries:
            is_dr = (inv.isDeemedPositive == "Yes")
            amt = -abs(inv.amount) if is_dr else abs(inv.amount)
            all_ledgers.append(TallyLedgerEntry(
                ledgerName=inv.salesLedger or "Sales Account",
                amount=amt,
                isDeemedPositive=inv.isDeemedPositive
            ))

        # 2. Validate voucher data and balancing BEFORE XML generation
        cls.validate_voucher(voucher, all_ledgers)

        # 3. Load the template
        template = cls.load_template(voucher.voucherType)

        # 4. Determine dynamic parameters
        action = "Alter" if voucher.isUpdate else "Create"
        # Only populate MASTERID and ALTERID when updating an existing voucher, otherwise keep them empty
        if voucher.isUpdate:
            master_id_val = voucher.masterId
            alter_id_val = str(int(voucher.alterId or "1") + 1)
        else:
            master_id_val = ""
            alter_id_val = ""

        # Set PERSISTEDVIEW dynamically
        vch_type_lower = voucher.voucherType.lower()
        is_sales_or_purchase = "sales" in vch_type_lower or "purchase" in vch_type_lower or "credit" in vch_type_lower or "debit" in vch_type_lower
        if is_sales_or_purchase and voucher.inventoryEntries:
            persisted_view = "Invoice Voucher View"
        else:
            persisted_view = "Accounting Voucher View"

        # Narration is optional
        narration_xml = ""
        if voucher.narration:
            narration_xml = f"<NARRATION>{escape_xml(voucher.narration)}</NARRATION>"

        # Basic ship note is optional
        basic_ship_note_xml = ""
        if voucher.basicShipDeliveryNote:
            basic_ship_note_xml = f"<BASICSHIPDELIVERYNOTE>{escape_xml(voucher.basicShipDeliveryNote)}</BASICSHIPDELIVERYNOTE>"

        # Generate PARTYLEDGERNAME tag dynamically whenever the voucher type requires it (Sales and Purchase)
        party_ledger_name_xml = ""
        if is_sales_or_purchase and voucher.partyLedgerName:
            party_ledger_name_xml = f"<PARTYLEDGERNAME>{escape_xml(voucher.partyLedgerName)}</PARTYLEDGERNAME>"

        # 5. Build dynamic ledger entries XML list
        ledger_blocks = []
        index = 1
        for entry in voucher.ledgerEntries:
            ledger_blocks.append(cls._build_single_ledger_entry(entry, index))
            index += 1
        for entry in voucher.taxEntries:
            ledger_blocks.append(cls._build_single_ledger_entry(entry, index))
            index += 1
        ledger_entries_xml = "".join(ledger_blocks)

        # 6. Build dynamic inventory entries XML list (Only for Sales and Purchase vouchers with items)
        inventory_entries_xml = ""
        if is_sales_or_purchase and voucher.inventoryEntries:
            inventory_entries_xml = cls._build_inventory_entries(voucher.inventoryEntries)

        # 7. Replace placeholders in the XML template
        xml_str = template
        xml_str = xml_str.replace("{{companyName}}", escape_xml(voucher.companyName))
        xml_str = xml_str.replace("{{voucherType}}", escape_xml(voucher.voucherType))
        xml_str = xml_str.replace("{{voucherDate}}", escape_xml(voucher.voucherDate))
        xml_str = xml_str.replace("{{action}}", action)
        xml_str = xml_str.replace("{{masterId}}", master_id_val)
        xml_str = xml_str.replace("{{alterId}}", alter_id_val)
        xml_str = xml_str.replace("{{persistedView}}", persisted_view)
        xml_str = xml_str.replace("{{narration}}", narration_xml)
        xml_str = xml_str.replace("{{basicShipDeliveryNote}}", basic_ship_note_xml)
        xml_str = xml_str.replace("{{voucherNumber}}", escape_xml(voucher.voucherNumber))
        xml_str = xml_str.replace("{{referenceNumber}}", escape_xml(voucher.referenceNumber))
        xml_str = xml_str.replace("{{partyName}}", escape_xml(voucher.partyLedgerName))
        xml_str = xml_str.replace("{{partyLedgerName}}", party_ledger_name_xml)
        xml_str = xml_str.replace("{{ledgerEntries}}", ledger_entries_xml)
        xml_str = xml_str.replace("{{inventoryEntries}}", inventory_entries_xml)

        # 8. Final syntax validation check
        cls.validate_xml_syntax(xml_str)

        return xml_str

    @classmethod
    def _build_single_ledger_entry(cls, entry: TallyLedgerEntry, index: int) -> str:
        escaped_ledger_name = escape_xml(entry.ledgerName)
        is_dr = (entry.isDeemedPositive == "Yes")
        amount_val = -abs(entry.amount) if is_dr else abs(entry.amount)

        # Build optional bill allocations
        bill_xml = ""
        if entry.billAllocations:
            for bill in entry.billAllocations:
                escaped_bill_name = escape_xml(bill.refNo)
                escaped_bill_type = escape_xml(bill.billType)
                bill_amt = -abs(bill.amount) if is_dr else abs(bill.amount)
                bill_xml += f"""
                                    <BILLALLOCATIONS.LIST>
                                        <NAME>{escaped_bill_name}</NAME>
                                        <BILLTYPE>{escaped_bill_type}</BILLTYPE>
                                        <AMOUNT>{bill_amt:.2f}</AMOUNT>
                                    </BILLALLOCATIONS.LIST>"""

        # Build optional bank allocations
        bank_xml = ""
        if entry.bankAllocations:
            for bank in entry.bankAllocations:
                escaped_trans_type = escape_xml(bank.transType or "Inter Bank Transfer")
                escaped_inst_no = escape_xml(bank.instNumber)
                bank_amt = -abs(bank.amount) if is_dr else abs(bank.amount)
                bank_xml += f"""
                                    <BANKALLOCATIONS.LIST>
                                        <DATE>{bank.date}</DATE>
                                        <TRANSACTIONTYPE>{escaped_trans_type}</TRANSACTIONTYPE>
                                        <INSTRUMENTNUMBER>{escaped_inst_no}</INSTRUMENTNUMBER>
                                        <AMOUNT>{bank_amt:.2f}</AMOUNT>
                                    </BANKALLOCATIONS.LIST>"""

        # Build optional cost allocations (CATEGORYALLOCATIONS.LIST only if cost category/centre exists)
        cost_xml = ""
        if entry.costAllocations:
            for cost in entry.costAllocations:
                escaped_category = escape_xml(cost.category or "Primary Cost Category")
                escaped_cost_name = escape_xml(cost.name)
                cost_amt = -abs(cost.amount) if is_dr else abs(cost.amount)
                cost_xml += f"""
                                    <CATEGORYALLOCATIONS.LIST>
                                        <CATEGORY>{escaped_category}</CATEGORY>
                                        <COSTCENTREALLOCATIONS.LIST>
                                            <NAME>{escaped_cost_name}</NAME>
                                            <AMOUNT>{cost_amt:.2f}</AMOUNT>
                                        </COSTCENTREALLOCATIONS.LIST>
                                    </CATEGORYALLOCATIONS.LIST>"""

        return f"""
                        <LEDGERENTRIES.LIST>
                            <INDEXNUMBER>{index}</INDEXNUMBER>
                            <LEDGERNAME>{escaped_ledger_name}</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>{entry.isDeemedPositive}</ISDEEMEDPOSITIVE>
                            <AMOUNT>{amount_val:.2f}</AMOUNT>{bill_xml}{bank_xml}{cost_xml}
                        </LEDGERENTRIES.LIST>"""

    @classmethod
    def _build_inventory_entries(cls, entries: List[TallyInventoryEntry]) -> str:
        if not entries:
            return ""

        blocks = []
        for entry in entries:
            escaped_item_name = escape_xml(entry.stockItem)
            escaped_ledger_name = escape_xml(entry.salesLedger or "Sales Account")
            
            is_dr = (entry.isDeemedPositive == "Yes")
            amount_val = -abs(entry.amount) if is_dr else abs(entry.amount)
            rate_val = abs(entry.rate)
            qty_val = abs(entry.quantity)
            unit_val = entry.unit
            
            qty_str = format_qty(qty_val, unit_val)
            rate_str = format_rate(rate_val, unit_val)

            # Build batch details (default to Primary Batch and Main Location if not provided)
            batch_xml = ""
            if entry.batchDetails:
                for batch in entry.batchDetails:
                    escaped_batch_name = escape_xml(batch.batchName)
                    batch_qty = abs(batch.quantity)
                    batch_amt = -abs(batch.amount) if is_dr else abs(batch.amount)
                    batch_qty_str = format_qty(batch_qty, unit_val)
                    batch_xml += f"""
                            <BATCHALLOCATIONS.LIST>
                                <GODOWNNAME>Main Location</GODOWNNAME>
                                <DESTINATIONGODOWNNAME>Main Location</DESTINATIONGODOWNNAME>
                                <BATCHNAME>{escaped_batch_name}</BATCHNAME>
                                <AMOUNT>{batch_amt:.2f}</AMOUNT>
                                <ACTUALQTY>{batch_qty_str}</ACTUALQTY>
                                <BILLEDQTY>{batch_qty_str}</BILLEDQTY>
                            </BATCHALLOCATIONS.LIST>"""
            else:
                batch_xml = f"""
                            <BATCHALLOCATIONS.LIST>
                                <GODOWNNAME>Main Location</GODOWNNAME>
                                <DESTINATIONGODOWNNAME>Main Location</DESTINATIONGODOWNNAME>
                                <BATCHNAME>Primary Batch</BATCHNAME>
                                <AMOUNT>{amount_val:.2f}</AMOUNT>
                                <ACTUALQTY>{qty_str}</ACTUALQTY>
                                <BILLEDQTY>{qty_str}</BILLEDQTY>
                            </BATCHALLOCATIONS.LIST>"""

            # Calculate CGST, SGST, IGST rates dynamically from entry.gstRate
            gst_rate = entry.gstRate
            cgst_rate = gst_rate / 2
            sgst_rate = gst_rate / 2
            igst_rate = gst_rate

            cgst_rate_str = f"{int(cgst_rate)}" if cgst_rate.is_integer() else f"{cgst_rate:.2f}"
            sgst_rate_str = f"{int(sgst_rate)}" if sgst_rate.is_integer() else f"{sgst_rate:.2f}"
            igst_rate_str = f"{int(igst_rate)}" if igst_rate.is_integer() else f"{igst_rate:.2f}"

            blocks.append(f"""
                        <ALLINVENTORYENTRIES.LIST>
                            <STOCKITEMNAME>{escaped_item_name}</STOCKITEMNAME>
                            <ISDEEMEDPOSITIVE>{entry.isDeemedPositive}</ISDEEMEDPOSITIVE>
                            <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
                            <ISAUTONEGATE>No</ISAUTONEGATE>
                            <ISCUSTOMSCLEARANCE>No</ISCUSTOMSCLEARANCE>
                            <ISTRACKCOMPONENT>No</ISTRACKCOMPONENT>
                            <ISTRACKPRODUCTION>No</ISTRACKPRODUCTION>
                            <ISPRIMARYITEM>No</ISPRIMARYITEM>
                            <ISSCRAP>No</ISSCRAP>
                            <RATE>{rate_str}</RATE>
                            <ACTUALQTY>{qty_str}</ACTUALQTY>
                            <BILLEDQTY>{qty_str}</BILLEDQTY>
                            <AMOUNT>{amount_val:.2f}</AMOUNT>
                            {batch_xml}
                            <ACCOUNTINGALLOCATIONS.LIST>
                                <LEDGERNAME>{escaped_ledger_name}</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>{entry.isDeemedPositive}</ISDEEMEDPOSITIVE>
                                <LEDGERFROMITEM>No</LEDGERFROMITEM>
                                <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
                                <ISPARTYLEDGER>No</ISPARTYLEDGER>
                                <AMOUNT>{amount_val:.2f}</AMOUNT>
                            </ACCOUNTINGALLOCATIONS.LIST>
                            <RATEDETAILS.LIST>
                                <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>
                                <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
                                <GSTRATE>{cgst_rate_str}</GSTRATE>
                            </RATEDETAILS.LIST>
                            <RATEDETAILS.LIST>
                                <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>
                                <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
                                <GSTRATE>{sgst_rate_str}</GSTRATE>
                            </RATEDETAILS.LIST>
                            <RATEDETAILS.LIST>
                                <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>
                                <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
                                <GSTRATE>{igst_rate_str}</GSTRATE>
                            </RATEDETAILS.LIST>
                        </ALLINVENTORYENTRIES.LIST>""")

        return "".join(blocks)
