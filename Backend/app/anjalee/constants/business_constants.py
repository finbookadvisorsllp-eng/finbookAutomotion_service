# Business constants for the anjalee module
SALES_COLLECTION = "sales_vouchers"
PURCHASE_COLLECTION = "purchase_vouchers"
FUNDFLOW_COLLECTION = "fund_flow_transactions"
COUNTERS_COLLECTION = "counters"
COMPANIES_COLLECTION = "companies"
VOUCHERS_COLLECTION = "vouchers"
LEDGERS_COLLECTION = "ledgers"
STOCK_ITEMS_COLLECTION = "stockItems"
VOUCHER_TYPES_COLLECTION = "voucherTypes"

# Sequential prefixes
SALES_PREFIXES = {
    "sales_invoice": "SI",
    "sales_order": "SO",
    "credit_note": "CN"
}

PURCHASE_PREFIXES = {
    "purchase_invoice": "PI",
    "purchase_order": "PO",
    "debit_note": "DN"
}

FUNDFLOW_PREFIXES = {
    "bank_payment": "BP",
    "cash_payment": "CP",
    "contra": "CT"
}
