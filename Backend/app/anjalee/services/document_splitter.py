import os
import re
import uuid
import logging
from typing import List, Dict, Any, Optional

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    PdfReader = None
    PdfWriter = None

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

from app.config import settings

logger = logging.getLogger("document_splitter")

class DocumentSplitterService:
    """
    Enterprise-grade Multi-Invoice Document Boundary Detection & Splitting Engine.
    
    When a multi-page PDF (e.g. 5-10 pages) containing multiple distinct accounting
    documents (e.g. Sales Invoice, Purchase Bill, Fuel/Expense receipts) is uploaded,
    this service detects document boundaries and splits the single PDF into separate
    sub-documents, each processed independently into its own accounting voucher.
    """

    INVOICE_HEADER_PATTERNS = [
        re.compile(r'\b(?:tax\s+invoice|commercial\s+invoice|retail\s+invoice|bill\s+of\s+supply|original\s+for\s+recipient|duplicate\s+for\s+transporter|triplicate\s+for\s+supplier|cash\s+memo|proforma\s+invoice|debit\s+note|credit\s+note)\b', re.IGNORECASE),
        re.compile(r'\b(?:sales\s+invoice|purchase\s+invoice|tax\s+bill)\b', re.IGNORECASE),
    ]

    INVOICE_NUM_PATTERNS = [
        re.compile(r'\b[A-Za-z0-9]{2,8}/\d{2,4}-\d{2,4}/\d{3,8}\b'),
        re.compile(r'\b(?:bill\s+of\s+supply\s+no|cn\s+no)[\s.:#\/-]+([A-Za-z0-9\/-]{4,35})\b', re.IGNORECASE),
        re.compile(r'\b(?:inv(?:oice)?|bill|challan)\s*(?:no|num|number|#)[\s.:#\/-]+([A-Za-z0-9\/-]{3,35})\b', re.IGNORECASE),
        re.compile(r'\b(?:invoice\s*id|bill\s*no|invoice\s*#)[\s.:#\/-]+([A-Za-z0-9\/-]{3,35})\b', re.IGNORECASE),
        re.compile(r'\b(?:inv|bill)\s*#\s*([A-Za-z0-9\/-]{3,35})\b', re.IGNORECASE),
    ]

    GSTIN_PATTERN = re.compile(r'\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b')

    CONTINUATION_PATTERNS = [
        re.compile(r'\b(?:continued\s+on\s+next\s+page|contd\b|carried\s+forward|c\/f|b\/f)\b', re.IGNORECASE),
        re.compile(r'\bpage\s+([2-9]|\d{2,})\s+of\s+(\d+)\b', re.IGNORECASE),
    ]

    def analyze_single_page(self, page_num: int, text: str) -> Dict[str, Any]:
        """Extracts diagnostic signals from a single page's text."""
        cleaned_text = text or ""
        lines = [line.strip() for line in cleaned_text.splitlines() if line.strip()]
        first_few_lines = " ".join(lines[:12])

        has_header = any(pat.search(first_few_lines) for pat in self.INVOICE_HEADER_PATTERNS)
        
        # Extract invoice numbers
        inv_numbers = []
        for pat in self.INVOICE_NUM_PATTERNS:
            matches = pat.findall(cleaned_text[:2500])
            for m in matches:
                m_clean = m.strip().strip("-/:.#").strip()
                if len(m_clean) >= 3 and not m_clean.lower() in ["date", "time", "none", "gstin", "invoice"]:
                    inv_numbers.append(m_clean)

        inv_no = inv_numbers[0] if inv_numbers else None

        # Extract GSTINs found on page
        gstins = list(set(self.GSTIN_PATTERN.findall(cleaned_text)))

        # Check continuation
        is_continuation = False
        cont_match = re.search(r'\bpage\s+([1-9]\d*)\s+of\s+([1-9]\d*)\b', cleaned_text, re.IGNORECASE)
        page_of_page = None
        if cont_match:
            current_p = int(cont_match.group(1))
            total_p = int(cont_match.group(2))
            page_of_page = (current_p, total_p)
            if current_p > 1:
                is_continuation = True
        elif any(pat.search(cleaned_text[-500:]) for pat in self.CONTINUATION_PATTERNS):
            is_continuation = True

        return {
            "page_number": page_num,
            "has_header": has_header,
            "invoice_number": inv_no,
            "gstins": gstins,
            "is_continuation": is_continuation,
            "page_of_page": page_of_page,
            "sample_snippet": first_few_lines[:250]
        }

    def detect_invoice_boundaries(self, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Analyzes all OCR pages and groups them into distinct invoice units.
        Returns a list of groups with 1-based page numbers.
        """
        total_pages = len(pages)
        if total_pages <= 1:
            return [{"group_index": 1, "pages": [1], "invoice_number": None, "page_count": 1}]

        # 1. Analyze signals for each page
        page_signals = []
        for p in pages:
            p_num = p.get("page_number", 1)
            p_text = p.get("text", "")
            page_signals.append(self.analyze_single_page(p_num, p_text))

        # 2. Deterministic Heuristic Boundary Detection
        logger.info("[DocumentSplitter] Running heuristic boundary detector...")
        groups = []
        current_group_pages = [page_signals[0]["page_number"]]
        current_inv_no = page_signals[0]["invoice_number"]
        current_gstins = set(page_signals[0]["gstins"])

        for i in range(1, total_pages):
            sig = page_signals[i]
            p_num = sig["page_number"]

            is_new_document = False

            # Rule A: Page explicitly states Page 1 of N -> Must be a new document
            if sig["page_of_page"] and sig["page_of_page"][0] == 1:
                is_new_document = True

            # Rule B: Page is marked as continuation (Page 2 of N, etc.) -> definitely NOT a new doc
            elif sig["is_continuation"] or (sig["page_of_page"] and sig["page_of_page"][0] > 1):
                is_new_document = False

            # Rule C: Clear Invoice Header + a DIFFERENT invoice number than previous
            elif sig["has_header"] and sig["invoice_number"] and current_inv_no and sig["invoice_number"].lower() != current_inv_no.lower():
                is_new_document = True

            # Rule D: Clear Invoice Header + totally different seller GSTINs and no continuation
            elif sig["has_header"] and sig["gstins"] and current_gstins and not (set(sig["gstins"]) & current_gstins):
                is_new_document = True

            # Rule E: Has Invoice Header + has its own invoice number (even if previous had none)
            elif sig["has_header"] and sig["invoice_number"] and not current_inv_no:
                is_new_document = True

            if is_new_document:
                groups.append({
                    "group_index": len(groups) + 1,
                    "pages": current_group_pages,
                    "invoice_number": current_inv_no,
                    "page_count": len(current_group_pages)
                })
                current_group_pages = [p_num]
                current_inv_no = sig["invoice_number"]
                current_gstins = set(sig["gstins"])
            else:
                current_group_pages.append(p_num)
                if not current_inv_no and sig["invoice_number"]:
                    current_inv_no = sig["invoice_number"]
                current_gstins.update(sig["gstins"])

        # Add the final group
        if current_group_pages:
            groups.append({
                "group_index": len(groups) + 1,
                "pages": current_group_pages,
                "invoice_number": current_inv_no,
                "page_count": len(current_group_pages)
            })

        if len(groups) > 1:
            logger.info(f"[DocumentSplitter] Heuristic detection partitioned {total_pages} pages into {len(groups)} group(s).")
            return groups

        # 3. If heuristic couldn't find distinct boundaries and document has > 2 pages, consult LLM
        llm_groups = self._detect_boundaries_via_llm(page_signals, total_pages)
        if llm_groups and len(llm_groups) > 1:
            covered_pages = set()
            for g in llm_groups:
                for pn in g.get("pages", []):
                    covered_pages.add(pn)
            if covered_pages == set(range(1, total_pages + 1)):
                logger.info(f"[DocumentSplitter] LLM successfully detected {len(llm_groups)} invoice boundaries.")
                return llm_groups

        return groups

    def _detect_boundaries_via_llm(self, page_signals: List[Dict[str, Any]], total_pages: int) -> Optional[List[Dict[str, Any]]]:
        """Calls OpenRouter or Nvidia LLM to intelligently group pages into invoices."""
        openrouter_key = settings.OPENROUTER_API_KEY or settings.NVIDIA_API_KEY
        if not openrouter_key:
            return None

        import requests
        import json

        summary_lines = []
        for s in page_signals:
            summary_lines.append(
                f"- Page {s['page_number']}: HasHeader={s['has_header']} | InvNo={s['invoice_number']} | "
                f"Continuation={s['is_continuation']} | PageOfPage={s['page_of_page']} | Snippet: \"{s['sample_snippet'][:180]}\""
            )
        summaries_text = "\n".join(summary_lines)

        prompt = f"""You are an expert document boundary analyzer for Indian business accounting.
A single multi-page PDF with {total_pages} pages was uploaded. Some pages may be separate distinct invoices (e.g. Sales Invoices, Purchase Bills, Debit Notes, Receipts), or multi-page continuation of the same invoice.

Review the diagnostic summary of all {total_pages} pages:
{summaries_text}

Task:
Determine the exact group of pages belonging to each distinct invoice. Every page from 1 to {total_pages} MUST be included exactly once in order.

Output strictly a JSON array without markdown formatting:
[
  {{"group_index": 1, "pages": [1, 2], "invoice_number": "INV-101", "document_type": "Purchase Invoice"}},
  {{"group_index": 2, "pages": [3], "invoice_number": "INV-502", "document_type": "Sales Invoice"}}
]
"""
        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "google/gemini-2.5-flash" if settings.OPENROUTER_API_KEY else settings.LLM_MODEL,
            "messages": [
                {"role": "system", "content": "You are a precise JSON document boundary classifier. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.0,
            "max_tokens": 512
        }

        url = "https://openrouter.ai/api/v1/chat/completions" if settings.OPENROUTER_API_KEY else f"{settings.NVIDIA_BASE_URL}/chat/completions"

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=8.0)
            if resp.status_code == 200:
                raw_content = resp.json()["choices"][0]["message"]["content"]
                raw_content = re.sub(r'^```(?:json)?\s*', '', raw_content.strip(), flags=re.MULTILINE)
                raw_content = re.sub(r'\s*```$', '', raw_content.strip(), flags=re.MULTILINE)
                match = re.search(r'(\[.*\])', raw_content, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(1))
                    if isinstance(parsed, list) and len(parsed) > 0:
                        return parsed
        except Exception as e:
            logger.warning(f"[DocumentSplitter] LLM boundary call failed or timed out: {e}")

        return None

    def split_pdf_file(self, original_pdf_path: str, invoice_groups: List[Dict[str, Any]], upload_dir: str, orig_filename: str) -> List[Dict[str, Any]]:
        """
        Physically splits the original PDF into separate sub-PDF files for each invoice group
        using pypdf (or fitz fallback). Preserves vector text and image quality.
        """
        if not os.path.exists(original_pdf_path):
            raise FileNotFoundError(f"Original file not found: {original_pdf_path}")

        split_results = []
        base_name = os.path.splitext(orig_filename)[0]

        if PdfReader and PdfWriter:
            reader = PdfReader(original_pdf_path)
            total_src_pages = len(reader.pages)

            for idx, group in enumerate(invoice_groups):
                pages_list = group.get("pages", [])
                if not pages_list:
                    continue

                writer = PdfWriter()
                for p_num in pages_list:
                    page_idx = p_num - 1
                    if 0 <= page_idx < total_src_pages:
                        writer.add_page(reader.pages[page_idx])

                start_p = pages_list[0]
                end_p = pages_list[-1]
                page_label = f"p{start_p}" if start_p == end_p else f"p{start_p}-p{end_p}"

                sub_unique_filename = f"{uuid.uuid4()}_{base_name}_part_{idx + 1}_{page_label}.pdf"
                sub_file_path = os.path.join(upload_dir, sub_unique_filename)
                with open(sub_file_path, "wb") as f_out:
                    writer.write(f_out)

                file_size = os.path.getsize(sub_file_path)

                split_results.append({
                    "group_index": idx + 1,
                    "pages": pages_list,
                    "start_page": start_p,
                    "end_page": end_p,
                    "file_path": sub_file_path,
                    "filename": f"{base_name} (Part {idx + 1} - Pages {page_label})",
                    "sub_filename": sub_unique_filename,
                    "file_url": f"/uploads/bulk-upload/{sub_unique_filename}",
                    "file_size": file_size,
                    "invoice_number": group.get("invoice_number"),
                    "estimated_type": group.get("document_type")
                })
        elif fitz:
            src_doc = fitz.open(original_pdf_path)
            total_src_pages = len(src_doc)

            for idx, group in enumerate(invoice_groups):
                pages_list = group.get("pages", [])
                if not pages_list:
                    continue

                sub_pdf = fitz.open()
                for p_num in pages_list:
                    page_idx = p_num - 1
                    if 0 <= page_idx < total_src_pages:
                        sub_pdf.insert_pdf(src_doc, from_page=page_idx, to_page=page_idx)

                start_p = pages_list[0]
                end_p = pages_list[-1]
                page_label = f"p{start_p}" if start_p == end_p else f"p{start_p}-p{end_p}"

                sub_unique_filename = f"{uuid.uuid4()}_{base_name}_part_{idx + 1}_{page_label}.pdf"
                sub_file_path = os.path.join(upload_dir, sub_unique_filename)
                sub_pdf.save(sub_file_path)
                sub_pdf.close()

                file_size = os.path.getsize(sub_file_path)

                split_results.append({
                    "group_index": idx + 1,
                    "pages": pages_list,
                    "start_page": start_p,
                    "end_page": end_p,
                    "file_path": sub_file_path,
                    "filename": f"{base_name} (Part {idx + 1} - Pages {page_label})",
                    "sub_filename": sub_unique_filename,
                    "file_url": f"/uploads/bulk-upload/{sub_unique_filename}",
                    "file_size": file_size,
                    "invoice_number": group.get("invoice_number"),
                    "estimated_type": group.get("document_type")
                })
            src_doc.close()
        else:
            raise RuntimeError("Neither pypdf nor fitz is installed for PDF splitting.")

        return split_results

document_splitter = DocumentSplitterService()
