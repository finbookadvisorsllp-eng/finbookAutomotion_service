from typing import Dict, Any, List, Optional
import re

def calculate_taxes(
    company_state: str,
    party_state: str,
    sales_entries: List[Dict[str, Any]],
    inventory_entries: Optional[List[Dict[str, Any]]] = None,
    tcs_amount: float = 0.0,
    round_off_amount: float = 0.0,
    additional_charges: Optional[List[Dict[str, Any]]] = None,
    tds_amount: float = 0.0,
    voucher_type: str = "sales_invoice"
) -> Dict[str, Any]:
    """
    State-based GST Calculation Engine using Excel-aligned Proportional Allocation.
    Determines tax type and calculates GST components (CGST, SGST, IGST, CESS)
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
    cess_total = 0.0

    # Extract CESS rate from any CESS ledger in sales_entries or additional_charges
    cess_rate = 0.0
    has_cess_ledger = False
    cess_ledger_amt = 0.0
    all_ledgers_for_cess = (sales_entries or []) + (additional_charges or [])
    for c in all_ledgers_for_cess:
        name = (c.get("ledgerName") or c.get("ledger") or c.get("ledger_name") or "").upper()
        if "CESS" in name:
            has_cess_ledger = True
            match = re.search(r"(\d+(?:\.\d+)?)\s*%", name)
            if match:
                cess_rate = float(match.group(1))
            else:
                cess_ledger_amt += float(c.get("amount") or 0.0)
    
    if inventory_entries:
        # Step 1: Calculate Inventory Total
        inventory_total = 0.0
        for entry in inventory_entries:
            inventory_total += float(entry.get("amount") or 0.0)
            
        # Step 2: Calculate Total Additional Charges
        ledger_total = 0.0
        if sales_entries:
            for entry in sales_entries:
                entry_name = (entry.get("ledgerName") or entry.get("ledger_name") or "").upper()
                is_tax_entry = any(tok in entry_name for tok in ["CGST", "SGST", "IGST", "UTGST", "CESS"])
                if not is_tax_entry:
                    ledger_total += float(entry.get("amount") or 0.0)
                    
        additional_charges_non_tax = 0.0
        if additional_charges:
            for c in additional_charges:
                name = (c.get("ledgerName") or c.get("ledger_name") or "").upper()
                is_tax = any(tok in name for tok in ["CGST", "SGST", "IGST", "UTGST", "CESS"])
                if not is_tax:
                    additional_charges_non_tax += float(c.get("amount") or 0.0)
                
        total_additional_charges = ledger_total + additional_charges_non_tax
        
        # Step 3, 4, 5, 6: Distribute and calculate taxes item-wise
        item_count = len(inventory_entries)
        
        for entry in inventory_entries:
            item_amount = float(entry.get("amount") or 0.0)
            gst_rate = float(entry.get("gstRate") or entry.get("taxRate") or entry.get("gst_rate") or 0.0)
            taxability = entry.get("taxabilityType") or entry.get("taxability_type") or "Taxable"
            rcm = entry.get("rcm") or False
            is_taxable = taxability == "Taxable" and not rcm
            
            # Ratio calculation
            if inventory_total > 0:
                ratio = item_amount / inventory_total
            else:
                ratio = 1.0 / item_count if item_count > 0 else 0.0
                
            # Distributed Charge
            distributed_charge = round(ratio * total_additional_charges, 2)
            
            # New Taxable Value
            taxable_amount = round(item_amount + distributed_charge, 2)
            
            # Calculate GST
            cgst = 0.0
            sgst = 0.0
            igst = 0.0
            cess = 0.0
            
            if is_taxable:
                gst_amt = taxable_amount * gst_rate / 100.0
                if is_intra_state:
                    cgst = round(gst_amt / 2.0, 2)
                    sgst = round(gst_amt / 2.0, 2)
                    cgst_total += cgst
                    sgst_total += sgst
                else:
                    igst = round(gst_amt, 2)
                    igst_total += igst
                
                # Calculate CESS
                line_cess_rate = float(entry.get("cessRate") or entry.get("cess_rate") or 0.0)
                if line_cess_rate <= 0.0:
                    line_cess_rate = cess_rate
                if line_cess_rate > 0.0:
                    cess = round(taxable_amount * line_cess_rate / 100.0, 2)
                    cess_total += cess
            
            total_tax = cgst + sgst + igst + cess
            
            # Populate entry dictionary directly with CamelCase and snake_case fields
            entry["itemAmount"] = round(item_amount, 2)
            entry["item_amount"] = round(item_amount, 2)
            entry["gstRate"] = gst_rate
            entry["gst_rate"] = gst_rate
            entry["ratio"] = round(ratio, 4)
            entry["distributedCharge"] = distributed_charge
            entry["distributed_charge"] = distributed_charge
            entry["taxableAmount"] = taxable_amount
            entry["taxable_amount"] = taxable_amount
            entry["cgst"] = cgst
            entry["sgst"] = sgst
            entry["igst"] = igst
            entry["cess"] = cess
            entry["totalTax"] = total_tax
            entry["total_tax"] = total_tax
            
        base_amount = sum(float(item.get("taxableAmount") or 0.0) for item in inventory_entries)
        
    else:
        # without_item mode: only sales_entries (excluding tax ledgers)
        for entry in sales_entries:
            name = (entry.get("ledgerName") or entry.get("ledger_name") or "").upper()
            is_tax = any(tok in name for tok in ["CGST", "SGST", "IGST", "UTGST", "CESS"])
            if is_tax:
                continue
                
            amount = float(entry.get("amount") or 0.0)
            gst_rate = float(entry.get("gstRate") or entry.get("taxRate") or entry.get("gst_rate") or 0.0)
            
            base_amount += amount
            gst_amt = (amount * gst_rate) / 100.0
            
            cgst = 0.0
            sgst = 0.0
            igst = 0.0
            cess = 0.0
            
            if is_intra_state:
                cgst = round(gst_amt / 2.0, 2)
                sgst = round(gst_amt / 2.0, 2)
                cgst_total += cgst
                sgst_total += sgst
            else:
                igst = round(gst_amt, 2)
                igst_total += igst
                
            # Calculate CESS
            line_cess_rate = float(entry.get("cessRate") or entry.get("cess_rate") or 0.0)
            if line_cess_rate <= 0.0:
                line_cess_rate = cess_rate
            if line_cess_rate > 0.0:
                cess = round(amount * line_cess_rate / 100.0, 2)
                cess_total += cess
                
            # Set values on entry just in case
            entry["taxableAmount"] = amount
            entry["taxable_amount"] = amount
            entry["cgst"] = cgst
            entry["sgst"] = sgst
            entry["igst"] = igst
            entry["cess"] = cess
            entry["totalTax"] = cgst + sgst + igst + cess
            entry["total_tax"] = cgst + sgst + igst + cess
            
    # If CESS rate wasn't in any name but CESS ledger amount is manually specified, use it
    if cess_total == 0.0 and has_cess_ledger and cess_ledger_amt > 0.0:
        cess_total = cess_ledger_amt

    # Round totals to 2 decimal places
    base_amount = round(base_amount, 2)
    cgst_total = round(cgst_total, 2)
    sgst_total = round(sgst_total, 2)
    igst_total = round(igst_total, 2)
    cess_total = round(cess_total, 2)
    
    # Calculate additional charges total excluding tax ledgers (CGST, SGST, IGST, UTGST, CESS)
    additional_charges_total = 0.0
    if additional_charges:
        for c in additional_charges:
            name = (c.get("ledgerName") or c.get("ledger_name") or "").upper()
            is_tax = any(tok in name for tok in ["CGST", "SGST", "IGST", "UTGST", "CESS"])
            if not is_tax:
                additional_charges_total += float(c.get("amount") or 0.0)
            
    # Invoice Total = Base Amount + CGST + SGST + IGST + Cess + TCS + RoundOff - TDS
    vch_lower = (voucher_type or "").lower().strip()
    is_sales_or_purchase = any(x in vch_lower for x in ["sales", "credit_note", "credit note", "purchase", "debit_note", "debit note"])
    is_with_item = bool(inventory_entries)
    
    if is_sales_or_purchase and is_with_item:
        # Base Amount already includes additional charges, so do not add them again
        grand_total = (
            base_amount + cgst_total + sgst_total + igst_total + cess_total +
            float(tcs_amount or 0.0) + float(round_off_amount or 0.0) - float(tds_amount or 0.0)
        )
    else:
        grand_total = (
            base_amount + cgst_total + sgst_total + igst_total + cess_total +
            additional_charges_total + float(tcs_amount or 0.0) +
            float(round_off_amount or 0.0) - float(tds_amount or 0.0)
        )
    grand_total = round(grand_total, 2)
    
    return {
        "isIntraState": is_intra_state,
        "taxType": tax_type,
        "baseAmount": base_amount,
        "cgstAmount": cgst_total,
        "sgstAmount": sgst_total,
        "igstAmount": igst_total,
        "cessAmount": cess_total,
        "grandTotal": grand_total,
        "inventoryEntries": inventory_entries or [],
        "salesEntries": sales_entries or [],
        "gstSummary": {
            "taxableValue": base_amount,
            "cgst": cgst_total,
            "sgst": sgst_total,
            "igst": igst_total,
            "cess": cess_total
        }
    }
