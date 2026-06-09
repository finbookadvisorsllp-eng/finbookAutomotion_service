from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class TransactionStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"

class SalesVoucherType(str, Enum):
    SALES_INVOICE = "sales_invoice"
    SALES_ORDER = "sales_order"
    CREDIT_NOTE = "credit_note"

class PurchaseVoucherType(str, Enum):
    PURCHASE_INVOICE = "purchase_invoice"
    PURCHASE_ORDER = "purchase_order"
    DEBIT_NOTE = "debit_note"

class FundFlowVoucherType(str, Enum):
    BANK_PAYMENT = "bank_payment"
    CASH_PAYMENT = "cash_payment"
    CONTRA = "contra"

class ActivityLogEntry(BaseModel):
    action: str
    note: Optional[str] = ""
    at: datetime = Field(default_factory=datetime.utcnow)
