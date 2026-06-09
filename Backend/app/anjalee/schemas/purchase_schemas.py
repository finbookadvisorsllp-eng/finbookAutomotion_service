from pydantic import BaseModel
from typing import List, Optional

class PurchaseTransactionCreate(BaseModel):
    voucherType: str
    voucherDate: Optional[str] = None
    invoiceNumber: Optional[str] = None
    invoiceDate: Optional[str] = None
    poNumber: Optional[str] = None
    partyLedger: Optional[str] = None
    partyGstin: Optional[str] = None
    grandTotal: Optional[float] = 0.0
    narration: Optional[str] = ""
    status: Optional[str] = "draft"
    productLines: Optional[List[dict]] = []
    purchaseLines: Optional[List[dict]] = []
    additionalCharges: Optional[List[dict]] = []

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""

class CommentRequest(BaseModel):
    note: str
