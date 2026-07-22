"""
SpreadsheetValidationEngine
===========================
Dynamic, accounting-grade validation engine for bulk Excel/CSV uploads.

Validates every uploaded row against MongoDB master records and accounting rules
for all voucher types: Sales, Purchase, Payment, Receipt, Contra, Journal,
Credit Note, Debit Note.

All accounting constants (GST rates, state codes, TDS/TCS schedules, column
keyword mappings, voucher rules) are imported from:
    app.anjalee.constants.accounting_constants

Each validation emits structured ValidationIssue objects with:
  - Exact row and column indices
  - Severity: Error | Warning | Info
  - Category, title, whatIsWrong, whyItIsWrong, howToFix
  - suggestedValue + confidence score (0.0–1.0)
  - canAutoFix, createNewMaster, isDuplicate flags
"""

import re
import difflib
import hashlib
import logging
from datetime import datetime, date

from app.anjalee.constants.accounting_constants import (
    VALID_GST_RATES,
    VALID_TDS_RATES,
    VALID_TCS_RATES,
    VALID_CURRENCY_CODES,
    INDIAN_STATE_CODES,
    PAN_ENTITY_TYPES,
    FIELD_COLUMN_MAPPINGS,
    VOUCHER_TYPE_RULES,
    COLL_LEDGERS,
    COLL_STOCK_ITEMS,
    COLL_VOUCHERS,
    COLL_COMPANIES,
    COLL_HSN_CODES,
    COLL_COST_CENTERS,
    COLL_GODOWNS,
    BANK_LEDGER_GROUPS,
    PARTY_LEDGER_GROUPS,
)

logger = logging.getLogger("spreadsheet_validator")


# ─────────────────────────────────────────────────────────────────────────────
# Helper utilities
# ─────────────────────────────────────────────────────────────────────────────

def fuzzy_best_match(val: str, candidates: dict) -> tuple:
    """
    Find the best fuzzy match for `val` from `candidates` {lower_key: original_name}.
    Returns (original_name, confidence_0_to_1) or (None, 0.0).
    """
    if not val or not candidates:
        return None, 0.0

    val_lower = val.strip().lower()

    # Exact match → confidence 1.0
    if val_lower in candidates:
        return candidates[val_lower], 1.0

    # Fuzzy match
    close = difflib.get_close_matches(val_lower, list(candidates.keys()), n=1, cutoff=0.35)
    if close:
        ratio = difflib.SequenceMatcher(None, val_lower, close[0]).ratio()
        return candidates[close[0]], round(ratio, 2)

    # Substring containment fallback
    for key, orig in candidates.items():
        if val_lower in key or key in val_lower:
            ratio = difflib.SequenceMatcher(None, val_lower, key).ratio()
            return orig, round(max(0.3, ratio), 2)

    return None, 0.0


def safe_float(val) -> tuple:
    """Returns (float_val, None) or (None, error_msg)."""
    if val is None or str(val).strip() == "":
        return None, "empty"
    try:
        return float(str(val).replace(",", "").strip()), None
    except (ValueError, TypeError):
        return None, f"'{val}' is not a valid number"


def parse_date_flexible(val) -> tuple:
    """
    Parse date from multiple formats.
    Returns (datetime, None) or (None, error_msg).
    Preserves datetime/date objects directly without re-parsing.
    """
    if isinstance(val, datetime):
        return val, None
    if isinstance(val, date):
        return datetime(val.year, val.month, val.day), None

    val_str = str(val or "").strip()
    if not val_str:
        return None, "Date is empty"

    if " " in val_str:
        val_str = val_str.split(" ")[0]

    FORMATS = [
        "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y/%m/%d",
        "%d.%m.%Y", "%Y%m%d", "%d-%b-%Y", "%d %b %Y",
        "%m/%d/%Y", "%b %d, %Y",
    ]
    for fmt in FORMATS:
        try:
            dt = datetime.strptime(val_str, fmt)
            if 1990 <= dt.year <= 2100:
                return dt, None
        except ValueError:
            continue
    return None, f"Unrecognized date format: '{val_str}'. Use DD/MM/YYYY"


def row_hash(row: list) -> str:
    """MD5 hash of a normalised row for duplicate detection."""
    normalised = "|".join(str(x or "").strip().lower() for x in row)
    return hashlib.md5(normalised.encode()).hexdigest()


# ── Compliance validators ────────────────────────────────────────────────────

def validate_gstin_full(gstin: str) -> tuple:
    """Full GSTIN structure check. Returns (is_valid, error_msg | None)."""
    g = str(gstin or "").strip().upper()
    if not g:
        return False, "GSTIN is empty"
    if len(g) != 15:
        return False, f"GSTIN must be exactly 15 characters (got {len(g)})"
    state_code = g[:2]
    if state_code not in INDIAN_STATE_CODES:
        return False, (
            f"Invalid state code '{state_code}'. "
            f"Valid codes: {', '.join(sorted(INDIAN_STATE_CODES.keys()))}"
        )
    pan_part = g[2:12]
    if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", pan_part):
        return False, f"PAN embedded in GSTIN (positions 3–12) is invalid: '{pan_part}'. Expected AAAAA9999A"
    if not g[12].isdigit():
        return False, f"GSTIN position 13 must be a digit (entity number), got '{g[12]}'"
    if g[13] != "Z":
        return False, f"GSTIN position 14 must be 'Z', got '{g[13]}'"
    return True, None


def validate_pan_full(pan: str) -> tuple:
    """Full PAN validation. Returns (is_valid, error_msg | None)."""
    p = str(pan or "").strip().upper()
    if not p:
        return False, "PAN is empty"
    if len(p) != 10:
        return False, f"PAN must be exactly 10 characters (got {len(p)})"
    if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", p):
        return False, "PAN format must be 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)"
    entity = p[3].upper()
    if entity not in PAN_ENTITY_TYPES:
        return False, f"PAN 4th character '{entity}' is not a valid entity type. Valid: {list(PAN_ENTITY_TYPES.keys())}"
    return True, None


def validate_ifsc_full(ifsc: str) -> tuple:
    """IFSC code validation. Returns (is_valid, error_msg | None)."""
    i = str(ifsc or "").strip().upper()
    if not i:
        return False, "IFSC is empty"
    if len(i) != 11:
        return False, f"IFSC must be exactly 11 characters (got {len(i)})"
    if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", i):
        return False, "IFSC format: 4 letters + '0' + 6 alphanumeric (e.g. SBIN0001234)"
    return True, None


def validate_hsn_sac(val: str) -> tuple:
    """HSN/SAC must be 4, 6, or 8 numeric digits."""
    v = str(val or "").strip()
    if not v:
        return False, "HSN/SAC is empty"
    if not v.isdigit():
        return False, f"HSN/SAC must be numeric, got '{v}'"
    if len(v) not in (4, 6, 8):
        return False, f"HSN/SAC must be 4, 6, or 8 digits (got {len(v)} digits)"
    return True, None


def validate_email_format(val: str) -> tuple:
    v = str(val or "").strip()
    if not v:
        return False, "Email is empty"
    if not re.match(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", v):
        return False, f"'{v}' is not a valid email address"
    return True, None


def validate_phone_format(val: str) -> tuple:
    """Indian mobile: 10 digits starting with 6/7/8/9."""
    v = str(val or "").strip().replace(" ", "").replace("-", "")
    if v.startswith("+91"):
        v = v[3:]
    elif v.startswith("91") and len(v) == 12:
        v = v[2:]
    if not v:
        return False, "Phone number is empty"
    if not v.isdigit() or len(v) != 10:
        return False, f"Phone must be 10 digits (got '{val}')"
    if v[0] not in "6789":
        return False, f"Indian mobile must start with 6, 7, 8 or 9 (got '{v[0]}')"
    return True, None


def validate_pincode_format(val: str) -> tuple:
    """Indian PIN: 6 non-zero-leading digits."""
    v = str(val or "").strip()
    if not v:
        return False, "PIN code is empty"
    if not v.isdigit() or len(v) != 6:
        return False, f"PIN code must be 6 digits (got '{v}')"
    if v[0] == "0":
        return False, "PIN code cannot start with 0"
    return True, None


# ─────────────────────────────────────────────────────────────────────────────
# Issue builder
# ─────────────────────────────────────────────────────────────────────────────

def make_issue(
    row: int,
    col: int,
    field: str,
    category: str,
    severity: str,
    title: str,
    current_value,
    what_is_wrong: str,
    why_is_wrong: str,
    how_to_fix: str,
    suggested_value=None,
    confidence: float = 1.0,
    can_auto_fix: bool = False,
    create_new_master: bool = False,
    is_duplicate: bool = False,
) -> dict:
    issue_id = f"issue-{row}-{field}-{col}"
    sv = str(suggested_value) if suggested_value is not None else None
    return {
        "id": issue_id,
        "row": row,
        "col": col,
        "field": field,
        "category": category,
        "severity": severity,
        "title": title,
        "currentValue": str(current_value or ""),
        "whatIsWrong": what_is_wrong,
        "whyItIsWrong": why_is_wrong,
        "howToFix": how_to_fix,
        "suggestedValue": sv,
        "confidence": round(float(confidence), 2),
        "canAutoFix": can_auto_fix,
        "createNewMaster": create_new_master,
        "isDuplicate": is_duplicate,
        # Legacy keys kept for frontend compatibility
        "type": severity,
        "applyValue": sv,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SpreadsheetValidationEngine
# ─────────────────────────────────────────────────────────────────────────────

class SpreadsheetValidationEngine:
    """
    Validates an uploaded spreadsheet against MongoDB master records
    and accounting business rules.

    Master data is loaded once per validation call from MongoDB and cached
    in instance dictionaries for the duration of that call.
    """

    def __init__(self, db):
        self.db = db

        # Master data caches — populated during validate()
        self.party_ledgers: dict = {}        # {lower_name: original_name}
        self.all_ledgers: dict = {}          # {lower_name: original_name}
        self.bank_ledgers: dict = {}         # {lower_name: original_name}
        self.stock_items: dict = {}          # {lower_name: original_name}  ← from stock_items collection only
        self.hsn_codes: set = set()          # valid HSN/SAC codes from hsn_codes collection
        self.existing_voucher_nos: set = set()
        self.cost_centers: dict = {}
        self.godowns: dict = {}
        self.company_info: dict = {}

    # ── Master data loaders ──────────────────────────────────────────────────

    async def _load_master_data(self):
        """Load all master data from MongoDB. Uses collection names from accounting_constants."""
        db = self.db

        # Party ledgers (Sundry Debtors + Sundry Creditors only)
        try:
            cur = db[COLL_LEDGERS].find(
                {"groupName": {"$in": PARTY_LEDGER_GROUPS}},
                {"ledgerName": 1}
            )
            for doc in await cur.to_list(length=2000):
                n = (doc.get("ledgerName") or "").strip()
                if n:
                    self.party_ledgers[n.lower()] = n
        except Exception as e:
            logger.warning(f"Could not load party ledgers: {e}")

        # All ledgers (for journal/general ledger validation)
        try:
            cur = db[COLL_LEDGERS].find({}, {"ledgerName": 1, "groupName": 1})
            for doc in await cur.to_list(length=5000):
                n = (doc.get("ledgerName") or "").strip()
                if n:
                    self.all_ledgers[n.lower()] = n
        except Exception as e:
            logger.warning(f"Could not load all ledgers: {e}")

        # Bank ledgers
        try:
            cur = db[COLL_LEDGERS].find(
                {"groupName": {"$in": BANK_LEDGER_GROUPS}},
                {"ledgerName": 1}
            )
            for doc in await cur.to_list(length=500):
                n = (doc.get("ledgerName") or "").strip()
                if n:
                    self.bank_ledgers[n.lower()] = n
        except Exception as e:
            logger.warning(f"Could not load bank ledgers: {e}")

        # Stock items — Item Name is ONLY validated against stock_items, never party ledgers
        try:
            cur = db[COLL_STOCK_ITEMS].find({}, {"itemName": 1, "stockItemName": 1, "name": 1})
            for doc in await cur.to_list(length=5000):
                n = (
                    doc.get("itemName") or
                    doc.get("stockItemName") or
                    doc.get("name") or ""
                ).strip()
                if n:
                    self.stock_items[n.lower()] = n
        except Exception as e:
            logger.warning(f"Could not load stock items: {e}")

        # HSN/SAC codes (optional — format-only check if collection missing)
        try:
            cur = db[COLL_HSN_CODES].find({}, {"code": 1})
            for doc in await cur.to_list(length=10000):
                c = str(doc.get("code") or "").strip()
                if c:
                    self.hsn_codes.add(c)
        except Exception as e:
            logger.debug(f"HSN codes collection not available, using format-only check: {e}")

        # Existing voucher numbers (for duplicate voucher detection)
        try:
            cur = db[COLL_VOUCHERS].find({}, {"voucherNumber": 1, "voucher_number": 1})
            for doc in await cur.to_list(length=10000):
                vn = str(doc.get("voucherNumber") or doc.get("voucher_number") or "").strip()
                if vn:
                    self.existing_voucher_nos.add(vn.lower())
        except Exception as e:
            logger.debug(f"Vouchers collection not available: {e}")

        # Cost centers
        try:
            cur = db[COLL_COST_CENTERS].find({}, {"name": 1})
            for doc in await cur.to_list(length=500):
                n = (doc.get("name") or "").strip()
                if n:
                    self.cost_centers[n.lower()] = n
        except Exception as e:
            logger.debug(f"Cost centers collection not available: {e}")

        # Godowns / Warehouses
        try:
            cur = db[COLL_GODOWNS].find({}, {"name": 1})
            for doc in await cur.to_list(length=200):
                n = (doc.get("name") or "").strip()
                if n:
                    self.godowns[n.lower()] = n
        except Exception as e:
            logger.debug(f"Godowns collection not available: {e}")

        # Company info (for financial year boundaries)
        try:
            doc = await db[COLL_COMPANIES].find_one({})
            if doc:
                self.company_info = doc
        except Exception as e:
            logger.debug(f"Company info not available: {e}")

    # ── Column mapping ────────────────────────────────────────────────────────

    def map_columns(self, headers: list) -> list:
        """
        Map each spreadsheet column header to a standard ERP field name using
        keyword matching from FIELD_COLUMN_MAPPINGS (in accounting_constants).
        Returns list of {original_name, standard_erp_field, col_idx}.
        """
        result = []
        for col_idx, header in enumerate(headers):
            h = str(header or "").strip().lower()
            matched_field = "Unmapped"
            for std_field, keywords in FIELD_COLUMN_MAPPINGS:
                if any(k in h for k in keywords):
                    matched_field = std_field
                    break
            result.append({
                "original_name": str(header or ""),
                "standard_erp_field": matched_field,
                "col_idx": col_idx,
            })
        return result

    def build_col_index(self, column_mapping: list) -> dict:
        """{field_name: col_idx} lookup built from map_columns() output."""
        idx = {}
        for m in column_mapping:
            f = m["standard_erp_field"]
            if f != "Unmapped" and f not in idx:
                idx[f] = m["col_idx"]
        return idx

    # ── Document classifier ───────────────────────────────────────────────────

    def classify_document(self, filename: str, headers: list, col_idx: dict) -> str:
        """Classify document type from filename keywords then header keywords."""
        fn = filename.lower()
        hdr = " ".join(str(h or "") for h in headers).lower()

        for keyword, doc_type in [
            ("sales invoice",    "Sales Invoice"),
            ("purchase invoice", "Purchase Invoice"),
            ("credit note",      "Credit Note"),
            ("debit note",       "Debit Note"),
            ("journal",          "Journal Voucher"),
            ("contra",           "Contra Voucher"),
            ("payment",          "Payment Voucher"),
            ("receipt",          "Receipt Voucher"),
            ("purchase",         "Purchase Voucher"),
            ("sales",            "Sales Voucher"),
            ("bank",             "Bank Statement"),
            ("statement",        "Bank Statement"),
        ]:
            if keyword in fn or keyword in hdr:
                return doc_type

        # Infer from detected columns
        if "UTR/Cheque No" in col_idx or "Bank Name" in col_idx:
            return "Bank Statement"
        if "IGST Amount" in col_idx or "HSN/SAC" in col_idx:
            return "Sales Invoice"

        return "Sales Voucher"

    # ── Cell accessor ─────────────────────────────────────────────────────────

    def get_cell(self, row: list, col_idx: dict, field: str) -> tuple:
        """Returns (col_index, str_value). Returns (-1, '') if field not mapped."""
        ci = col_idx.get(field, -1)
        if ci == -1 or ci >= len(row):
            return -1, ""
        val = row[ci]
        if isinstance(val, (datetime, date)):
            return ci, val.strftime("%d/%m/%Y")
        return ci, str(val or "").strip()

    # ─────────────────────────────────────────────────────────────────────────
    # Validation methods
    # ─────────────────────────────────────────────────────────────────────────

    def _validate_dates(self, row, row_num, col_idx):
        issues = []
        ci, val = self.get_cell(row, col_idx, "Date")
        if ci == -1:
            return issues

        raw_val = row[ci]

        if not val:
            issues.append(make_issue(
                row=row_num, col=ci, field="Date", category="Date", severity="Error",
                title="Date is Missing",
                current_value="",
                what_is_wrong="The Date column is empty.",
                why_is_wrong="Tally XML import requires a valid transaction date for every voucher.",
                how_to_fix="Enter a date in DD/MM/YYYY format.",
                suggested_value=datetime.now().strftime("%d/%m/%Y"),
                confidence=1.0, can_auto_fix=True,
            ))
            return issues

        parsed, err = parse_date_flexible(raw_val)
        if err:
            issues.append(make_issue(
                row=row_num, col=ci, field="Date", category="Date", severity="Error",
                title="Invalid Date Format",
                current_value=val,
                what_is_wrong=f"'{val}' could not be parsed as a valid date ({err}).",
                why_is_wrong="Tally requires dates in DD/MM/YYYY, YYYY-MM-DD or similar standard formats.",
                how_to_fix="Correct the date to DD/MM/YYYY format.",
                suggested_value=datetime.now().strftime("%d/%m/%Y"),
                confidence=0.9, can_auto_fix=False,
            ))
        else:
            now = datetime.now()
            fy_start_year = now.year if now.month >= 4 else now.year - 1
            fy_start = datetime(fy_start_year, 4, 1)
            fy_end = datetime(fy_start_year + 1, 3, 31)

            if parsed > now:
                issues.append(make_issue(
                    row=row_num, col=ci, field="Date", category="Date", severity="Warning",
                    title="Future Date Detected",
                    current_value=val,
                    what_is_wrong=f"Date '{val}' is in the future.",
                    why_is_wrong="Transactions are typically not post-dated.",
                    how_to_fix="Correct the date if entered incorrectly.",
                    suggested_value=now.strftime("%d/%m/%Y"),
                    confidence=0.8, can_auto_fix=False,
                ))
            elif parsed < datetime(2000, 1, 1):
                issues.append(make_issue(
                    row=row_num, col=ci, field="Date", category="Date", severity="Error",
                    title="Date Out of Range",
                    current_value=val,
                    what_is_wrong=f"'{val}' is before the year 2000.",
                    why_is_wrong="Accounting records must have dates within a valid financial year range.",
                    how_to_fix="Enter a valid 4-digit year date.",
                    suggested_value=now.strftime("%d/%m/%Y"),
                    confidence=0.95, can_auto_fix=False,
                ))
            elif not (fy_start <= parsed <= fy_end):
                issues.append(make_issue(
                    row=row_num, col=ci, field="Date", category="Date", severity="Warning",
                    title="Date Outside Current Financial Year",
                    current_value=val,
                    what_is_wrong=(
                        f"Date '{val}' falls outside the current FY "
                        f"({fy_start.strftime('%d/%m/%Y')} – {fy_end.strftime('%d/%m/%Y')})."
                    ),
                    why_is_wrong="Vouchers outside the active financial year may be rejected during Tally import.",
                    how_to_fix="Confirm the financial year or adjust the date.",
                    suggested_value=None,
                    confidence=0.7, can_auto_fix=False,
                ))

        return issues

    def _validate_voucher_number(self, row, row_num, col_idx):
        issues = []
        ci, val = self.get_cell(row, col_idx, "Voucher No")
        if ci == -1:
            return issues

        if not val:
            issues.append(make_issue(
                row=row_num, col=ci, field="Voucher No", category="Voucher", severity="Error",
                title="Voucher Number is Missing",
                current_value="",
                what_is_wrong="Voucher / Invoice number is empty.",
                why_is_wrong="Tally requires a unique voucher number for each transaction.",
                how_to_fix="Provide a sequential voucher number.",
                suggested_value=f"VCH-{row_num - 1:04d}",
                confidence=1.0, can_auto_fix=True,
            ))
        elif val.lower() in self.existing_voucher_nos:
            issues.append(make_issue(
                row=row_num, col=ci, field="Voucher No", category="Voucher", severity="Error",
                title="Duplicate Voucher Number",
                current_value=val,
                what_is_wrong=f"Voucher number '{val}' already exists in the database.",
                why_is_wrong="Duplicate voucher numbers cause posting conflicts in Tally.",
                how_to_fix="Assign a unique voucher number.",
                suggested_value=f"{val}-NEW",
                confidence=1.0, can_auto_fix=False, is_duplicate=True,
            ))
        return issues

    def _validate_party(self, row, row_num, col_idx, doc_type):
        """Validates Party Name against Sundry Debtor/Creditor ledgers only."""
        issues = []
        ci, val = self.get_cell(row, col_idx, "Party Name")
        if ci == -1:
            return issues

        rules = VOUCHER_TYPE_RULES.get(doc_type, {})
        must_have_party = rules.get("must_have_party", True)

        if not val:
            if must_have_party:
                issues.append(make_issue(
                    row=row_num, col=ci, field="Party Name", category="Party/Ledger", severity="Error",
                    title="Party Ledger is Missing",
                    current_value="",
                    what_is_wrong="Party name is blank.",
                    why_is_wrong=f"{doc_type} vouchers must have a party ledger (Sundry Debtor or Creditor).",
                    how_to_fix="Enter a valid party ledger name from your Tally master.",
                    suggested_value=list(self.party_ledgers.values())[0] if self.party_ledgers else None,
                    confidence=0.5, can_auto_fix=False, create_new_master=True,
                ))
            return issues

        # Skip if master data unavailable
        if not self.party_ledgers and not self.all_ledgers:
            return issues

        best_party, conf_party = fuzzy_best_match(val, self.party_ledgers)
        best_all, conf_all = fuzzy_best_match(val, self.all_ledgers)

        # Pick the better suggestion
        if (conf_all or 0) > (conf_party or 0):
            best, conf = best_all, conf_all
        else:
            best, conf = best_party, conf_party

        if val.lower() not in self.party_ledgers and val.lower() not in self.all_ledgers:
            issues.append(make_issue(
                row=row_num, col=ci, field="Party Name", category="Party/Ledger", severity="Error",
                title="Ledger Not Found in Tally",
                current_value=val,
                what_is_wrong=f"Party '{val}' does not exist in your Tally master ledgers.",
                why_is_wrong="Tally XML import will fail if ledger names do not match exactly.",
                how_to_fix=f"Rename to '{best}' or create a new ledger." if best else "Create a new ledger or correct the spelling.",
                suggested_value=best,
                confidence=conf, can_auto_fix=(bool(best) and conf >= 0.8),
                create_new_master=(best is None),
            ))
        elif val.lower() not in self.party_ledgers and val.lower() in self.all_ledgers:
            issues.append(make_issue(
                row=row_num, col=ci, field="Party Name", category="Party/Ledger", severity="Warning",
                title="Ledger Not in Debtor/Creditor Group",
                current_value=val,
                what_is_wrong=f"'{val}' exists in ledgers but not under Sundry Debtors or Sundry Creditors.",
                why_is_wrong="Party ledgers for sales/purchase must belong to Sundry Debtors or Creditors group.",
                how_to_fix="Change the ledger group in Tally to Sundry Debtors or Sundry Creditors.",
                suggested_value=val,
                confidence=0.9, can_auto_fix=False,
            ))

        return issues

    def _validate_ledger(self, row, row_num, col_idx):
        """Validates the general Ledger column against all_ledgers (for journal entries)."""
        issues = []
        ci, val = self.get_cell(row, col_idx, "Ledger")
        if ci == -1 or not val:
            return issues

        # Skip if master not loaded
        if not self.all_ledgers:
            return issues

        if val.lower() not in self.all_ledgers:
            best, conf = fuzzy_best_match(val, self.all_ledgers)
            issues.append(make_issue(
                row=row_num, col=ci, field="Ledger", category="Party/Ledger", severity="Error",
                title="Ledger Account Not Found",
                current_value=val,
                what_is_wrong=f"Ledger account '{val}' does not exist in Tally.",
                why_is_wrong="All ledger accounts must exist in Tally master to post journal entries.",
                how_to_fix=f"Rename to '{best}' or create the ledger." if best else "Create the ledger account in Tally.",
                suggested_value=best,
                confidence=conf, can_auto_fix=(bool(best) and conf >= 0.8),
                create_new_master=(best is None),
            ))
        return issues

    def _validate_item(self, row, row_num, col_idx):
        """
        Validates Item Name ONLY against the stock_items (stockItems) MongoDB collection.
        Never cross-checks against party ledgers or any other master.
        Skips validation silently if stock_items master is empty (new installation).
        """
        issues = []
        ci, val = self.get_cell(row, col_idx, "Item Name")
        if ci == -1 or not val:
            return issues

        # If stock_items master not loaded (empty collection), skip validation
        if not self.stock_items:
            return issues

        if val.lower() not in self.stock_items:
            best, conf = fuzzy_best_match(val, self.stock_items)
            issues.append(make_issue(
                row=row_num, col=ci, field="Item Name", category="Inventory", severity="Warning",
                title="Stock Item Not Found in Tally",
                current_value=val,
                what_is_wrong=f"Item '{val}' does not match any stock item in Tally's stockItems master.",
                why_is_wrong="Inventory vouchers must reference valid stock items for accurate inventory tracking.",
                how_to_fix=f"Map to '{best}' or create a new stock item." if best else "Create a new stock item in Tally.",
                suggested_value=best,
                confidence=conf, can_auto_fix=(bool(best) and conf >= 0.8),
                create_new_master=(best is None),
            ))
        return issues

    def _validate_amount(self, row, row_num, col_idx, doc_type):
        issues = []
        ci, val = self.get_cell(row, col_idx, "Amount")
        if ci == -1:
            return issues

        if not val:
            issues.append(make_issue(
                row=row_num, col=ci, field="Amount", category="Amount", severity="Error",
                title="Amount is Missing",
                current_value="",
                what_is_wrong="The Amount column is empty.",
                why_is_wrong="Every voucher line must have an amount value.",
                how_to_fix="Enter a positive numeric amount.",
                suggested_value="0.00",
                confidence=1.0, can_auto_fix=False,
            ))
            return issues

        fval, ferr = safe_float(val)
        if ferr:
            issues.append(make_issue(
                row=row_num, col=ci, field="Amount", category="Amount", severity="Error",
                title="Amount is Not Numeric",
                current_value=val,
                what_is_wrong=f"'{val}' cannot be parsed as a number.",
                why_is_wrong="Amount fields must contain valid numeric values.",
                how_to_fix="Remove non-numeric characters (letters, symbols) from the amount field.",
                suggested_value=None, confidence=1.0, can_auto_fix=False,
            ))
        elif fval == 0:
            issues.append(make_issue(
                row=row_num, col=ci, field="Amount", category="Amount", severity="Warning",
                title="Zero Amount Detected",
                current_value=val,
                what_is_wrong="Amount is zero.",
                why_is_wrong="Zero-value vouchers are usually not meaningful accounting entries.",
                how_to_fix="Verify if this row should have a non-zero amount.",
                suggested_value=None, confidence=0.7, can_auto_fix=False,
            ))
        elif fval < 0 and doc_type not in ("Credit Note", "Debit Note", "Journal Voucher"):
            issues.append(make_issue(
                row=row_num, col=ci, field="Amount", category="Amount", severity="Error",
                title="Negative Amount Detected",
                current_value=val,
                what_is_wrong=f"Amount is negative ({val}).",
                why_is_wrong="Tally expects positive amounts for standard debit/credit entries.",
                how_to_fix=f"Change to the absolute value: {abs(fval):.2f}",
                suggested_value=f"{abs(fval):.2f}",
                confidence=1.0, can_auto_fix=True,
            ))
        return issues

    def _validate_gst_math(self, row, row_num, col_idx):
        issues = []

        def gcell(f):
            ci = col_idx.get(f, -1)
            if ci == -1 or ci >= len(row):
                return -1, None, ""
            v = str(row[ci] or "").strip().replace(",", "")
            fv, _ = safe_float(v)
            return ci, fv, v

        taxable_ci, taxable, taxable_str = gcell("Taxable Value")
        rate_ci,    rate,    rate_str    = gcell("GST Rate")
        cgst_ci,    cgst,    cgst_str    = gcell("CGST Amount")
        sgst_ci,    sgst,    sgst_str    = gcell("SGST Amount")
        igst_ci,    igst,    igst_str    = gcell("IGST Amount")
        cess_ci,    cess,    _           = gcell("CESS Amount")
        amt_ci,     amt,     amt_str     = gcell("Amount")

        # GST rate slab check
        if rate_ci != -1 and rate_str:
            rate_clean, _ = safe_float(rate_str.replace("%", ""))
            if rate_clean is not None and rate_clean not in VALID_GST_RATES and rate_clean != 0:
                closest = min(VALID_GST_RATES, key=lambda x: abs(x - rate_clean))
                issues.append(make_issue(
                    row=row_num, col=rate_ci, field="GST Rate", category="GST", severity="Warning",
                    title="Unusual GST Rate",
                    current_value=rate_str,
                    what_is_wrong=f"GST rate {rate_str}% is not a standard Indian GST rate.",
                    why_is_wrong=f"Valid rates: {sorted(VALID_GST_RATES)}",
                    how_to_fix=f"Correct to a valid rate. Nearest standard rate: {closest}%",
                    suggested_value=str(closest),
                    confidence=0.85, can_auto_fix=False,
                ))

        if taxable is not None and rate is not None and taxable > 0 and rate > 0:
            expected_gst = round(taxable * rate / 100, 2)
            half_gst = round(expected_gst / 2, 2)

            if cgst is not None and sgst is not None:
                actual = round((cgst or 0) + (sgst or 0), 2)
                if abs(actual - expected_gst) > 0.5:
                    issues.append(make_issue(
                        row=row_num, col=cgst_ci, field="CGST Amount", category="GST", severity="Error",
                        title="CGST + SGST Mismatch",
                        current_value=f"CGST={cgst_str}, SGST={sgst_str}",
                        what_is_wrong=f"CGST ({cgst_str}) + SGST ({sgst_str}) = {actual}, expected {expected_gst} (Taxable {taxable} × {rate}%).",
                        why_is_wrong="GST = Taxable Value × Rate / 100. CGST = SGST = half of total GST.",
                        how_to_fix=f"Set CGST = {half_gst} and SGST = {half_gst}",
                        suggested_value=str(half_gst),
                        confidence=1.0, can_auto_fix=True,
                    ))

            if igst is not None and abs((igst or 0) - expected_gst) > 0.5:
                issues.append(make_issue(
                    row=row_num, col=igst_ci, field="IGST Amount", category="GST", severity="Error",
                    title="IGST Amount Mismatch",
                    current_value=igst_str,
                    what_is_wrong=f"IGST {igst_str} ≠ expected {expected_gst} (Taxable {taxable} × {rate}%).",
                    why_is_wrong="IGST must equal the full GST amount for inter-state transactions.",
                    how_to_fix=f"Set IGST = {expected_gst}",
                    suggested_value=str(expected_gst),
                    confidence=1.0, can_auto_fix=True,
                ))

        # Grand total check
        if taxable is not None and amt is not None and taxable > 0:
            gst_total = (cgst or 0) + (sgst or 0) + (igst or 0) + (cess or 0)
            if rate is not None and gst_total == 0:
                gst_total = round(taxable * rate / 100, 2)
            expected_total = round(taxable + gst_total, 2)
            if abs(amt - expected_total) > 0.5:
                issues.append(make_issue(
                    row=row_num, col=amt_ci, field="Amount", category="GST", severity="Error",
                    title="Grand Total Mismatch",
                    current_value=amt_str,
                    what_is_wrong=f"Grand total {amt_str} ≠ Taxable ({taxable}) + GST ({gst_total}) = {expected_total}",
                    why_is_wrong="Total Amount = Taxable Value + all GST amounts.",
                    how_to_fix=f"Correct total to {expected_total}",
                    suggested_value=str(expected_total),
                    confidence=1.0, can_auto_fix=True,
                ))
        return issues

    def _validate_qty_rate(self, row, row_num, col_idx):
        issues = []
        qty_ci    = col_idx.get("Quantity", -1)
        rate_ci   = col_idx.get("Rate", -1)
        tax_ci    = col_idx.get("Taxable Value", -1)
        disc_ci   = col_idx.get("Discount%", -1)

        if qty_ci == -1 or rate_ci == -1 or tax_ci == -1:
            return issues

        qty_str = str(row[qty_ci] if qty_ci < len(row) else "").strip()
        rate_str = str(row[rate_ci] if rate_ci < len(row) else "").strip()
        tax_str = str(row[tax_ci] if tax_ci < len(row) else "").strip()

        qty, _ = safe_float(qty_str)
        rate, _ = safe_float(rate_str)
        taxable, _ = safe_float(tax_str)

        if qty is not None and qty < 0:
            issues.append(make_issue(
                row=row_num, col=qty_ci, field="Quantity", category="Inventory", severity="Error",
                title="Negative Quantity",
                current_value=qty_str,
                what_is_wrong=f"Quantity is negative ({qty_str}).",
                why_is_wrong="Quantities should be positive for standard entries. Use Debit/Credit Note for returns.",
                how_to_fix=f"Change to {abs(qty)}",
                suggested_value=str(abs(qty)), confidence=1.0, can_auto_fix=True,
            ))

        if qty is not None and rate is not None and taxable is not None:
            disc_str = str(row[disc_ci] if disc_ci != -1 and disc_ci < len(row) else "0").strip()
            disc, _ = safe_float(disc_str.replace("%", ""))
            disc = disc or 0
            expected = round(qty * rate * (1 - disc / 100), 2)
            if abs(taxable - expected) > 0.5:
                issues.append(make_issue(
                    row=row_num, col=tax_ci, field="Taxable Value", category="Calculation", severity="Error",
                    title="Taxable Value Mismatch",
                    current_value=tax_str,
                    what_is_wrong=(
                        f"Taxable Value {tax_str} ≠ "
                        f"Qty ({qty}) × Rate ({rate}){f' × (1-{disc}%)' if disc else ''} = {expected}"
                    ),
                    why_is_wrong="Taxable Value must equal Quantity × Rate (minus any discount).",
                    how_to_fix=f"Set Taxable Value = {expected}",
                    suggested_value=str(expected),
                    confidence=1.0, can_auto_fix=True,
                ))
        return issues

    def _validate_tds_tcs(self, row, row_num, col_idx):
        issues = []
        for field, valid_rates, label in [
            ("TDS%", VALID_TDS_RATES, "TDS"),
            ("TCS%", VALID_TCS_RATES, "TCS"),
        ]:
            ci = col_idx.get(field, -1)
            if ci == -1:
                continue
            val = str(row[ci] if ci < len(row) else "").strip().replace("%", "")
            if not val:
                continue
            fval, ferr = safe_float(val)
            if ferr:
                issues.append(make_issue(
                    row=row_num, col=ci, field=field, category="TDS/TCS", severity="Error",
                    title=f"Invalid {label} Rate",
                    current_value=val,
                    what_is_wrong=f"{label} rate '{val}' is not numeric.",
                    why_is_wrong=f"{label} rate must be a numeric percentage.",
                    how_to_fix=f"Enter a valid {label} rate (e.g. 1, 2, 5, 10).",
                    suggested_value=None, confidence=1.0,
                ))
            elif fval != 0 and fval not in valid_rates:
                closest = min(valid_rates, key=lambda x: abs(x - fval))
                issues.append(make_issue(
                    row=row_num, col=ci, field=field, category="TDS/TCS", severity="Warning",
                    title=f"Unusual {label} Rate",
                    current_value=val,
                    what_is_wrong=f"{label} rate {val}% is not a standard rate.",
                    why_is_wrong=f"Valid {label} rates: {sorted(valid_rates)}",
                    how_to_fix=f"Verify and correct the {label} rate. Nearest standard: {closest}%",
                    suggested_value=str(closest),
                    confidence=0.75, can_auto_fix=False,
                ))
        return issues

    def _validate_gstin(self, row, row_num, col_idx):
        issues = []
        ci, val = self.get_cell(row, col_idx, "GSTIN")
        if ci == -1 or not val:
            return issues
        ok, err = validate_gstin_full(val)
        if not ok:
            issues.append(make_issue(
                row=row_num, col=ci, field="GSTIN", category="Compliance", severity="Error",
                title="Invalid GSTIN",
                current_value=val,
                what_is_wrong=f"GSTIN '{val}' is invalid: {err}",
                why_is_wrong="GSTIN: 2-digit state code + 10-char PAN + entity digit + 'Z' + check digit.",
                how_to_fix="Correct to a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).",
                suggested_value=None, confidence=1.0, can_auto_fix=False,
            ))
        return issues

    def _validate_pan(self, row, row_num, col_idx):
        issues = []
        ci, val = self.get_cell(row, col_idx, "PAN")
        if ci == -1 or not val:
            return issues
        ok, err = validate_pan_full(val)
        if not ok:
            issues.append(make_issue(
                row=row_num, col=ci, field="PAN", category="Compliance", severity="Error",
                title="Invalid PAN",
                current_value=val,
                what_is_wrong=f"PAN '{val}' is invalid: {err}",
                why_is_wrong="PAN must be exactly 10 characters: AAAAA9999A.",
                how_to_fix="Enter a valid PAN card number.",
                suggested_value=None, confidence=1.0, can_auto_fix=False,
            ))
        return issues

    def _validate_hsn_sac(self, row, row_num, col_idx):
        issues = []
        ci, val = self.get_cell(row, col_idx, "HSN/SAC")
        if ci == -1 or not val:
            return issues
        ok, err = validate_hsn_sac(val)
        if not ok:
            issues.append(make_issue(
                row=row_num, col=ci, field="HSN/SAC", category="Compliance", severity="Error",
                title="Invalid HSN/SAC Code",
                current_value=val,
                what_is_wrong=f"HSN/SAC '{val}': {err}",
                why_is_wrong="HSN codes must be 4, 6, or 8 numeric digits.",
                how_to_fix="Enter a valid numeric HSN/SAC code.",
                suggested_value=None, confidence=1.0, can_auto_fix=False,
            ))
        elif self.hsn_codes and val not in self.hsn_codes:
            issues.append(make_issue(
                row=row_num, col=ci, field="HSN/SAC", category="Compliance", severity="Warning",
                title="HSN/SAC Code Not in Master",
                current_value=val,
                what_is_wrong=f"HSN/SAC '{val}' is not in the HSN codes master.",
                why_is_wrong="An unrecognised HSN code may cause issues in GST returns.",
                how_to_fix="Verify the HSN code against the official GST tariff schedule.",
                suggested_value=None, confidence=0.9, can_auto_fix=False,
            ))
        return issues

    def _validate_ifsc(self, row, row_num, col_idx):
        issues = []
        ci, val = self.get_cell(row, col_idx, "IFSC Code")
        if ci == -1 or not val:
            return issues
        ok, err = validate_ifsc_full(val)
        if not ok:
            issues.append(make_issue(
                row=row_num, col=ci, field="IFSC Code", category="Bank", severity="Error",
                title="Invalid IFSC Code",
                current_value=val,
                what_is_wrong=f"IFSC '{val}': {err}",
                why_is_wrong="IFSC: 4-letter bank code + '0' + 6 alphanumeric branch code.",
                how_to_fix="Enter a valid 11-character IFSC code (e.g. SBIN0001234).",
                suggested_value=None, confidence=1.0, can_auto_fix=False,
            ))
        return issues

    def _validate_contact_fields(self, row, row_num, col_idx):
        issues = []

        email_ci, email_val = self.get_cell(row, col_idx, "Email")
        if email_ci != -1 and email_val:
            ok, err = validate_email_format(email_val)
            if not ok:
                issues.append(make_issue(
                    row=row_num, col=email_ci, field="Email", category="Contact", severity="Warning",
                    title="Invalid Email Address", current_value=email_val,
                    what_is_wrong=err, why_is_wrong="Email must follow standard format: user@domain.com",
                    how_to_fix="Correct the email address.",
                    suggested_value=None, confidence=1.0, can_auto_fix=False,
                ))

        phone_ci, phone_val = self.get_cell(row, col_idx, "Phone")
        if phone_ci != -1 and phone_val:
            ok, err = validate_phone_format(phone_val)
            if not ok:
                issues.append(make_issue(
                    row=row_num, col=phone_ci, field="Phone", category="Contact", severity="Warning",
                    title="Invalid Phone Number", current_value=phone_val,
                    what_is_wrong=err,
                    why_is_wrong="Indian mobile numbers must be 10 digits starting with 6, 7, 8 or 9.",
                    how_to_fix="Enter a valid 10-digit Indian mobile number.",
                    suggested_value=None, confidence=1.0, can_auto_fix=False,
                ))

        pin_ci, pin_val = self.get_cell(row, col_idx, "Pin Code")
        if pin_ci != -1 and pin_val:
            ok, err = validate_pincode_format(pin_val)
            if not ok:
                issues.append(make_issue(
                    row=row_num, col=pin_ci, field="Pin Code", category="Contact", severity="Warning",
                    title="Invalid PIN Code", current_value=pin_val,
                    what_is_wrong=err,
                    why_is_wrong="Indian PIN codes must be exactly 6 digits and cannot start with 0.",
                    how_to_fix="Enter a valid 6-digit Indian PIN code.",
                    suggested_value=None, confidence=1.0, can_auto_fix=False,
                ))
        return issues

    def _validate_currency(self, row, row_num, col_idx):
        issues = []
        ci, val = self.get_cell(row, col_idx, "Currency")
        if ci == -1 or not val:
            return issues
        if val.upper() not in VALID_CURRENCY_CODES:
            issues.append(make_issue(
                row=row_num, col=ci, field="Currency", category="Currency", severity="Warning",
                title="Unrecognised Currency Code",
                current_value=val,
                what_is_wrong=f"Currency '{val}' is not a recognised ISO 4217 code.",
                why_is_wrong=f"Valid codes include: {', '.join(sorted(VALID_CURRENCY_CODES))}",
                how_to_fix="Use a valid 3-letter ISO currency code (e.g. INR, USD, EUR).",
                suggested_value="INR", confidence=0.8, can_auto_fix=False,
            ))
        return issues

    def _validate_bank_account(self, row, row_num, col_idx, doc_type):
        issues = []
        ci, val = self.get_cell(row, col_idx, "Bank Name")
        if ci == -1:
            return issues

        rules = VOUCHER_TYPE_RULES.get(doc_type, {})
        must_have_bank = rules.get("must_have_bank", False)

        if must_have_bank and not val:
            issues.append(make_issue(
                row=row_num, col=ci, field="Bank Name", category="Bank", severity="Error",
                title="Bank Account is Missing",
                current_value="",
                what_is_wrong=f"{doc_type} requires a bank account ledger.",
                why_is_wrong="Payment, Receipt and Contra vouchers must specify a bank or cash ledger.",
                how_to_fix="Provide the bank account name as it appears in Tally.",
                suggested_value=list(self.bank_ledgers.values())[0] if self.bank_ledgers else None,
                confidence=0.5, can_auto_fix=False,
            ))
        elif val and not self.bank_ledgers and not self.all_ledgers:
            return issues  # master not loaded, skip
        elif val and val.lower() not in self.bank_ledgers and val.lower() not in self.all_ledgers:
            best_bank, conf_bank = fuzzy_best_match(val, self.bank_ledgers)
            best_all, conf_all = fuzzy_best_match(val, self.all_ledgers)
            best = best_bank if (conf_bank or 0) >= (conf_all or 0) else best_all
            conf = max(conf_bank or 0, conf_all or 0)
            issues.append(make_issue(
                row=row_num, col=ci, field="Bank Name", category="Bank", severity="Warning",
                title="Bank Account Not Found in Tally",
                current_value=val,
                what_is_wrong=f"Bank account '{val}' was not found in Tally ledgers.",
                why_is_wrong="Bank ledgers should be configured under 'Bank Accounts' group in Tally.",
                how_to_fix=f"Rename to '{best}' or verify the bank ledger name." if best else "Check Tally bank ledger configuration.",
                suggested_value=best, confidence=conf, can_auto_fix=(bool(best) and conf >= 0.8),
            ))
        return issues

    def _validate_cost_center(self, row, row_num, col_idx):
        issues = []
        ci, val = self.get_cell(row, col_idx, "Cost Center")
        if ci == -1 or not val or not self.cost_centers:
            return issues
        if val.lower() not in self.cost_centers:
            best, conf = fuzzy_best_match(val, self.cost_centers)
            issues.append(make_issue(
                row=row_num, col=ci, field="Cost Center", category="Cost Center", severity="Warning",
                title="Cost Center Not Found",
                current_value=val,
                what_is_wrong=f"Cost Center '{val}' does not exist in master.",
                why_is_wrong="Cost centres must match Tally configuration for cost allocation.",
                how_to_fix=f"Use '{best}' or create the cost centre." if best else "Create the cost centre in Tally.",
                suggested_value=best, confidence=conf,
                can_auto_fix=(bool(best) and conf >= 0.8), create_new_master=(best is None),
            ))
        return issues

    def _validate_godown(self, row, row_num, col_idx):
        issues = []
        ci, val = self.get_cell(row, col_idx, "Godown")
        if ci == -1 or not val or not self.godowns:
            return issues
        if val.lower() not in self.godowns:
            best, conf = fuzzy_best_match(val, self.godowns)
            issues.append(make_issue(
                row=row_num, col=ci, field="Godown", category="Inventory", severity="Warning",
                title="Godown / Warehouse Not Found",
                current_value=val,
                what_is_wrong=f"Godown '{val}' does not exist in Tally master.",
                why_is_wrong="Inventory must be allocated to a valid godown/warehouse.",
                how_to_fix=f"Use '{best}' or create the godown." if best else "Create the godown in Tally.",
                suggested_value=best, confidence=conf,
                can_auto_fix=(bool(best) and conf >= 0.8), create_new_master=(best is None),
            ))
        return issues

    def _validate_voucher_type_rules(self, row, row_num, col_idx, doc_type):
        """Check that voucher-type-specific required fields are present (from VOUCHER_TYPE_RULES)."""
        issues = []
        rules = VOUCHER_TYPE_RULES.get(doc_type, {})
        for req_field in rules.get("required", []):
            _, val = self.get_cell(row, col_idx, req_field)
            if not val:
                field_ci = col_idx.get(req_field, -1)
                issues.append(make_issue(
                    row=row_num, col=field_ci, field=req_field,
                    category="Voucher Rules", severity="Error",
                    title=f"Required Field Missing: {req_field}",
                    current_value="",
                    what_is_wrong=f"'{req_field}' is required for {doc_type} but is empty.",
                    why_is_wrong=f"Tally {doc_type} vouchers must always have a {req_field} value.",
                    how_to_fix=f"Provide a valid {req_field}.",
                    suggested_value=None, confidence=1.0, can_auto_fix=False,
                ))
        return issues

    def _detect_duplicate_rows(self, data_rows: list) -> dict:
        """Returns {row_num: True} for every row that is an exact duplicate."""
        seen = {}
        result = {}
        for row_num, row in enumerate(data_rows, start=2):
            h = row_hash(row)
            if h in seen:
                result[row_num] = True
                result[seen[h]] = True
            else:
                seen[h] = row_num
        return result

    # ─────────────────────────────────────────────────────────────────────────
    # Main entry point
    # ─────────────────────────────────────────────────────────────────────────

    async def validate(self, normalised_rows: list, filename: str) -> dict:
        """
        Full validation pipeline.

        Args:
            normalised_rows: list of rows (first row = headers, rest = data).
                             Cell values may be str, int, float, datetime, or date.
            filename:        Original uploaded filename (used for doc type classification).

        Returns:
            {
                column_mapping, col_idx, doc_type,
                validation_results, validation_summary
            }
        """
        await self._load_master_data()

        if not normalised_rows or len(normalised_rows) < 2:
            return {
                "column_mapping": [], "col_idx": {}, "doc_type": "Unknown",
                "validation_results": [],
                "validation_summary": {
                    "total_rows": 0, "valid_rows": 0, "error_count": 0,
                    "warning_count": 0, "info_count": 0,
                    "duplicate_count": 0, "import_readiness_score": 0, "can_import": False,
                },
            }

        headers    = normalised_rows[0]
        data_rows  = normalised_rows[1:]

        column_mapping = self.map_columns(headers)
        col_idx        = self.build_col_index(column_mapping)
        doc_type       = self.classify_document(filename, headers, col_idx)
        duplicate_map  = self._detect_duplicate_rows(data_rows)

        all_issues = []

        for i, row in enumerate(data_rows):
            row_num = i + 2  # row 1 = header, row 2 = first data row

            # Duplicate row marker
            if duplicate_map.get(row_num):
                ci_date = col_idx.get("Date", 0)
                all_issues.append(make_issue(
                    row=row_num, col=ci_date, field="Row",
                    category="Duplicate", severity="Warning",
                    title="Duplicate Row Detected",
                    current_value="",
                    what_is_wrong="This row is an exact duplicate of another row in the file.",
                    why_is_wrong="Duplicate rows create duplicate vouchers in Tally.",
                    how_to_fix="Remove one of the duplicate rows or confirm it is a separate transaction.",
                    suggested_value=None, confidence=1.0, is_duplicate=True,
                ))

            # Run all validators
            all_issues += self._validate_dates(row, row_num, col_idx)
            all_issues += self._validate_voucher_number(row, row_num, col_idx)
            all_issues += self._validate_party(row, row_num, col_idx, doc_type)
            all_issues += self._validate_ledger(row, row_num, col_idx)
            all_issues += self._validate_item(row, row_num, col_idx)      # stock_items only
            all_issues += self._validate_amount(row, row_num, col_idx, doc_type)
            all_issues += self._validate_gst_math(row, row_num, col_idx)
            all_issues += self._validate_qty_rate(row, row_num, col_idx)
            all_issues += self._validate_tds_tcs(row, row_num, col_idx)
            all_issues += self._validate_gstin(row, row_num, col_idx)
            all_issues += self._validate_pan(row, row_num, col_idx)
            all_issues += self._validate_hsn_sac(row, row_num, col_idx)
            all_issues += self._validate_ifsc(row, row_num, col_idx)
            all_issues += self._validate_contact_fields(row, row_num, col_idx)
            all_issues += self._validate_currency(row, row_num, col_idx)
            all_issues += self._validate_bank_account(row, row_num, col_idx, doc_type)
            all_issues += self._validate_cost_center(row, row_num, col_idx)
            all_issues += self._validate_godown(row, row_num, col_idx)
            all_issues += self._validate_voucher_type_rules(row, row_num, col_idx, doc_type)

        # Summary
        total_rows    = len(data_rows)
        error_count   = sum(1 for i in all_issues if i["severity"] == "Error")
        warning_count = sum(1 for i in all_issues if i["severity"] == "Warning")
        info_count    = sum(1 for i in all_issues if i["severity"] == "Info")
        dup_count     = sum(1 for v in duplicate_map.values() if v)
        error_rows    = {i["row"] for i in all_issues if i["severity"] == "Error"}
        valid_rows    = total_rows - len(error_rows)
        readiness     = max(0, min(100, round((valid_rows / total_rows) * 100))) if total_rows else 100

        return {
            "column_mapping": column_mapping,
            "col_idx": col_idx,
            "doc_type": doc_type,
            "validation_results": all_issues,
            "validation_summary": {
                "total_rows":             total_rows,
                "valid_rows":             valid_rows,
                "error_count":            error_count,
                "warning_count":          warning_count,
                "info_count":             info_count,
                "duplicate_count":        dup_count,
                "import_readiness_score": readiness,
                "can_import":             (error_count == 0),
            },
        }
