from pydantic import BaseModel
from typing import List, Optional, Any

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
    ledgerRows: Optional[List[dict]] = []
    costCenters: Optional[List[dict]] = []

    # UI Fields for saving all fund flow details
    voucherNumberSeries: Optional[str] = None
    company: Optional[str] = None
    ledgerGroup: Optional[str] = None
    openingBalance: Optional[float] = 0.0
    bankBalance: Optional[float] = 0.0
    costCenterApplicable: Optional[bool] = False
    costCategory: Optional[str] = None
    costCenter: Optional[str] = None
    costAmount: Optional[float] = 0.0
    gstApplicable: Optional[bool] = False
    gstLedger: Optional[str] = None
    gstRate: Optional[Any] = None
    tdsApplicable: Optional[bool] = False
    tdsLedger: Optional[str] = None
    tdsRate: Optional[Any] = None
    totalDebit: Optional[float] = 0.0
    totalCredit: Optional[float] = 0.0
    difference: Optional[float] = 0.0
    entryMode: Optional[str] = "manual"
    excessOption: Optional[str] = None
    remarks: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""

class CommentRequest(BaseModel):
    note: str
