from typing import Dict, Any, List, Optional

def calculate_taxes(
    company_state: str,
    party_state: str,
    sales_entries: List[Dict[str, Any]],
    inventory_entries: Optional[List[Dict[str, Any]]] = None,
    tcs_amount: float = 0.0,
    round_off_amount: float = 0.0,
    additional_charges: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    State-based GST Calculation Engine.
    Determines tax type and calculates GST components (CGST, SGST, IGST)
    for each line in sales_entries or inventory_entries. Returns totals and summaries.
    """
    company_state_clean = (company_state or "").strip().lower()
    party_state_clean = (party_state or "").strip().lower()
    
    # Default to true (CGST_SGST) if one of the states is missing to avoid calculation errors
    if not company_state_clean or not party_state_clean:
        is_intra_state = True
    else:
        is_intra_state = company_state_clean == party_state_clean
        
    tax_type = "CGST_SGST" if is_intra_state else "IGST"
    
    base_amount = 0.0
    cgst_total = 0.0
    sgst_total = 0.0
    igst_total = 0.0
    
    entries_to_calculate = inventory_entries if inventory_entries else sales_entries
    
    for entry in entries_to_calculate:
        amount = float(entry.get("amount") or 0.0)
        gst_rate = float(entry.get("gstRate") or 0.0)
        
        base_amount += amount
        gst_amt = (amount * gst_rate) / 100.0
        
        if is_intra_state:
            cgst_total += gst_amt / 2.0
            sgst_total += gst_amt / 2.0
        else:
            igst_total += gst_amt
            
    # Round totals to 2 decimal places
    base_amount = round(base_amount, 2)
    cgst_total = round(cgst_total, 2)
    sgst_total = round(sgst_total, 2)
    igst_total = round(igst_total, 2)
    
    # Calculate additional charges total
    additional_charges_total = 0.0
    if additional_charges:
        for c in additional_charges:
            additional_charges_total += float(c.get("amount") or 0.0)
            
    # Grand Total = baseAmount + cgstAmount + sgstAmount + igstAmount + additionalCharges + tcsAmount + roundOffAmount
    grand_total = base_amount + cgst_total + sgst_total + igst_total + additional_charges_total + float(tcs_amount or 0.0) + float(round_off_amount or 0.0)
    grand_total = round(grand_total, 2)
    
    return {
        "isIntraState": is_intra_state,
        "taxType": tax_type,
        "baseAmount": base_amount,
        "cgstAmount": cgst_total,
        "sgstAmount": sgst_total,
        "igstAmount": igst_total,
        "grandTotal": grand_total,
        "gstSummary": {
            "taxableValue": base_amount,
            "cgst": cgst_total,
            "sgst": sgst_total,
            "igst": igst_total
        }
    }
