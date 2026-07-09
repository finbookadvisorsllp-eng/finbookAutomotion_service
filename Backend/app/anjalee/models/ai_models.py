from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

class AiLedger(BaseModel):
    name: str
    group: str
    balance: float
    currency: str = "INR"

class AiInvoiceItem(BaseModel):
    item_name: str
    quantity: float
    rate: float
    amount: float
    gst_rate: Optional[float] = None
    discount_percent: float = 0.0
    hsn: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    ratio: Optional[float] = 0.0
    distributedCharge: Optional[float] = 0.0
    taxableAmount: Optional[float] = 0.0
    cgst: Optional[float] = 0.0
    sgst: Optional[float] = 0.0
    igst: Optional[float] = 0.0
    cess: Optional[float] = 0.0
    totalTax: Optional[float] = 0.0

class AiVoucherLedgerEntry(BaseModel):
    ledger_name: str
    is_debit: bool
    amount: float

class AiVoucherDraft(BaseModel):
    voucher_type: Optional[str] = Field(None, description="E.g., Sales, Debit Note")
    party: Optional[str] = Field(None, description="Primary party ledger name")
    amount: float = Field(0.0, description="Voucher amount")
    debit: Optional[str] = Field(None, description="Ledger to debit")
    credit: Optional[str] = Field(None, description="Ledger to credit")
    date: str = Field(default_factory=lambda: datetime.today().strftime('%Y-%m-%d'))
    narration: str = Field("", description="Voucher description")
    status: str = Field("Draft", description="Draft or Saved")
    gst_rate: Optional[float] = Field(None, description="GST rate percentage if applicable")
    voucher_number: Optional[str] = Field(None, description="Voucher number")
    entry_mode: str = Field("accounting", description="'accounting' or 'item_invoice'")
    items: List[AiInvoiceItem] = Field(default_factory=list, description="Items list for invoice mode")
    ledger_entries: List[AiVoucherLedgerEntry] = Field(default_factory=list, description="All ledger entries for multi-entry vouchers")
    bill_allocations: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Bill allocations for payment/receipt")
    additional_charges: List[Dict[str, Any]] = Field(default_factory=list, description="Additional charges/ledger lines (e.g. Freight, Cess, Packing)")
    # Tax calculation results — populated by calculate_taxes engine, never computed inline
    base_amount: float = Field(0.0, description="Taxable base amount from calculate_taxes")
    cgst_amount: float = Field(0.0, description="CGST from calculate_taxes")
    sgst_amount: float = Field(0.0, description="SGST from calculate_taxes")
    igst_amount: float = Field(0.0, description="IGST from calculate_taxes")
    cess_amount: float = Field(0.0, description="CESS from calculate_taxes")
    is_intra_state: bool = Field(True, description="Intra-state flag from calculate_taxes")
    tax_type: str = Field("CGST_SGST", description="Tax type: CGST_SGST or IGST from calculate_taxes")

class ChatSession(BaseModel):
    session_id: str
    history: List[Dict[str, str]] = Field(default_factory=list)
    current_draft: Optional[AiVoucherDraft] = None
    state: str = Field("idle", description="State of the session: idle, awaiting_confirmation")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    draft_json: Optional[Dict[str, Any]] = None

class ChatMessageRequest(BaseModel):
    session_id: str
    message: str

class ChatMessageResponse(BaseModel):
    reply: str
    draft: Optional[AiVoucherDraft] = None
    state: str
    history: List[Dict[str, str]]
    draft_json: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
