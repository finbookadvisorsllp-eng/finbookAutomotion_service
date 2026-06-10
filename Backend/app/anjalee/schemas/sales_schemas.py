from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

class SalesVoucherEntry(BaseModel):
    ledgerId: Optional[str] = None
    ledgerName: str
    description: Optional[str] = ""
    hsnSacCode: Optional[str] = ""
    gstRate: float = 0.0
    amount: float = 0.0

class SalesVoucherInventoryEntry(BaseModel):
    stockItemId: Optional[str] = None
    stockItem: str
    description: Optional[str] = ""
    hsnSacCode: Optional[str] = ""
    billQuantity: float = 0.0
    billRate: float = 0.0
    discountPercent: float = 0.0
    amount: float = 0.0
    rcm: bool = False
    taxabilityType: str = "Taxable"
    gstRate: float = 0.0

class GstSummary(BaseModel):
    taxableValue: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0

class SalesVoucherCreate(BaseModel):
    voucherNumber: Optional[str] = None
    voucherDate: Optional[str] = None
    voucherType: Optional[str] = "sales_invoice"
    voucherSeries: Optional[str] = "Default"
    # Change by Anjalee: invoiceNumber is the customer-facing bill number (separate from voucherNumber)
    invoiceNumber: Optional[str] = None
    referenceNumber: Optional[str] = None
    creditNoteDate: Optional[str] = None
    salesLedger: Optional[str] = None
    consigneeLedger: Optional[str] = None
    partyLedgerId: Optional[str] = None
    partyLedgerName: str
    partyGSTIN: Optional[str] = None
    gstRegistrationType: Optional[str] = None
    tcsAmount: float = 0.0
    roundOffAmount: float = 0.0
    salesEntries: List[SalesVoucherEntry] = []
    inventoryEntries: Optional[List[SalesVoucherInventoryEntry]] = []
    entryTab: Optional[str] = "with_item"
    gstRegistration: Optional[str] = None
    partyState: Optional[str] = None
    companyState: Optional[str] = None
    additionalCharges: Optional[List[dict]] = []
    tcsDetails: Optional[List[dict]] = []
    tdsDetails: Optional[List[dict]] = []
    narration: Optional[str] = ""
    status: Optional[str] = "DRAFT"

class SalesVoucherUpdate(BaseModel):
    voucherNumber: Optional[str] = None
    voucherDate: Optional[str] = None
    voucherType: Optional[str] = None
    voucherSeries: Optional[str] = None
    # Change by Anjalee: invoiceNumber is the customer-facing bill number
    invoiceNumber: Optional[str] = None
    referenceNumber: Optional[str] = None
    creditNoteDate: Optional[str] = None
    salesLedger: Optional[str] = None
    consigneeLedger: Optional[str] = None
    partyLedgerId: Optional[str] = None
    partyLedgerName: Optional[str] = None
    partyGSTIN: Optional[str] = None
    gstRegistrationType: Optional[str] = None
    tcsAmount: Optional[float] = None
    roundOffAmount: Optional[float] = None
    salesEntries: Optional[List[SalesVoucherEntry]] = None
    inventoryEntries: Optional[List[SalesVoucherInventoryEntry]] = None
    entryTab: Optional[str] = None
    gstRegistration: Optional[str] = None
    partyState: Optional[str] = None
    companyState: Optional[str] = None
    additionalCharges: Optional[List[dict]] = None
    tcsDetails: Optional[List[dict]] = None
    tdsDetails: Optional[List[dict]] = None
    narration: Optional[str] = None
    status: Optional[str] = None

class SalesVoucherResponse(BaseModel):
    id: str = Field(alias="_id")
    companyId: Optional[str] = None
    voucherNumber: Optional[str] = None
    voucherDate: Optional[str] = None
    voucherType: Optional[str] = None
    voucherSeries: Optional[str] = None
    # Change by Anjalee: invoiceNumber is the customer-facing bill number
    invoiceNumber: Optional[str] = None
    referenceNumber: Optional[str] = None
    creditNoteDate: Optional[str] = None
    salesLedger: Optional[str] = None
    consigneeLedger: Optional[str] = None
    partyLedgerId: Optional[str] = None
    partyLedgerName: Optional[str] = None
    partyGSTIN: Optional[str] = None
    gstRegistrationType: Optional[str] = None
    partyState: Optional[str] = None
    companyState: Optional[str] = None
    isIntraState: bool = True
    taxType: str = "CGST_SGST"
    baseAmount: float = 0.0
    cgstAmount: float = 0.0
    sgstAmount: float = 0.0
    igstAmount: float = 0.0
    tcsAmount: float = 0.0
    roundOffAmount: float = 0.0
    grandTotal: float = 0.0
    salesEntries: List[SalesVoucherEntry] = []
    inventoryEntries: Optional[List[SalesVoucherInventoryEntry]] = []
    entryTab: Optional[str] = "with_item"
    gstRegistration: Optional[str] = None
    additionalCharges: Optional[List[dict]] = []
    tcsDetails: Optional[List[dict]] = []
    tdsDetails: Optional[List[dict]] = []
    gstSummary: GstSummary = Field(default_factory=GstSummary)
    narration: Optional[str] = ""
    status: str = "DRAFT"
    createdAt: Optional[Any] = None
    updatedAt: Optional[Any] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True
    }

class PartyLedgerDropdownResponse(BaseModel):
    id: str
    name: str
    gstin: Optional[str] = None
    gstState: Optional[str] = None

class SalesLedgerDropdownResponse(BaseModel):
    id: str
    name: str
    gstApplicable: bool = True
    taxRate: float = 0.0

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""

class CommentRequest(BaseModel):
    note: str
