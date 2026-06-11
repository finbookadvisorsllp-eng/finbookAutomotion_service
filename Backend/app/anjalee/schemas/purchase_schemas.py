from pydantic import BaseModel
from typing import List, Optional

class PurchaseTransactionCreate(BaseModel):
    voucherType: str
    voucherNumber: Optional[str] = None
    voucherNumberSeries: Optional[str] = None
    voucherDate: Optional[str] = None
    invoiceNumber: Optional[str] = None
    invoiceDate: Optional[str] = None
    poNumber: Optional[str] = None
    partyLedger: Optional[str] = None
    partyGstin: Optional[str] = None
    purchaseLedger: Optional[str] = None
    consigneeLedger: Optional[str] = None
    gstRegistration: Optional[str] = None
    gstRegistrationType: Optional[str] = None
    entryTab: Optional[str] = "without_item"
    grandTotal: Optional[float] = 0.0
    narration: Optional[str] = ""
    status: Optional[str] = "draft"
    productLines: Optional[List[dict]] = []
    purchaseLines: Optional[List[dict]] = []
    additionalCharges: Optional[List[dict]] = []
    tdsDetails: Optional[List[dict]] = []
    tcsDetails: Optional[List[dict]] = []

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""

class CommentRequest(BaseModel):
    note: str
