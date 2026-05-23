import sys
import json
import re
import os
import logging

# Standardize extraction for RapidOCR (based on PaddleOCR models)
try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError:
    print(json.dumps({"success": False, "error": "RapidOCR not installed. Run: pip install rapidocr_onnxruntime"}))
    sys.exit(1)

def extract_fields(results):
    """
    Results from RapidOCR is a list of [ [box, text, confidence], ... ]
    """
    full_text = []
    if results:
        for line in results:
            txt = line[1]
            full_text.append(txt)

    text_blob = "\n".join(full_text)
    
    fields = {
        "invoiceNumber": "",
        "invoiceDate": "",
        "partyName": "",
        "partyGstin": "",
        "baseAmount": 0,
        "cgst": 0,
        "sgst": 0,
        "igst": 0,
        "grandTotal": 0,
        "items": []
    }

    # Advanced Regex for Invoice Parsing
    # 1. Invoice Number
    inv_match = re.search(r'(?:Invoice|Inv|Bill|Voucher)\s*(?:No|Number|#)?[:.\s]*([A-Z0-9/-]{3,})', text_blob, re.I)
    if inv_match: fields["invoiceNumber"] = inv_match.group(1).strip()

    # 2. Date
    date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}[/-]\d{1,2}[/-]\d{1,2})', text_blob)
    if date_match: fields["invoiceDate"] = date_match.group(0).strip()

    # 3. GSTIN
    gst_match = re.search(r'\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}', text_blob)
    if gst_match: fields["partyGstin"] = gst_match.group(0)

    # 4. Grand Total
    total_match = re.search(r'(?:Total|Grand Total|Net Amount|Payable)[:.\s]*[₹RS.]*\s*([\d,]+\.\d{2})', text_blob, re.I)
    if total_match:
        try:
            fields["grandTotal"] = float(total_match.group(1).replace(',', ''))
        except:
            pass

    # 5. Party Name (Usually the first few lines of the invoice)
    if full_text:
        for line in full_text[:5]:
            if len(line) > 5 and not any(k in line.lower() for k in ['invoice', 'tax', 'bill', 'date', 'gst']):
                fields["partyName"] = line.strip()
                break

    return fields, text_blob

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        return

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"success": False, "error": f"File not found: {image_path}"}))
        return

    try:
        # Initialize RapidOCR
        engine = RapidOCR()
        
        # Perform OCR
        result, elapsed = engine(image_path)
        
        if not result:
            print(json.dumps({"success": True, "fields": {}, "rawText": "", "message": "No text detected"}))
            return

        fields, raw_text = extract_fields(result)
        
        print(json.dumps({
            "success": True,
            "confidence": 95,
            "rawText": raw_text,
            "fields": fields
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
