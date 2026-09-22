from pydantic import BaseModel
from typing import List, Optional, Any

class FundFlowTransactionCreate(BaseModel):
    model_config = {"extra": "allow"}

    # Exact keys matching MongoDB 'vouchers' collection
    companyId: Optional[Any] = None
    voucherGuid: Optional[str] = None
    remoteId: Optional[str] = None
    voucherKey: Optional[str] = None
    voucherNumber: Optional[str] = None
    voucherNumberSeries: Optional[str] = "Default"
    numberingStyle: Optional[str] = "Auto Retain"

    reference: Optional[Any] = None  # {"reference": str, "referenceDate": str} or str
    voucherTypeName: Optional[str] = None  # "Payment" / "Receipt" / "Contra"
    voucherTypeOrigName: Optional[str] = None
    voucherTypeId: Optional[Any] = None
    voucherCategory: Optional[str] = None
    voucherClass: Optional[str] = "ACCOUNTING"
    objectView: Optional[str] = "Accounting Voucher View"
    persistedView: Optional[str] = "Accounting Voucher View"

    dates: Optional[Any] = None  # {"date": datetime, "voucherDate": str, "effectiveDate": datetime}
    partyName: Optional[str] = None
    partyLedgerName: Optional[str] = None
    partyMailingName: Optional[str] = None
    basicBuyerName: Optional[str] = None
    basicBasePartyName: Optional[str] = None
    partyPincode: Optional[str] = None
    address: Optional[str] = ""

    gstDetails: Optional[dict] = {}
    flags: Optional[dict] = {
        "isCancelled": False,
        "isOptional": False,
        "isDeleted": False
    }

    ledgerEntries: Optional[List[dict]] = []
    inventoryEntries: Optional[List[dict]] = []
    invoiceOrderList: Optional[List[dict]] = []
    ewayBillDetails: Optional[List[dict]] = []
    dispatchDetails: Optional[dict] = {}

    totals: Optional[dict] = None  # {"grandTotal": float, "totalAmount": float}
    narration: Optional[str] = ""
    status: Optional[str] = "ACTIVE"
    source: Optional[str] = "manual"
    entryMode: Optional[str] = "manual"
    createdVia: Optional[str] = "manual"
    auditInfo: Optional[dict] = None
    tallyXml: Optional[str] = None
    tally_xml: Optional[str] = None

    # FundFlow UI and workflow compatibility fields
    voucherType: Optional[str] = "cash_payment"
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
    billRows: Optional[List[dict]] = []
    ledgerRows: Optional[List[dict]] = []
    costCenters: Optional[List[dict]] = []
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
    excessOption: Optional[str] = None
    remarks: Optional[str] = None
    batch_id: Optional[str] = None
    item_id: Optional[str] = None
    fingerprint: Optional[str] = None
    source_document: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""

class CommentRequest(BaseModel):
    note: str
