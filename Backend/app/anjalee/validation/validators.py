import re
from typing import Any, List, Dict
from app.anjalee.models.ai_models import AiVoucherDraft
from app.anjalee.validation.base import BaseValidator, ValidatorResult, ValidationStatus

class VoucherTypeValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        vtype = draft.voucher_type
        valid_types = ["sales", "purchase", "payment", "receipt", "contra", "journal", "debit note", "credit note"]
        if not vtype or vtype.strip().lower() not in valid_types:
            return ValidatorResult(
                status=ValidationStatus.ERROR,
                errors=["Voucher Type cannot be determined or is invalid. Allowed types: Sales, Purchase, Payment, Receipt, Contra, Journal, Debit Note, Credit Note."]
            )
        return ValidatorResult(status=ValidationStatus.SUCCESS)

class PartyValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        vtype = (draft.voucher_type or "").lower()
        # For contra/journal, we might not always require a simple "party" in standard sense, but if it exists, validate it.
        # For sales/credit note: Sundry Debtors
        # For purchase/debit note: Sundry Creditors
        # For payment/receipt: Debtors, Creditors, Expenses, Incomes, etc.
        if vtype in ["sales", "credit note", "credit_note"]:
            allowed_groups = ["Sundry Debtors"]
        elif vtype in ["purchase", "debit note", "debit_note"]:
            allowed_groups = ["Sundry Creditors"]
        else:
            allowed_groups = ["Sundry Debtors", "Sundry Creditors", "Direct Expenses", "Indirect Expenses", "Direct Incomes", "Indirect Incomes", "Duties & Taxes"]

        party_name = draft.party
        if not party_name:
            # If mandatory field validator will check it, just return success or missing here.
            # But let's check it. If missing and mandatory: we will return SUCCESS here and let MandatoryFieldValidator handle it, OR return not found.
            # Let's say if party is absent but not strictly filled yet, we return success.
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        party_name = party_name.strip()
        # Exact Case-insensitive Match
        exact_doc = await db["ledgers"].find_one({
            "ledgerName": {"$regex": f"^{re.escape(party_name)}$", "$options": "i"},
            "groupName": {"$in": allowed_groups}
        })
        if exact_doc:
            return ValidatorResult(
                status=ValidationStatus.SUCCESS,
                master_matches={"party": {"status": "resolved", "matches": [exact_doc["ledgerName"]]}}
            )

        # Fuzzy / Contain Match
        cursor = db["ledgers"].find({
            "ledgerName": {"$regex": re.escape(party_name), "$options": "i"},
            "groupName": {"$in": allowed_groups}
        })
        matches = await cursor.to_list(length=10)
        match_names = [m["ledgerName"] for m in matches]

        if len(match_names) == 1:
            return ValidatorResult(
                status=ValidationStatus.SUCCESS,
                master_matches={"party": {"status": "resolved", "matches": match_names}}
            )
        elif len(match_names) > 1:
            return ValidatorResult(
                status=ValidationStatus.DUPLICATE,
                errors=[f"Multiple party matches found for '{party_name}'."],
                duplicates={"party": match_names},
                master_matches={"party": {"status": "ambiguous", "matches": match_names}}
            )
        else:
            return ValidatorResult(
                status=ValidationStatus.NOT_FOUND,
                errors=[f"Party '{party_name}' not found in database."],
                master_matches={"party": {"status": "none", "matches": []}}
            )

class ItemValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        if draft.entry_mode != "item_invoice" or not draft.items:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        errors = []
        duplicates = {}
        master_matches = {}
        status = ValidationStatus.SUCCESS

        for item in draft.items:
            item_name = item.item_name
            if not item_name:
                continue

            exact_doc = await db["stockItems"].find_one({
                "itemName": {"$regex": f"^{re.escape(item_name)}$", "$options": "i"}
            })
            if exact_doc:
                master_matches[item_name] = {"status": "resolved", "matches": [exact_doc["itemName"]]}
                continue

            # Fuzzy/Contain search
            cursor = db["stockItems"].find({
                "itemName": {"$regex": re.escape(item_name), "$options": "i"}
            })
            matches = await cursor.to_list(length=10)
            match_names = [m["itemName"] for m in matches]

            if len(match_names) == 1:
                master_matches[item_name] = {"status": "resolved", "matches": match_names}
            elif len(match_names) > 1:
                status = ValidationStatus.DUPLICATE
                errors.append(f"Multiple stock item matches found for '{item_name}'.")
                duplicates[item_name] = match_names
                master_matches[item_name] = {"status": "ambiguous", "matches": match_names}
            else:
                status = ValidationStatus.NOT_FOUND
                errors.append(f"Stock item '{item_name}' not found in database.")
                master_matches[item_name] = {"status": "none", "matches": []}

        return ValidatorResult(status=status, errors=errors, duplicates=duplicates, master_matches=master_matches)

class LedgerValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        # Check debit/credit helper ledger properties (e.g. Sales Ledger / Purchase Ledger / Expense Accounts)
        vtype = (draft.voucher_type or "").lower()
        if vtype not in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note", "journal"]:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        ledgers_to_validate = []
        if vtype in ["sales", "credit note", "credit_note"] and draft.credit:
            ledgers_to_validate.append(("credit", draft.credit, ["Sales Accounts"]))
        if vtype in ["purchase", "debit note", "debit_note"] and draft.debit:
            ledgers_to_validate.append(("debit", draft.debit, ["Purchase Accounts"]))

        errors = []
        duplicates = {}
        master_matches = {}
        status = ValidationStatus.SUCCESS

        for field_name, name, groups in ledgers_to_validate:
            exact = await db["ledgers"].find_one({
                "ledgerName": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
                "groupName": {"$in": groups}
            })
            if exact:
                master_matches[field_name] = {"status": "resolved", "matches": [exact["ledgerName"]]}
                continue

            cursor = db["ledgers"].find({
                "ledgerName": {"$regex": re.escape(name), "$options": "i"},
                "groupName": {"$in": groups}
            })
            matches = await cursor.to_list(length=10)
            match_names = [m["ledgerName"] for m in matches]

            if len(match_names) == 1:
                master_matches[field_name] = {"status": "resolved", "matches": match_names}
            elif len(match_names) > 1:
                status = ValidationStatus.DUPLICATE
                errors.append(f"Multiple ledger matches found for '{name}' in group {groups}.")
                duplicates[field_name] = match_names
                master_matches[field_name] = {"status": "ambiguous", "matches": match_names}
            else:
                status = ValidationStatus.NOT_FOUND
                errors.append(f"Ledger '{name}' not found in group {groups}.")
                master_matches[field_name] = {"status": "none", "matches": []}

        return ValidatorResult(status=status, errors=errors, duplicates=duplicates, master_matches=master_matches)

class BankValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        vtype = (draft.voucher_type or "").lower()
        if vtype not in ["payment", "receipt", "contra"]:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        # In Payment: bank account is credit
        # In Receipt: bank account is debit
        # In Contra: bank/cash account can be either or both
        banks_to_check = []
        if vtype == "payment" and draft.credit:
            banks_to_check.append(("credit", draft.credit))
        elif vtype == "receipt" and draft.debit:
            banks_to_check.append(("debit", draft.debit))
        elif vtype == "contra":
            if draft.debit:
                banks_to_check.append(("debit", draft.debit))
            if draft.credit:
                banks_to_check.append(("credit", draft.credit))

        allowed_groups = ["Bank Accounts", "Cash-in-Hand", "Bank OD A/c"]
        errors = []
        duplicates = {}
        master_matches = {}
        status = ValidationStatus.SUCCESS

        for field_name, bank_name in banks_to_check:
            exact = await db["ledgers"].find_one({
                "ledgerName": {"$regex": f"^{re.escape(bank_name)}$", "$options": "i"},
                "groupName": {"$in": allowed_groups}
            })
            if exact:
                master_matches[field_name] = {"status": "resolved", "matches": [exact["ledgerName"]]}
                continue

            cursor = db["ledgers"].find({
                "ledgerName": {"$regex": re.escape(bank_name), "$options": "i"},
                "groupName": {"$in": allowed_groups}
            })
            matches = await cursor.to_list(length=10)
            match_names = [m["ledgerName"] for m in matches]

            if len(match_names) == 1:
                master_matches[field_name] = {"status": "resolved", "matches": match_names}
            elif len(match_names) > 1:
                status = ValidationStatus.DUPLICATE
                errors.append(f"Multiple cash/bank account matches found for '{bank_name}'.")
                duplicates[field_name] = match_names
                master_matches[field_name] = {"status": "ambiguous", "matches": match_names}
            else:
                status = ValidationStatus.NOT_FOUND
                errors.append(f"Cash/bank account '{bank_name}' not found.")
                master_matches[field_name] = {"status": "none", "matches": []}

        return ValidatorResult(status=status, errors=errors, duplicates=duplicates, master_matches=master_matches)

class GstValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        if draft.entry_mode != "item_invoice" or not draft.items:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        missing_fields = {}
        warnings = []

        for idx, item in enumerate(draft.items):
            if item.gst_rate is None or item.gst_rate <= 0:
                # Query item master
                doc = await db["stockItems"].find_one({"itemName": item.item_name})
                if doc and doc.get("gstRate") is not None:
                    # Found in DB! Auto-return/inject
                    item.gst_rate = float(doc["gstRate"])
                else:
                    missing_fields[f"items.{idx}.gst_rate"] = f"GST rate missing for item '{item.item_name}'."
                    warnings.append(f"GST rate is not configured for item '{item.item_name}'.")

        if missing_fields:
            return ValidatorResult(
                status=ValidationStatus.WARNING,
                warnings=warnings,
                missing_fields=missing_fields
            )
        return ValidatorResult(status=ValidationStatus.SUCCESS)

class UnitValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        if draft.entry_mode != "item_invoice" or not draft.items:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        for item in draft.items:
            if not item.unit:
                doc = await db["stockItems"].find_one({"itemName": item.item_name})
                if doc and doc.get("unit"):
                    item.unit = doc["unit"]
        return ValidatorResult(status=ValidationStatus.SUCCESS)

class QuantityValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        if draft.entry_mode != "item_invoice" or not draft.items:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        missing_fields = {}
        errors = []

        for idx, item in enumerate(draft.items):
            if not item.quantity or item.quantity <= 0:
                missing_fields[f"items.{idx}.quantity"] = f"Quantity missing/invalid for item '{item.item_name}'."
                errors.append(f"Quantity is required for item '{item.item_name}'.")

        if missing_fields:
            return ValidatorResult(
                status=ValidationStatus.ERROR,
                errors=errors,
                missing_fields=missing_fields
            )
        return ValidatorResult(status=ValidationStatus.SUCCESS)

class RateValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        if draft.entry_mode != "item_invoice" or not draft.items:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        missing_fields = {}
        errors = []

        for idx, item in enumerate(draft.items):
            if not item.rate or item.rate <= 0:
                missing_fields[f"items.{idx}.rate"] = f"Rate missing/invalid for item '{item.item_name}'."
                errors.append(f"Rate is required for item '{item.item_name}'.")

        if missing_fields:
            return ValidatorResult(
                status=ValidationStatus.ERROR,
                errors=errors,
                missing_fields=missing_fields
            )
        return ValidatorResult(status=ValidationStatus.SUCCESS)

class StockValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        vtype = (draft.voucher_type or "").lower()
        # Stock deduction warning only applies for outgoing stock: Sales, Credit Note, Debit Note (sometimes)
        if vtype not in ["sales", "credit note", "credit_note"] or draft.entry_mode != "item_invoice":
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        warnings = []
        for item in draft.items:
            doc = await db["stockItems"].find_one({"itemName": item.item_name})
            if doc:
                available = float(doc.get("qty") or 0.0)
                required = float(item.quantity or 0.0)
                if required > available:
                    warnings.append(
                        f"Insufficient stock for '{item.item_name}'. Available: {available}, Required: {required}."
                    )

        if warnings:
            return ValidatorResult(
                status=ValidationStatus.WARNING,
                warnings=warnings
            )
        return ValidatorResult(status=ValidationStatus.SUCCESS)

class OutstandingBillValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        vtype = (draft.voucher_type or "").lower()
        if vtype not in ["payment", "receipt"] or not draft.party:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        # Reuse existing outstanding bills calc query
        pending_bills = []
        seen_bills = set()

        async def calc_paid(bill_no: str) -> float:
            paid = 0.0
            cursor = db["fundflow"].find({
                "status": {"$ne": "deleted"},
                "billRows": {"$elemMatch": {"$or": [{"billNo": bill_no}, {"billRef": bill_no}]}}
            })
            async for ff in cursor:
                for row in ff.get("billRows") or []:
                    if row.get("billNo") == bill_no or row.get("billRef") == bill_no:
                        paid += float(row.get("allocationAmount") or row.get("allocatedAmount") or 0.0)
            return paid

        if vtype == "payment":
            # Outstandings are from purchases
            cursor = db["purchase_vouchers"].find({
                "$or": [{"partyLedger": draft.party}, {"partyName": draft.party}],
                "isDeleted": {"$ne": True}
            }).sort("createdAt", -1).limit(10)
            async for pv in cursor:
                bill_no = pv.get("voucherNumber") or pv.get("invoiceNumber") or ""
                if not bill_no or bill_no in seen_bills:
                    continue
                bill_amount = float(pv.get("grandTotal") or 0.0)
                paid_amount = await calc_paid(bill_no)
                outstanding = round(bill_amount - paid_amount, 2)
                if outstanding > 0:
                    seen_bills.add(bill_no)
                    pending_bills.append({
                        "billNo": bill_no,
                        "pendingAmount": outstanding
                    })
        else:
            # Outstandings are from sales
            cursor = db["sales_vouchers"].find({
                "$or": [{"partyLedgerName": draft.party}, {"partyName": draft.party}],
                "isDeleted": {"$ne": True}
            }).sort("createdAt", -1).limit(10)
            async for sv in cursor:
                bill_no = sv.get("voucherNumber") or ""
                if not bill_no or bill_no in seen_bills:
                    continue
                bill_amount = float(sv.get("grandTotal") or 0.0)
                paid_amount = await calc_paid(bill_no)
                outstanding = round(bill_amount - paid_amount, 2)
                if outstanding > 0:
                    seen_bills.add(bill_no)
                    pending_bills.append({
                        "billNo": bill_no,
                        "pendingAmount": outstanding
                    })

        if pending_bills:
            return ValidatorResult(
                status=ValidationStatus.SUCCESS,
                master_matches={"outstanding_bills": pending_bills}
            )
        return ValidatorResult(status=ValidationStatus.SUCCESS)

class DuplicateVoucherValidator(BaseValidator):
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        vtype = (draft.voucher_type or "").lower()
        if not vtype or not draft.party or not draft.amount:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        # Duplicate: same party, amount, and voucher date (or close date)
        # Search all collections
        collections_to_search = ["sales_vouchers", "purchase_vouchers", "fundflow"]
        for coll in collections_to_search:
            query = {
                "$or": [
                    {"partyLedgerName": draft.party},
                    {"partyLedger": draft.party},
                    {"partyName": draft.party}
                ],
                # grandTotal or amount
                "$or": [
                    {"grandTotal": draft.amount},
                    {"amount": draft.amount}
                ],
                "voucherDate": draft.date,
                "isDeleted": {"$ne": True},
                "status": {"$ne": "deleted"}
            }
            # Remove date if date isn't set, but date is always set (default_factory)
            cnt = await db[coll].count_documents(query)
            if cnt > 0:
                return ValidatorResult(
                    status=ValidationStatus.WARNING,
                    warnings=[f"A voucher of type '{draft.voucher_type}' with party '{draft.party}' and amount ₹{draft.amount:,.2f} already exists on date {draft.date}."]
                )
        return ValidatorResult(status=ValidationStatus.SUCCESS)

class MandatoryFieldValidator(BaseValidator):
    MANDATORY_FIELDS_CONFIG = {
        "sales": ["party", "items", "date"],
        "purchase": ["party", "items", "date"],
        "credit note": ["party", "items", "date"],
        "debit note": ["party", "items", "date"],
        "payment": ["party", "credit", "amount", "date"], # credit is bank/cash account paid from
        "receipt": ["party", "debit", "amount", "date"], # debit is bank/cash account received to
        "contra": ["debit", "credit", "amount", "date"],
        "journal": ["ledger_entries", "amount", "date"]
    }

    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        vtype = (draft.voucher_type or "").lower()
        rules = self.MANDATORY_FIELDS_CONFIG.get(vtype, [])
        if not rules:
            return ValidatorResult(status=ValidationStatus.SUCCESS)

        missing = {}
        errors = []

        for field in rules:
            val = getattr(draft, field, None)
            if field == "items" and draft.entry_mode == "item_invoice":
                if not val or len(val) == 0:
                    missing["items"] = "Voucher must contain at least one item."
                    errors.append("Voucher items are required.")
            elif field == "ledger_entries":
                if not val or len(val) == 0:
                    missing["ledger_entries"] = "Voucher must contain ledger entries."
                    errors.append("Ledger entries are required.")
            elif not val:
                display_name = field.replace("_", " ").capitalize()
                missing[field] = f"{display_name} is required."
                errors.append(f"Mandatory field '{display_name}' is missing.")

        if missing:
            return ValidatorResult(
                status=ValidationStatus.ERROR,
                errors=errors,
                missing_fields=missing
            )
        return ValidatorResult(status=ValidationStatus.SUCCESS)
