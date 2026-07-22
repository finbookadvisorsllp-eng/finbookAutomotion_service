"""
accounting_constants.py
=======================
Centralised accounting reference data for the bulk-upload validation engine.

All hardcoded accounting rules and master lookups live here — a single source of
truth for GST rates, TDS/TCS schedules, Indian state codes, GSTIN/PAN entity maps,
ERP column keyword mappings, and voucher-type business rules.

Import from this module everywhere instead of duplicating values.
"""

# ─────────────────────────────────────────────────────────────────────────────
# GST Rates (Indian GST Council slabs)
# ─────────────────────────────────────────────────────────────────────────────

VALID_GST_RATES = {0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 9, 12, 14, 18, 28}

# ─────────────────────────────────────────────────────────────────────────────
# TDS / TCS standard rates (Income Tax Act 1961)
# ─────────────────────────────────────────────────────────────────────────────

VALID_TDS_RATES = {0.1, 1, 2, 5, 10, 20, 30}
VALID_TCS_RATES = {0.075, 0.1, 1, 5}

# ─────────────────────────────────────────────────────────────────────────────
# ISO 4217 currency codes (commonly used in Indian trade)
# ─────────────────────────────────────────────────────────────────────────────

VALID_CURRENCY_CODES = {
    "INR", "USD", "EUR", "GBP", "JPY", "AED", "SGD", "AUD", "CAD", "CHF",
    "CNY", "HKD", "KWD", "SAR", "MYR", "THB", "ZAR", "NZD", "SEK", "NOK"
}

# ─────────────────────────────────────────────────────────────────────────────
# Indian State Codes (for GSTIN validation — first 2 digits)
# Source: GST Council Official Notification
# ─────────────────────────────────────────────────────────────────────────────

INDIAN_STATE_CODES = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman and Diu",
    "26": "Dadra and Nagar Haveli",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh (New)",
    "38": "Ladakh",
    "97": "Other Territory",
    "99": "Centre Jurisdiction",
}

# ─────────────────────────────────────────────────────────────────────────────
# PAN Entity Type Map (4th character of PAN)
# Source: Income Tax Act
# ─────────────────────────────────────────────────────────────────────────────

PAN_ENTITY_TYPES = {
    "P": "Individual",
    "C": "Company",
    "H": "Hindu Undivided Family (HUF)",
    "F": "Firm / LLP",
    "A": "Association of Persons (AOP)",
    "T": "Trust",
    "B": "Body of Individuals (BOI)",
    "L": "Local Authority",
    "J": "Artificial Juridical Person (AJP)",
    "G": "Government",
}

# ─────────────────────────────────────────────────────────────────────────────
# ERP Column Keyword Mappings
# Ordered by specificity (most specific first to avoid false matches)
# ─────────────────────────────────────────────────────────────────────────────

FIELD_COLUMN_MAPPINGS = [
    ("Voucher Type",  ["voucher type", "vch type", "document type"]),
    ("Voucher No",    ["voucher no", "vch no", "voucher number", "inv no", "invoice no",
                       "invoice number", "bill no", "bill number"]),
    ("Date",          ["date", "voucher date", "invoice date", "bill date",
                       "txn date", "transaction date", "entry date"]),
    ("Party Name",    ["party name", "party", "customer", "vendor", "supplier",
                       "client", "buyer", "seller", "customer name", "vendor name"]),
    ("Ledger",        ["ledger", "account", "ledger name", "account name", "ledger account"]),
    ("Item Name",     ["item name", "item", "product", "stock item", "goods",
                       "service name", "particulars"]),
    ("Narration",     ["narration", "remarks", "remark", "note", "notes", "memo", "details"]),
    ("Quantity",      ["quantity", "qty", "units", "no of units", "pcs"]),
    ("Unit",          ["unit", "uom", "unit of measure", "unit of measurement"]),
    ("Rate",          ["rate", "unit price", "price", "unit rate", "price per unit"]),
    ("Discount%",     ["discount", "disc", "disc%", "discount%", "discount percent"]),
    ("Taxable Value", ["taxable value", "taxable", "taxable amt", "taxable amount",
                       "assessable value", "base amount", "basic amount"]),
    ("GST Rate",      ["gst rate", "gst%", "tax rate", "gst percent", "igst rate",
                       "cgst rate", "sgst rate", "tax percent"]),
    ("CGST Amount",   ["cgst", "cgst amount", "cgst amt", "central gst"]),
    ("SGST Amount",   ["sgst", "sgst amount", "sgst amt", "state gst"]),
    ("IGST Amount",   ["igst", "igst amount", "igst amt", "integrated gst"]),
    ("CESS Amount",   ["cess", "cess amount", "cess amt", "gst cess"]),
    ("TDS%",          ["tds", "tds%", "tds rate", "tds percent", "tds deducted"]),
    ("TCS%",          ["tcs", "tcs%", "tcs rate", "tcs percent", "tcs collected"]),
    ("Round Off",     ["round off", "roundoff", "rounding", "round"]),
    ("Amount",        ["amount", "total", "grand total", "net amount", "net",
                       "total amount", "value", "invoice amount", "bill amount"]),
    ("GSTIN",         ["gstin", "gst no", "gst number", "gstin no", "gstin number"]),
    ("PAN",           ["pan", "pan no", "pan number", "pan card", "pan card no"]),
    ("HSN/SAC",       ["hsn", "sac", "hsn code", "sac code", "hsn/sac", "hsn sac"]),
    ("IFSC Code",     ["ifsc", "ifsc code", "ifsc no"]),
    ("Bank Name",     ["bank name", "bank", "bank account", "bank account name"]),
    ("Reference No",  ["ref no", "reference", "reference no", "reference number", "ref num"]),
    ("UTR/Cheque No", ["utr", "cheque no", "check no", "cheque number",
                       "transaction id", "payment ref", "utr no", "rtgs no", "neft no"]),
    ("Currency",      ["currency", "cur", "curr", "currency code"]),
    ("Cost Center",   ["cost center", "cost centre", "cc", "cost centre name"]),
    ("Project",       ["project", "project name", "project code"]),
    ("Batch/Serial",  ["batch", "serial", "batch no", "serial no", "lot", "batch number"]),
    ("Godown",        ["godown", "warehouse", "location", "store", "godown name"]),
    ("Email",         ["email", "email id", "e-mail", "email address"]),
    ("Phone",         ["phone", "mobile", "contact", "phone no", "mobile no",
                       "contact no", "mobile number"]),
    ("Pin Code",      ["pin", "pincode", "pin code", "postal code", "zip", "zip code"]),
]

# ─────────────────────────────────────────────────────────────────────────────
# Voucher Type Business Rules
# Defines required fields and constraints per voucher type
# ─────────────────────────────────────────────────────────────────────────────

VOUCHER_TYPE_RULES = {
    "Sales Voucher": {
        "required": ["Date", "Party Name", "Amount"],
        "must_have_party": True,
        "must_have_bank": False,
    },
    "Sales Invoice": {
        "required": ["Date", "Party Name", "Amount"],
        "must_have_party": True,
        "must_have_bank": False,
    },
    "Purchase Voucher": {
        "required": ["Date", "Party Name", "Amount"],
        "must_have_party": True,
        "must_have_bank": False,
    },
    "Purchase Invoice": {
        "required": ["Date", "Party Name", "Amount"],
        "must_have_party": True,
        "must_have_bank": False,
    },
    "Payment Voucher": {
        "required": ["Date", "Amount"],
        "must_have_party": False,
        "must_have_bank": True,
    },
    "Receipt Voucher": {
        "required": ["Date", "Amount"],
        "must_have_party": False,
        "must_have_bank": True,
    },
    "Contra Voucher": {
        "required": ["Date", "Amount"],
        "must_have_party": False,
        "must_have_bank": True,
    },
    "Journal Voucher": {
        "required": ["Date", "Ledger", "Amount"],
        "must_have_party": False,
        "must_have_bank": False,
        "dr_cr_balance": True,
    },
    "Credit Note": {
        "required": ["Date", "Party Name", "Amount"],
        "must_have_party": True,
        "must_have_bank": False,
    },
    "Debit Note": {
        "required": ["Date", "Party Name", "Amount"],
        "must_have_party": True,
        "must_have_bank": False,
    },
    "Bank Statement": {
        "required": ["Date", "Amount"],
        "must_have_party": False,
        "must_have_bank": True,
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# MongoDB Collection Names used by the validation engine
# Consolidated with business_constants.py to avoid duplication
# ─────────────────────────────────────────────────────────────────────────────

COLL_LEDGERS       = "ledgers"
COLL_STOCK_ITEMS   = "stockItems"      # matches business_constants.STOCK_ITEMS_COLLECTION
COLL_VOUCHERS      = "vouchers"
COLL_COMPANIES     = "companies"
COLL_HSN_CODES     = "hsn_codes"
COLL_COST_CENTERS  = "cost_centers"
COLL_GODOWNS       = "godowns"

# Ledger group names for Bank Accounts
BANK_LEDGER_GROUPS = ["Bank Accounts", "Bank OD Account"]

# Ledger group names for Party (Debtor/Creditor)
PARTY_LEDGER_GROUPS = ["Sundry Debtors", "Sundry Creditors"]
