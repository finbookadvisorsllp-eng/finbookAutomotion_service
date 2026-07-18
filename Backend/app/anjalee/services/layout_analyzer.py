import logging
import re

logger = logging.getLogger("layout_analyzer")

# Target column keywords for dynamic column mapping
HEADER_KEYWORDS = {
    "hsn_code": ["hsn", "sac", "hsn/sac", "code"],
    "qty": ["qty", "quantity", "qnty", "bill qty", "billed qty", "actual qty", "nos", "pcs", "quantity (nos)", "quantity (pcs)"],
    "unit": ["unit", "uom", "per", "symbol", "units"],
    "rate": ["rate", "price", "unit price", "rate per", "rate/unit", "price/unit"],
    "discount_percent": ["disc", "discount", "disc%", "discount%", "disc %", "discount %"],
    "amount": ["amount", "value", "taxable value", "taxable amount", "net amount", "total amount", "taxable amt", "amt"],
    "gst_rate": ["gst", "gst%", "gst %", "tax%", "tax %", "cgst", "sgst", "igst", "rate %", "tax rate"],
    "item_name": ["item", "particulars", "description", "product", "goods", "name of product", "description of goods"]
}

# Exclusion/termination keywords to separate items table from summary
EXCLUSION_KEYWORDS = [
    "total", "sub total", "subtotal", "amount chargeable", "balance due", "rupees",
    "cgst", "sgst", "igst", "round off", "round-off", "tax amount", "taxable value",
    "integrated tax", "central tax", "state tax", "output gst", "output cgst", "output sgst",
    "continued", "declaration", "bank details", "terms", "signatory", "signature"
]

class LayoutAnalyzer:
    def analyze_layout(self, ocr_result: dict) -> dict:
        """
        Enterprise document layout analyzer implementing:
        - Stage 2: Layout Detection (Line Grouping)
        - Stage 3: Section Detection (Header, Party, Table, Totals, Footer)
        - Stage 4: Table Detection (Dynamic Column Mapping & Multi-Line row merging)
        """
        pages_layout = []
        pages = ocr_result.get("pages", [])

        for page in pages:
            page_num = page.get("page_number", 1)
            words = page.get("words", [])
            
            if not words:
                pages_layout.append({
                    "page_number": page_num,
                    "header_section": "",
                    "party_section": "",
                    "table_section": {"columns": [], "rows": []},
                    "summary_section": "",
                    "footer_section": "",
                    "paragraphs": []
                })
                continue

            # Estimate page dimensions
            max_x = max(max(pt[0] for pt in w.get("box", [[0,0]])) for w in words)
            max_y = max(max(pt[1] for pt in w.get("box", [[0,0]])) for w in words)
            page_width = max_x or 800
            page_height = max_y or 1000

            # ── Stage 2: Layout Detection (Line Grouping) ──────────────────────
            # Calculate centroid coordinates
            def get_y(w):
                box = w.get("box", [])
                return sum(pt[1] for pt in box) / len(box) if box else 0

            def get_x(w):
                box = w.get("box", [])
                return sum(pt[0] for pt in box) / len(box) if box else 0

            words.sort(key=get_y)
            lines = []
            for w in words:
                if not lines:
                    lines.append([w])
                else:
                    last_line = lines[-1]
                    avg_y = sum(get_y(item) for item in last_line) / len(last_line)
                    # Merge words within 14 pixels vertically
                    if abs(get_y(w) - avg_y) < 14:
                        last_line.append(w)
                    else:
                        lines.append([w])

            # Sort words horizontally in each line
            for line in lines:
                line.sort(key=get_x)

            # ── Stage 3: Section Detection & Stage 4: Table Detection ──────────
            table_header_idx = -1
            columns_detected = {}

            # Search for the main items table header line
            for idx, line in enumerate(lines):
                matches = 0
                temp_cols = {}
                for col_key, keywords in HEADER_KEYWORDS.items():
                    for kw in keywords:
                        kw_clean = re.sub(r"[^\w\s%]", "", kw).lower().strip()
                        for w in line:
                            txt = w.get("text", "").lower().strip()
                            txt = re.sub(r"[^\w\s%]", "", txt)
                            if txt == kw_clean or (len(kw_clean) > 3 and kw_clean in txt) or (len(txt) > 3 and txt in kw_clean):
                                box = w.get("box", [])
                                if box:
                                    w_min_x = min(pt[0] for pt in box)
                                    w_max_x = max(pt[0] for pt in box)
                                    temp_cols[col_key] = (w_min_x, w_max_x)
                                    matches += 1
                                    break
                if matches >= 3:
                    table_header_idx = idx
                    columns_detected = temp_cols
                    break

            # Define sections
            header_lines = []
            party_lines = []
            table_lines = []
            summary_lines = []
            footer_lines = []

            # 1. Header & Party details (Lines above table header)
            if table_header_idx != -1:
                pre_table_lines = lines[:table_header_idx]
                for line in pre_table_lines:
                    line_text = " ".join([w.get("text", "") for w in line])
                    # Heuristics: Party details typically contain Name, Address, GSTIN, Buyer, Seller
                    if any(kw in line_text.lower() for kw in ["buyer", "seller", "consignee", "gstin", "to:", "address", "companyName"]):
                        party_lines.append(line_text)
                    else:
                        header_lines.append(line_text)
            else:
                # No table header detected, treat top 30% as header and rest as body
                for line in lines:
                    line_text = " ".join([w.get("text", "") for w in line])
                    if get_y(line[0]) < page_height * 0.30:
                        header_lines.append(line_text)
                    else:
                        summary_lines.append(line_text)

            # 2. Table row isolation
            raw_table_rows = []
            columns_spans = {}
            if table_header_idx != -1 and len(columns_detected) >= 2:
                # Sort columns horizontally
                sorted_cols = sorted(columns_detected.items(), key=lambda item: item[1][0])
                for i in range(len(sorted_cols)):
                    col_key, (c_min, c_max) = sorted_cols[i]
                    if i < len(sorted_cols) - 1:
                        next_min = sorted_cols[i+1][1][0]
                        columns_spans[col_key] = (c_min - 15, next_min - 5)
                    else:
                        columns_spans[col_key] = (c_min - 15, page_width)

                if "item_name" not in columns_spans:
                    first_col_min = sorted_cols[0][1][0]
                    columns_spans["item_name"] = (0, first_col_min - 5)

                # Parse subsequent lines
                is_table_active = True
                for line in lines[table_header_idx + 1:]:
                    line_text = " ".join([w.get("text", "") for w in line])
                    line_text_lower = line_text.lower()

                    # Termination trigger: If we hit any exclusion keywords (e.g. CGST, SGST, Total), we exit table mode
                    if any(term in line_text_lower for term in EXCLUSION_KEYWORDS):
                        is_table_active = False

                    if is_table_active:
                        # Extract table cells
                        row_cells = {col: [] for col in columns_spans.keys()}
                        for w in line:
                            w_x = get_x(w)
                            mapped = False
                            for col_key, (c_min, c_max) in columns_spans.items():
                                if c_min <= w_x < c_max:
                                    row_cells[col_key].append(w.get("text", ""))
                                    mapped = True
                                    break
                            if not mapped:
                                closest_col = min(columns_spans.keys(), key=lambda k: min(abs(w_x - columns_spans[k][0]), abs(w_x - columns_spans[k][1])))
                                row_cells[closest_col].append(w.get("text", ""))

                        row_data = {col: " ".join(words).strip() for col, words in row_cells.items()}
                        raw_table_rows.append(row_data)
                    else:
                        # Summary/Totals & Footer lines (below table)
                        if any(kw in line_text_lower for kw in ["bank", "ifsc", "ac no", "account", "declare", "terms", "authorized", "signatory", "signature"]):
                            footer_lines.append(line_text)
                        else:
                            summary_lines.append(line_text)

            # ── Stage 4: Enforce Description-Merging and New Item Rule ──────────
            merged_rows = []
            for row in raw_table_rows:
                desc   = row.get("item_name", "").strip()
                hsn    = row.get("hsn_code", "").strip()
                qty    = row.get("qty", "").strip()
                rate   = row.get("rate", "").strip()
                amount = row.get("amount", "").strip()

                has_qty    = bool(re.search(r"\d", qty))
                has_rate   = bool(re.search(r"\d", rate))
                has_amount = bool(re.search(r"\d", amount))

                # New Item Rule: Row has description AND (quantity OR rate OR amount)
                if desc and not (has_qty or has_rate or has_amount):
                    # Check if previous row exists to append description
                    if merged_rows:
                        prev = merged_rows[-1]
                        prev["item_name"] = (prev.get("item_name", "") + " " + desc).strip()
                        if hsn:
                            prev["hsn_code"] = (prev.get("hsn_code", "") + " " + hsn).strip()
                    else:
                        merged_rows.append(row)
                else:
                    merged_rows.append(row)

            # Filter final rows: exclude empty rows and purely numeric/non-descriptive summary items
            final_rows = []
            for r in merged_rows:
                if any(val.strip() for val in r.values()):
                    desc = r.get("item_name", "").strip()
                    # A valid line item description must contain at least one alphabetical word/part (length >= 2).
                    # Pure numbers/punctuation/HSN lines are excluded.
                    if desc and not re.search(r"[a-zA-Z]{2,}", desc):
                        continue
                    final_rows.append(r)

            pages_layout.append({
                "page_number": page_num,
                "header_section": "\n".join(header_lines),
                "party_section": "\n".join(party_lines),
                "table_section": {
                    "columns": list(columns_spans.keys()),
                    "rows": final_rows
                },
                "summary_section": "\n".join(summary_lines),
                "footer_section": "\n".join(footer_lines),
                "paragraphs": ["\n".join(header_lines), "\n".join(party_section for party_section in party_lines)]
            })

        return {
            "pages": pages_layout
        }

# Singleton
layout_analyzer = LayoutAnalyzer()
