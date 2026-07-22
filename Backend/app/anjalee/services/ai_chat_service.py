import re
import datetime
import logging
from typing import Dict, Any, List, Tuple, Optional
from bson import ObjectId

from app.anjalee.models.ai_models import AiVoucherDraft, AiInvoiceItem, AiVoucherLedgerEntry, ChatSession
from app.anjalee.services.llm_service import llm_service
from app.anjalee.services.business_report_service import BusinessReportService
from app.anjalee.repositories.sales_repo import SalesVoucherRepository
from app.anjalee.repositories.sales_repo import STATE_CODES
from app.anjalee.utils.gst_calculator import calculate_taxes

logger = logging.getLogger(__name__)

def is_affirmative(msg: str) -> bool:
    clean = msg.strip().lower()
    words = ["yes", "y", "create", "sure", "ok", "okay", "yeah", "yep", "do it", "save", "confirm"]
    pattern = r'\b(' + '|'.join(re.escape(w) for w in words) + r')\b'
    return bool(re.search(pattern, clean))

def is_negative(msg: str) -> bool:
    clean = msg.strip().lower()
    words = ["no", "n", "don't", "cancel", "stop", "abort", "discard"]
    pattern = r'\b(' + '|'.join(re.escape(w) for w in words) + r')\b'
    return bool(re.search(pattern, clean))

class AiChatService:
    def __init__(self, db):
        self.db = db
        self.sales_repo = SalesVoucherRepository(db)
        self.report_service = BusinessReportService(db)
        from app.db import client as sync_client
        self.sync_db = sync_client[db.name]

    async def _resolve_entity(self, name: str, entity_type: str, allowed_groups: Optional[List[str]] = None) -> Dict[str, Any]:
        if not name:
            return {"status": "none", "name": None, "matches": []}
        name = name.strip()
        import re
        import difflib
        
        collection = "stockItems" if entity_type == "item" else "ledgers"
        field = "itemName" if entity_type == "item" else "ledgerName"
        
        # Build base filter
        base_filter = {}
        if allowed_groups and collection == "ledgers":
            base_filter["groupName"] = {"$in": allowed_groups}
            
        # 1. Exact match (case-insensitive)
        exact_filter = {**base_filter, field: {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
        cursor = self.db[collection].find(exact_filter)
        exact_docs = await cursor.to_list(length=10)
        exact_matches = [d[field] for d in exact_docs]
        
        if len(exact_matches) == 1:
            return {"status": "resolved", "name": exact_matches[0], "matches": exact_matches}
        elif len(exact_matches) > 1:
            return {"status": "ambiguous", "name": None, "matches": exact_matches}
            
        # 2. Fuzzy / Close match search
        # First gather candidate names from contains and tokenized searches to run difflib on
        candidate_names = set()
        
        # Candidate source A: Contains search
        contains_filter = {**base_filter, field: {"$regex": re.escape(name), "$options": "i"}}
        cursor = self.db[collection].find(contains_filter)
        contains_docs = await cursor.to_list(length=50)
        for d in contains_docs:
            candidate_names.add(d[field])
            
        # Candidate source B: Tokenized "$or" search
        words = [w for w in name.split() if len(w) > 1]
        if words:
            or_parts = [{field: {"$regex": re.escape(w), "$options": "i"}} for w in words]
            token_filter = {**base_filter, "$or": or_parts}
            cursor = self.db[collection].find(token_filter)
            token_docs = await cursor.to_list(length=50)
            for d in token_docs:
                candidate_names.add(d[field])
                
        # Score and filter candidate names to prioritize distinctive tokens
        query_tokens = [w.lower() for w in re.findall(r'[a-zA-Z0-9]+', name) if len(w) >= 2]
        if query_tokens and candidate_names:
            scored_candidates = []
            for cand in candidate_names:
                cand_lower = cand.lower()
                score = sum(1 for token in query_tokens if token in cand_lower)
                scored_candidates.append((cand, score))
            max_score = max(score for _, score in scored_candidates)
            if max_score > 0:
                candidate_names = {cand for cand, score in scored_candidates if score == max_score}

        # Run Gestalt Pattern Matcher / fuzzy close matches
        close_matches = difflib.get_close_matches(name, list(candidate_names), n=50, cutoff=0.45)
        
        # Also preserve candidate order from exact contains or tokenized list
        ordered_matches = []
        for m in close_matches:
            if m not in ordered_matches:
                ordered_matches.append(m)
        for m in sorted(list(candidate_names)):
            if m not in ordered_matches:
                # Add contains matches if they have decent ratio
                ratio = difflib.SequenceMatcher(None, name.lower(), m.lower()).ratio()
                if ratio > 0.4:
                    ordered_matches.append(m)
                    
        if ordered_matches:
            return {"status": "ambiguous", "name": None, "matches": ordered_matches[:50]}
            
        return {"status": "none", "name": None, "matches": []}

    async def _create_new_entity(self, name: str, entity_type: str, voucher_type: Optional[str] = None) -> str:
        import datetime
        import uuid
        from bson import ObjectId
        
        comp_id = None
        company = await self.db["companies"].find_one()
        if company:
            comp_id = company["_id"]
            
        if entity_type == "item":
            new_item = {
                "companyId": comp_id,
                "itemName": name,
                "status": "ACTIVE",
                "gstSettings": {"taxability": "Taxable", "gstRate": 18.0},
                "inventory": {"openingStock": {"quantity": 0.0, "value": 0.0, "rate": 0.0}},
                "unit": {"baseUnit": "Nos", "alternateUnit": "Not Applicable"}
            }
            await self.db["stockItems"].insert_one(new_item)
            return name
        else:
            if entity_type == "party":
                v_type_lower = (voucher_type or "").lower()
                if v_type_lower in ["sales", "credit note", "credit_note"]:
                    group = "Sundry Debtors"
                elif v_type_lower in ["purchase", "debit note", "debit_note"]:
                    group = "Sundry Creditors"
                else:
                    group = "Sundry Debtors"
            elif entity_type == "bank":
                group = "Bank Accounts"
            elif entity_type == "ledger":
                v_type_lower = (voucher_type or "").lower()
                if v_type_lower in ["sales", "credit note", "credit_note"]:
                    group = "Sales Accounts"
                else:
                    group = "Purchase Accounts"
            elif entity_type == "tax_ledger":
                group = "Duties & Taxes"
            elif entity_type == "additional_charge":
                group = "Indirect Expenses"
            else:
                group = "Indirect Expenses"
                
            new_ledger = {
                "companyId": comp_id,
                "ledgerGuid": str(uuid.uuid4()),
                "ledgerName": name,
                "groupName": group,
                "status": "ACTIVE",
                "balances": {"openingBalance": {"amount": 0.0, "type": "DEBIT", "asOfDate": datetime.datetime.utcnow()}},
                "partyDetails": {"contactPerson": None, "phone": None, "email": None, "address": [], "gstRegistrationType": "Consumer"},
                "flags": {"isBillWiseOn": False, "isCostCentresOn": False, "affectsStock": False}
            }
            await self.db["ledgers"].insert_one(new_ledger)
            return name

    async def _resolve_ledger_fuzzy(self, name: str, allowed_groups: List[str]) -> List[str]:
        res = await self._resolve_entity(name, "ledger", allowed_groups)
        return res["matches"]

    async def _resolve_party_payment(self, name: str) -> List[str]:
        expected_groups = [
            "Sundry Debtors", "Sundry Creditors", "Direct Expenses", 
            "Indirect Expenses", "Direct Incomes", "Indirect Incomes"
        ]
        return await self._resolve_ledger_fuzzy(name, expected_groups)

    async def _resolve_bank_payment(self, name: str) -> List[str]:
        expected_groups = ["Bank Accounts", "Cash-in-Hand", "Bank OD A/c"]
        return await self._resolve_ledger_fuzzy(name, expected_groups)

    async def get_session(self, session_id: str) -> ChatSession:
        doc = await self.db["ai_sessions"].find_one({"session_id": session_id})
        if doc:
            return ChatSession(**doc)
        return ChatSession(session_id=session_id)

    async def save_session(self, session: ChatSession) -> None:
        session.updated_at = datetime.datetime.utcnow()
        doc = session.model_dump()
        await self.db["ai_sessions"].update_one(
            {"session_id": session.session_id},
            {"$set": doc},
            upsert=True
        )

    def _match_choice_selection(self, message: str, choices: List[str], history: Optional[List[Dict[str, str]]] = None) -> Optional[str]:
        message_clean = message.strip().lower()
        if message_clean.isdigit() and history:
            # Try to match based on the last assistant message's printed numbered list
            last_assistant_content = ""
            for msg in reversed(history):
                if msg.get("role") == "assistant" and any(tok in msg.get("content", "") for tok in ["1.", "1)"]):
                    last_assistant_content = msg.get("content", "")
                    break
            
            if last_assistant_content:
                import re as _re
                pattern = r"^\s*" + _re.escape(message_clean) + r"[\.\)]\s*(.+)$"
                for line in last_assistant_content.splitlines():
                    m = _re.match(pattern, line.strip())
                    if m:
                        candidate = m.group(1).strip()
                        candidate_clean = _re.sub(r"[\*\_]", "", candidate).strip()
                        # Match candidate against the actual choices
                        for choice in choices:
                            if choice.lower() == candidate_clean.lower() or choice.lower().startswith(candidate_clean.lower()) or candidate_clean.lower().startswith(choice.lower()):
                                return choice

        # Fallback to index-based matching
        if message_clean.isdigit():
            idx = int(message_clean) - 1
            if 0 <= idx < len(choices):
                return choices[idx]
        for choice in choices:
            if choice.lower() in message_clean:
                return choice
        return None


    def _allocate_payment(self, amount: float, bills: List[Dict[str, Any]], preference: Optional[str]) -> List[Dict[str, Any]]:
        allocations = []
        remaining = amount
        pref_lower = (preference or "").lower()

        # Check if specific bills are mentioned
        mentioned_bills = []
        for b in bills:
            b_no = b["billNo"].lower()
            if b_no in pref_lower or b_no.replace("-", "") in pref_lower:
                mentioned_bills.append(b)

        if mentioned_bills:
            for b in mentioned_bills:
                if remaining <= 0:
                    break
                alloc_amt = min(b["pendingAmount"], remaining)
                allocations.append({"bill": b["billNo"], "amount": alloc_amt})
                remaining = round(remaining - alloc_amt, 2)

        # Sort the rest
        sorted_bills = list(bills)
        if "newest" in pref_lower:
            sorted_bills.sort(key=lambda x: x.get("date", ""), reverse=True)
        else:
            sorted_bills.sort(key=lambda x: x.get("date", ""), reverse=False)

        for b in sorted_bills:
            if remaining <= 0:
                break
            if any(a["bill"] == b["billNo"] for a in allocations):
                continue
            alloc_amt = min(b["pendingAmount"], remaining)
            allocations.append({"bill": b["billNo"], "amount": alloc_amt})
            remaining = round(remaining - alloc_amt, 2)

        if remaining > 0:
            allocations.append({"bill": "On Account", "amount": remaining})

        return allocations

    def _parse_date_input(self, text: str) -> Optional[str]:
        text_clean = text.strip().lower()
        if text_clean in ["today", "aaj"]:
            return datetime.date.today().strftime("%Y-%m-%d")
        elif text_clean in ["yesterday", "kal"]:
            return (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        elif text_clean in ["tomorrow", "aane wala kal"]:
            return (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        match = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", text)
        if match:
            return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"
        match = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", text)
        if match:
            return f"{match.group(3)}-{int(match.group(2)):02d}-{int(match.group(1)):02d}"
        return None

    async def _resolve_items_list(self, session, items_list, draft, backend_notes_list):
        draft.entry_mode = "item_invoice"
        
        # Initialize or extend the items resolution queue in metadata
        if "temp_items_to_resolve" not in session.metadata or not session.metadata["temp_items_to_resolve"]:
            session.metadata["temp_items_to_resolve"] = list(items_list)
        else:
            if items_list:
                session.metadata["temp_items_to_resolve"].extend(items_list)

        while session.metadata.get("temp_items_to_resolve"):
            it = session.metadata["temp_items_to_resolve"].pop(0)
            item_name = it.get("item_name")
            if not item_name:
                qty = float(it.get("quantity") or 0.0)
                if qty < 0:
                    backend_notes_list.append("Quantity cannot be negative.")
                    qty = 0.0
                rate = float(it.get("rate") or 0.0)
                if rate <= 0.0 and it.get("rate") is not None:
                    backend_notes_list.append("Rate must be greater than zero.")
                    rate = 0.0
                draft.items.append(AiInvoiceItem(
                    item_name="",
                    quantity=qty,
                    rate=rate,
                    amount=qty * rate,
                    discount_percent=float(it.get("discount_percent") or 0.0)
                ))
                continue
                
            res = await self._resolve_stock_item(item_name)
            if res["status"] == "resolved":
                item_details = self._get_item_details_from_doc(res["doc"])
                qty = float(it.get("quantity") or 0.0)
                if qty < 0:
                    backend_notes_list.append("Quantity cannot be negative.")
                    qty = 0.0
                    
                user_specified_rate = it.get("rate") is not None
                rate = float(it.get("rate") or 0.0)
                if user_specified_rate and rate <= 0.0:
                    backend_notes_list.append("Rate must be greater than zero.")
                    rate = 0.0
                elif not rate:
                    rate = item_details["rate"]
                    
                discount_pct = float(it.get("discount_percent") or 0.0)
                amt = (qty * rate) * (1.0 - discount_pct / 100.0)
                
                existing = next((x for x in draft.items if x.item_name.lower() == item_details["name"].lower()), None)
                if existing:
                    existing.quantity = qty
                    existing.rate = rate
                    existing.amount = amt
                    existing.discount_percent = discount_pct
                else:
                    draft.items.append(AiInvoiceItem(
                        item_name=item_details["name"],
                        quantity=qty,
                        rate=rate,
                        amount=amt,
                        discount_percent=discount_pct,
                        gst_rate=item_details["gst_rate"],
                        hsn=item_details.get("hsn_code"),
                        unit=item_details.get("unit")
                    ))
                backend_notes_list.append(f"Added item '{item_details['name']}' x {qty}.")
            elif res["status"] == "ambiguous":
                # Push back to front of the queue
                session.metadata["temp_items_to_resolve"].insert(0, it)
                session.metadata["item_choices"] = [doc["itemName"] for doc in res["matches"]]
                session.metadata["temp_item_query"] = it
                session.state = "WAITING_ITEM"
                backend_notes_list.append(f"Multiple matches found for item '{item_name}'.")
                break
            else:
                session.state = "WAITING_ITEM"
                session.metadata.pop("temp_items_to_resolve", None)
                session.metadata.pop("temp_item_query", None)
                session.metadata["item_not_found_error"] = True
                break

    async def process_chat(self, session_id: str, user_message: str) -> Dict[str, Any]:
        logger.info(f"Processing message for session '{session_id}': {user_message}")
        session = await self.get_session(session_id)
        nlu_gl, nlg_gl = await self._get_active_guidelines()

        # Append user message to history
        parsed = {}
        skip_nlu = False
        session.history.append({"role": "user", "content": user_message})
        await self.save_session(session)

        # Check if user message resolves an active choice
        selection_resolved = False
        backend_notes_list = []
        draft = session.current_draft
        is_choice_state = session.state in ["WAITING_PARTY", "WAITING_BANK", "WAITING_ITEM", "WAITING_ENTRY_MODE", "WAITING_LEDGER", "WAITING_ITEM_NAME", "WAITING_CHARGE_AMOUNT", "WAITING_ADDITIONAL_CHARGE", "WAITING_CREATE_CONFIRMATION"]

        if is_choice_state and draft:
            # 0. WAITING_ENTRY_MODE selection check
            if session.state == "WAITING_ENTRY_MODE" and session.metadata.get("entry_mode_choices"):
                choices = session.metadata["entry_mode_choices"]
                selected = self._match_choice_selection(user_message, choices, session.history)
                if not selected:
                    clean_msg = user_message.strip().lower()
                    if "item" in clean_msg or clean_msg == "1" or "first" in clean_msg:
                        selected = choices[0]
                    elif "account" in clean_msg or "ledger" in clean_msg or "without" in clean_msg or clean_msg == "2" or "second" in clean_msg:
                        selected = choices[1]

                if selected:
                    if selected == choices[0]:
                        draft.entry_mode = "item_invoice"
                        backend_notes_list.append("Entry Mode set to Item Invoice.")
                        session.state = "WAITING_ITEM"
                    else:
                        draft.entry_mode = "accounting"
                        backend_notes_list.append("Entry Mode set to Accounting Invoice.")
                        session.state = "WAITING_AMOUNT"
                    session.metadata.pop("entry_mode_choices", None)
                    session.metadata["entry_mode_selected"] = True
                    selection_resolved = True

            # 0b. WAITING_LEDGER selection check
            elif session.state == "WAITING_LEDGER" and session.metadata.get("ledger_choices"):
                choices = session.metadata["ledger_choices"]
                selected = self._match_choice_selection(user_message, choices, session.history)
                if selected:
                    target_field = "credit" if draft.voucher_type.lower() in ["sales", "credit note", "credit_note"] else "debit"
                    setattr(draft, target_field, selected)
                    session.metadata.pop("ledger_choices", None)
                    session.metadata.pop("temp_ledger", None)
                    backend_notes_list.append(f"Ledger resolved to '{selected}'.")
                    session.state = "WAITING_AMOUNT"
                    selection_resolved = True

            # 1. WAITING_PARTY selection check
            elif session.state == "WAITING_PARTY" and session.metadata.get("party_choices"):
                choices = session.metadata["party_choices"]
                selected = self._match_choice_selection(user_message, choices, session.history)
                if selected:
                    if draft.voucher_type.lower() == "contra":
                        draft.debit = selected
                    else:
                        draft.party = selected
                    session.metadata.pop("party_choices", None)
                    session.metadata.pop("temp_party", None)
                    backend_notes_list.append(f"Party resolved to '{selected}'.")
                    is_inv = draft.voucher_type.lower() in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"]
                    
                    # Process saved temp_items immediately!
                    if session.metadata.get("temp_items"):
                        temp_items = session.metadata.pop("temp_items")
                        await self._resolve_items_list(session, temp_items, draft, backend_notes_list)
                        if session.metadata.pop("item_not_found_error", False):
                            reply = "Please select a valid stock item."
                            session.history.append({"role": "assistant", "content": reply})
                            await self.save_session(session)
                            return {"reply": reply, "draft": draft, "state": session.state}
                        
                    if draft.voucher_type.lower() in ["payment", "receipt", "contra"]:
                        session.state = "WAITING_BANK"
                    elif is_inv and draft.entry_mode == "item_invoice":
                        if session.state not in ["WAITING_ITEM", "WAITING_CREATE_CONFIRMATION", "WAITING_ITEM_QTY_RATE"]:
                            session.state = "WAITING_ITEM"
                    else:
                        session.state = "WAITING_AMOUNT"
                    selection_resolved = True

            # 2. WAITING_BANK selection check
            elif session.state == "WAITING_BANK" and session.metadata.get("bank_choices"):
                choices = session.metadata["bank_choices"]
                selected = self._match_choice_selection(user_message, choices, session.history)
                if selected:
                    target_field = "credit" if draft.voucher_type.lower() in ["payment", "contra"] else "debit"
                    setattr(draft, target_field, selected)
                    session.metadata.pop("bank_choices", None)
                    session.metadata.pop("temp_bank", None)
                    backend_notes_list.append(f"Payment account resolved to '{selected}'.")
                    session.state = "WAITING_AMOUNT"
                    selection_resolved = True

            # 3. WAITING_ITEM selection check
            elif session.state == "WAITING_ITEM" and session.metadata.get("item_choices") and session.metadata.get("temp_item_query"):
                choices = session.metadata["item_choices"]
                selected = self._match_choice_selection(user_message, choices, session.history)
                if selected:
                    res = await self._resolve_stock_item(selected)
                    if res["status"] == "resolved":
                        item_details = self._get_item_details_from_doc(res["doc"])
                        it = session.metadata["temp_item_query"]
                        qty = float(it.get("quantity") or 1.0)
                        rate = float(it.get("rate") or 0.0) or item_details["rate"]
                        discount_pct = float(it.get("discount_percent") or 0.0)
                        amt = (qty * rate) * (1.0 - discount_pct / 100.0)
                        
                        draft.items.append(AiInvoiceItem(
                            item_name=item_details["name"],
                            quantity=qty,
                            rate=rate,
                            amount=amt,
                            discount_percent=discount_pct,
                            gst_rate=item_details["gst_rate"],
                            hsn=item_details.get("hsn_code"),
                            unit=item_details.get("unit")
                        ))
                        
                        # Remove this item from queue
                        if session.metadata.get("temp_items_to_resolve"):
                            session.metadata["temp_items_to_resolve"].pop(0)

                        session.metadata.pop("item_choices", None)
                        session.metadata.pop("temp_item_query", None)
                        backend_notes_list.append(f"Item resolved to '{selected}'.")

                        # Process next item in the queue (if any)
                        await self._resolve_items_list(session, [], draft, backend_notes_list)
                        if session.metadata.pop("item_not_found_error", False):
                            reply = "Please select a valid stock item."
                            session.history.append({"role": "assistant", "content": reply})
                            await self.save_session(session)
                            return {"reply": reply, "draft": draft, "state": session.state}

                        if rate == 0 or qty == 0:
                            session.metadata["temp_item_needs_qty_rate"] = item_details["name"]
                            session.state = "WAITING_ITEM_QTY_RATE"
                        elif not session.metadata.get("temp_items_to_resolve"):
                            session.state = "idle"
                        selection_resolved = True

            # 3b. WAITING_ITEM_NAME selection check
            elif session.state == "WAITING_ITEM_NAME" and session.metadata.get("temp_item_needs_name_idx") is not None:
                idx = session.metadata["temp_item_needs_name_idx"]
                if idx < len(draft.items):
                    res = await self._resolve_stock_item(user_message)
                    if res["status"] == "resolved":
                        item_details = self._get_item_details_from_doc(res["doc"])
                        draft.items[idx].item_name = item_details["name"]
                        draft.items[idx].gst_rate = item_details["gst_rate"]
                        draft.items[idx].hsn = item_details.get("hsn_code")
                        draft.items[idx].unit = item_details.get("unit")
                        session.metadata.pop("temp_item_needs_name_idx", None)
                        selection_resolved = True
                    elif res["status"] == "ambiguous":
                        session.metadata["item_choices"] = [doc["itemName"] for doc in res["matches"]]
                        session.metadata["temp_item_query"] = {"quantity": draft.items[idx].quantity, "rate": draft.items[idx].rate}
                        session.state = "WAITING_ITEM"
                        selection_resolved = True
                    else:
                        draft.items[idx].item_name = user_message
                        session.metadata.pop("temp_item_needs_name_idx", None)
                        selection_resolved = True

            # 3c. WAITING_CHARGE_AMOUNT selection check
            elif session.state == "WAITING_CHARGE_AMOUNT" and session.metadata.get("temp_charge_needs_amount"):
                charge_name = session.metadata["temp_charge_needs_amount"]
                amt = 0.0
                import re as _re
                m = _re.search(r'(\d+(?:\.\d+)?)', user_message)
                if m:
                    amt = float(m.group(1))
                if amt > 0:
                    for c in draft.additional_charges:
                        if c["ledger_name"] == charge_name:
                            c["amount"] = amt
                            break
                    session.metadata.pop("temp_charge_needs_amount", None)
                    selection_resolved = True

            # 3d. WAITING_ADDITIONAL_CHARGE selection check
            elif session.state == "WAITING_ADDITIONAL_CHARGE" and session.metadata.get("charge_choices") and session.metadata.get("temp_charge_query"):
                choices = session.metadata["charge_choices"]
                selected = self._match_choice_selection(user_message, choices, session.history)
                if selected:
                    charge = session.metadata["temp_charge_query"]
                    charge_amount = float(charge.get("amount") or 0.0)
                    draft.additional_charges.append({"ledger_name": selected, "amount": charge_amount})
                    session.metadata.pop("charge_choices", None)
                    session.metadata.pop("temp_charge_query", None)
                    backend_notes_list.append(f"Additional charge ledger resolved to '{selected}'.")
                    session.state = "WAITING_ITEM"
                    selection_resolved = True

            # 3e. WAITING_CREATE_CONFIRMATION check
            elif session.state == "WAITING_CREATE_CONFIRMATION" and session.metadata.get("pending_create_name") and session.metadata.get("pending_create_type"):
                create_name = session.metadata["pending_create_name"]
                create_type = session.metadata["pending_create_type"]
                
                if is_affirmative(user_message):
                    resolved_name = await self._create_new_entity(create_name, create_type, draft.voucher_type if draft else None)
                    backend_notes_list.append(f"Created new {create_type} record: '{resolved_name}'.")
                    
                    if create_type == "party":
                        draft.party = resolved_name
                        is_inv = draft.voucher_type.lower() in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"]
                        
                        # Process saved temp_items immediately!
                        if session.metadata.get("temp_items"):
                            temp_items = session.metadata.pop("temp_items")
                            await self._resolve_items_list(session, temp_items, draft, backend_notes_list)
                            
                        if draft.voucher_type.lower() in ["payment", "receipt", "contra"]:
                            session.state = "WAITING_BANK"
                        elif is_inv and draft.entry_mode == "item_invoice":
                            if session.state not in ["WAITING_ITEM", "WAITING_CREATE_CONFIRMATION", "WAITING_ITEM_QTY_RATE"]:
                                session.state = "WAITING_ITEM"
                        else:
                            session.state = "WAITING_AMOUNT"
                    elif create_type == "bank":
                        target_field = "credit" if draft.voucher_type.lower() in ["payment", "contra"] else "debit"
                        setattr(draft, target_field, resolved_name)
                        session.state = "WAITING_AMOUNT"
                    elif create_type == "ledger":
                        target_field = "credit" if draft.voucher_type.lower() in ["sales", "credit note", "credit_note"] else "debit"
                        setattr(draft, target_field, resolved_name)
                        session.state = "WAITING_AMOUNT"
                    elif create_type == "item":
                        it = session.metadata.get("pending_item_query") or {}
                        qty = float(it.get("quantity") or 1.0)
                        rate = float(it.get("rate") or 100.0)
                        disc = float(it.get("discount_percent") or 0.0)
                        draft.items.append(AiInvoiceItem(
                            item_name=resolved_name,
                            quantity=qty,
                            rate=rate,
                            amount=(qty * rate) * (1.0 - disc / 100.0),
                            discount_percent=disc,
                            gst_rate=18.0,
                            unit="Nos"
                        ))
                        session.state = "WAITING_ITEM"
                    elif create_type == "additional_charge":
                        charge = session.metadata.get("pending_charge_query") or {}
                        amt = float(charge.get("amount") or 0.0)
                        draft.additional_charges.append({"ledger_name": resolved_name, "amount": amt})
                        session.state = "WAITING_ITEM"
                        
                    session.metadata.pop("pending_create_name", None)
                    session.metadata.pop("pending_create_type", None)
                    session.metadata.pop("pending_item_query", None)
                    session.metadata.pop("pending_charge_query", None)
                    selection_resolved = True
                elif is_negative(user_message):
                    backend_notes_list.append(f"Did not create {create_type} '{create_name}'. Please specify another name.")
                    if create_type == "party":
                        session.state = "WAITING_PARTY"
                    elif create_type == "bank":
                        session.state = "WAITING_BANK"
                    elif create_type == "ledger":
                        session.state = "WAITING_LEDGER"
                    elif create_type == "item":
                        session.state = "WAITING_ITEM"
                    elif create_type == "additional_charge":
                        session.state = "WAITING_ITEM"
                        
                    session.metadata.pop("pending_create_name", None)
                    session.metadata.pop("pending_create_type", None)
                    session.metadata.pop("pending_item_query", None)
                    session.metadata.pop("pending_charge_query", None)
                    selection_resolved = True

        # 4. WAITING_ITEM_QTY_RATE — user provides qty and rate for the pending item
        if session.state == "WAITING_ITEM_QTY_RATE" and draft and not selection_resolved:
            item_name = session.metadata.get("temp_item_needs_qty_rate", "")
            if item_name:
                pending_item = next((it for it in draft.items if it.item_name == item_name), None)
                if pending_item:
                    qty_from_parsed = float(parsed.get("items", [{}])[0].get("quantity") or 0.0) if parsed.get("items") else 0.0
                    rate_from_parsed = float(parsed.get("items", [{}])[0].get("rate") or 0.0) if parsed.get("items") else 0.0
                    # Also try to extract from raw user message (e.g. "10 rate 500")
                    import re as _re
                    if not qty_from_parsed:
                        m = _re.search(r'(\d+(?:\.\d+)?)', user_message)
                        if m:
                            qty_from_parsed = float(m.group(1))
                    if not rate_from_parsed:
                        m2 = _re.search(r'(?:@|rate|at|\*)[\s]*([\d]+(?:\.\d+)?)', user_message, _re.IGNORECASE)
                        if m2:
                            rate_from_parsed = float(m2.group(1))
                        else:
                            # Try second number as rate
                            nums = _re.findall(r'\d+(?:\.\d+)?', user_message)
                            if len(nums) >= 2:
                                qty_from_parsed = float(nums[0])
                                rate_from_parsed = float(nums[1])

                    if qty_from_parsed > 0:
                        pending_item.quantity = qty_from_parsed
                    if rate_from_parsed > 0:
                        pending_item.rate = rate_from_parsed
                    if pending_item.quantity > 0 and pending_item.rate > 0:
                        pending_item.amount = pending_item.quantity * pending_item.rate
                        session.metadata.pop("temp_item_needs_qty_rate", None)
                        backend_notes_list.append(f"Set qty={pending_item.quantity}, rate=₹{pending_item.rate} for '{item_name}'.")
                        selection_resolved = True

        if selection_resolved:
            skip_nlu = True
            selection_resolved = False

        if not selection_resolved:
            # Parse message with LLM NLU parser
            if skip_nlu:
                parsed = {}
                intent = "general_chat"
            else:
                current_draft_dict = session.current_draft.model_dump() if session.current_draft else None
                parsed = llm_service.parse_user_message(user_message, session.history, current_draft_dict, custom_guidelines=nlu_gl)
                intent = parsed.get("intent", "general_chat")
            
            logger.info(f"LLM NLU parsed intent: {intent}")

            # Check for cancel intent
            if not skip_nlu and intent == "cancel_draft":
                session.current_draft = None
                session.draft_json = None
                session.state = "WAITING_INTENT"
                session.metadata = {}
                reply = "I have discarded the active draft voucher."
                session.history.append({"role": "assistant", "content": reply})
                await self.save_session(session)
                return {"reply": reply, "draft": None, "state": session.state}

            # Check if user is asking a question
            if not skip_nlu and intent == "question":
                return await self._handle_question(session, parsed, user_message)
            if not skip_nlu and intent == "capability_question":
                return await self._handle_capability_question(session, user_message)
            
            # Check if user wants to load/show an existing voucher
            if not skip_nlu and intent == "load_voucher":
                search_num = parsed.get("voucher_number")
                search_party = parsed.get("party")
                search_vtype = parsed.get("voucher_type")
                
                # Dynamic fallback for party name if NLU failed to extract it
                if not search_party:
                    clean_msg = user_message.lower()
                    try:
                        cursor = self.db["ledgers"].find({}, {"ledgerName": 1})
                        ledgers_docs = await cursor.to_list(length=1000)
                        best_match = None
                        for d in ledgers_docs:
                            l_name = d["ledgerName"]
                            if l_name and l_name.lower() in clean_msg:
                                if not best_match or len(l_name) > len(best_match):
                                    best_match = l_name
                        if best_match:
                            search_party = best_match
                    except Exception:
                        pass
                
                if not search_num:
                    import re as _re
                    m = _re.search(r'\b(SI-\d{4}-\d+|SI-\d+|PV-\d{4}-\d+|PV-\d+)\b', user_message, _re.IGNORECASE)
                    if m:
                        search_num = m.group(1).upper()
                
                found = await self._find_voucher_doc(search_num, search_party, search_vtype)
                if found:
                    doc, v_type = found
                    party = doc.get("partyLedgerName") or doc.get("partyLedger") or ""
                    v_num = doc.get("voucherNumber") or ""
                    
                    draft = await self._load_voucher_to_draft(doc, v_type)
                    
                    session.current_draft = draft
                    session.draft_json = await self.generate_target_voucher_json(draft)
                    session.state = "awaiting_confirmation"
                    
                    reply = f"I have loaded Voucher #{v_num} for '{party}' into the manual form. You can now edit it manually or with the chatbot."
                    session.history.append({"role": "assistant", "content": reply})
                    await self.save_session(session)
                    
                    return {
                        "reply": reply,
                        "draft": draft,
                        "state": session.state,
                        "draft_json": session.draft_json
                    }
                else:
                    reply = "I couldn't find any matching saved voucher in the database. Please check the voucher number or party name."
                    session.history.append({"role": "assistant", "content": reply})
                    await self.save_session(session)
                    return {
                        "reply": reply,
                        "draft": session.current_draft,
                        "state": session.state
                    }

            # Check for general chat / greetings
            if not skip_nlu and intent == "general_chat" and not session.current_draft:
                if "?" in user_message or any(kw in user_message.lower() for kw in ["what is", "how do", "why", "define", "explain", "accounting", "ledger", "voucher"]):
                    return await self._handle_question(session, parsed, user_message)
                reply = parsed.get("reply") or "Hello! How can I assist you with your accounting today?"
                session.history.append({"role": "assistant", "content": reply})
                await self.save_session(session)
                return {"reply": reply, "draft": None, "state": session.state}

            # Check for save intent
            if not skip_nlu and (intent == "save_voucher" or (parsed.get("confirmation") == "yes" and session.state in ["WAITING_CONFIRMATION", "READY_TO_SAVE", "WAITING_ALLOCATION"])):
                # Ensure we have all sufficient information before creating/saving the voucher
                draft = session.current_draft
                is_complete = False
                if draft and draft.voucher_type and draft.party and (draft.amount and draft.amount > 0):
                    if draft.voucher_type.lower() in ["payment", "receipt", "contra"]:
                        bank_field = "credit" if draft.voucher_type.lower() in ["payment", "contra"] else "debit"
                        if getattr(draft, bank_field):
                            is_complete = True
                    else:
                        is_complete = True
                
                if is_complete:
                    return await self._handle_save_voucher(session)

            # Get or initialize draft
            draft = session.current_draft
            if draft:
                is_inv = draft.voucher_type.lower() in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"]
                draft.entry_mode = "item_invoice" if is_inv else "accounting"
                session.metadata["entry_mode_selected"] = True

            if not draft:
                v_type = parsed.get("voucher_type")
                if not v_type:
                    session.state = "WAITING_INTENT"
                    reply = llm_service.generate_chat_response(
                        session_history=session.history,
                        current_state=session.state,
                        draft_details=None,
                        missing_fields=["voucher_type"],
                        backend_notes="Could not determine voucher type from input.",
                        custom_guidelines=nlg_gl
                    )
                    session.history.append({"role": "assistant", "content": reply})
                    await self.save_session(session)
                    return {"reply": reply, "draft": None, "state": session.state}

                v_type_normalized = v_type.title()
                if v_type_normalized not in ["Sales", "Purchase", "Debit Note", "Credit Note", "Payment", "Receipt", "Contra"]:
                    session.state = "WAITING_INTENT"
                    reply = "I only support Sales, Purchase, Debit Note, Credit Note, Payment, Receipt, and Contra vouchers. Which one would you like to create?"
                    session.history.append({"role": "assistant", "content": reply})
                    await self.save_session(session)
                    return {"reply": reply, "draft": None, "state": session.state}

                is_inv = v_type_normalized.lower() in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"]
                draft = AiVoucherDraft(
                    voucher_type=v_type_normalized,
                    party="",
                    amount=0.0,
                    debit="",
                    credit="",
                    narration="",
                    status="Draft",
                    entry_mode="item_invoice" if is_inv else "accounting"
                )
                session.metadata = {"entry_mode_selected": True}
                session.current_draft = draft
                session.state = "WAITING_PARTY"

            # Accumulate parsed entities in metadata
            if session.metadata is None:
                session.metadata = {}

            is_invoice_vch = draft.voucher_type.lower() in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"]
            if parsed.get("party"):
                session.metadata["temp_party"] = parsed["party"]
            if parsed.get("bank"):
                if is_invoice_vch and getattr(draft, "entry_mode", "accounting") == "accounting":
                    session.metadata["temp_ledger"] = parsed["bank"]
                else:
                    session.metadata["temp_bank"] = parsed["bank"]
            if parsed.get("amount") is not None and float(parsed["amount"] or 0) > 0:
                session.metadata["temp_amount"] = parsed["amount"]
            if parsed.get("date"):
                session.metadata["temp_date"] = parsed["date"]
            if parsed.get("narration"):
                draft.narration = parsed["narration"]
            if parsed.get("allocation_preference"):
                session.metadata["temp_allocation_preference"] = parsed["allocation_preference"]

            # Resolve party if temporary exists and not set
            if not draft.party and session.metadata.get("temp_party"):
                search_party = session.metadata["temp_party"]
                v_type_lower = draft.voucher_type.lower()
                if v_type_lower == "contra":
                    # For Contra, temp_party is actually the debit (source) account
                    if not draft.debit:
                        allowed_groups = ["Bank Accounts", "Cash-in-Hand", "Bank OD A/c"]
                        res = await self._resolve_entity(search_party, "bank", allowed_groups)
                        if res["status"] == "resolved":
                            draft.debit = res["name"]
                            session.metadata.pop("temp_party", None)
                            session.metadata.pop("party_choices", None)
                            backend_notes_list.append(f"Source (DR) account resolved to '{res['name']}'.")
                        elif res["status"] == "ambiguous":
                            session.metadata["party_choices"] = res["matches"]
                            session.metadata["temp_party_query"] = search_party
                            session.state = "WAITING_PARTY"
                            backend_notes_list.append(f"Multiple matches found for source account '{search_party}'.")
                        else:
                            session.state = "WAITING_BANK"
                            session.metadata.pop("temp_party", None)
                            reply = "Please select a valid bank or cash account."
                            session.history.append({"role": "assistant", "content": reply})
                            await self.save_session(session)
                            return {"reply": reply, "draft": draft, "state": session.state}
                else:
                    if v_type_lower in ["sales", "credit note", "credit_note"]:
                        allowed_groups = ["Sundry Debtors", "Sundry Creditors"]
                    elif v_type_lower in ["purchase", "debit note", "debit_note"]:
                        allowed_groups = ["Sundry Debtors", "Sundry Creditors"]
                    else:
                        allowed_groups = ["Sundry Debtors", "Sundry Creditors", "Direct Expenses", "Indirect Expenses", "Direct Incomes", "Indirect Incomes", "Duties & Taxes"]
                    
                    res = await self._resolve_entity(search_party, "party", allowed_groups)
                    if res["status"] == "resolved":
                        draft.party = res["name"]
                        session.metadata.pop("temp_party", None)
                        session.metadata.pop("party_choices", None)
                        session.metadata.pop("temp_party_query", None)
                        backend_notes_list.append(f"Party resolved to '{res['name']}'.")
                    elif res["status"] == "ambiguous":
                        session.metadata["party_choices"] = res["matches"]
                        session.metadata["temp_party_query"] = search_party
                        session.state = "WAITING_PARTY"
                        backend_notes_list.append(f"Multiple matches found for party '{search_party}'.")
                    else:
                        session.state = "WAITING_PARTY"
                        session.metadata.pop("temp_party", None)
                        reply = "Please select a valid party ledger name."
                        session.history.append({"role": "assistant", "content": reply})
                        await self.save_session(session)
                        return {"reply": reply, "draft": draft, "state": session.state}

            # Resolve bank if temporary bank exists and not set
            is_accounting_vch = draft.voucher_type.lower() in ["payment", "receipt", "contra"]
            if is_accounting_vch:
                should_resolve_bank = True
                if draft.voucher_type.lower() == "contra" and not draft.debit:
                    should_resolve_bank = False

                if should_resolve_bank:
                    target_field = "credit" if draft.voucher_type.lower() in ["payment", "contra"] else "debit"
                    current_bank = getattr(draft, target_field)

                    if not current_bank and session.metadata.get("temp_bank"):
                        search_bank = session.metadata["temp_bank"]
                        allowed_groups = ["Bank Accounts", "Cash-in-Hand", "Bank OD A/c"]
                        res = await self._resolve_entity(search_bank, "bank", allowed_groups)
                        if res["status"] == "resolved":
                            setattr(draft, target_field, res["name"])
                            session.metadata.pop("temp_bank", None)
                            session.metadata.pop("bank_choices", None)
                            session.metadata.pop("temp_bank_query", None)
                            backend_notes_list.append(f"Payment account resolved to '{res['name']}'.")
                        elif res["status"] == "ambiguous":
                            session.metadata["bank_choices"] = res["matches"]
                            session.metadata["temp_bank_query"] = search_bank
                            session.state = "WAITING_BANK"
                            backend_notes_list.append(f"Multiple matches found for bank '{search_bank}'.")
                        else:
                            session.state = "WAITING_BANK"
                            session.metadata.pop("temp_bank", None)
                            reply = "Please select a valid bank or cash account."
                            session.history.append({"role": "assistant", "content": reply})
                            await self.save_session(session)
                            return {"reply": reply, "draft": draft, "state": session.state}


            # Resolve sales/purchase ledger if temporary ledger exists and not set (Accounting Mode)
            if is_invoice_vch and getattr(draft, "entry_mode", "accounting") == "accounting":
                target_field = "credit" if draft.voucher_type.lower() in ["sales", "credit note", "credit_note"] else "debit"
                current_ledger = getattr(draft, target_field)

                if not current_ledger and session.metadata.get("temp_ledger"):
                    search_ledger = session.metadata["temp_ledger"]
                    allowed_groups = ["Sales Accounts"] if draft.voucher_type.lower() in ["sales", "credit note", "credit_note"] else ["Purchase Accounts"]
                    res = await self._resolve_entity(search_ledger, "ledger", allowed_groups)
                    if res["status"] == "resolved":
                        setattr(draft, target_field, res["name"])
                        session.metadata.pop("temp_ledger", None)
                        session.metadata.pop("ledger_choices", None)
                        session.metadata.pop("temp_ledger_query", None)
                        backend_notes_list.append(f"Ledger resolved to '{res['name']}'.")
                    elif res["status"] == "ambiguous":
                        session.metadata["ledger_choices"] = res["matches"]
                        session.metadata["temp_ledger_query"] = search_ledger
                        session.state = "WAITING_LEDGER"
                        backend_notes_list.append(f"Multiple matches found for ledger '{search_ledger}'.")
                    else:
                        session.state = "WAITING_LEDGER"
                        session.metadata.pop("temp_ledger", None)
                        reply = f"Please select a valid {'Sales' if draft.voucher_type.lower() in ['sales', 'credit note', 'credit_note'] else 'Purchase'} ledger name."
                        session.history.append({"role": "assistant", "content": reply})
                        await self.save_session(session)
                        return {"reply": reply, "draft": draft, "state": session.state}

            # 3. Amount Resolution
            if (not draft.amount or draft.amount == 0.0) and session.metadata.get("temp_amount") is not None:
                try:
                    amt = float(session.metadata["temp_amount"])
                    if amt > 0:
                        draft.amount = amt
                        session.metadata.pop("temp_amount", None)
                        backend_notes_list.append(f"Amount set to ₹{amt:,.2f}.")
                except ValueError:
                    pass

            # 4. Date Resolution
            if session.metadata.get("temp_date"):
                parsed_dt = self._parse_date_input(str(session.metadata["temp_date"]))
                if parsed_dt:
                    draft.date = parsed_dt
                    session.metadata.pop("temp_date", None)
                    backend_notes_list.append(f"Date set to {parsed_dt}.")

            # 5. Items Resolution for Invoice Vouchers
            if draft.voucher_type.lower() in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"]:
                # If we are currently in WAITING_PARTY or waiting to create a party, do NOT resolve items in this turn.
                # Save them for later when the party is resolved.
                if session.state in ["WAITING_PARTY", "WAITING_CREATE_CONFIRMATION"] and not draft.party:
                    if parsed.get("items"):
                        session.metadata["temp_items"] = parsed["items"]
                elif parsed.get("items"):
                    await self._resolve_items_list(session, parsed["items"], draft, backend_notes_list)
                    if session.metadata.pop("item_not_found_error", False):
                        reply = "Please select a valid stock item."
                        session.history.append({"role": "assistant", "content": reply})
                        await self.save_session(session)
                        return {"reply": reply, "draft": draft, "state": session.state}

            # 5b. Additional Charges Resolution (e.g. Freight, Cess, Packing)
            if parsed.get("additional_charges") and draft.voucher_type.lower() in [
                "sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"
            ]:
                for charge in parsed["additional_charges"]:
                    charge_name = charge.get("ledger_name") or ""
                    charge_amount = float(charge.get("amount") or 0.0) if charge.get("amount") is not None else 0.0
                    if not charge_name:
                        continue
                    
                    allowed_groups = ["Direct Expenses", "Indirect Expenses", "Direct Incomes", "Indirect Incomes", "Duties & Taxes"]
                    res = await self._resolve_entity(charge_name, "additional_charge", allowed_groups)
                    if res["status"] == "resolved":
                        resolved_name = res["name"]
                        existing = next((c for c in draft.additional_charges if c["ledger_name"].lower() == resolved_name.lower()), None)
                        if existing:
                            existing["amount"] = charge_amount
                        else:
                            draft.additional_charges.append({"ledger_name": resolved_name, "amount": charge_amount})
                        if charge_amount > 0:
                            backend_notes_list.append(f"Additional charge '{resolved_name}': ₹{charge_amount:.2f}")
                    elif res["status"] == "ambiguous":
                        session.metadata["charge_choices"] = res["matches"]
                        session.metadata["temp_charge_query"] = charge
                        session.state = "WAITING_ADDITIONAL_CHARGE"
                        backend_notes_list.append(f"Multiple matches found for charge ledger '{charge_name}'.")
                        break
                    else:
                        session.state = "WAITING_ITEM"
                        reply = "Please select a valid additional charge ledger name."
                        session.history.append({"role": "assistant", "content": reply})
                        await self.save_session(session)
                        return {"reply": reply, "draft": draft, "state": session.state}

        # Update calculations & GST (using manual voucher logic calculations engine)
        if draft.party:
            if draft.voucher_type.lower() in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"]:
                if not draft.credit or draft.credit == "":
                    if draft.voucher_type.lower() in ["sales", "credit note", "credit_note"]:
                        draft.credit = await self._resolve_ledger_name("", "Sales Accounts") or "GST Sales 18%"
                        draft.debit = draft.party
                    else:
                        draft.debit = await self._resolve_ledger_name("", "Purchase Accounts") or "GST Purchase 18%"
                        draft.credit = draft.party

                # Call calculations engine
                items_dict = [it.model_dump() for it in draft.items]
                gst_calc = await self._calculate_invoice_gst_entries(
                    draft.party, items_dict, draft.voucher_type,
                    additional_charges=draft.additional_charges or []
                )
                # Store all tax results on draft — single source of truth from calculate_taxes
                draft.amount = gst_calc["total_amount"]
                draft.gst_rate = gst_calc["gst_rate"]
                draft.base_amount = gst_calc["base_amount"]
                draft.cgst_amount = gst_calc["cgst_amount"]
                draft.sgst_amount = gst_calc["sgst_amount"]
                draft.igst_amount = gst_calc["igst_amount"]
                draft.cess_amount = gst_calc["cess_amount"]
                draft.is_intra_state = gst_calc["is_intra_state"]
                draft.tax_type = gst_calc["tax_type"]
                draft.ledger_entries = [AiVoucherLedgerEntry(**e) for e in gst_calc["ledger_entries"]]
                if gst_calc.get("resolved_additional_charges"):
                    draft.additional_charges = gst_calc["resolved_additional_charges"]
                if gst_calc.get("items"):
                    draft.items = [AiInvoiceItem(**it) for it in gst_calc["items"]]
            else:
                if draft.voucher_type.lower() == "payment":
                    draft.debit = draft.party
                elif draft.voucher_type.lower() == "receipt":
                    draft.credit = draft.party

        # 6. WAITING_ALLOCATION Check (Outstanding bills)
        outstanding_bills = None
        is_accounting_vch = draft.voucher_type.lower() in ["payment", "receipt", "contra"] if draft else False
        if is_accounting_vch and draft.party:
            bills = await self._get_outstanding_bills(draft.party)
            if bills:
                outstanding_bills = bills
                session.metadata["outstanding_bills"] = bills
                
                # Settle outstanding bill amount: payment amount must match total outstanding bills amount exactly!
                total_outstanding = sum(b["pendingAmount"] for b in bills)
                draft.amount = total_outstanding
                
                # Check allocation instruction
                pref = session.metadata.get("temp_allocation_preference")
                if session.state == "WAITING_ALLOCATION" and user_message and not pref:
                    pref = user_message

                if pref:
                    allocations = self._allocate_payment(draft.amount, bills, pref)
                    draft.bill_allocations = allocations
                    session.metadata.pop("temp_allocation_preference", None)
                    backend_notes_list.append("Payment allocations updated.")
                    session.state = "WAITING_CONFIRMATION"
                else:
                    if not draft.bill_allocations:
                        allocations = self._allocate_payment(draft.amount, bills, "oldest")
                        draft.bill_allocations = allocations
                    session.state = "WAITING_ALLOCATION"
            else:
                draft.bill_allocations = []
                if session.state == "WAITING_ALLOCATION":
                    session.state = "WAITING_CONFIRMATION"

        # Determine current missing fields
        missing_fields = []
        is_invoice_vch = draft.voucher_type.lower() in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"] if draft else False

        if not draft.voucher_type:
            missing_fields.append("Voucher Type")
        if not draft.party and draft.voucher_type.lower() != "contra":
            missing_fields.append("Party Ledger")
        if draft.voucher_type.lower() == "contra":
            if not draft.debit:
                missing_fields.append("Source Account (DR)")
            if not draft.credit:
                missing_fields.append("Destination Account (CR)")
        if is_accounting_vch and draft.voucher_type.lower() != "contra" and not getattr(draft, "credit" if draft.voucher_type.lower() in ["payment", "contra"] else "debit"):
            missing_fields.append("Payment Account")
        if is_invoice_vch and draft.entry_mode == "accounting" and not getattr(draft, "credit" if draft.voucher_type.lower() in ["sales", "credit note", "credit_note"] else "debit"):
            missing_fields.append("Sales Ledger" if draft.voucher_type.lower() in ["sales", "credit note", "credit_note"] else "Purchase Ledger")
        if is_invoice_vch and not draft.items:
            missing_fields.append("Items")
        if is_invoice_vch and any(it.item_name == "" for it in draft.items):
            missing_fields.append("Item Name")
        if is_invoice_vch and draft.entry_mode == "item_invoice" and draft.items and any(it.quantity == 0 or it.rate == 0 for it in draft.items):
            missing_fields.append("Item Quantity/Rate")
        if is_invoice_vch and any(float(c.get("amount") or 0.0) == 0.0 for c in (draft.additional_charges or []) if not c.get("is_tax")):
            missing_fields.append("Additional Charge Amount")
        if not draft.amount or draft.amount == 0.0:
            missing_fields.append("Amount")

        # Protect interactive/clarification states from being overwritten
        is_interactive_state = session.state in [
            "WAITING_CREATE_CONFIRMATION",
            "WAITING_ADDITIONAL_CHARGE",
            "WAITING_PARTY",
            "WAITING_BANK",
            "WAITING_ITEM",
            "WAITING_LEDGER"
        ] and (
            session.metadata.get("party_choices") is not None or
            session.metadata.get("bank_choices") is not None or
            session.metadata.get("item_choices") is not None or
            session.metadata.get("ledger_choices") is not None or
            session.metadata.get("charge_choices") is not None or
            session.metadata.get("pending_create_name") is not None
        )

        if not is_interactive_state:
            if not draft.voucher_type:
                session.state = "WAITING_INTENT"
            elif not draft.party and draft.voucher_type.lower() != "contra":
                session.state = "WAITING_PARTY"
            elif draft.voucher_type.lower() == "contra" and (not draft.debit or not draft.credit):
                session.state = "WAITING_BANK"
            elif is_accounting_vch and draft.voucher_type.lower() != "contra" and not getattr(draft, "credit" if draft.voucher_type.lower() in ["payment", "contra"] else "debit"):
                session.state = "WAITING_BANK"
            elif is_invoice_vch and draft.entry_mode == "accounting" and not getattr(draft, "credit" if draft.voucher_type.lower() in ["sales", "credit note", "credit_note"] else "debit"):
                session.state = "WAITING_LEDGER"
            elif is_invoice_vch and not draft.items:
                session.state = "WAITING_ITEM"
                non_tax_charges = [c for c in (draft.additional_charges or []) if not c.get("is_tax", False)]
                if non_tax_charges:
                    backend_notes_list.append("Please add at least one inventory item before creating the invoice.")
                else:
                    backend_notes_list.append("Please add at least one inventory item.")
            elif is_invoice_vch and any(it.item_name == "" for it in draft.items):
                unnamed_idx = next(i for i, it in enumerate(draft.items) if it.item_name == "")
                session.metadata["temp_item_needs_name_idx"] = unnamed_idx
                session.state = "WAITING_ITEM_NAME"
            elif is_invoice_vch and draft.entry_mode == "item_invoice" and draft.items and any(it.quantity == 0 or it.rate == 0 for it in draft.items):
                missing_item = next((it for it in draft.items if it.quantity == 0 or it.rate == 0), None)
                if missing_item:
                    session.metadata["temp_item_needs_qty_rate"] = missing_item.item_name
                session.state = "WAITING_ITEM_QTY_RATE"
            elif is_invoice_vch and any(float(c.get("amount") or 0.0) == 0.0 for c in (draft.additional_charges or []) if not c.get("is_tax")):
                missing_charge = next(c for c in draft.additional_charges if float(c.get("amount") or 0.0) == 0.0 and not c.get("is_tax"))
                session.metadata["temp_charge_needs_amount"] = missing_charge["ledger_name"]
                session.state = "WAITING_CHARGE_AMOUNT"
            elif not draft.amount or draft.amount == 0.0:
                if is_invoice_vch and draft.entry_mode == "item_invoice":
                    session.state = "WAITING_ITEM_QTY_RATE"
                else:
                    session.state = "WAITING_AMOUNT"
            else:
                if is_accounting_vch and outstanding_bills and session.state == "WAITING_ALLOCATION":
                    pass # Keep in WAITING_ALLOCATION state to ask the user
                else:
                    session.state = "WAITING_CONFIRMATION"

        # Narration and sequential number auto update
        if draft.party or draft.voucher_type.lower() in ["contra", "contra voucher"]:
            await self._update_draft_fields_and_narration(draft)
        elif draft.voucher_type.lower() in ["payment", "payment voucher", "receipt", "receipt voucher", "contra", "contra voucher"]:
            t_party = session.metadata.get("temp_party")
            t_amount = float(session.metadata.get("temp_amount") or 0.0)
            if t_party:
                if not draft.items:
                    draft.items = [
                        AiInvoiceItem(
                            item_name=t_party,
                            quantity=1.0,
                            rate=t_amount,
                            amount=t_amount,
                            discount_percent=0.0,
                            gst_rate=0.0,
                            description=draft.narration or f"Payment to {t_party}"
                        )
                    ]
                else:
                    if len(draft.items) == 1:
                        item = draft.items[0]
                        if item.item_name != t_party or item.amount != t_amount:
                            item.item_name = t_party
                            item.amount = t_amount
                            item.rate = t_amount

        session.current_draft = draft
        session.draft_json = await self.generate_target_voucher_json(draft)

        # Call NLG to generate the natural response
        backend_notes = " ".join(backend_notes_list)
        entry_mode_choices = session.metadata.get("entry_mode_choices")
        ledger_choices = session.metadata.get("ledger_choices")
        item_choices  = session.metadata.get("item_choices")
        party_choices = session.metadata.get("party_choices")
        bank_choices  = session.metadata.get("bank_choices")
        charge_choices = session.metadata.get("charge_choices")

        # Determine choices to pass to NLG based strictly on current state
        choices = None
        if session.state == "WAITING_PARTY":
            choices = party_choices
        elif session.state == "WAITING_ITEM":
            choices = item_choices
        elif session.state == "WAITING_BANK":
            choices = bank_choices
        elif session.state == "WAITING_LEDGER":
            choices = ledger_choices
        elif session.state == "WAITING_ADDITIONAL_CHARGE":
            choices = charge_choices
        elif session.state == "WAITING_ENTRY_MODE":
            choices = entry_mode_choices
            
        if not choices:
            choices = entry_mode_choices or ledger_choices or item_choices or party_choices or bank_choices or charge_choices
        
        # Inject dynamic guidelines for language and style consistency
        nlg_gl.append("Always respond in the user's natural query language (e.g. English, Hinglish, or Hindi) with a casual, natural, simple, and conversational tone.")
        nlg_gl.append("Do not translate standard accounting terms (like Quantity, Qty, Rate, Amount, Party, Customer, Bank Account, Items) to pure Hindi.")
        
        if session.state == "WAITING_ITEM" and session.metadata.get("item_choices"):
            if "resolved" in backend_notes.lower() or "created" in backend_notes.lower():
                nlg_gl.append("The last user message was for choosing/confirming the party. We have successfully resolved the party. Do NOT treat the user's message as a selection for the stock item. You must now list the matching stock item options and ask the user to select one.")
        
        if session.state == "WAITING_CREATE_CONFIRMATION" and session.metadata.get("pending_create_name"):
            pending_name = session.metadata["pending_create_name"]
            pending_type = session.metadata["pending_create_type"]
            nlg_gl.append(f"Ask the user if they want to create a new {pending_type} record for '{pending_name}' since it doesn't exist in the database.")
        
        reply = llm_service.generate_chat_response(
            session_history=session.history,
            current_state=session.state,
            draft_details=draft.model_dump() if draft else None,
            missing_fields=missing_fields,
            outstanding_bills=outstanding_bills,
            options=choices,
            backend_notes=backend_notes,
            custom_guidelines=nlg_gl
        )

        session.history.append({"role": "assistant", "content": reply})
        await self.save_session(session)

        return {
            "reply": reply,
            "draft": draft,
            "state": session.state,
            "draft_json": session.draft_json
        }

    async def _handle_cancel_draft(self, session: ChatSession) -> Dict[str, Any]:
        session.current_draft = None
        session.draft_json = None
        session.state = "WAITING_INTENT"
        session.metadata = {}
        reply = "I have discarded the active draft voucher."
        session.history.append({"role": "assistant", "content": reply})
        await self.save_session(session)
        return {"reply": reply, "draft": None, "state": session.state}

    async def _handle_save_voucher(self, session: ChatSession) -> Dict[str, Any]:
        draft = session.current_draft
        if not draft:
            reply = "No draft voucher to save. Please describe a voucher first."
            session.history.append({"role": "assistant", "content": reply})
            await self.save_session(session)
            return {"reply": reply, "draft": None, "state": session.state}

        try:
            draft.entry_mode = "item_invoice" if draft.items else "accounting"
            v_type_lower = draft.voucher_type.lower()
            if v_type_lower in ["sales", "sales voucher", "credit note", "credit_note"]:
                from app.anjalee.services.sales_service import SalesVoucherService
                from app.anjalee.schemas.sales_schemas import SalesVoucherCreate, SalesVoucherInventoryEntry, SalesVoucherEntry
                sales_service = SalesVoucherService(self.sales_repo)
                
                inv_entries = []
                sales_entries = []
                
                if draft.entry_mode == "item_invoice":
                    for item in draft.items:
                        inv_entries.append(SalesVoucherInventoryEntry(
                            stockItem=item.item_name,
                            billQuantity=item.quantity,
                            billRate=item.rate,
                            amount=item.amount,
                            gstRate=item.gst_rate or 18.0
                        ))
                else:
                    sales_entries.append(SalesVoucherEntry(
                        ledgerName=draft.credit,
                        amount=draft.amount,
                        gstRate=draft.gst_rate or 18.0
                    ))
                
                v_type_val = "credit_note" if "credit" in v_type_lower else "sales_invoice"
                additional_charges_payload = [
                    {"ledgerName": c["ledger_name"], "amount": float(c.get("amount") or 0.0), "taxableValue": float(c.get("taxable_value") or 0.0)}
                    for c in (draft.additional_charges or [])
                ]
                payload = SalesVoucherCreate(
                    voucherType=v_type_val,
                    partyLedgerName=draft.party,
                    voucherDate=draft.date,
                    narration=(draft.narration + "\n[Created via AI Text-to-Entry]") if draft.narration else "[Created via AI Text-to-Entry]",
                    status="DRAFT",
                    entryTab="with_item" if draft.entry_mode == "item_invoice" else "without_item",
                    inventoryEntries=inv_entries,
                    salesEntries=sales_entries,
                    additionalCharges=additional_charges_payload
                )
                res = await sales_service.create_voucher(payload)
                v_num = res.get("voucherNumber") or ""
                if v_num:
                    await self.db["sales_vouchers"].update_one(
                        {"voucherNumber": v_num},
                        {"$set": {"sessionId": session.session_id}}
                    )
                v_type_display = "Credit Note" if v_type_val == "credit_note" else "Sales Voucher"
                reply = f"Successfully saved {v_type_display} as **Draft** (Voucher Number: {v_num})."

            elif v_type_lower in ["purchase", "purchase voucher", "debit note", "debit_note"]:
                from app.anjalee.services.purchase_service import PurchaseService
                from app.anjalee.repositories.purchase_repo import PurchaseRepository
                from app.anjalee.schemas.purchase_schemas import PurchaseVoucherCreate
                
                purchase_repo = PurchaseRepository(self.sync_db)
                purchase_service = PurchaseService(purchase_repo)
                
                prod_lines = []
                pur_lines = []
                
                if draft.entry_mode == "item_invoice":
                    for idx, item in enumerate(draft.items):
                        prod_lines.append({
                            "srNo": idx + 1,
                            "stockItem": item.item_name,
                            "billQuantity": item.quantity,
                            "billRate": item.rate,
                            "amount": item.amount,
                            "gstRate": item.gst_rate or 18.0
                        })
                else:
                    pur_lines.append({
                        "srNo": 1,
                        "purchaseLedger": draft.credit,
                        "amount": draft.amount,
                        "gstRate": draft.gst_rate or 18.0
                    })
                
                v_type_val = "debit_note" if "debit" in v_type_lower else "purchase_invoice"
                payload = PurchaseVoucherCreate(
                    voucherType=v_type_val,
                    partyLedger=draft.party,
                    voucherDate=draft.date,
                    narration=(draft.narration + "\n[Created via AI Text-to-Entry]") if draft.narration else "[Created via AI Text-to-Entry]",
                    status="DRAFT",
                    entryTab="with_item" if draft.entry_mode == "item_invoice" else "without_item",
                    productLines=prod_lines,
                    purchaseLines=pur_lines
                )
                res = purchase_service.create_transaction(payload)
                v_num = res.get("voucherNumber") or ""
                if v_num:
                    await self.db["purchase_vouchers"].update_one(
                        {"voucherNumber": v_num},
                        {"$set": {"sessionId": session.session_id}}
                    )
                v_type_display = "Debit Note" if v_type_val == "debit_note" else "Purchase Voucher"
                reply = f"Successfully saved {v_type_display} as **Draft** (Voucher Number: {v_num})."

            elif v_type_lower in ["payment", "payment voucher", "receipt", "receipt voucher", "contra", "contra voucher"]:
                from app.anjalee.services.fundflow_service import FundFlowService
                from app.anjalee.repositories.fundflow_repo import FundFlowRepository
                from app.anjalee.schemas.fundflow_schemas import FundFlowTransactionCreate
                
                fundflow_repo = FundFlowRepository(self.sync_db)
                fundflow_service = FundFlowService(fundflow_repo)
                
                is_cash = "cash" in draft.debit.lower() or "cash" in draft.credit.lower()
                if "payment" in v_type_lower:
                    v_type_val = "cash_payment" if is_cash else "bank_payment"
                    against = draft.credit
                elif "receipt" in v_type_lower:
                    v_type_val = "cash_receipt" if is_cash else "bank_receipt"
                    against = draft.debit
                else:
                    v_type_val = "contra"
                    against = draft.credit
                
                bill_rows = []
                if draft.bill_allocations:
                    for alloc in draft.bill_allocations:
                        bill_rows.append({
                            "billNo": alloc.get("bill") or alloc.get("billNo"),
                            "allocationAmount": float(alloc.get("amount") or 0.0)
                        })

                ledger_rows = []
                if draft.items:
                    for item in draft.items:
                        ledger_rows.append({
                            "ledgerName": item.item_name,
                            "amount": float(item.amount),
                            "description": item.description or draft.narration or f"Payment to {item.item_name}"
                        })
                else:
                    ledger_rows = [
                        {
                            "ledgerName": draft.party,
                            "amount": draft.amount,
                            "description": draft.narration or f"Payment to {draft.party}"
                        }
                    ]

                payload = FundFlowTransactionCreate(
                    voucherType=v_type_val,
                    voucherDate=draft.date,
                    partyLedger=draft.party,
                    againstLedger=against,
                    amount=draft.amount,
                    narration=(draft.narration + "\n[Created via AI Text-to-Entry]") if draft.narration else "[Created via AI Text-to-Entry]",
                    status="draft",
                    entryMode="manual",
                    billRows=bill_rows,
                    ledgerRows=ledger_rows
                )
                res = fundflow_service.create_transaction(payload)
                v_num = res.get("voucherNumber") or ""
                if v_num:
                    await self.db["fund_flow_vouchers"].update_one(
                        {"voucherNumber": v_num},
                        {"$set": {"sessionId": session.session_id}}
                    )
                v_type_display = "Payment Voucher" if "payment" in v_type_lower else ("Receipt Voucher" if "receipt" in v_type_lower else "Contra Voucher")
                reply = f"Successfully saved {v_type_display} as **Draft** (Voucher Number: {v_num})."

            draft.status = "Saved"
            draft.voucher_number = v_num
            session.current_draft = draft
            session.draft_json = await self.generate_target_voucher_json(draft)
            session.state = "SAVED"
            session.metadata = {}
            session.history.append({"role": "assistant", "content": reply})
            await self.save_session(session)
            return {"reply": reply, "draft": draft, "state": session.state, "draft_json": session.draft_json}

        except Exception as e:
            logger.error(f"Error saving voucher: {str(e)}", exc_info=True)
            reply = f"Failed to save voucher: {str(e)}"
            session.history.append({"role": "assistant", "content": reply})
            await self.save_session(session)
            return {"reply": reply, "draft": draft, "state": session.state}

    async def _find_voucher_doc(self, voucher_number: Optional[str] = None, party: Optional[str] = None, voucher_type: Optional[str] = None) -> Optional[Tuple[Dict[str, Any], str]]:
        import re
        search_configs = [
            ("sales_vouchers", "sales_invoice"),
            ("purchase_vouchers", "purchase_invoice"),
            ("fund_flow_vouchers", "payment")
        ]
        
        if voucher_number:
            for coll, v_type in search_configs:
                try:
                    doc = await self.db[coll].find_one({"voucherNumber": voucher_number})
                    if doc:
                        return doc, v_type
                except Exception:
                    pass
            for coll, v_type in search_configs:
                try:
                    doc = await self.db[coll].find_one({"voucherNumber": {"$regex": re.escape(voucher_number), "$options": "i"}})
                    if doc:
                        return doc, v_type
                except Exception:
                    pass

        if party:
            v_type_normalized = (voucher_type or "sales").lower()
            if "sales" in v_type_normalized or "credit" in v_type_normalized:
                target_colls = [("sales_vouchers", "sales_invoice")]
                query = {"partyLedgerName": {"$regex": re.escape(party), "$options": "i"}, "isDeleted": {"$ne": True}}
            elif "purchase" in v_type_normalized or "debit" in v_type_normalized:
                target_colls = [("purchase_vouchers", "purchase_invoice")]
                query = {"partyLedger": {"$regex": re.escape(party), "$options": "i"}, "isDeleted": {"$ne": True}}
            else:
                target_colls = [("fund_flow_vouchers", "payment")]
                query = {"partyLedger": {"$regex": re.escape(party), "$options": "i"}, "status": {"$ne": "deleted"}}
                
            for coll, v_type in target_colls:
                try:
                    cursor = self.db[coll].find(query).sort("_id", -1).limit(1)
                    docs = await cursor.to_list(length=1)
                    if docs:
                        return docs[0], v_type
                except Exception:
                    pass
                    
            for coll, v_type in search_configs:
                try:
                    q = {"$or": [
                        {"partyLedgerName": {"$regex": re.escape(party), "$options": "i"}},
                        {"partyLedger": {"$regex": re.escape(party), "$options": "i"}}
                    ]}
                    cursor = self.db[coll].find(q).sort("_id", -1).limit(1)
                    docs = await cursor.to_list(length=1)
                    if docs:
                        return docs[0], v_type
                except Exception:
                    pass
                    
        return None

    async def _load_voucher_to_draft(self, doc: Dict[str, Any], voucher_type: str) -> AiVoucherDraft:
        is_sales = "sales" in voucher_type.lower() or "credit" in voucher_type.lower()
        is_fundflow = "payment" in voucher_type.lower() or "receipt" in voucher_type.lower() or "contra" in voucher_type.lower()
        
        items = []
        if is_fundflow:
            for row in doc.get("ledgerRows", []):
                items.append(AiInvoiceItem(
                    item_name=row.get("ledgerName") or "",
                    quantity=1.0,
                    rate=row.get("amount") or 0.0,
                    amount=row.get("amount") or 0.0,
                    discount_percent=0.0,
                    gst_rate=0.0,
                    description=row.get("description") or ""
                ))
        else:
            entries_field = "inventoryEntries" if is_sales else "productLines"
            for item in doc.get(entries_field, []):
                items.append(AiInvoiceItem(
                    item_name=item.get("stockItem") or item.get("stockItemName") or "",
                    quantity=item.get("billQuantity") or item.get("billedQty") or 1.0,
                    rate=item.get("billRate") or item.get("rate") or 0.0,
                    amount=item.get("amount") or 0.0,
                    gst_rate=item.get("gstRate") or 0.0,
                    discount_percent=item.get("discountPercent") or 0.0
                ))

        if is_fundflow:
            if "payment" in voucher_type.lower():
                v_type = "Payment"
            elif "receipt" in voucher_type.lower():
                v_type = "Receipt"
            else:
                v_type = "Contra"
        else:
            if is_sales:
                v_type = "Credit Note" if "credit" in voucher_type.lower() else "Sales"
            else:
                v_type = "Debit Note" if "debit" in voucher_type.lower() else "Purchase"

        party = doc.get("partyLedgerName") or doc.get("partyLedger") or ""
        amount = doc.get("grandTotal") or doc.get("amount") or 0.0
        
        if is_fundflow:
            if v_type == "Payment":
                debit = party
                credit = doc.get("againstLedger") or ""
            elif v_type == "Receipt":
                debit = doc.get("againstLedger") or ""
                credit = party
            else:
                debit = party
                credit = doc.get("againstLedger") or ""
        else:
            debit = doc.get("partyLedgerName") if is_sales else (doc.get("purchaseLedger") or "")
            credit = (doc.get("salesLedger") or "") if is_sales else (doc.get("partyLedger") or "")
            
        narration = doc.get("narration") or ""

        raw_charges = doc.get("additionalCharges") or []
        additional_charges = []
        for c in raw_charges:
            additional_charges.append({
                "ledger_name": c.get("ledgerName") or c.get("ledger_name") or "",
                "amount": float(c.get("amount") or 0.0),
                "taxable_value": float(c.get("taxableValue") or c.get("taxable_value") or 0.0),
                "is_tax": c.get("isTax", False) or c.get("is_tax", False)
            })

        draft = AiVoucherDraft(
            voucher_type=v_type,
            party=party,
            amount=amount,
            debit=debit,
            credit=credit,
            date=doc.get("voucherDate") or "",
            narration=narration,
            status="Draft",
            gst_rate=doc.get("gstSummary", {}).get("gstRate") or doc.get("gstRate") or 18.0,
            voucher_number=doc.get("voucherNumber") or "",
            entry_mode="item_invoice" if items else "accounting",
            items=items,
            additional_charges=additional_charges
        )

        if not is_fundflow:
            gst_calc = await self._calculate_invoice_gst_entries(
                draft.party,
                [item.model_dump() for item in draft.items],
                draft.voucher_type,
                additional_charges=draft.additional_charges
            )
            draft.amount = round(gst_calc["total_amount"])
            draft.gst_rate = gst_calc["gst_rate"]
            draft.base_amount = gst_calc["base_amount"]
            draft.cgst_amount = gst_calc["cgst_amount"]
            draft.sgst_amount = gst_calc["sgst_amount"]
            draft.igst_amount = gst_calc["igst_amount"]
            draft.cess_amount = gst_calc["cess_amount"]
            draft.is_intra_state = gst_calc["is_intra_state"]
            draft.tax_type = gst_calc["tax_type"]
            draft.ledger_entries = [AiVoucherLedgerEntry(**e) for e in gst_calc["ledger_entries"]]
            if gst_calc.get("resolved_additional_charges"):
                draft.additional_charges = gst_calc["resolved_additional_charges"]
            if gst_calc.get("items"):
                draft.items = [AiInvoiceItem(**it) for it in gst_calc["items"]]
        else:
            draft.ledger_entries = []

        return draft

    async def _search_party_master(self, name: str, voucher_type: str) -> Optional[Dict[str, Any]]:
        v_type_lower = voucher_type.lower()
        if v_type_lower in ["sales", "credit note", "credit_note"]:
            expected_groups = ["Sundry Debtors"]
        elif v_type_lower in ["purchase", "debit note", "debit_note"]:
            expected_groups = ["Sundry Creditors"]
        elif v_type_lower in ["payment", "receipt", "contra"]:
            expected_groups = ["Sundry Debtors", "Sundry Creditors", "Bank Accounts", "Cash-in-Hand", "Direct Expenses", "Indirect Expenses", "Direct Incomes", "Indirect Incomes"]
        else:
            expected_groups = ["Sundry Debtors", "Sundry Creditors"]

        doc = await self.db["ledgers"].find_one({
            "ledgerName": {"$regex": re.escape(name), "$options": "i"},
            "groupName": {"$in": expected_groups}
        })
        if doc:
            return doc
            
        if name.lower() in ["cash", "bank"]:
            doc_cash = await self.db["ledgers"].find_one({
                "ledgerName": {"$regex": re.escape(name), "$options": "i"},
                "groupName": {"$in": ["Cash-in-Hand", "Bank Accounts", "Bank OD A/c"]}
            })
            if doc_cash:
                return doc_cash
        return None

    async def _resolve_ledger_name(self, name: str, group: str) -> str:
        if name:
            doc = await self.db["ledgers"].find_one({"ledgerName": {"$regex": f"^{name}$", "$options": "i"}})
            if doc:
                return doc["ledgerName"]
        if group:
            doc = await self.db["ledgers"].find_one({"groupName": {"$regex": f"^{group}$", "$options": "i"}})
            if doc:
                return doc["ledgerName"]
        return name or group

    async def _get_outstanding_bills(self, party_name: str) -> List[Dict[str, Any]]:
        pending_bills = []
        seen_bills = set()

        async def calc_paid(bill_no: str) -> float:
            paid = 0.0
            cursor = self.db["fundflow"].find({
                "status": {"$ne": "deleted"},
                "billRows": {"$elemMatch": {"$or": [{"billNo": bill_no}, {"billRef": bill_no}]}}
            })
            async for ff in cursor:
                for row in ff.get("billRows") or []:
                    if row.get("billNo") == bill_no or row.get("billRef") == bill_no:
                        paid += float(row.get("allocationAmount") or row.get("allocatedAmount") or 0.0)
            return paid

        # Sales vouchers
        cursor = self.db["sales_vouchers"].find({
            "$or": [{"partyLedgerName": party_name}, {"partyName": party_name}],
            "isDeleted": {"$ne": True}
        }).sort("createdAt", -1).limit(30)
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
                    "date": sv.get("voucherDate") or "",
                    "billAmount": bill_amount,
                    "paidAmount": paid_amount,
                    "pendingAmount": outstanding,
                    "source": "Sales Invoice"
                })

        # Purchase vouchers
        cursor = self.db["purchase_vouchers"].find({
            "$or": [{"partyLedger": party_name}, {"partyName": party_name}],
            "isDeleted": {"$ne": True}
        }).sort("createdAt", -1).limit(30)
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
                    "date": pv.get("voucherDate") or pv.get("invoiceDate") or "",
                    "billAmount": bill_amount,
                    "paidAmount": paid_amount,
                    "pendingAmount": outstanding,
                    "source": "Purchase Bill"
                })

        # Tally vouchers
        cursor = self.db["vouchers"].find({
            "$or": [{"partyLedgerName": party_name}, {"partyName": party_name}],
            "voucherCategory": {"$in": ["Sales", "Purchase"]},
            "isDeleted": {"$ne": True}
        }).sort("dates.date", -1).limit(30)
        async for v in cursor:
            bill_no = v.get("voucherNumber") or v.get("voucherGuid") or ""
            if not bill_no or bill_no in seen_bills:
                continue
            totals = v.get("totals") or {}
            bill_amount = float(totals.get("totalAmount") or totals.get("totalDebit") or totals.get("totalCredit") or 0.0)
            paid_amount = await calc_paid(bill_no)
            outstanding = round(bill_amount - paid_amount, 2)
            if outstanding > 0:
                seen_bills.add(bill_no)
                pending_bills.append({
                    "billNo": bill_no,
                    "date": "",
                    "billAmount": bill_amount,
                    "paidAmount": paid_amount,
                    "pendingAmount": outstanding,
                    "source": "Tally"
                })

        pending_bills.sort(key=lambda x: x["date"], reverse=True)
        return pending_bills

    async def _resolve_stock_item(self, item_query: str) -> Dict[str, Any]:
        res = await self._resolve_entity(item_query, "item")
        if res["status"] == "resolved":
            doc = await self.db["stockItems"].find_one({"itemName": res["name"]})
            return {"status": "resolved", "doc": doc}
        elif res["status"] == "ambiguous":
            matches = await self.db["stockItems"].find({"itemName": {"$in": res["matches"]}}).to_list(length=50)
            return {"status": "ambiguous", "matches": matches}
        return {"status": "none"}

    def _get_item_details_from_doc(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        hsn_code = doc.get("hsnCode") or ""
        gst_rate = doc.get("gstSettings", {}).get("gstRate") or 18.0
        if not gst_rate:
            gst_rate = doc.get("taxRate") or 18.0

        rate_raw = ((doc.get("inventory") or {}).get("openingStock") or {}).get("rate") or 0.0
        try:
            rate = float(rate_raw)
        except (ValueError, TypeError):
            rate = 100.0

        unit = doc.get("uom") or doc.get("unit") or "Nos"
        return {"name": doc["itemName"], "rate": rate, "gst_rate": float(gst_rate), "hsn_code": str(hsn_code), "unit": str(unit)}

    async def _find_stock_item_and_rate(self, item_name: str) -> Optional[Dict[str, Any]]:
        res = await self._resolve_stock_item(item_name)
        if res["status"] == "resolved":
            return self._get_item_details_from_doc(res["doc"])
        return None

    async def _add_items_to_draft(self, session: ChatSession, items_parsed: List[Dict[str, Any]], voucher_type: str) -> Dict[str, Any]:
        party_name = session.metadata.get("party")
        if not party_name:
            session.state = "WAITING_PARTY"
            await self.save_session(session)
            reply = "Which customer?" if voucher_type.lower() == "sales" else "Which supplier?"
            session.history.append({"role": "assistant", "content": reply})
            await self.save_session(session)
            return {"reply": reply, "draft": None, "state": session.state}

        draft = session.current_draft
        if not draft:
            if voucher_type.lower() == "sales":
                debit = party_name
                credit = await self._resolve_ledger_name("", "Sales Accounts") or "GST Sales 18%"
            else:
                debit = party_name
                credit = await self._resolve_ledger_name("", "Purchase Accounts") or "GST Purchase 18%"

            draft = AiVoucherDraft(
                voucher_type=voucher_type,
                party=party_name,
                amount=0.0,
                debit=debit,
                credit=credit,
                entry_mode="item_invoice",
                items=[]
            )

        existing_items = {item.item_name.lower(): item for item in draft.items}

        for it in items_parsed:
            item_query = it.get("item_name")
            if not item_query:
                continue

            res = await self._resolve_stock_item(item_query)
            if res["status"] == "resolved":
                item_details = self._get_item_details_from_doc(res["doc"])
            elif res["status"] == "ambiguous":
                options = [doc["itemName"] for doc in res["matches"]]
                reply = f"I found multiple matching items for '{item_query}'. Please select which item you want to select:\n" + "\n".join([f"- {opt}" for opt in options])
                session.history.append({"role": "assistant", "content": reply})
                meta = session.metadata or {}
                meta["suggested_item_options"] = options
                meta["pending_item_query"] = it
                meta["suggested_actions"] = options
                session.metadata = meta
                session.state = "WAITING_ITEM_SELECTION"
                await self.save_session(session)
                return {"reply": reply, "draft": draft, "state": session.state}
            else:
                reply = f"Item '{item_query}' does not exist in Item Master. Would you like to create it with default settings?"
                session.history.append({"role": "assistant", "content": reply})
                meta = session.metadata or {}
                meta["pending_create_item"] = it
                meta["suggested_actions"] = ["Create Item", "Cancel"]
                session.metadata = meta
                session.state = "WAITING_CREATE_ITEM"
                await self.save_session(session)
                return {"reply": reply, "draft": draft, "state": session.state}

            resolved_name = item_details["name"]
            qty = float(it.get("quantity") or 1.0)
            rate = float(it.get("rate") or 0.0) or item_details["rate"]

            if not rate:
                session.state = "WAITING_RATE"
                session.metadata["pending_item"] = {
                    "item_name": resolved_name,
                    "quantity": qty,
                    "rate": 0.0,
                    "amount": 0.0
                }
                await self.save_session(session)
                reply = f"What is the rate for {resolved_name}?"
                session.history.append({"role": "assistant", "content": reply})
                await self.save_session(session)
                return {"reply": reply, "draft": draft, "state": session.state}

            discount_pct = float(it.get("discount_percent") or 0.0)
            discount_amt = qty * rate * (discount_pct / 100.0)
            amt = (qty * rate) - discount_amt

            new_item = AiInvoiceItem(
                item_name=resolved_name,
                quantity=qty,
                rate=rate,
                amount=amt,
                discount_percent=discount_pct,
                gst_rate=item_details["gst_rate"],
                hsn=item_details.get("hsn_code"),
                unit=item_details.get("unit")
            )
            existing_items[resolved_name.lower()] = new_item

        draft.items = list(existing_items.values())

        gst_calc = await self._calculate_invoice_gst_entries(
            draft.party, [item.model_dump() for item in draft.items], draft.voucher_type,
            additional_charges=draft.additional_charges or []
        )
        draft.amount = gst_calc["total_amount"]
        draft.gst_rate = gst_calc["gst_rate"]
        draft.base_amount = gst_calc["base_amount"]
        draft.cgst_amount = gst_calc["cgst_amount"]
        draft.sgst_amount = gst_calc["sgst_amount"]
        draft.igst_amount = gst_calc["igst_amount"]
        draft.cess_amount = gst_calc["cess_amount"]
        draft.is_intra_state = gst_calc["is_intra_state"]
        draft.tax_type = gst_calc["tax_type"]
        draft.ledger_entries = [AiVoucherLedgerEntry(**e) for e in gst_calc["ledger_entries"]]
        if gst_calc.get("resolved_additional_charges"):
            draft.additional_charges = gst_calc["resolved_additional_charges"]
        if gst_calc.get("items"):
            draft.items = [AiInvoiceItem(**it) for it in gst_calc["items"]]

        await self._update_draft_fields_and_narration(draft)

        session.current_draft = draft
        session.state = "WAITING_CONFIRMATION"
        session.draft_json = await self.generate_target_voucher_json(draft)
        await self.save_session(session)

        item_summary = ", ".join([f"{it.quantity} {it.item_name} @₹{it.rate:,.2f}" for it in draft.items])
        reply = f"I have prepared a draft {voucher_type} for '{draft.party}' with items: {item_summary}. Net amount is ₹{draft.amount:,.2f}. Do you want to save, edit, or cancel?"
        session.history.append({"role": "assistant", "content": reply})
        await self.save_session(session)

        return {
            "reply": reply,
            "draft": draft,
            "state": session.state,
            "draft_json": session.draft_json
        }

    async def _calculate_invoice_gst_entries(
        self,
        party_name: str,
        items: List[Dict[str, Any]],
        voucher_type: str,
        additional_charges: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        # 1. Resolve company state
        comp_state = "Madhya Pradesh"
        comp_gstin = "23AAFFF9731L1Z7"
        company = await self.db["companies"].find_one()
        if company:
            gst_details = company.get("gstDetails") or {}
            comp_gstin = gst_details.get("gstin") or comp_gstin
            if len(comp_gstin) >= 2:
                prefix = comp_gstin[:2]
                comp_state = STATE_CODES.get(prefix) or gst_details.get("gstState") or comp_state
            else:
                comp_state = gst_details.get("gstState") or comp_state

        # 2. Resolve party state
        party_state = comp_state
        party_gstin = ""
        party_ledger = await self.db["ledgers"].find_one({"ledgerName": party_name})
        if party_ledger:
            pd = party_ledger.get("partyDetails") or {}
            party_gstin = pd.get("gstin") or party_ledger.get("gstin") or ""
            gst_state = pd.get("gstState") or ""
            if not gst_state and party_gstin and len(party_gstin) >= 2:
                prefix = party_gstin[:2]
                gst_state = STATE_CODES.get(prefix, "")
            party_state = gst_state or comp_state

        # 3. Separate additional charges into sales_entries (non-tax) and calc_additional_charges (tax)
        sales_entries = []
        calc_additional_charges = []
        for charge in (additional_charges or []):
            name = charge.get("ledger_name") or charge.get("ledgerName") or ""
            name_upper = name.upper()
            is_tax = any(tok in name_upper for tok in ["CGST", "SGST", "IGST", "UTGST", "CESS"])
            if is_tax:
                calc_additional_charges.append({
                    "ledgerName": name,
                    "amount": float(charge.get("amount") or 0.0)
                })
            else:
                sales_entries.append({
                    "ledgerName": name,
                    "amount": float(charge.get("amount") or 0.0),
                    "gstRate": 0.0
                })

        # 4. Map items to inventory_entries format expected by calculate_taxes
        inventory_entries = []
        for item in items:
            inventory_entries.append({
                "stockItem": item.get("item_name") or item.get("stockItem") or "",
                "amount": float(item.get("amount") or 0.0),
                "gstRate": float(item.get("gst_rate") or item.get("gstRate") or 0.0),
                "taxRate": float(item.get("gst_rate") or item.get("gstRate") or 0.0),
                "taxabilityType": "Taxable",
                "rcm": False,
                "cessRate": 0.0,
                "billQuantity": float(item.get("quantity") or item.get("billQuantity") or 0.0),
                "billRate": float(item.get("rate") or item.get("billRate") or 0.0),
                "discountPercent": float(item.get("discount_percent") or item.get("discountPercent") or 0.0),
                "hsnSacCode": item.get("hsn") or item.get("hsnSacCode") or "",
                "unit": item.get("unit") or "",
                "description": item.get("description") or ""
            })

        # 5. Call calculate_taxes
        v_type_lower = voucher_type.lower()
        vch_type_for_calc = "sales_invoice"
        if "purchase" in v_type_lower:
            vch_type_for_calc = "purchase_invoice"
        elif "credit" in v_type_lower:
            vch_type_for_calc = "credit_note"
        elif "debit" in v_type_lower:
            vch_type_for_calc = "debit_note"

        tax_results = calculate_taxes(
            company_state=comp_state,
            party_state=party_state,
            sales_entries=sales_entries,
            inventory_entries=inventory_entries,
            tcs_amount=0.0,
            round_off_amount=0.0,
            additional_charges=calc_additional_charges,
            tds_amount=0.0,
            voucher_type=vch_type_for_calc
        )

        # 6. Retrieve computed amounts
        total_invoice_amount = tax_results["grandTotal"]
        cgst_amt = tax_results["cgstAmount"]
        sgst_amt = tax_results["sgstAmount"]
        igst_amt = tax_results["igstAmount"]
        cess_amt = tax_results["cessAmount"]
        base_amount = tax_results["baseAmount"]
        
        # Calculate max gst_rate percentage for the draft metadata
        gst_rate = max([float(item.get("gstRate") or 18.0) for item in inventory_entries]) if inventory_entries else 18.0
        is_intrastate = tax_results["isIntraState"]

        # 7. Construct ledger entries for double entry
        ledger_entries = []
        is_sales_like = v_type_lower in ["sales", "credit note", "credit_note"]
        is_sales = v_type_lower == "sales"
        is_debit_note = v_type_lower in ["debit note", "debit_note"]
        use_output_ledgers = is_sales_like
        party_is_debit = is_sales or is_debit_note
        other_accounts_is_debit = not party_is_debit

        # Party Ledger entry
        ledger_entries.append({
            "ledger_name": party_name,
            "is_debit": party_is_debit,
            "amount": total_invoice_amount
        })

        # Sales/Purchase Account entry
        sales_pur_group = "Sales Accounts" if is_sales_like else "Purchase Accounts"
        resolved_sales_pur = await self._resolve_ledger_name("", sales_pur_group)
        total_item_amount = sum(float(item.get("amount") or 0.0) for item in items)
        ledger_entries.append({
            "ledger_name": resolved_sales_pur,
            "is_debit": other_accounts_is_debit,
            "amount": total_item_amount
        })

        # Tax ledgers entries (CGST, SGST, IGST)
        if is_intrastate:
            cgst_ledger = "Output CGST" if use_output_ledgers else "CGST Carry Forward"
            sgst_ledger = "Output SGST" if use_output_ledgers else "SGST Carry Forward"
            if cgst_amt > 0:
                ledger_entries.append({"ledger_name": cgst_ledger, "is_debit": other_accounts_is_debit, "amount": cgst_amt})
            if sgst_amt > 0:
                ledger_entries.append({"ledger_name": sgst_ledger, "is_debit": other_accounts_is_debit, "amount": sgst_amt})
        else:
            igst_ledger = "Output IGST" if use_output_ledgers else "IGST Carry Forward"
            if igst_amt > 0:
                ledger_entries.append({"ledger_name": igst_ledger, "is_debit": other_accounts_is_debit, "amount": igst_amt})

        # Non-tax additional charges ledger entries (Freight, Packing, etc.)
        for entry in sales_entries:
            ledger_entries.append({
                "ledger_name": entry["ledgerName"],
                "is_debit": other_accounts_is_debit,
                "amount": entry["amount"]
            })

        # Cess tax ledger entry (if cess_amt > 0)
        cess_ledger = "Cess Charges"
        for c in (additional_charges or []):
            c_name = c.get("ledger_name") or c.get("ledgerName") or ""
            if "CESS" in c_name.upper():
                cess_ledger = c_name
                break
        if cess_amt > 0:
            ledger_entries.append({
                "ledger_name": cess_ledger,
                "is_debit": other_accounts_is_debit,
                "amount": cess_amt
            })

        # 8. Construct resolved_additional_charges array with is_tax field
        resolved_additional_charges = []
        
        # Add non-tax charges (marked as is_tax: False)
        for c in sales_entries:
            resolved_additional_charges.append({
                "ledger_name": c["ledgerName"],
                "amount": c["amount"],
                "taxable_value": 0.0,
                "is_tax": False
            })

        # Add Cess tax charges if calculated (marked as is_tax: True)
        if cess_amt > 0 or any("CESS" in (c.get("ledger_name") or c.get("ledgerName") or "").upper() for c in (additional_charges or [])):
            resolved_additional_charges.append({
                "ledger_name": cess_ledger,
                "amount": cess_amt if cess_amt > 0 else 0.0,
                "taxable_value": base_amount,
                "is_tax": True
            })

        # Add CGST/SGST/IGST tax charges (marked as is_tax: True)
        if is_intrastate:
            cgst_ledger = "Output CGST" if use_output_ledgers else "CGST Carry Forward"
            sgst_ledger = "Output SGST" if use_output_ledgers else "SGST Carry Forward"
            if cgst_amt > 0:
                resolved_additional_charges.append({
                    "ledger_name": cgst_ledger,
                    "amount": cgst_amt,
                    "taxable_value": base_amount,
                    "is_tax": True
                })
            if sgst_amt > 0:
                resolved_additional_charges.append({
                    "ledger_name": sgst_ledger,
                    "amount": sgst_amt,
                    "taxable_value": base_amount,
                    "is_tax": True
                })
        else:
            igst_ledger = "Output IGST" if use_output_ledgers else "IGST Carry Forward"
            if igst_amt > 0:
                resolved_additional_charges.append({
                    "ledger_name": igst_ledger,
                    "amount": igst_amt,
                    "taxable_value": base_amount,
                    "is_tax": True
                })

        updated_items = []
        for entry in tax_results.get("inventoryEntries", []):
            updated_items.append({
                "item_name": entry.get("stockItem"),
                "quantity": entry.get("billQuantity") or 0.0,
                "rate": entry.get("billRate") or 0.0,
                "amount": entry.get("amount") or 0.0,
                "gst_rate": entry.get("gstRate") or 0.0,
                "discount_percent": entry.get("discountPercent") or 0.0,
                "hsn": entry.get("hsnSacCode") or "",
                "unit": entry.get("unit") or "",
                "description": entry.get("description") or "",
                "ratio": entry.get("ratio") or 0.0,
                "distributedCharge": entry.get("distributedCharge") or 0.0,
                "taxableAmount": entry.get("taxableAmount") or 0.0,
                "cgst": entry.get("cgst") or 0.0,
                "sgst": entry.get("sgst") or 0.0,
                "igst": entry.get("igst") or 0.0,
                "cess": entry.get("cess") or 0.0,
                "totalTax": entry.get("totalTax") or 0.0
            })

        return {
            "total_amount": total_invoice_amount,
            "gst_rate": gst_rate,
            # Full calculate_taxes results — store these on draft to avoid re-derivation
            "base_amount": base_amount,
            "cgst_amount": cgst_amt,
            "sgst_amount": sgst_amt,
            "igst_amount": igst_amt,
            "cess_amount": cess_amt,
            "is_intra_state": is_intrastate,
            "tax_type": "CGST_SGST" if is_intrastate else "IGST",
            "ledger_entries": ledger_entries,
            "resolved_additional_charges": resolved_additional_charges,
            "items": updated_items
        }


    async def _handle_sales_debit_note_updates(self, session: ChatSession, user_message: str, parsed: Dict[str, Any], voucher_type: str) -> Dict[str, Any]:
        draft = session.current_draft
        if not draft:
            reply = "There is no draft voucher to update. Tell me what you want to create first."
            session.history.append({"role": "assistant", "content": reply})
            await self.save_session(session)
            return {"reply": reply, "draft": None, "state": session.state}

        user_msg_lower = user_message.lower()
        updated = False
        reply_msg = ""

        if "cash" in user_msg_lower or "make it cash" in user_msg_lower:
            cash_ledger = await self._resolve_ledger_name("Cash", "Cash-in-Hand")
            draft.party = cash_ledger
            draft.debit = cash_ledger if voucher_type.lower() == "sales" else draft.debit
            draft.credit = cash_ledger if voucher_type.lower() == "debit note" else draft.credit
            session.metadata["party"] = cash_ledger
            updated = True
            reply_msg = "Updated party to Cash sale."
        elif "change customer to" in user_msg_lower or "change party to" in user_msg_lower or "change supplier to" in user_msg_lower:
            match = re.search(r"(?:customer|party|supplier)\s+to\s+([a-zA-Z0-9\s\.\-\&]+)", user_message, re.IGNORECASE)
            if match:
                new_party = match.group(1).strip()
                party_ledger = await self._search_party_master(new_party, voucher_type)
                if party_ledger:
                    draft.party = party_ledger["ledgerName"]
                    draft.debit = party_ledger["ledgerName"] if voucher_type.lower() == "sales" else draft.debit
                    draft.credit = party_ledger["ledgerName"] if voucher_type.lower() == "debit note" else draft.credit
                    session.metadata["party"] = party_ledger["ledgerName"]
                    updated = True
                    reply_msg = f"Updated party to '{party_ledger['ledgerName']}'."
                else:
                    reply_msg = f"Could not find customer/supplier '{new_party}' in database."

        elif "quantity to" in user_msg_lower or "change quantity" in user_msg_lower:
            qty_match = re.search(r"quantity\s+(?:to\s+)?(\d+)", user_msg_lower)
            if qty_match:
                new_qty = float(qty_match.group(1))
                target_item = None
                if len(draft.items) == 1:
                    target_item = draft.items[0]
                else:
                    for it in draft.items:
                        if it.item_name.lower() in user_msg_lower:
                            target_item = it
                            break
                            
                if target_item:
                    target_item.quantity = new_qty
                    target_item.amount = (target_item.quantity * target_item.rate) * (1 - target_item.discount_percent / 100.0)
                    updated = True
                    reply_msg = f"Updated quantity of '{target_item.item_name}' to {int(new_qty)}."
                else:
                    reply_msg = "Which item's quantity would you like to update?"

        elif "remove" in user_msg_lower or "delete" in user_msg_lower:
            target_name = ""
            for word in ["remove", "delete"]:
                if word in user_msg_lower:
                    parts = user_msg_lower.split(word)
                    if len(parts) > 1:
                        target_name = parts[1].strip()
            
            if target_name:
                initial_count = len(draft.items)
                draft.items = [it for it in draft.items if target_name not in it.item_name.lower()]
                if len(draft.items) < initial_count:
                    updated = True
                    reply_msg = f"Removed '{target_name}' from items."
                else:
                    reply_msg = f"Could not find item matching '{target_name}' in the draft."
            else:
                reply_msg = "Which item would you like to remove?"

        elif "discount" in user_msg_lower:
            pct_match = re.search(r"(\d+)%", user_msg_lower)
            if pct_match:
                discount_pct = float(pct_match.group(1))
                for it in draft.items:
                    it.discount_percent = discount_pct
                    it.amount = (it.quantity * it.rate) * (1 - discount_pct / 100.0)
                updated = True
                reply_msg = f"Applied {int(discount_pct)}% discount to all items."

        if not updated and parsed.get("updated_fields"):
            updated_fields = parsed["updated_fields"]
            draft_dict = draft.model_dump()
            for field, val in updated_fields.items():
                if field in draft_dict:
                    if field == "amount":
                        draft_dict[field] = float(val)
                    elif field in ["debit", "credit"]:
                        draft_dict[field] = await self._resolve_ledger_name(val, "")
                    else:
                        draft_dict[field] = val
                    updated = True
            if updated:
                draft = AiVoucherDraft(**draft_dict)
                reply_msg = "Updated voucher details."

        if updated:
            gst_calc = await self._calculate_invoice_gst_entries(
                draft.party, [item.model_dump() for item in draft.items], draft.voucher_type,
                additional_charges=draft.additional_charges or []
            )
            # Store all tax results from calculate_taxes — single source of truth
            draft.amount = gst_calc["total_amount"]
            draft.gst_rate = gst_calc["gst_rate"]
            draft.base_amount = gst_calc["base_amount"]
            draft.cgst_amount = gst_calc["cgst_amount"]
            draft.sgst_amount = gst_calc["sgst_amount"]
            draft.igst_amount = gst_calc["igst_amount"]
            draft.cess_amount = gst_calc["cess_amount"]
            draft.is_intra_state = gst_calc["is_intra_state"]
            draft.tax_type = gst_calc["tax_type"]
            draft.ledger_entries = [AiVoucherLedgerEntry(**e) for e in gst_calc["ledger_entries"]]
            if gst_calc.get("resolved_additional_charges"):
                draft.additional_charges = gst_calc["resolved_additional_charges"]
            if gst_calc.get("items"):
                draft.items = [AiInvoiceItem(**it) for it in gst_calc["items"]]
            
            session.current_draft = draft
            session.state = "WAITING_CONFIRMATION"
            session.draft_json = await self.generate_target_voucher_json(draft)
            await self.save_session(session)
            reply = f"{reply_msg} Recalculated total is ₹{draft.amount:,.2f}. Do you want to save, edit, or cancel?"
        else:
            reply = reply_msg or "I couldn't identify what you want to update. Please try specifying clearly."
            
        session.history.append({"role": "assistant", "content": reply})
        await self.save_session(session)
        return {
            "reply": reply,
            "draft": draft,
            "state": session.state,
            "draft_json": session.draft_json
        }

    async def get_erp_capabilities_metadata(self) -> Dict[str, Any]:
        collections = await self.db.list_collection_names()
        
        # Voucher Types from DB
        voucher_types_cursor = self.db["voucherTypes"].find({})
        vts = await voucher_types_cursor.to_list(length=100)
        voucher_types = list(set([v["voucherTypeName"] for v in vts if v.get("voucherTypeName")] + ["Sales", "Purchase", "Payment", "Receipt", "Contra", "Credit Note", "Debit Note"]))
        
        features = []
        if "sales_vouchers" in collections:
            features.append("Sales Voucher (Invoicing)")
        if "purchase_vouchers" in collections:
            features.append("Purchase Voucher (Billing)")
        if "fund_flow_vouchers" in collections:
            features.append("Payment Voucher")
            features.append("Receipt Voucher")
            features.append("Contra Voucher")
        if "stockItems" in collections:
            features.append("Inventory Management")
        if "GST" in collections:
            features.append("GST Calculations & Tax Ledgers")
        if "ledgers" in collections:
            features.append("Ledger Management (Customers & Suppliers)")
        if "costCenters" in collections:
            features.append("Cost Centers")
            
        features.extend([
            "AI Text-to-Entry (natural language parsing)",
            "OCR Invoice/Receipt Upload (coming soon/available)",
            "Bulk Upload",
            "Approval Workflow & Status Tracking",
            "Tally Export & Sync"
        ])
        
        return {
            "available_voucher_types": voucher_types,
            "features": features,
            "database_modules": collections
        }

    async def _handle_capability_question(self, session: ChatSession, user_message: str) -> Dict[str, Any]:
        meta = await self.get_erp_capabilities_metadata()
        reply = llm_service.generate_capability_answer(user_message, meta)
        session.history.append({"role": "assistant", "content": reply})
        await self.save_session(session)
        return {
            "reply": reply,
            "draft": session.current_draft,
            "state": session.state
        }

    async def _handle_question(self, session: ChatSession, parsed: Dict[str, Any], user_message: str) -> Dict[str, Any]:
        report_reply = await self.report_service.handle_business_query(user_message)
        if report_reply:
            session.history.append({"role": "assistant", "content": report_reply})
            await self.save_session(session)
            return {
                "reply": report_reply,
                "draft": session.current_draft,
                "state": session.state
            }

        query_type = parsed.get("query_type")
        
        # Check for capability questions
        if query_type == "capability_question" or any(kw in user_message.lower() for kw in ["what can you do", "accounting features", "how can you help", "how do i create"]):
            return await self._handle_capability_question(session, user_message)

        ledger_name = parsed.get("ledger")
        db_data = None
        
        if query_type == "ledger_balance" and ledger_name:
            doc = await self.db["ledgers"].find_one({"ledgerName": {"$regex": f"^{ledger_name}$", "$options": "i"}})
            if doc:
                db_data = {
                    "ledger_name": doc["ledgerName"],
                    "group": doc["groupName"],
                    "balance": doc.get("balances", {}).get("openingBalance", {}).get("amount", 0.0)
                }
            else:
                db_data = {"error": f"Ledger '{ledger_name}' was not found in the database."}
                
        elif query_type == "list_vouchers":
            docs = await self.db["sales_vouchers"].find({"isDeleted": {"$ne": True}}).limit(20).to_list(length=20)
            db_data = [{"voucherNumber": d.get("voucherNumber"), "party": d.get("partyLedgerName"), "grandTotal": d.get("grandTotal"), "date": d.get("voucherDate")} for d in docs]
            
        elif query_type == "highest_outstanding":
            docs = await self.db["ledgers"].find({"groupName": {"$in": ["Sundry Debtors", "Sundry Creditors"]}}).to_list(length=100)
            db_data = [{"ledgerName": d.get("ledgerName"), "groupName": d.get("groupName"), "openingBalance": d.get("balances", {}).get("openingBalance", {})} for d in docs]
            
        elif query_type == "total_sales_today":
            today_str = datetime.date.today().strftime('%Y-%m-%d')
            docs = await self.db["sales_vouchers"].find({"voucherDate": today_str, "isDeleted": {"$ne": True}}).to_list(length=100)
            total = sum(d.get("grandTotal") or 0.0 for d in docs)
            db_data = {
                "date": today_str,
                "sales_count": len(docs),
                "total_sales_amount": total
            }
        else:
            ledgers = await self.db["ledgers"].find({}).limit(100).to_list(length=100)
            items = await self.db["stockItems"].find({}).limit(100).to_list(length=100)
            vouchers = await self.db["sales_vouchers"].find({"isDeleted": {"$ne": True}}).limit(10).to_list(length=10)
            
            total_ledgers_count = await self.db["ledgers"].count_documents({})
            total_items_count = await self.db["stockItems"].count_documents({})
            
            db_data = {
                "total_ledgers_in_database": total_ledgers_count,
                "total_stock_items_in_database": total_items_count,
                "ledgers": [{"name": l.get("ledgerName"), "group": l.get("groupName")} for l in ledgers],
                "items": [{"name": i.get("itemName"), "gst_rate": i.get("gstSettings", {}).get("gstRate") or 18.0} for i in items],
                "recent_vouchers": [{"number": v.get("voucherNumber"), "party": v.get("partyLedgerName"), "total": v.get("grandTotal")} for v in vouchers]
            }

        reply = llm_service.generate_answer(user_message, db_data)
        session.history.append({"role": "assistant", "content": reply})
        await self.save_session(session)
        
        return {
            "reply": reply,
            "draft": session.current_draft,
            "state": session.state
        }

    async def _update_draft_fields_and_narration(self, draft: AiVoucherDraft):
        v_type_lower = draft.voucher_type.lower()
        if v_type_lower in ["payment", "payment voucher", "receipt", "receipt voucher", "contra", "contra voucher"]:
            if draft.party:
                if not draft.items:
                    draft.items = [
                        AiInvoiceItem(
                            item_name=draft.party,
                            quantity=1.0,
                            rate=draft.amount or 0.0,
                            amount=draft.amount or 0.0,
                            discount_percent=0.0,
                            gst_rate=0.0,
                            description=draft.narration or ""
                        )
                    ]
                else:
                    if len(draft.items) == 1:
                        item = draft.items[0]
                        if item.item_name != draft.party or item.amount != (draft.amount or 0.0):
                            item.item_name = draft.party
                            item.amount = draft.amount or 0.0
                            item.rate = draft.amount or 0.0

        if not draft.voucher_number:
            from app.anjalee.repositories.sales_repo import SalesVoucherRepository
            sales_repo = SalesVoucherRepository(self.db)
            voucher_type_raw = draft.voucher_type.lower().replace(" ", "_")
            prefix_map = {
                "sales": "SI",
                "sales_invoice": "SI",
                "purchase": "PI",
                "purchase_invoice": "PI",
                "credit_note": "CN",
                "debit_note": "DN",
                "payment": "PAY",
                "payment_voucher": "PAY",
                "receipt": "RCT",
                "receipt_voucher": "RCT",
                "contra": "CON",
                "contra_voucher": "CON"
            }
            prefix = prefix_map.get(voucher_type_raw, "SV")
            seq = await sales_repo.get_dynamic_next_sequence(voucher_type_raw, prefix, consume=False)
            import datetime
            year = datetime.datetime.now().year
            draft.voucher_number = f"{prefix}-{year}-{str(seq).zfill(4)}"

        v_type_lower = draft.voucher_type.lower()
        if not draft.narration or draft.narration.startswith("Being "):
            if v_type_lower in ["sales", "credit note", "credit_note"]:
                if not draft.items:
                    draft.narration = f"Being sales voucher created for {draft.party}"
                else:
                    item_summaries = []
                    for it in draft.items:
                        qty_str = f"{it.quantity:g}"
                        item_summaries.append(f"{qty_str} {it.item_name} @ ₹{it.rate:,.2f}")
                    items_text = ", ".join(item_summaries)
                    draft.narration = f"Being sales of {items_text} to {draft.party}"
            elif v_type_lower in ["purchase", "debit note", "debit_note"]:
                if not draft.items:
                    draft.narration = f"Being purchase voucher created for {draft.party}"
                else:
                    item_summaries = []
                    for it in draft.items:
                        qty_str = f"{it.quantity:g}"
                        item_summaries.append(f"{qty_str} {it.item_name} @ ₹{it.rate:,.2f}")
                    items_text = ", ".join(item_summaries)
                    draft.narration = f"Being purchase of {items_text} from {draft.party}"
            elif "payment" in v_type_lower:
                draft.narration = f"Being payment of ₹{draft.amount:,.2f} made to {draft.party}"
            elif "receipt" in v_type_lower:
                draft.narration = f"Being receipt of ₹{draft.amount:,.2f} received from {draft.party}"
            elif "contra" in v_type_lower:
                draft.narration = f"Being fund transfer from {draft.credit} to {draft.debit} of ₹{draft.amount:,.2f}"
            else:
                draft.narration = f"Being voucher created for {draft.party}"

            if draft.voucher_number:
                draft.narration += f" vide Ref No. {draft.voucher_number}"

    async def generate_target_voucher_json(self, draft: AiVoucherDraft) -> Dict[str, Any]:
        v_num = draft.voucher_number
        if not v_num:
            from app.anjalee.repositories.sales_repo import SalesVoucherRepository
            sales_repo = SalesVoucherRepository(self.db)
            voucher_type_raw = draft.voucher_type.lower().replace(" ", "_")
            prefix_map = {
                "sales": "SI",
                "sales_invoice": "SI",
                "purchase": "PI",
                "purchase_invoice": "PI",
                "credit_note": "CN",
                "debit_note": "DN",
                "payment": "PAY",
                "payment_voucher": "PAY",
                "receipt": "RCT",
                "receipt_voucher": "RCT",
                "contra": "CON",
                "contra_voucher": "CON"
            }
            prefix = prefix_map.get(voucher_type_raw, "SV")
            seq = await sales_repo.get_dynamic_next_sequence(voucher_type_raw, prefix, consume=False)
            import datetime
            year = datetime.datetime.now().year
            v_num = f"{prefix}-{year}-{str(seq).zfill(4)}"
            draft.voucher_number = v_num

        comp_state = "Madhya Pradesh"
        comp_gstin = "23AAFFF9731L1Z7"
        comp_id = ""
        
        company = await self.db["companies"].find_one()
        if company:
            comp_id = str(company.get("_id"))
            comp_gstin = company.get("gstDetails", {}).get("gstin") or comp_gstin
            comp_state = company.get("gstDetails", {}).get("gstState") or comp_state

        party_state = comp_state
        party_gstin = ""
        party_id = ""
        
        party_ledg = await self.db["ledgers"].find_one({"ledgerName": draft.party})
        if party_ledg:
            party_id = str(party_ledg.get("_id"))
            party_gstin = party_ledg.get("partyDetails", {}).get("gstin") or ""
            party_state = party_ledg.get("partyDetails", {}).get("gstState") or party_state

        is_intra = (comp_gstin[:2] == party_gstin[:2]) if party_gstin else True

        draft.entry_mode = "item_invoice" if draft.items else "accounting"
        v_type_lower = draft.voucher_type.lower()
        if v_type_lower in ["sales", "sales voucher", "credit note", "credit_note"]:
            sales_entries = []
            inv_entries = []
            
            if draft.entry_mode == "item_invoice":
                for item in draft.items:
                    inv_entries.append({
                        "stockItem": item.item_name,
                        "description": f"Sales of {item.item_name}",
                        "hsnSacCode": "4819",
                        "billQuantity": float(item.quantity),
                        "billRate": float(item.rate),
                        "discountPercent": float(item.discount_percent),
                        "amount": float(item.amount),
                        "rcm": False,
                        "taxabilityType": "Taxable",
                        "gstRate": float(item.gst_rate) if item.gst_rate else (draft.gst_rate or 18.0)
                    })
                # Add non-tax additional charges to salesEntries (matching manual form logic)
                for c in (draft.additional_charges or []):
                    c_name = c.get("ledger_name") or c.get("ledgerName") or ""
                    is_tax = c.get("is_tax", False) or any(tok in c_name.upper() for tok in ["CGST", "SGST", "IGST", "UTGST", "CESS"])
                    if not is_tax:
                        sales_entries.append({
                            "ledgerId": None,
                            "ledgerName": c_name,
                            "description": "",
                            "hsnSacCode": "",
                            "gstRate": 0.0,
                            "amount": float(c.get("amount") or 0.0)
                        })
            else:
                sales_entries.append({
                    "ledgerName": draft.credit,
                    "description": draft.narration,
                    "hsnSacCode": None,
                    "gstRate": float(draft.gst_rate) if draft.gst_rate else 18.0,
                    "amount": float(draft.amount)
                })

            v_type_val = "credit_note" if "credit" in v_type_lower else "sales_invoice"
            # Use tax results stored on draft by calculate_taxes — no inline re-derivation
            return {
                "companyId": comp_id,
                "voucherNumber": draft.voucher_number or "",
                "voucherDate": draft.date,
                "voucherType": v_type_val,
                "voucherSeries": "Default",
                "invoiceNumber": "",
                "referenceNumber": "",
                "creditNoteDate": None,
                "salesLedger": draft.credit,
                "consigneeLedger": draft.party,
                "consigneeGstin": party_gstin,
                "partyLedgerId": party_id,
                "partyLedgerName": draft.party,
                "partyGSTIN": party_gstin,
                "gstRegistrationType": "Regular" if party_gstin else "Consumer",
                "partyState": party_state,
                "companyState": comp_state,
                "isIntraState": draft.is_intra_state,
                "taxType": draft.tax_type,
                "baseAmount": float(draft.base_amount),
                "cgstAmount": float(draft.cgst_amount),
                "sgstAmount": float(draft.sgst_amount),
                "igstAmount": float(draft.igst_amount),
                "cessAmount": float(draft.cess_amount),
                "tcsAmount": 0.0,
                "roundOffAmount": 0.0,
                "grandTotal": float(draft.amount),
                "entryTab": "with_item" if draft.entry_mode == "item_invoice" else "without_item",
                "gstRegistration": party_gstin,
                "entryMode": draft.entry_mode,
                "ocrMetadata": {},
                "bulkMetadata": {},
                "salesEntries": sales_entries,
                "inventoryEntries": inv_entries,
                "additionalCharges": [
                    {
                        "ledgerName": c.get("ledger_name") or c.get("ledgerName"),
                        "amount": float(c.get("amount") or 0.0),
                        "taxableValue": float(c.get("taxable_value") or 0.0)
                    }
                    for c in (draft.additional_charges or [])
                    if c.get("is_tax", False) or any(tok in (c.get("ledger_name") or c.get("ledgerName") or "").upper() for tok in ["CGST", "SGST", "IGST", "UTGST", "CESS"])
                ],
                "tcsDetails": [],
                "tdsDetails": [],
                "gstSummary": {
                    "taxableValue": float(draft.base_amount),
                    "cgst": float(draft.cgst_amount),
                    "sgst": float(draft.sgst_amount),
                    "igst": float(draft.igst_amount),
                    "cess": float(draft.cess_amount)
                },
                "narration": draft.narration,
                "status": "DRAFT"
            }

        elif v_type_lower in ["purchase", "purchase voucher", "debit note", "debit_note"]:
            prod_lines = []
            pur_lines = []
            if draft.entry_mode == "item_invoice":
                for idx, item in enumerate(draft.items):
                    prod_lines.append({
                        "srNo": idx + 1,
                        "stockItem": item.item_name,
                        "description": f"Purchase of {item.item_name}",
                        "hsnSacCode": "4819",
                        "billQuantity": float(item.quantity),
                        "billRate": float(item.rate),
                        "discountPercent": float(item.discount_percent),
                        "amount": float(item.amount),
                        "rcm": False,
                        "taxabilityType": "Taxable",
                        "gstRate": float(item.gst_rate) if item.gst_rate else (draft.gst_rate or 18.0)
                    })
                # Add non-tax additional charges to purchaseLines (matching manual form logic)
                for c in (draft.additional_charges or []):
                    c_name = c.get("ledger_name") or c.get("ledgerName") or ""
                    is_tax = c.get("is_tax", False) or any(tok in c_name.upper() for tok in ["CGST", "SGST", "IGST", "UTGST", "CESS"])
                    if not is_tax:
                        pur_lines.append({
                            "srNo": len(pur_lines) + 1,
                            "purchaseLedger": c_name,
                            "description": "",
                            "hsnSacCode": "",
                            "gstRate": 0.0,
                            "amount": float(c.get("amount") or 0.0)
                        })
            else:
                pur_lines.append({
                    "srNo": 1,
                    "purchaseLedger": draft.credit,
                    "description": draft.narration,
                    "hsnSacCode": None,
                    "amount": float(draft.amount),
                    "gstRate": float(draft.gst_rate) if draft.gst_rate else 18.0
                })

            v_type_val = "debit_note" if "debit" in v_type_lower else "purchase_invoice"
            # Use tax results stored on draft by calculate_taxes — no inline re-derivation
            return {
                "companyId": comp_id,
                "voucherNumber": draft.voucher_number or "",
                "voucherNumberSeries": "General",
                "voucherType": v_type_val,
                "voucherDate": draft.date,
                "invoiceNumber": "",
                "invoiceDate": draft.date,
                "poNumber": "",
                "debitNoteDate": None,
                "referenceNumber": "",
                "partyLedger": draft.party,
                "partyGstin": party_gstin,
                "purchaseLedger": draft.credit,
                "consigneeLedger": draft.party,
                "consigneeGstin": party_gstin,
                "gstRegistration": party_gstin,
                "gstRegistrationType": "Regular" if party_gstin else "Consumer",
                "partyState": party_state,
                "companyState": comp_state,
                "isIntraState": draft.is_intra_state,
                "taxType": draft.tax_type,
                "baseAmount": float(draft.base_amount),
                "cgstAmount": float(draft.cgst_amount),
                "sgstAmount": float(draft.sgst_amount),
                "igstAmount": float(draft.igst_amount),
                "cessAmount": float(draft.cess_amount),
                "tcsAmount": 0.0,
                "roundOffAmount": 0.0,
                "entryTab": "with_item" if draft.entry_mode == "item_invoice" else "without_item",
                "grandTotal": float(draft.amount),
                "narration": draft.narration,
                "status": "DRAFT",
                "entryMode": draft.entry_mode,
                "ocrMetadata": {},
                "bulkMetadata": {},
                "productLines": prod_lines,
                "purchaseLines": pur_lines,
                "additionalCharges": [
                    {
                        "ledgerName": c.get("ledger_name") or c.get("ledgerName"),
                        "amount": float(c.get("amount") or 0.0),
                        "taxableValue": float(c.get("taxable_value") or 0.0)
                    }
                    for c in (draft.additional_charges or [])
                    if c.get("is_tax", False) or any(tok in (c.get("ledger_name") or c.get("ledgerName") or "").upper() for tok in ["CGST", "SGST", "IGST", "UTGST", "CESS"])
                ],
                "gstSummary": {
                    "taxableValue": float(draft.base_amount),
                    "cgst": float(draft.cgst_amount),
                    "sgst": float(draft.sgst_amount),
                    "igst": float(draft.igst_amount),
                    "cess": float(draft.cess_amount)
                },
                "tdsDetails": [],
                "tcsDetails": []
            }

        elif v_type_lower in ["payment", "payment voucher", "receipt", "receipt voucher", "contra", "contra voucher"]:
            is_cash = "cash" in draft.debit.lower() or "cash" in draft.credit.lower()
            if "payment" in v_type_lower:
                v_type_val = "cash_payment" if is_cash else "bank_payment"
                against = draft.credit
            elif "receipt" in v_type_lower:
                v_type_val = "cash_receipt" if is_cash else "bank_receipt"
                against = draft.debit
            else:
                v_type_val = "contra"
                against = draft.credit
                
            bill_rows = []
            if draft.bill_allocations:
                for alloc in draft.bill_allocations:
                    bill_rows.append({
                        "billNo": alloc.get("bill") or alloc.get("billNo"),
                        "allocationAmount": float(alloc.get("amount") or 0.0)
                    })
            
            ledger_rows = []
            if draft.items:
                for item in draft.items:
                    ledger_rows.append({
                        "ledgerName": item.item_name,
                        "amount": float(item.amount),
                        "description": item.description or draft.narration
                    })
            else:
                ledger_rows = [
                    {
                        "ledgerName": draft.party,
                        "amount": float(draft.amount),
                        "description": draft.narration
                    }
                ]
            
            return {
                "voucherType": v_type_val,
                "voucherDate": draft.date,
                "partyLedger": draft.party,
                "againstLedger": against,
                "amount": float(draft.amount),
                "narration": draft.narration,
                "status": "draft",
                "entryMode": "manual",
                "billRows": bill_rows,
                "ledgerRows": ledger_rows
            }

    async def get_page_load_data(self) -> Dict[str, Any]:
        import datetime
        company = await self.db["companies"].find_one()
        company_name = company.get("companyName") if company else "Friends Grafix Pvt Ltd"
        company_gst = company.get("gstDetails", {}) if company else {}
        
        party_count = await self.db["ledgers"].count_documents({"groupName": {"$in": ["Sundry Debtors", "Sundry Creditors"]}})
        item_count = await self.db["stockItems"].count_documents({})
        ledger_count = await self.db["ledgers"].count_documents({})
        
        # Voucher Types from DB
        voucher_types_cursor = self.db["voucherTypes"].find({})
        voucher_types_docs = await voucher_types_cursor.to_list(length=100)
        voucher_types = list(set([vt.get("voucherTypeName") for vt in voucher_types_docs if vt.get("voucherTypeName")]))
        if not voucher_types:
            voucher_types = ["Sales", "Purchase", "Debit Note", "Credit Note", "Payment", "Receipt", "Contra"]
        
        parties_cursor = self.db["ledgers"].aggregate([
            {"$match": {"groupName": {"$in": ["Sundry Debtors", "Sundry Creditors"]}}},
            {"$sample": {"size": 3}}
        ])
        parties = await parties_cursor.to_list(length=3)
        
        items_cursor = self.db["stockItems"].aggregate([
            {"$sample": {"size": 3}}
        ])
        items = await items_cursor.to_list(length=3)
        
        suggestions = [
            "Create Sales Invoice",
            "Create Purchase Bill",
            "Create Payment Voucher",
            "Create Receipt Voucher"
        ]
        import random
        for p in parties:
            if not items:
                break
            item = random.choice(items)
            qty = random.choice([5, 10, 15, 20, 50, 100])
            p_name = p["ledgerName"]
            i_name = item["itemName"]
            
            if p.get("groupName") == "Sundry Debtors":
                suggestions.append(f"Create sales invoice for {p_name} with {qty} {i_name}")
            else:
                suggestions.append(f"Create purchase bill from {p_name} with {qty} {i_name}")
                
        if parties:
            p_name = random.choice(parties)["ledgerName"]
            amt = random.choice([5000, 12000, 25000, 75000])
            suggestions.append(f"Create payment of {amt} to {p_name}")

        greetings = [
            "Hello! I am ready to create a voucher. Please describe the transaction.",
            "Welcome! How can I assist you with your accounting today? Describe your transaction.",
            "Hi! Ready to record a new entry? Tell me the details of the transaction.",
            "Hello! I am ready to record a new voucher. Please tell me what you want to create."
        ]
        welcome_message = random.choice(greetings)
        if parties and items:
            p_sample = random.choice(parties)["ledgerName"]
            i_sample = random.choice(items)["itemName"]
            qty_sample = random.choice([5, 10, 12, 15, 20])
            welcome_message += f' Please describe the transaction (e.g. "Create sales invoice for {p_sample} with {qty_sample} {i_sample}").'
        else:
            welcome_message += ' Please describe the transaction (e.g. "Create sales invoice for ABC Traders with 5 Laptops").'
        
        cursor_sessions = self.db["ai_sessions"].find().sort("updated_at", -1).limit(20)
        sessions_docs = await cursor_sessions.to_list(length=20)
        conversations = []
        for s in sessions_docs:
            draft = s.get("current_draft") or {}
            preview = ""
            if s.get("history"):
                user_msgs = [m for m in s["history"] if m.get("role") == "user"]
                if user_msgs:
                    preview = user_msgs[-1].get("content", "")
            
            conversations.append({
                "id": s["session_id"],
                "title": draft.get("party") or s.get("metadata", {}).get("temp_party") or "New Voucher Chat",
                "voucherType": draft.get("voucher_type") or "Pending",
                "status": draft.get("status") or "Draft",
                "date": s["updated_at"].strftime("%d %b %Y") if s.get("updated_at") else "Just now",
                "preview": preview or "Describe transaction..."
            })
            
        recent_sales = await self.db["sales_vouchers"].find({"isDeleted": {"$ne": True}}).sort("createdAt", -1).limit(10).to_list(length=10)
        recent_purchase = await self.db["purchase_vouchers"].find({"isDeleted": {"$ne": True}}).sort("createdAt", -1).limit(10).to_list(length=10)
        
        voucher_history = []
        for v in recent_sales:
            voucher_history.append({
                "id": str(v["_id"]),
                "voucherNumber": v.get("voucherNumber", ""),
                "party": v.get("partyLedgerName", ""),
                "voucherType": "Sales Voucher",
                "amount": v.get("grandTotal", 0.0),
                "date": v.get("voucherDate", ""),
                "status": v.get("status", "Draft")
            })
        for v in recent_purchase:
            voucher_history.append({
                "id": str(v["_id"]),
                "voucherNumber": v.get("voucherNumber", ""),
                "party": v.get("partyLedger", ""),
                "voucherType": "Debit Note" if v.get("voucherType") == "debit_note" else "Purchase Bill",
                "amount": v.get("grandTotal", 0.0),
                "date": v.get("voucherDate", ""),
                "status": v.get("status", "Draft")
            })
            
        all_parties_cursor = self.db["ledgers"].find({"groupName": {"$in": ["Sundry Debtors", "Sundry Creditors"]}}, {"ledgerName": 1})
        all_parties_docs = await all_parties_cursor.to_list(length=1000)
        all_parties = [p["ledgerName"] for p in all_parties_docs]
        
        all_ledgers_cursor = self.db["ledgers"].find({}, {"ledgerName": 1})
        all_ledgers_docs = await all_ledgers_cursor.to_list(length=1000)
        all_ledgers = [l["ledgerName"] for l in all_ledgers_docs]
        
        all_items_cursor = self.db["stockItems"].find({}, {"itemName": 1})
        all_items_docs = await all_items_cursor.to_list(length=1000)
        all_items = [i["itemName"] for i in all_items_docs]
 
        all_banks_cursor = self.db["ledgers"].find(
            {"groupName": {"$in": ["Bank Accounts", "Cash-in-Hand", "Bank OD A/c"]}},
            {"ledgerName": 1}
        )
        all_banks_docs = await all_banks_cursor.to_list(length=500)
        all_banks = [b["ledgerName"] for b in all_banks_docs]

        # Additional matching categories from database
        suppliers_cursor = self.db["ledgers"].find({"groupName": "Sundry Creditors"}, {"ledgerName": 1})
        suppliers_docs = await suppliers_cursor.to_list(length=1000)
        suppliers = [s["ledgerName"] for s in suppliers_docs]

        customers_cursor = self.db["ledgers"].find({"groupName": "Sundry Debtors"}, {"ledgerName": 1})
        customers_docs = await customers_cursor.to_list(length=1000)
        customers = [c["ledgerName"] for c in customers_docs]

        cash_cursor = self.db["ledgers"].find({"groupName": "Cash-in-Hand"}, {"ledgerName": 1})
        cash_docs = await cash_cursor.to_list(length=100)
        cash_ledgers = [c["ledgerName"] for c in cash_docs]

        tax_cursor = self.db["ledgers"].find({"groupName": "Duties & Taxes"}, {"ledgerName": 1})
        tax_docs = await tax_cursor.to_list(length=500)
        tax_ledgers = [t["ledgerName"] for t in tax_docs]

        charges_cursor = self.db["ledgers"].find({
            "groupName": {"$in": ["Direct Expenses", "Indirect Expenses", "Direct Incomes", "Indirect Incomes", "Duties & Taxes"]}
        }, {"ledgerName": 1})
        charges_docs = await charges_cursor.to_list(length=1000)
        additional_charges = [c["ledgerName"] for c in charges_docs]

        cost_centers_cursor = self.db["costCenters"].find({}, {"name": 1, "costCenterName": 1})
        cost_centers_docs = await cost_centers_cursor.to_list(length=500)
        cost_centers = list(set([cc.get("name") or cc.get("costCenterName") for cc in cost_centers_docs if cc.get("name") or cc.get("costCenterName")]))

        units = set()
        async for item in self.db["stockItems"].find({}, {"unit": 1, "uom": 1}):
            u = item.get("unit") or {}
            if isinstance(u, dict):
                bu = u.get("baseUnit")
                if bu: units.add(bu)
            elif isinstance(u, str):
                units.add(u)
            uom = item.get("uom")
            if uom: units.add(uom)
        if not units:
            units = {"Nos", "Kgs", "Pcs", "Box", "Mtr", "Ltr"}

        gst_rates = await self.db["GST"].distinct("rate")
        if not gst_rates:
            gst_rates = [0, 5, 12, 18, 28]
 
        return {
            "companyName": company_name,
            "financialYear": "FY 2024-25",
            "currentUser": "R",
            "partyCount": party_count,
            "itemCount": item_count,
            "ledgerCount": ledger_count,
            "availableVoucherTypes": voucher_types,
            "companyGst": company_gst,
            "currentDate": datetime.date.today().isoformat(),
            "conversations": conversations,
            "voucherHistory": voucher_history,
            "quickSuggestions": suggestions,
            "allParties": all_parties,
            "allLedgers": all_ledgers,
            "allItems": all_items,
            "allBanks": all_banks,
            "suppliers": suppliers,
            "customers": customers,
            "cashLedgers": cash_ledgers,
            "taxLedgers": tax_ledgers,
            "additionalCharges": additional_charges,
            "costCenters": cost_centers,
            "units": list(units),
            "gstRates": list(gst_rates),
            "voucherTypes": voucher_types,
            "welcomeMessage": welcome_message
        }

    def _evaluate_missing_and_actions(self, draft: Optional[AiVoucherDraft], state: str) -> Tuple[List[Dict[str, str]], List[str]]:
        missing = []
        actions = ["Cancel"]
        
        if not draft:
            missing.append({"name": "Party", "type": "Required"})
            missing.append({"name": "Voucher Type", "type": "Required"})
            actions.append("Add Party")
            return missing, actions

        if not draft.party and draft.voucher_type.lower() != "contra":
            missing.append({"name": "Party", "type": "Required"})
        if draft.voucher_type.lower() == "contra":
            if not draft.debit:
                missing.append({"name": "Source Account (DR)", "type": "Required"})
            if not draft.credit:
                missing.append({"name": "Destination Account (CR)", "type": "Required"})
        is_invoice_vch = draft.voucher_type.lower() in ["sales", "purchase", "credit note", "credit_note", "debit note", "debit_note"] if draft.voucher_type else False
        if draft.entry_mode == "item_invoice" or is_invoice_vch:
            if not draft.items:
                missing.append({"name": "Items", "type": "Required"})
        else:
            if not draft.amount or draft.amount == 0.0:
                missing.append({"name": "Amount", "type": "Required"})
                
        if not draft.narration:
            missing.append({"name": "Narration", "type": "Optional"})
            actions.append("Add Narration")
            
        has_discount = any(item.discount_percent > 0 for item in draft.items) if draft.items else False
        if not has_discount and draft.entry_mode == "item_invoice":
            missing.append({"name": "Discount", "type": "Optional"})
            actions.append("Add Discount")
            
        has_freight = any("freight" in entry.ledger_name.lower() for entry in draft.ledger_entries)
        if not has_freight:
            missing.append({"name": "Freight", "type": "Optional"})
            actions.append("Add Freight")
            
        if draft.party and (draft.items or (draft.amount and draft.amount > 0)):
            actions.append("Review")
            actions.append("Save Draft")
            actions.append("Approve")
            
        return missing, actions

    async def _get_active_guidelines(self) -> Tuple[List[str], List[str]]:
        try:
            count = await self.db["ai_guidelines"].count_documents({})
            if count == 0:
                defaults = [
                    # NLU guidelines
                    {"category": "nlu", "text": "If the user mentions any extra charges (e.g. 'add freight 200', 'cess 100 add karo'), capture them in additional_charges.", "is_active": True},
                    # NLG guidelines
                    {"category": "nlg", "text": "Always keep standard English accounting terms like 'Amount', 'Quantity', 'Rate', 'Party', 'Bank' in Hinglish/Hindi replies. Do not translate them to Hindi.", "is_active": True},
                    {"category": "nlg", "text": "Present ambiguous choices to the user as a clear, numbered list.", "is_active": True},
                    {"category": "nlg", "text": "For complete drafts, show a bulleted review summary before asking to save.", "is_active": True}
                ]
                await self.db["ai_guidelines"].insert_many(defaults)

            cursor = self.db["ai_guidelines"].find({"is_active": True})
            docs = await cursor.to_list(length=100)
            nlu_gl = [d["text"] for d in docs if d.get("category") == "nlu"]
            nlg_gl = [d["text"] for d in docs if d.get("category") == "nlg"]
            return nlu_gl, nlg_gl
        except Exception as e:
            logger.error(f"Error fetching active guidelines: {str(e)}", exc_info=True)
            return [], []

