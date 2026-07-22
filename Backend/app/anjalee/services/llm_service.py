import json
import re
import logging
from typing import Any, List, Dict, Optional
from openai import OpenAI
from app.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        if not settings.NVIDIA_API_KEY:
            logger.warning("NVIDIA_API_KEY is not configured. LLM calls will fail.")
            self.client = None
        else:
            self.client = OpenAI(
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.NVIDIA_API_KEY
            )
        self.model = settings.LLM_MODEL

    def _clean_json_string(self, content: str) -> str:
        """
        Cleans the string returned by LLM to extract the JSON object.
        Strips markdown code blocks and trailing/leading characters.
        """
        content = content.strip()
        match = re.search(r"({.*})", content, re.DOTALL)
        if match:
            return match.group(1)
        return content

    def parse_user_message(self, user_message: str, session_history: List[Dict[str, str]], current_draft: Optional[Dict[str, Any]] = None, custom_guidelines: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Sends the user message and session context to LLM to parse intent,
        voucher properties, or question parameters.
        Returns a structured dictionary matching our JSON schema.
        """
        system_prompt = f"""You are an expert AI Accounting Assistant. Your job is to process natural language user requests and convert them into structured JSON messages that the backend can parse.
 
We support these voucher types:
- Sales (Sales Vouchers, bills)
- Purchase (Purchase Vouchers, bills)
- Debit Note (Purchase returns)
- Credit Note (Sales returns)
- Payment (Bank/Cash payment vouchers)

- Receipt (Bank/Cash receipt vouchers)
- Contra (Fund transfer between bank and cash)

The user can type in English, Hindi ("Rahul ko 25000 de do"), Hinglish ("HDFC se Rahul ko payment"), Mixed language, Broken grammar, Voice-to-text style, or Short commands.

You must output a single JSON object. DO NOT output any other text or markdown wrappers except the JSON itself.

Select one of these values for "intent":
1. "create_voucher": User wants to create a new voucher.
2. "update_draft": User wants to edit/change a field or item on the current active draft.
3. "save_voucher": User says "save", "confirm", "yes, save it", "proceed", "do it", "create it", or similar.
4. "cancel_draft": User says "cancel", "clear draft", "discard", "no, cancel", or similar.
5. "question": User is asking an accounting question (either requiring database lookup, report statistics, or general accounting knowledge/definitions).
6. "capability_question": User is asking what you/AI assistant can do, what features/modules are available, how it works, or how to create vouchers.
7. "general_chat": Greeting or other queries.
8. "load_voucher": User wants to open, load, view, or show a specific existing voucher (e.g. "show me Accent Graphics sales voucher", "load voucher SI-2026-0022", "open debit note 5").

JSON Output Schema:
{{
  "intent": "create_voucher" | "update_draft" | "save_voucher" | "cancel_draft" | "question" | "capability_question" | "general_chat" | "load_voucher",
  "voucher_type": "Sales" | "Purchase" | "Debit Note" | "Credit Note" | "Payment" | "Receipt" | "Contra" | null,
  "voucher_number": "string" | null,
  "party": "string" | null,
  "bank": "string" | null,
  "amount": number | null,
  "date": "string" | null,
  "narration": "string" | null,
  "items": [
    {{
      "item_name": "string",
      "quantity": number | null,
      "rate": number | null,
      "discount_percent": number | null
    }}
  ],
  "additional_charges": [
    {{
      "ledger_name": "string",
      "amount": number | null
    }}
  ],
  "confirmation": "yes" | "no" | null,
  "allocation_preference": "string" | null
}}

Guidelines:
1. STRICT RULE: DO NOT guess or invent ledger names, bank names, GST rates, dates, voucher numbers, or outstanding details.
2. CONTRA CLASSIFICATION: If the user mentions any transfer between Cash ↔ Bank, Bank ↔ Bank, cash deposits, or cash withdrawals (e.g., "Transfer 10000 from Cash to SBI", "Withdraw 5000 from Bank", "Deposit 20000 cash into HDFC"), you MUST set "voucher_type" to "Contra". Do NOT set it to Payment or Receipt. For Contra, map the Source account (transferring from) to the "party" field, and the Destination account (transferring to) to the "bank" field.
3. If the user refers to allocation instructions (e.g. "against oldest", "split between SI-001 and SI-002", "full payment"), capture this text in "allocation_preference".
4. For updates: if the user specifies changes like "change amount to 5000", map it to the corresponding fields.
5. If the user mentions any extra charges (e.g. "add freight 200", "cess 100 add karo", "packing charges 50"), capture them in "additional_charges" with the ledger_name exactly as mentioned and the amount. Do NOT add them as items.
6. CRITICAL - PARTY vs ITEMS DISAMBIGUATION:
   - "party" is the CUSTOMER or SUPPLIER (a business name or person name, e.g. "ABIL Health Care", "Ramesh Traders", "ABC Pvt Ltd").
   - "items" are PHYSICAL GOODS / STOCK ITEMS being sold or purchased (product names, e.g. "Arobond", "Craft Paper", "Medicine", "Laptop").
   - In a sentence like "Create sales invoice for ABIL Health Care for 10 Arobond":
     * party = "ABIL Health Care" (the customer)
     * items = [{{"item_name": "Arobond", "quantity": 10, "rate": null}}]
   - In a sentence like "Create sales invoice for Ramesh Traders with 5 Cement bags at rate 500":
     * party = "Ramesh Traders"
     * items = [{{"item_name": "Cement bags", "quantity": 5, "rate": 500}}]
   - If only ONE name appears and no explicit item is mentioned, treat it as "party".
   - NEVER put a physical product/goods name in "party". NEVER put a person/company name in "items".
7. For "load_voucher" intent: make sure to extract the party name/ledger name (e.g. "shivali graphics", "Accent Graphics", "Vansh Fire") into the "party" field, and any voucher numbers (like "SI-2026-0022", "PV-01", etc.) into "voucher_number".
8. Current Active Draft State (if any): {json.dumps(current_draft) if current_draft else "None"}
"""
        if custom_guidelines:
            system_prompt += "\n\nAdditional Dynamic NLU Instructions:\n"
            for i, gl in enumerate(custom_guidelines):
                system_prompt += f"- {gl}\n"

        messages = [{"role": "system", "content": system_prompt}]
        
        # Add session history (last 30 messages for context)
        for msg in session_history[-30:]:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
        messages.append({"role": "user", "content": user_message})

        logger.info(f"LLM parse_user_message request with model: {self.model}")
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=512
            )
            raw_response = completion.choices[0].message.content
            logger.info(f"LLM NLU Raw Response: {raw_response}")
            
            cleaned_json = self._clean_json_string(raw_response)
            parsed_json = json.loads(cleaned_json)
            return parsed_json
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from LLM NLU response: {str(e)}")
            return {"intent": "general_chat", "reply": "I'm sorry, I couldn't interpret that command. Could you please rephrase?"}
        except Exception as e:
            logger.error(f"Error calling LLM NLU API: {str(e)}", exc_info=True)
            return {"intent": "general_chat", "reply": "I encountered an error connecting to the AI system. Please verify the NVIDIA API key."}

    def generate_chat_response(
        self,
        session_history: List[Dict[str, str]],
        current_state: str,
        draft_details: Optional[Dict[str, Any]],
        missing_fields: List[str],
        outstanding_bills: Optional[List[Dict[str, Any]]] = None,
        options: Optional[List[str]] = None,
        backend_notes: Optional[str] = None,
        custom_guidelines: Optional[List[str]] = None
    ) -> str:
        # Determine language of the latest query
        latest_query = ""
        for msg in reversed(session_history):
            if msg.get("role") == "user":
                latest_query = msg.get("content", "")
                break
        
        is_english = True
        latest_query_lower = latest_query.lower()
        hinglish_words = ["ko", "se", "banao", "karo", "hai", "hain", "ki", "ka", "ke", "aur", "de", "do", "kripya", "batayein", "karna", "hoga", "hoge", "liya", "diya", "gaya", "chahiye", "kuch", "ek", "naya", "banayein", "batao"]
        import re
        for word in hinglish_words:
            if re.search(r'\b' + re.escape(word) + r'\b', latest_query_lower):
                is_english = False
                break

        context_str = f"""<context>
- Current Session State: {current_state}
- Active Voucher Draft: {json.dumps(draft_details) if draft_details else "None"}
- Missing Required Fields: {json.dumps(missing_fields)}
- Outstanding Bills: {json.dumps(outstanding_bills) if outstanding_bills else "None"}
- Available Options/Matches: {json.dumps(options) if options else "None"}
- Backend Notes: {backend_notes or "None"}
</context>"""

        if options:
            if is_english:
                system_prompt = f"""You are a friendly AI accounting assistant.

{context_str}

Rules:
- CRITICAL: Since 'Available Options/Matches' (options) in the context block is NOT "None", you MUST list every single option from the options list numbered EXACTLY as it is spelled.
- Do NOT summarize, do NOT shorten, and do NOT use placeholders or generic names like 'Ledger 1' or 'Graphics (Ledger 1)'. You MUST output the actual names from the options list exactly as they appear (e.g. if the options list has 'Accent Graphics', you MUST output 'Accent Graphics').
- Do NOT ask for quantity/rate confirmations, do NOT ask other questions, and do NOT make assumptions.
- Your only response must be to print the numbered list of actual options and ask the user to select one. E.g. "I found multiple matching options. Please select one: ...".
- Tone: casual, friendly, direct — not robotic. Like a smart accountant on WhatsApp.
"""
            else:
                system_prompt = f"""You are a friendly AI accounting assistant. Reply in natural Hinglish.

{context_str}

Rules:
- CRITICAL: Since 'Available Options/Matches' (options) in the context block is NOT "None", you MUST list every single option from the options list in Hinglish numbered EXACTLY as it is spelled.
- Do NOT summarize, do NOT shorten, and do NOT use placeholders or generic names like 'Ledger 1' or 'Graphics (Ledger 1)'. You MUST output the actual names from the options list exactly as they appear.
- Do NOT ask for quantity/rate confirmations, do NOT ask other questions, and do NOT make assumptions.
- Your only response must be to print the numbered list of actual options and ask the user to select one. E.g. "Mujhe multiple matches mile hain. Please select karein: ...".
- Tone: casual, friendly, direct — like a smart accountant on WhatsApp.
"""
        else:
            if is_english:
                system_prompt = f"""You are a friendly AI accounting assistant — sharp, helpful, and conversational, like ChatGPT.

{context_str}

Rules:
- CRITICAL: Write ONLY the natural, conversational reply to the user. Do NOT echo, print, or copy any tags, keys, or JSON from the <context> block (like "State:", "Draft:", "Missing:", etc.).
- CRITICAL: Respond in ENGLISH only. Never use Hindi or Hinglish words.
- If current_state is "WAITING_CREATE_CONFIRMATION": ask the user if they want to create a new ledger/item/additional charge record with that name. Do NOT auto-create. Say: "I couldn't find a record for '[name]'. Would you like to create a new one?" (replace '[name]' with the actual pending create name from notes/context).
- If asking for missing info: ask in 1 short, natural sentence.
  * If current_state is "WAITING_BANK":
    - For Payment/Contra: ask "Which bank or cash account should we make the payment from?"
    - For Receipt: ask "Which bank or cash account did you receive this payment into?"
  * Otherwise, use contextual terms:
    - If Sales, ask "Which customer is this invoice for?" or "Please specify the customer ledger name."
    - If Purchase, ask "Which supplier is this bill from?" or "Please specify the supplier ledger name."
    - If Payment, ask "Which ledger or party is being paid?"
    - If Receipt, ask "Who is depositing or paying this amount?"
    - If Contra, ask "Which bank/cash account are you transferring to/from?"
- NEVER ask for things already in the Draft. Ask only what is listed in Missing.
- If WAITING_CONFIRMATION: show a clean summary with ✅ then ask "Ready to save this voucher?"
- If WAITING_ALLOCATION: list the outstanding bills and ask how to allocate.
- NEVER ask for a bank account for Sales/Purchase vouchers.
- For validation errors (negative qty, zero rate, missing item): explain briefly in 1-2 sentences, ask for the correct value.
- Tone: casual, friendly, direct — not robotic. Like a smart accountant on WhatsApp.
"""
            else:
                system_prompt = f"""You are a friendly AI accounting assistant — helpful and conversational, like ChatGPT. Reply in natural Hinglish.

{context_str}

Rules:
- CRITICAL: Write ONLY the natural, conversational reply to the user. Do NOT echo, print, or copy any tags, keys, or JSON from the <context> block (like "State:", "Draft:", "Missing:", etc.).
- Respond in natural Hinglish only (Hindi + English mix). Never pure Hindi.
- Keep standard accounting terms in English: Amount, Quantity, Rate, Party, Items, Bank Account.
- If current_state is "WAITING_CREATE_CONFIRMATION": ask the user in Hinglish if they want to create it. E.g. "Mujhe '[name]' record nahi mila. Kya aap ek naya record create karna chahte hain?" (replace '[name]' with the actual pending create name from notes/context).
- If asking for missing info: ask in 1 short, natural Hinglish sentence.
  * If current_state is "WAITING_BANK":
    - For Payment/Contra: ask "Kis bank ya cash account se payment karni hai?"
    - For Receipt: ask "Ye payment kaunse bank ya cash account me receive hui hai?"
  * Otherwise:
    - If Sales: "Kaunse customer ke liye hai ye invoice?"
    - If Purchase: "Ye bill kaunse supplier se aaya hai?"
    - If Payment: "Ye payment kis ledger ya party ko ho rahi hai?"
    - If Receipt: "Ye amount kaun deposit ya pay kar raha hai?"
    - If Contra: "Kis bank/cash account me transfer ho raha hai?"
- NEVER ask for things already in the Draft. Ask only what is listed in Missing.
- If WAITING_CONFIRMATION: show a clean summary with ✅ then ask "Ye voucher save karein?"
- If WAITING_ALLOCATION: list the outstanding bills and ask how to allocate.
- NEVER ask for bank account for Sales/Purchase vouchers.
- For validation errors: briefly explain in 1-2 sentences, ask for correct value.
- Tone: casual, friendly, direct — like a smart accountant on WhatsApp.
"""
        if custom_guidelines:
            system_prompt += "\n\nAdditional Dynamic Response Guidelines:\n"
            for i, gl in enumerate(custom_guidelines):
                system_prompt += f"- {gl}\n"

        messages = [{"role": "system", "content": system_prompt}]
        for msg in session_history[-30:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

        logger.info(f"LLM generate_chat_response request with model: {self.model}")
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=512
            )
            reply = completion.choices[0].message.content.strip()
            logger.info(f"LLM NLG Response: {reply}")
            return reply
        except Exception as e:
            logger.error(f"Error calling LLM NLG API: {str(e)}", exc_info=True)
            return "I have updated the voucher draft. Would you like to review it or proceed to save?"

    def generate_answer(self, query: str, data: Any) -> str:
        """
        Converts the database query result into a professional, human-readable response.
        If the query is a general accounting question or about text-to-entry features,
        answers it using general knowledge in a professional manner.
        """
        system_prompt = """You are an experienced, professional AI Accounting Assistant.
If the user's query is about specific database records (like balances, transaction lists, recent invoices, etc.), answer directly, clearly, and concisely based on the provided database data.
If the user's query is a general accounting question (e.g. "What is accounting?", "Explain double-entry bookkeeping", "What is depreciation?") or asks about our text-to-entry capabilities and features, answer it dynamically using your expert accounting knowledge in a clear, conversational, and helpful manner.
Format monetary figures nicely in Rupees (₹) with commas (e.g. ₹15,000).
Keep it conversational but highly professional, like a senior accountant. Do not output paragraphs; keep it structured, bulleted, or brief.
"""
        user_prompt = f"""
User Query: "{query}"

Database Data:
{json.dumps(data, indent=2, default=str)}
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        logger.info(f"LLM generate_answer request with model: {self.model}")
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=512
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Error calling LLM API for answer generation: {str(e)}", exc_info=True)
            return f"Error formatting response. Raw data: {str(data)}"

    def generate_capability_answer(self, query: str, data: Any) -> str:
        """
        Answers general or step-by-step inquiries about ERP capabilities using metadata.
        """
        system_prompt = """You are an experienced, professional AI Accounting Assistant.
Answer the user's question directly, clearly, and concisely based on the provided ERP capabilities metadata.
Explain step-by-step how to create or perform tasks within the assistant (e.g. how to create a sales voucher, purchase voucher, payment voucher, etc.).
Keep it conversational, friendly, and structured. Do not output lengthy essays; use bullet points and clear, easy-to-follow steps.
If a module or feature is not in the metadata, politely state that it's currently not supported but we support the modules listed.
"""
        user_prompt = f"""
User Query: "{query}"

ERP Capabilities Metadata:
{json.dumps(data, indent=2, default=str)}
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        logger.info(f"LLM generate_capability_answer request with model: {self.model}")
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=512
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Error calling LLM API for capability answer: {str(e)}", exc_info=True)
            return "I am capable of helping you record Sales, Purchase, Payment, Receipt, and Contra vouchers. What would you like to create?"

    def extract_document_fields(self, ocr_text: str) -> Dict[str, Any]:
        """
        Extracts structured financial fields from raw OCR text of an invoice / bill of supply.
        Returns a dict with keys: vendorName, invoiceNumber, invoiceDate, gstin,
        taxableValue, taxAmount, totalAmount.
        Values are null when the field cannot be determined from the text.
        """
        system_prompt = """You are a precise document parsing AI. You will receive raw OCR text extracted from a financial document (invoice, bill of supply, purchase bill, etc.).

Your task: extract ONLY the following fields and return them as a single JSON object. Do NOT add any extra text, markdown, or explanation — output ONLY the JSON object.

JSON Schema:
{
  "vendorName": "string or null",
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD string or null",
  "gstin": "string (15-char GST number of the SUPPLIER/VENDOR) or null",
  "taxableValue": number or null,
  "taxAmount": number or null,
  "totalAmount": number or null
}

Rules:
1. vendorName: The name of the company/person who ISSUED the document (supplier/vendor), NOT the buyer.
2. invoiceNumber: The invoice number, bill number, or document reference number.
3. invoiceDate: The date of the invoice/bill. Convert to YYYY-MM-DD format. If year is missing, assume current year.
4. gstin: The 15-character GST Identification Number of the issuing vendor/supplier. Ignore the buyer's GSTIN.
5. taxableValue: The taxable amount BEFORE tax (subtotal excluding GST/tax). Extract the numeric value only.
6. taxAmount: The total GST/tax amount (sum of CGST + SGST + IGST). Extract the numeric value only.
7. totalAmount: The grand total / final amount payable including all taxes. Extract the numeric value only.
8. If a field is not clearly present in the text, set it to null. DO NOT guess or fabricate values.
9. Remove currency symbols (₹, Rs., INR) from numeric values.
10. Output ONLY valid JSON. No markdown, no explanation."""

        user_prompt = f"OCR Text:\n\n{ocr_text[:6000]}"  # Limit to 6000 chars to stay within token budget

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        logger.info("LLM extract_document_fields request")
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=256
            )
            raw_response = completion.choices[0].message.content
            logger.info(f"LLM document extraction raw response: {raw_response}")
            cleaned_json = self._clean_json_string(raw_response)
            parsed = json.loads(cleaned_json)
            return parsed
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from LLM document extraction: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error calling LLM for document extraction: {e}", exc_info=True)
            return {}


llm_service = LLMService()

# ─── Phase 3 & 4 Document AI Methods ─────────────────────────────────────────

# Supported document types for classification
DOCUMENT_TYPES = [
    "Sales Invoice", "Purchase Invoice", "Expense Bill", "Retail Invoice",
    "Tax Invoice", "Credit Note", "Debit Note", "Receipt Voucher",
    "Payment Voucher", "Bank Statement", "Journal Voucher", "Contra Voucher",
    "Quotation", "Delivery Challan", "Purchase Order", "Sales Order",
    "Bill of Supply", "Unknown Document"
]


class DocumentAIService:
    """
    Dedicated AI service for the Bulk Upload OCR pipeline.
    Handles Phase 3 (classification) and Phase 4 (full accounting data extraction).
    """

    def __init__(self):
        if not settings.NVIDIA_API_KEY:
            logger.warning("NVIDIA_API_KEY not configured. DocumentAI calls will fail.")
            self.client = None
        else:
            self.client = OpenAI(
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.NVIDIA_API_KEY
            )
        self.model = settings.LLM_MODEL

    def _clean_json(self, content: str) -> str:
        content = content.strip()
        # Remove markdown code fences
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
        match = re.search(r"(\{.*\})", content, re.DOTALL)
        if match:
            return match.group(1)
        return content

    # ── Phase 3 ───────────────────────────────────────────────────────────────

    def classify_document(self, ocr_text: str) -> dict:
        """
        Phase 3: Classifies the document type from OCR text.
        Returns: { document_type, confidence, reasoning }
        """
        types_str = ", ".join(DOCUMENT_TYPES)
        system_prompt = f"""You are a financial document classification expert specializing in Indian business documents.

Classify the given OCR text into exactly ONE of these document types:
{types_str}

Analyze the document's title, headings, labels, and overall structure to determine its type.

Output ONLY a valid JSON object — no markdown, no extra text:
{{
  "document_type": "<exact type from the list above>",
  "confidence": <integer 0-100>,
  "reasoning": "<one concise sentence explaining the classification>"
}}"""

        user_prompt = f"Document OCR Text:\n\n{ocr_text[:5000]}"

        try:
            logger.info("DocumentAI.classify_document: sending request")
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.0,
                max_tokens=200
            )
            raw = completion.choices[0].message.content
            logger.info(f"DocumentAI.classify_document raw: {raw}")
            cleaned = self._clean_json(raw)
            result = json.loads(cleaned)
            # Validate document_type is in our list
            if result.get("document_type") not in DOCUMENT_TYPES:
                result["document_type"] = "Unknown Document"
            return result
        except json.JSONDecodeError as e:
            logger.error(f"classify_document JSON parse error: {e}")
            return {"document_type": "Unknown Document", "confidence": 0, "reasoning": "Classification failed."}
        except Exception as e:
            logger.error(f"classify_document error: {e}", exc_info=True)
            return {"document_type": "Unknown Document", "confidence": 0, "reasoning": str(e)}

    # ── Phase 4 ───────────────────────────────────────────────────────────────

    def extract_full_accounting_data(self, ocr_text: str, document_type: str) -> dict:
        """
        Phase 4: Extracts ALL structured accounting data from the document.
        Content/heading-driven: reads every labeled field present in the actual
        document and maps to the standard schema. Extra fields go to additionalFields.
        Returns a rich JSON with per-field confidence scores and AI suggestions.
        """
        system_prompt = f"""You are an expert AI for extracting structured accounting data from Indian financial documents.

You are analyzing a [{document_type}] document.

YOUR TASK:
1. Read the COMPLETE OCR text carefully — every heading, label, value, and table row.
2. Extract ALL labeled data fields you find in the document. Do NOT skip any labeled data.
3. Map extracted data to the standard schema fields listed below where applicable.
4. For ANY additional labeled data NOT in the standard schema (e.g. license numbers, batch codes, transport details, schemes, approval numbers), add them to "additionalFields".
5. Assign confidence scores per field: 95-100=clearly visible, 80-95=visible, 60-80=inferred, 0-60=uncertain/missing.
6. Generate 3-8 intelligent AI validation suggestions about the document.

OUTPUT — a single JSON object only (NO markdown, NO explanation):
{{
  "header": {{
    "values": {{
      "invoiceNumber": null,
      "invoiceDate": null,
      "supplierName": null,
      "customerName": null,
      "supplierGSTIN": null,
      "customerGSTIN": null,
      "PAN": null,
      "supplierAddress": null,
      "customerAddress": null,
      "state": null,
      "stateCode": null,
      "invoiceType": null,
      "paymentTerms": null,
      "dueDate": null,
      "currency": "INR",
      "referenceNumber": null,
      "purchaseOrderNumber": null,
      "transportDetails": null,
      "vehicleNumber": null,
      "eWayBill": null,
      "narration": null
    }},
    "confidence": {{
      "invoiceNumber": 0, "invoiceDate": 0, "supplierName": 0, "customerName": 0,
      "supplierGSTIN": 0, "customerGSTIN": 0, "PAN": 0, "supplierAddress": 0,
      "customerAddress": 0, "state": 0, "stateCode": 0, "invoiceType": 0,
      "paymentTerms": 0, "dueDate": 0, "currency": 95, "referenceNumber": 0,
      "purchaseOrderNumber": 0, "transportDetails": 0, "vehicleNumber": 0,
      "eWayBill": 0, "narration": 0
    }}
  }},
  "items": [
    {{
      "values": {{
        "itemName": null, "description": null, "hsnCode": null,
        "quantity": null, "unit": null, "rate": null, "discount": 0,
        "taxableAmount": null, "cgst": 0, "sgst": 0, "igst": 0, "cess": 0,
        "taxPercent": 0, "lineTotal": null
      }},
      "confidence": {{
        "itemName": 0, "description": 0, "hsnCode": 0, "quantity": 0,
        "unit": 0, "rate": 0, "discount": 0, "taxableAmount": 0,
        "cgst": 0, "sgst": 0, "igst": 0, "cess": 0, "taxPercent": 0, "lineTotal": 0
      }}
    }}
  ],
  "totals": {{
    "values": {{
      "subtotal": null, "discount": 0, "cgstTotal": 0, "sgstTotal": 0,
      "igstTotal": 0, "cessTotal": 0, "roundOff": 0,
      "grandTotal": null, "paidAmount": null, "balanceAmount": null
    }},
    "confidence": {{
      "subtotal": 0, "discount": 0, "cgstTotal": 0, "sgstTotal": 0,
      "igstTotal": 0, "cessTotal": 0, "roundOff": 0,
      "grandTotal": 0, "paidAmount": 0, "balanceAmount": 0
    }}
  }},
  "additionalFields": {{
    "values": {{}},
    "confidence": {{}}
  }},
  "suggestions": [
    {{"type": "success", "message": "example suggestion"}},
    {{"type": "warning", "message": "example warning"}}
  ],
  "overallConfidence": 0
}}

CRITICAL RULES:
- Extract EVERY item row from the items table — one JSON object per row.
- For GSTIN: must be 15-character alphanumeric. Mark confidence 0 if not 15 chars.
- For dates: convert to YYYY-MM-DD format.
- For numbers: remove currency symbols (₹, Rs., INR). Return as numbers, not strings.
- For suggestions: type must be one of "success", "warning", "error", "info".
- additionalFields MUST capture any extra labeled fields from the document (license numbers, batch numbers, scheme names, etc.).
- If the document is a Bill of Supply: set all GST values to 0 with confidence=95 (exempt).
- Output ONLY the JSON. No text before or after it."""

        # Limit input to control token usage while keeping all pages
        text_input = ocr_text[:9000]
        user_prompt = f"Document OCR Text:\n\n{text_input}"

        try:
            logger.info(f"DocumentAI.extract_full_accounting_data: model={self.model}, doc_type={document_type}")
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.0,
                max_tokens=3500
            )
            raw = completion.choices[0].message.content
            logger.info(f"DocumentAI.extract_full_accounting_data raw length: {len(raw)}")
            cleaned = self._clean_json(raw)
            result = json.loads(cleaned)
            return result
        except json.JSONDecodeError as e:
            logger.error(f"extract_full_accounting_data JSON parse error: {e}. Raw: {raw[:500] if 'raw' in dir() else 'N/A'}")
            return _empty_extraction_result()
        except Exception as e:
            logger.error(f"extract_full_accounting_data error: {e}", exc_info=True)
            return _empty_extraction_result()




def _empty_extraction_result() -> dict:
    """Returns a safe empty extraction result when LLM fails."""
    return {
        "header": {
            "values": {k: None for k in [
                "invoiceNumber", "invoiceDate", "supplierName", "customerName",
                "supplierGSTIN", "customerGSTIN", "PAN", "supplierAddress",
                "customerAddress", "state", "stateCode", "invoiceType",
                "paymentTerms", "dueDate", "currency", "referenceNumber",
                "purchaseOrderNumber", "transportDetails", "vehicleNumber",
                "eWayBill", "narration"
            ]},
            "confidence": {}
        },
        "items": [],
        "totals": {
            "values": {k: None for k in [
                "subtotal", "discount", "cgstTotal", "sgstTotal", "igstTotal",
                "cessTotal", "roundOff", "grandTotal", "paidAmount", "balanceAmount"
            ]},
            "confidence": {}
        },
        "additionalFields": {"values": {}, "confidence": {}},
        "suggestions": [
            {"type": "error", "message": "AI extraction failed. Please fill fields manually or re-run."}
        ],
        "overallConfidence": 0
    }


def _empty_dynamic_schema(reason: str = "AI analysis failed") -> dict:
    """Returns a safe empty dynamic schema when LLM fails."""
    return {
        "document_type": "Unknown Document",
        "confidence": 0,
        "reasoning": reason,
        "sections": [
            {
                "id": "fallback",
                "title": "Document Fields",
                "order": 1,
                "fields": [
                    {
                        "id": "raw_text",
                        "label": "Extracted Text",
                        "type": "textarea",
                        "value": "",
                        "confidence": 0,
                        "required": False,
                        "editable": True,
                        "page": 1,
                        "bbox": None,
                        "placeholder": "No data could be extracted automatically"
                    }
                ]
            }
        ],
        "suggestions": [{"type": "error", "message": reason}],
        "overall_confidence": 0
    }


document_ai_service = DocumentAIService()


# ─── Dynamic Document Understanding Engine ────────────────────────────────────

class DynamicDocumentAI:
    """
    The main AI engine for the Dynamic Document Understanding system.

    Single responsibility: Given OCR text from any business document,
    produce a complete dynamic form schema that the frontend renders verbatim.

    No hardcoded field names. The AI decides ALL sections, fields, and types
    based entirely on what it reads in the document.
    """

    def __init__(self):
        if not settings.NVIDIA_API_KEY:
            logger.warning("NVIDIA_API_KEY not configured. DynamicDocumentAI calls will fail.")
            self.client = None
        else:
            self.client = OpenAI(
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.NVIDIA_API_KEY
            )
        self.model = settings.LLM_MODEL

    def generate_dynamic_schema(self, ocr_text: str, our_company_name: str = "", our_company_gstin: str = "", filename: str = "") -> dict:
        """
        Redirects dynamic schema generation to agent_orchestrator to ensure
        unified extraction, local regex fallback support, and flat JSON keys.
        """
        try:
            from app.anjalee.services.extraction_agents import agent_orchestrator
            logger.info(f"Redirecting DynamicDocumentAI.generate_dynamic_schema to agent_orchestrator.extract: filename={filename}")
            return agent_orchestrator.extract(
                ocr_text=ocr_text,
                filename=filename,
                our_company_name=our_company_name,
                our_company_gstin=our_company_gstin
            )
        except Exception as e:
            logger.error(f"Dynamic schema generation failed: {e}", exc_info=True)
            return _empty_dynamic_schema(str(e))


# Singleton
dynamic_document_ai = DynamicDocumentAI()
