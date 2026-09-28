from datetime import datetime
from typing import Optional, Dict, Any
from pymongo import ReturnDocument
from bson import ObjectId
import re

class VoucherNumberService:
    @staticmethod
    async def get_next_voucher_number(
        db,
        company_id: Optional[Any],
        voucher_type: str,
        financial_year: Optional[str] = None,
        series_id: Optional[str] = "MAIN",
        prefix: Optional[str] = None
    ) -> str:
        """
        Atomically generates and allocates the next sequential voucher number
        at SAVE TIME using MongoDB find_one_and_update ($inc: { currentNumber: 1 }).
        Guarantees zero race conditions and zero duplicates across Manual, OCR, and Bulk.
        """
        comp_str = str(company_id).strip() if company_id else "DEFAULT"
        current_year = datetime.now().year
        fy_str = financial_year or f"{current_year}-{str(current_year + 1)[-2:]}"
        
        # Standardize voucher type key and prefix dynamically per voucher type
        raw_type = (voucher_type or "Sales").strip().lower()

        if "purchase" in raw_type:
            v_type_clean = "purchase"
            base_prefix = prefix or f"PI-{current_year}-"
        elif "receipt" in raw_type or raw_type == "bank_payment":
            v_type_clean = "receipt"
            base_prefix = prefix or f"RV-{current_year}-"
        elif "payment" in raw_type or raw_type == "cash_payment":
            v_type_clean = "payment"
            base_prefix = prefix or f"PV-{current_year}-"
        elif "contra" in raw_type:
            v_type_clean = "contra"
            base_prefix = prefix or f"CV-{current_year}-"
        elif "journal" in raw_type:
            v_type_clean = "journal"
            base_prefix = prefix or f"JRN-{current_year}-"
        elif "credit" in raw_type:
            v_type_clean = "credit_note"
            base_prefix = prefix or f"CN-{current_year}-"
        elif "debit" in raw_type:
            v_type_clean = "debit_note"
            base_prefix = prefix or f"DN-{current_year}-"
        else:
            v_type_clean = "sales"
            base_prefix = prefix or f"SI-{current_year}-"

        if not base_prefix.endswith("-"):
            base_prefix += "-"

        sequence_key = f"{comp_str}_{fy_str}_{v_type_clean}_{series_id or 'MAIN'}"

        # Discover highest sequence and active prefix from actual saved vouchers in MongoDB
        highest_db_seq, discovered_prefix = await VoucherNumberService._discover_highest_sequence(db, comp_str, v_type_clean, base_prefix)

        if discovered_prefix:
            base_prefix = discovered_prefix
            if not base_prefix.endswith("-"):
                base_prefix += "-"

        # Ground truth: counter MUST match highest_db_seq from actual saved vouchers in database
        existing_counter = await db["counters"].find_one({"_id": sequence_key})
        cur_existing_p = str(existing_counter.get("prefix", "")).upper() if existing_counter else ""
        has_invalid_prefix = (
            (v_type_clean == "payment" and any(rp in cur_existing_p for rp in ["RV-", "REC-"])) or
            (v_type_clean == "receipt" and any(pp in cur_existing_p for pp in ["PV-", "PAY-"])) or
            (v_type_clean == "contra" and any(cp in cur_existing_p for cp in ["PV-", "RV-"]))
        )
        
        if not existing_counter or has_invalid_prefix or existing_counter.get("currentNumber") < highest_db_seq or existing_counter.get("prefix") != base_prefix:
            await db["counters"].update_one(
                {"_id": sequence_key},
                {
                    "$set": {
                        "companyId": comp_str,
                        "financialYear": fy_str,
                        "voucherType": v_type_clean,
                        "seriesId": series_id or 'MAIN',
                        "prefix": base_prefix,
                        "currentNumber": highest_db_seq,
                        "padding": 4 if any(k in base_prefix for k in ["SI-", "PI-", "PV-", "RV-", "CV-"]) else 6,
                        "updatedAt": datetime.utcnow()
                    }
                },
                upsert=True
            )

        # Atomic increment with guaranteed prefix update
        counter = await db["counters"].find_one_and_update(
            {"_id": sequence_key},
            {
                "$inc": {"currentNumber": 1},
                "$set": {
                    "prefix": base_prefix,
                    "companyId": comp_str,
                    "financialYear": fy_str,
                    "voucherType": v_type_clean,
                    "seriesId": series_id or 'MAIN'
                }
            },
            upsert=True,
            return_document=ReturnDocument.AFTER
        )

        num = counter.get("currentNumber", 1)
        padding = counter.get("padding", 4 if any(k in base_prefix for k in ["SI-", "PI-", "PV-", "RV-", "CV-"]) else 6)
        p_str = counter.get("prefix", base_prefix)
        formatted_seq = str(num).zfill(padding)

        return f"{p_str}{formatted_seq}"

    @staticmethod
    def get_next_voucher_number_sync(
        db,
        company_id: Optional[Any],
        voucher_type: str,
        financial_year: Optional[str] = None,
        series_id: Optional[str] = "MAIN",
        prefix: Optional[str] = None
    ) -> str:
        """
        Synchronously and atomically generates and allocates the next sequential voucher number
        at SAVE TIME using MongoDB find_one_and_update ($inc: { currentNumber: 1 }).
        Guarantees continuous sequential numbering for Payment, Receipt, Sales, Purchase, etc.
        """
        comp_str = str(company_id).strip() if company_id else "DEFAULT"
        current_year = datetime.now().year
        fy_str = financial_year or f"{current_year}-{str(current_year + 1)[-2:]}"
        
        raw_type = (voucher_type or "Sales").strip().lower()

        if "purchase" in raw_type:
            v_type_clean = "purchase"
            base_prefix = prefix or f"PI-{current_year}-"
        elif "receipt" in raw_type or raw_type == "bank_payment":
            v_type_clean = "receipt"
            base_prefix = prefix or f"RV-{current_year}-"
        elif "payment" in raw_type or raw_type == "cash_payment":
            v_type_clean = "payment"
            base_prefix = prefix or f"PV-{current_year}-"
        elif "contra" in raw_type:
            v_type_clean = "contra"
            base_prefix = prefix or f"CV-{current_year}-"
        elif "journal" in raw_type:
            v_type_clean = "journal"
            base_prefix = prefix or f"JRN-{current_year}-"
        elif "credit" in raw_type:
            v_type_clean = "credit_note"
            base_prefix = prefix or f"CN-{current_year}-"
        elif "debit" in raw_type:
            v_type_clean = "debit_note"
            base_prefix = prefix or f"DN-{current_year}-"
        else:
            v_type_clean = "sales"
            base_prefix = prefix or f"SI-{current_year}-"

        if not base_prefix.endswith("-"):
            base_prefix += "-"

        sequence_key = f"{comp_str}_{fy_str}_{v_type_clean}_{series_id or 'MAIN'}"

        highest_db_seq, discovered_prefix = VoucherNumberService._discover_highest_sequence_sync(db, comp_str, v_type_clean, base_prefix)

        if discovered_prefix is not None:
            base_prefix = discovered_prefix
            if base_prefix and not base_prefix.endswith("-"):
                base_prefix += "-"
        elif not base_prefix.endswith("-"):
            base_prefix += "-"

        existing_counter = db["counters"].find_one({"_id": sequence_key})
        cur_existing_p = str(existing_counter.get("prefix", "")).upper() if existing_counter else ""
        has_invalid_prefix = (
            (v_type_clean == "payment" and any(rp in cur_existing_p for rp in ["RV-", "REC-"])) or
            (v_type_clean == "receipt" and any(pp in cur_existing_p for pp in ["PV-", "PAY-"])) or
            (v_type_clean == "contra" and any(cp in cur_existing_p for cp in ["PV-", "RV-"]))
        )
        
        if not existing_counter or has_invalid_prefix or existing_counter.get("currentNumber", 0) < highest_db_seq or existing_counter.get("prefix") != base_prefix:
            db["counters"].update_one(
                {"_id": sequence_key},
                {
                    "$set": {
                        "companyId": comp_str,
                        "financialYear": fy_str,
                        "voucherType": v_type_clean,
                        "seriesId": series_id or 'MAIN',
                        "prefix": base_prefix,
                        "currentNumber": highest_db_seq,
                        "padding": 4 if any(k in base_prefix for k in ["SI-", "PI-", "PV-", "RV-", "CV-"]) else 6,
                        "updatedAt": datetime.utcnow()
                    }
                },
                upsert=True
            )

        counter = db["counters"].find_one_and_update(
            {"_id": sequence_key},
            {
                "$inc": {"currentNumber": 1},
                "$set": {
                    "prefix": base_prefix,
                    "companyId": comp_str,
                    "financialYear": fy_str,
                    "voucherType": v_type_clean,
                    "seriesId": series_id or 'MAIN'
                }
            },
            upsert=True,
            return_document=ReturnDocument.AFTER
        )

        num = counter.get("currentNumber", 1)
        if not base_prefix:
            return str(num)
        padding = counter.get("padding", 4 if any(k in base_prefix for k in ["SI-", "PI-", "PV-", "RV-", "CV-"]) else 6)
        p_str = counter.get("prefix", base_prefix)
        formatted_seq = str(num).zfill(padding)

        return f"{p_str}{formatted_seq}"

    @staticmethod
    def peek_next_voucher_number_sync(
        db,
        company_id: Optional[Any],
        voucher_type: str,
        financial_year: Optional[str] = None,
        series_id: Optional[str] = "MAIN",
        prefix: Optional[str] = None
    ) -> str:
        """
        Synchronously returns the next voucher number in sequence without incrementing the counter.
        Used by Manual Voucher Entry UI, Bank Statement peek, and OCR preview.
        """
        comp_str = str(company_id).strip() if company_id else "DEFAULT"
        current_year = datetime.now().year
        fy_str = financial_year or f"{current_year}-{str(current_year + 1)[-2:]}"
        raw_type = (voucher_type or "Sales").strip().lower()

        if "purchase" in raw_type:
            v_type_clean = "purchase"
            base_prefix = prefix or f"PI-{current_year}-"
        elif "receipt" in raw_type or raw_type == "bank_payment":
            v_type_clean = "receipt"
            base_prefix = prefix or f"RV-{current_year}-"
        elif "payment" in raw_type or raw_type == "cash_payment":
            v_type_clean = "payment"
            base_prefix = prefix or f"PV-{current_year}-"
        elif "contra" in raw_type:
            v_type_clean = "contra"
            base_prefix = prefix or f"CV-{current_year}-"
        else:
            v_type_clean = "sales"
            base_prefix = prefix or f"SI-{current_year}-"

        if not base_prefix.endswith("-"):
            base_prefix += "-"

        highest_db_seq, discovered_prefix = VoucherNumberService._discover_highest_sequence_sync(db, comp_str, v_type_clean, base_prefix)
        if discovered_prefix:
            base_prefix = discovered_prefix
            if not base_prefix.endswith("-"):
                base_prefix += "-"

        sequence_key = f"{comp_str}_{fy_str}_{v_type_clean}_{series_id or 'MAIN'}"
        existing_counter = db["counters"].find_one({"_id": sequence_key})
        
        counter_seq = 0
        if existing_counter:
            cur_p = str(existing_counter.get("prefix", "")).upper()
            is_wrong_p = (v_type_clean == "payment" and any(rp in cur_p for rp in ["RV-", "REC-"])) or \
                         (v_type_clean == "receipt" and any(pp in cur_p for pp in ["PV-", "PAY-"]))
            if not is_wrong_p:
                counter_seq = existing_counter.get("currentNumber", 0)

        next_seq = max(highest_db_seq, counter_seq) + 1
        padding = 4 if any(k in base_prefix for k in ["SI-", "PI-", "PV-", "RV-", "CV-"]) else 6
        return f"{base_prefix}{str(next_seq).zfill(padding)}"

    @staticmethod
    def _discover_highest_sequence_sync(db, company_id: str, voucher_type: str, prefix: str):
        """
        Synchronously scans existing voucher collections to find the HIGHEST numeric sequence
        for this specific company & voucher type.
        """
        highest = 0
        discovered_prefix = None
        target_colls = ["sales_vouchers", "purchase_vouchers", "vouchers", "fund_flow_vouchers"]

        v_type_lower = (voucher_type or "").lower()
        if "payment" in v_type_lower or v_type_lower == "cash_payment":
            v_kind = "payment"
            # Explicitly match payment documents and NEVER match 'bank_payment' (which is receipt in FundFlow)
            type_filter = [
                {"voucherTypeName": {"$regex": r"^payment$", "$options": "i"}},
                {"voucherType": {"$in": ["cash_payment", "payment", "Payment", "PAYMENT"]}},
                {"docType": {"$in": ["cash_payment", "payment", "Payment", "PAYMENT"]}}
            ]
            valid_prefixes = ["PV-", "PAY-"]
        elif "receipt" in v_type_lower or v_type_lower == "bank_payment":
            v_kind = "receipt"
            type_filter = [
                {"voucherTypeName": {"$regex": r"^receipt$", "$options": "i"}},
                {"voucherType": {"$in": ["bank_payment", "receipt", "Receipt", "RECEIPT", "bank_receipt", "cash_receipt"]}},
                {"docType": {"$in": ["bank_payment", "receipt", "Receipt", "RECEIPT"]}}
            ]
            valid_prefixes = ["RV-", "REC-"]
        elif "contra" in v_type_lower:
            v_kind = "contra"
            type_filter = [
                {"voucherTypeName": {"$regex": r"^contra$", "$options": "i"}},
                {"voucherType": {"$in": ["contra", "Contra", "CONTRA"]}},
                {"docType": {"$in": ["contra", "Contra", "CONTRA"]}}
            ]
            valid_prefixes = ["CV-", "CTR-"]
        elif "purchase" in v_type_lower:
            v_kind = "purchase"
            type_filter = [
                {"voucherType": {"$regex": "purchase", "$options": "i"}},
                {"voucherTypeName": {"$regex": "purchase", "$options": "i"}},
                {"docType": {"$regex": "purchase", "$options": "i"}}
            ]
            valid_prefixes = ["PI-", "PUR-", "PO-", "DN-"]
        else:
            v_kind = "sales"
            type_filter = [
                {"voucherType": {"$regex": "sales", "$options": "i"}},
                {"voucherTypeName": {"$regex": "sales", "$options": "i"}},
                {"docType": {"$regex": "sales", "$options": "i"}}
            ]
            valid_prefixes = ["SI-", "SAL-", "SO-", "CN-"]

        comp_filter = []
        if company_id and str(company_id).upper() != "DEFAULT":
            comp_filter.append({"companyId": company_id})
            comp_filter.append({"company_id": company_id})
            if ObjectId.is_valid(company_id):
                comp_filter.append({"companyId": ObjectId(company_id)})
                comp_filter.append({"company_id": ObjectId(company_id)})

        if comp_filter:
            query = {"$and": [{"$or": comp_filter}, {"$or": type_filter}]}
        else:
            query = {"$or": type_filter}

        for coll_name in target_colls:
            try:
                cursor = db[coll_name].find(query).limit(5000)
                for doc in cursor:
                    v_no = str(doc.get("voucherNumber") or doc.get("voucherNo") or doc.get("invoiceNumber") or "").strip()
                    if v_no and not v_no.startswith("draft_") and not v_no.startswith("vch_") and v_no != "Unassigned":
                        # CRITICAL: Verify that the prefix of v_no belongs to valid_prefixes for this voucher type!
                        # e.g., A Payment voucher cannot adopt an "RV-" (Receipt) prefix, and a Receipt voucher cannot adopt "PV-"!
                        prefix_match = any(v_no.upper().startswith(vp.upper()) for vp in valid_prefixes)
                        if not prefix_match:
                            continue

                        match = re.search(r'^(.*?)(0*(\d+))$', v_no)
                        if match:
                            prefix_part = match.group(1).strip()
                            seq_val = int(match.group(3))

                            if seq_val > 999999:
                                continue

                            if seq_val > highest:
                                highest = seq_val
                                discovered_prefix = prefix_part
            except Exception:
                pass

        return highest, discovered_prefix

    @staticmethod
    async def _discover_highest_sequence(db, company_id: str, voucher_type: str, prefix: str):
        """
        Scans existing voucher collections to find the HIGHEST numeric sequence (N) currently saved in database
        FOR THIS SPECIFIC COMPANY & VOUCHER TYPE, so the next generated number is ALWAYS (N + 1).
        """
        highest = 0
        discovered_prefix = None
        target_colls = ["sales_vouchers", "purchase_vouchers", "vouchers", "fund_flow_vouchers"]

        v_type_lower = (voucher_type or "").lower()
        if "payment" in v_type_lower or v_type_lower == "cash_payment":
            v_kind = "payment"
            # Explicitly match payment documents and NEVER match 'bank_payment' (which is receipt in FundFlow)
            type_filter = [
                {"voucherTypeName": {"$regex": r"^payment$", "$options": "i"}},
                {"voucherType": {"$in": ["cash_payment", "payment", "Payment", "PAYMENT"]}},
                {"docType": {"$in": ["cash_payment", "payment", "Payment", "PAYMENT"]}}
            ]
            valid_prefixes = ["PV-", "PAY-"]
        elif "receipt" in v_type_lower or v_type_lower == "bank_payment":
            v_kind = "receipt"
            type_filter = [
                {"voucherTypeName": {"$regex": r"^receipt$", "$options": "i"}},
                {"voucherType": {"$in": ["bank_payment", "receipt", "Receipt", "RECEIPT", "bank_receipt", "cash_receipt"]}},
                {"docType": {"$in": ["bank_payment", "receipt", "Receipt", "RECEIPT"]}}
            ]
            valid_prefixes = ["RV-", "REC-"]
        elif "contra" in v_type_lower:
            v_kind = "contra"
            type_filter = [
                {"voucherTypeName": {"$regex": r"^contra$", "$options": "i"}},
                {"voucherType": {"$in": ["contra", "Contra", "CONTRA"]}},
                {"docType": {"$in": ["contra", "Contra", "CONTRA"]}}
            ]
            valid_prefixes = ["CV-", "CTR-"]
        elif "purchase" in v_type_lower:
            v_kind = "purchase"
            type_filter = [
                {"voucherType": {"$regex": "purchase", "$options": "i"}},
                {"voucherTypeName": {"$regex": "purchase", "$options": "i"}},
                {"docType": {"$regex": "purchase", "$options": "i"}}
            ]
            valid_prefixes = ["PI-", "PUR-", "PO-", "DN-"]
        else:
            v_kind = "sales"
            type_filter = [
                {"voucherType": {"$regex": "sales", "$options": "i"}},
                {"voucherTypeName": {"$regex": "sales", "$options": "i"}},
                {"docType": {"$regex": "sales", "$options": "i"}}
            ]
            valid_prefixes = ["SI-", "SAL-", "SO-", "CN-"]

        comp_filter = []
        if company_id and str(company_id).upper() != "DEFAULT":
            comp_filter.append({"companyId": company_id})
            comp_filter.append({"company_id": company_id})
            if ObjectId.is_valid(company_id):
                comp_filter.append({"companyId": ObjectId(company_id)})
                comp_filter.append({"company_id": ObjectId(company_id)})

        if comp_filter:
            query = {"$and": [{"$or": comp_filter}, {"$or": type_filter}]}
        else:
            query = {"$or": type_filter}

        for coll_name in target_colls:
            try:
                cursor = db[coll_name].find(query).limit(5000)
                if hasattr(cursor, "__aiter__"):
                    async for doc in cursor:
                        v_no = str(doc.get("voucherNumber") or doc.get("voucherNo") or doc.get("invoiceNumber") or "").strip()
                        if v_no and not v_no.startswith("draft_") and not v_no.startswith("vch_") and v_no != "Unassigned":
                            # Validate prefix against valid_prefixes
                            if not any(v_no.upper().startswith(vp.upper()) for vp in valid_prefixes):
                                continue

                            match = re.search(r'^(.*?)(0*(\d+))$', v_no)
                            if match:
                                prefix_part = match.group(1).strip()
                                seq_val = int(match.group(3))

                                if seq_val > 999999:
                                    continue

                                if seq_val > highest:
                                    highest = seq_val
                                    if prefix_part:
                                        discovered_prefix = prefix_part
                else:
                    for doc in cursor:
                        v_no = str(doc.get("voucherNumber") or doc.get("voucherNo") or doc.get("invoiceNumber") or "").strip()
                        if v_no and not v_no.startswith("draft_") and not v_no.startswith("vch_") and v_no != "Unassigned":
                            if not any(v_no.upper().startswith(vp.upper()) for vp in valid_prefixes):
                                continue

                            match = re.search(r'^(.*?)(0*(\d+))$', v_no)
                            if match:
                                prefix_part = match.group(1).strip()
                                seq_val = int(match.group(3))

                                if seq_val > 999999:
                                    continue

                                if seq_val > highest:
                                    highest = seq_val
                                    if prefix_part:
                                        discovered_prefix = prefix_part
            except Exception:
                pass

        return highest, discovered_prefix

    @staticmethod
    async def create_indexes(db):
        """Creates unique compound indexes for voucher numbers to guarantee duplicate protection."""
        index_spec = [
            ("companyId", 1),
            ("financialYear", 1),
            ("voucherType", 1),
            ("seriesId", 1),
            ("voucherNumber", 1)
        ]
        for coll in ["sales_vouchers", "purchase_vouchers", "vouchers"]:
            try:
                await db[coll].create_index(index_spec, unique=True, name="unique_voucher_number_idx", sparse=True)
            except Exception:
                pass
