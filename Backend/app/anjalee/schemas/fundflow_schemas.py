from pydantic import BaseModel
from typing import List, Optional

class FundFlowTransactionCreate(BaseModel):
    voucherType: str
    voucherDate: Optional[str] = None
    referenceNumber: Optional[str] = None
    partyLedger: Optional[str] = None
    againstLedger: Optional[str] = None
    amount: Optional[float] = 0.0
    drCrType: Optional[str] = "Dr"
    cashLedger: Optional[str] = None
    cashAmount: Optional[float] = 0.0
    bankLedger: Optional[str] = None
    transType: Optional[str] = None
    instNumber: Optional[str] = None
    instDate: Optional[str] = None
    utr: Optional[str] = None
    ifscCode: Optional[str] = None
    branchName: Optional[str] = None
    sourceLedger: Optional[str] = None
    transferAmount: Optional[float] = 0.0
    destinationLedger: Optional[str] = None
    amountReceived: Optional[float] = 0.0
    narration: Optional[str] = ""
    status: Optional[str] = "draft"
    billRows: Optional[List[dict]] = []
    costCenters: Optional[List[dict]] = []

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""

class CommentRequest(BaseModel):
    note: str
