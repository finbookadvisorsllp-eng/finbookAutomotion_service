import os
import re
from datetime import datetime
import xml.etree.ElementTree as ET
from typing import List
from app.anjalee.services.tally.voucher_mapper import TallyVoucher, TallyLedgerEntry, TallyInventoryEntry

def escape_xml(val: str) -> str:
    """Escapes XML special characters."""
    if not val:
        return ""
    val_str = str(val)
    return (val_str.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace('"', "&quot;")
                   .replace("'", "&apos;"))

def format_qty(qty: float, unit: str) -> str:
    """Formats quantity with its Unit of Measure suffix."""
    qty_val = abs(qty)
    qty_str = f"{int(qty_val)}" if qty_val.is_integer() else f"{qty_val:.2f}"
    if unit:
        return f"{qty_str} {unit}"
    return qty_str

def format_rate(rate: float, unit: str) -> str:
    """Formats rate with its Unit of Measure divisor suffix."""
    rate_val = abs(rate)
    if unit:
        return f"{rate_val:.2f}/{unit}"
    return f"{rate_val:.2f}"

def escapeXml(val: str) -> str:
    """Escapes XML special characters."""
    return escape_xml(val)

def buildOptionalXmlField(tag: str, val: str, is_nil: bool = False) -> str:
    """Formats an optional field for Tally XML."""
    if not val or str(val).strip().upper() in ["", "NULL", "NONE", "UNDEFINED", "N/A"]:
        if is_nil:
            return f'<{tag} p6:nil="true" xmlns:p6="http://www.w3.org/2001/XMLSchema-instance" />'
        return f'<{tag} />'
    return f'<{tag}>{escapeXml(val)}</{tag}>'

def parse_float(val, default: float = 0.0) -> float:
    """Safely converts string/number with %, commas, or spaces to float."""
    if val is None or val == "":
        return default
    try:
        val_str = str(val).replace("%", "").replace(",", "").strip()
        return float(val_str)
    except (ValueError, TypeError):
        return default

def transformBoolean(val) -> str:

    """Converts boolean or truthy value to Tally's 'Yes'/'No'."""
    if val is None or val == "":
        return "No"
    # Match truthy representation
    val_lower = str(val).strip().lower()
    if val_lower in ["true", "yes", "1", "active", "y"]:
        return "Yes"
    elif val_lower in ["false", "no", "0", "inactive", "n"]:
        return "No"
    return "Yes" if bool(val) else "No"

def transformOpeningBalance(amt, btype_str) -> str:
    """Determines opening balance sign/value according to Tally's expected convention."""
    try:
        opening_bal = abs(float(amt))
    except (ValueError, TypeError):
        opening_bal = 0.0
    if opening_bal == 0.0:
        return "0.00"
    
    # If Credit, Tally expects negative sign
    btype_upper = str(btype_str).upper()
    if btype_upper.startswith("C") or btype_upper.startswith("CR") or btype_upper == "CREDIT":
        return f"-{opening_bal:.2f}"
    return f"{opening_bal:.2f}"


def transformState(val) -> str:
    """Transforms state (removes prefix/suffix GST codes if present, e.g. 'Maharashtra (27)' -> 'Maharashtra')."""
    if not val:
        return ""
    state_str = str(val)
    if " (" in state_str:
        state_str = state_str.split(" (")[0]
    return state_str.strip()

def transformGST(val) -> str:
    """Escapes and formats GSTIN code."""
    if not val or str(val).strip().upper() in ["N/A", "NULL", "NONE", "UNDEFINED"]:
        return ""
    return str(val).strip()

def transformAddress(addr_list) -> list:
    """Normalizes address fields into a list of strings."""
    if not addr_list:
        return []
    if isinstance(addr_list, str):
        return [addr_list]
    return [str(a).strip() for a in addr_list if a]

def transformAliases(aliases) -> list:
    """Normalizes aliases array."""
    if not aliases:
        return []
    if isinstance(aliases, str):
        return [aliases]
    return [str(a).strip() for a in aliases if a]

def transformBankDetails(ledger: dict) -> dict:
    """Extracts bank details from nested/flat ledger payload."""
    bd = ledger.get("bankDetails") if isinstance(ledger.get("bankDetails"), dict) else {}
    pd = ledger.get("partyDetails") if isinstance(ledger.get("partyDetails"), dict) else {}
    p_bd = pd.get("bankDetails") if isinstance(pd.get("bankDetails"), dict) else {}
    
    bank_name = bd.get("bankName") or ledger.get("bankName") or p_bd.get("bankName") or ""
    branch = bd.get("branchName") or ledger.get("branchName") or ledger.get("branch") or p_bd.get("branchName") or ""
    acct = bd.get("accountNumber") or ledger.get("accountNumber") or ledger.get("acctNo") or p_bd.get("accountNumber") or ""
    ifsc = bd.get("ifscCode") or ledger.get("ifscCode") or ledger.get("ifsc") or p_bd.get("ifscCode") or ""
    favouring = bd.get("paymentFavouring") or ledger.get("paymentFavouring") or pd.get("paymentFavouring") or ledger.get("ledgerName") or ""

    return {
        "bankName": str(bank_name).strip(),
        "branch": str(branch).strip(),
        "accountNumber": str(acct).strip(),
        "ifsc": str(ifsc).strip(),
        "favouring": str(favouring).strip()
    }


def build_bank_details_xml(tally_ledger: dict) -> str:
    """Builds <PAYMENTDETAILS.LIST> XML structure only when bank details exist."""
    bd = tally_ledger.get("banking") or {}
    bank_name = bd.get("bankName") or ""
    branch = bd.get("branch") or ""
    acct = bd.get("accountNumber") or ""
    ifsc = bd.get("ifsc") or ""
    favouring = bd.get("favouring") or tally_ledger.get("ledgerName") or ""

    if not (bank_name or branch or acct or ifsc):
        return ""

    e = escapeXml
    lines = ["      <PAYMENTDETAILS.LIST>"]
    if ifsc:
        lines.append(f"       <IFSCODE>{e(ifsc)}</IFSCODE>")
    if bank_name:
        lines.append(f"       <BANKNAME>{e(bank_name)}</BANKNAME>")
    if acct:
        lines.append(f"       <ACCOUNTNUMBER>{e(acct)}</ACCOUNTNUMBER>")
    if favouring:
        lines.append(f"       <PAYMENTFAVOURING>{e(favouring)}</PAYMENTFAVOURING>")
    lines.append("       <TRANSACTIONNAME>e-Fund Transfer</TRANSACTIONNAME>")
    lines.append("       <SETASDEFAULT>Yes</SETASDEFAULT>")
    lines.append("       <DEFAULTTRANSACTIONTYPE>e-Fund Transfer</DEFAULTTRANSACTIONTYPE>")
    lines.append("      </PAYMENTDETAILS.LIST>")
    return "\n".join(lines)



def build_contact_details_xml(tally_ledger: dict) -> str:
    """Builds <CONTACTDETAILS.LIST> XML structure only when contact details exist."""
    contact_person = tally_ledger.get("contactPerson") or ""
    phone = tally_ledger.get("phone") or ""
    mobile = tally_ledger.get("mobile") or ""
    email = tally_ledger.get("email") or ""

    if not (contact_person or phone or mobile or email):
        return ""

    e = escapeXml
    lines = ["      <CONTACTDETAILS.LIST>"]
    if contact_person:
        lines.append(f"       <NAME>{e(contact_person)}</NAME>")
        lines.append(f"       <CONTACTPERSON>{e(contact_person)}</CONTACTPERSON>")
    if phone:
        lines.append(f"       <PHONE>{e(phone)}</PHONE>")
    if mobile:
        lines.append(f"       <MOBILE>{e(mobile)}</MOBILE>")
    if email:
        lines.append(f"       <EMAIL>{e(email)}</EMAIL>")
    lines.append("      </CONTACTDETAILS.LIST>")
    return "\n".join(lines)


def ledgerToTallyMapper(ledger: dict) -> dict:
    """Maps a MongoDB Ledger document to a normalized Tally Ledger object directly without sample fallbacks."""
    from app.anjalee.services.tally.mappings.ledger_mapping import LEDGER_MAPPING
    
    tally_ledger = {}
    
    def resolve_path(doc, path):
        keys = path.split('.')
        curr = doc
        for k in keys:
            if isinstance(curr, dict):
                curr = curr.get(k)
            else:
                return None
        return curr

    for item in LEDGER_MAPPING:
        tally_field = item["tallyField"]
        mongo_path = item["mongoField"]
        transform_type = item.get("transform")
        
        # Get raw value
        raw_val = resolve_path(ledger, mongo_path)
        # Fallback to top-level if nested path was not present (for flat entries)
        if raw_val is None and '.' in mongo_path:
            fallback_key = mongo_path.split('.')[-1]
            raw_val = ledger.get(fallback_key)
            
        # Apply transformation
        if transform_type == "boolean":
            tally_ledger[tally_field] = transformBoolean(raw_val)
        elif transform_type == "state":
            tally_ledger[tally_field] = transformState(raw_val)
        elif transform_type == "address":
            tally_ledger[tally_field] = transformAddress(raw_val)
        elif transform_type == "string":
            tally_ledger[tally_field] = str(raw_val).strip() if raw_val is not None else ""
        else:
            tally_ledger[tally_field] = raw_val

    # Opening balance & IsDeemedPositive
    bal_obj = ledger.get("balances", {}).get("openingBalance") if isinstance(ledger.get("balances"), dict) else None
    if not bal_obj or not isinstance(bal_obj, dict):
        bal_obj = ledger.get("openingBalance") if isinstance(ledger.get("openingBalance"), dict) else {}

    if isinstance(bal_obj, dict):
        amt = bal_obj.get("amount") if bal_obj.get("amount") is not None else ledger.get("openingBalanceAmount")
        btype = bal_obj.get("type") or ledger.get("openingBalanceType") or "DR"
    else:
        amt = ledger.get("openingBalance") or ledger.get("openingBalanceAmount") or 0.0
        btype = ledger.get("openingBalanceType") or "DR"

    if amt is None:
        amt = 0.0

    btype_str = str(btype).upper()
    is_deemed_positive = "Yes" if (btype_str.startswith("D") or btype_str == "DEBIT") else "No"
        
    tally_ledger["isDeemedPositive"] = is_deemed_positive
    tally_ledger["openingBalance"] = transformOpeningBalance(amt, btype_str)
    tally_ledger["banking"] = transformBankDetails(ledger)

    raw_aliases = ledger.get("nameAliases")
    if raw_aliases is None or raw_aliases == "":
        raw_aliases = ledger.get("alias")
    tally_ledger["aliases"] = transformAliases(raw_aliases)
    
    cl = ledger.get("creditLimit") if ledger.get("creditLimit") is not None else ledger.get("terms", {}).get("creditLimit")
    if cl is not None and str(cl).strip() != "":
        try:
            cl_num = float(cl)
            cl_str = f"{int(cl_num)}" if cl_num.is_integer() else f"{cl_num}"
        except ValueError:
            cl_str = str(cl).strip()
        tally_ledger["creditLimit"] = cl_str
    else:
        tally_ledger["creditLimit"] = ""

    cp = ledger.get("creditPeriod") if ledger.get("creditPeriod") is not None else ledger.get("terms", {}).get("creditPeriod")
    if cp is not None and str(cp).strip() != "":
        tally_ledger["creditPeriod"] = str(cp).strip()
    else:
        tally_ledger["creditPeriod"] = ""
    
    pd = ledger.get("partyDetails") if isinstance(ledger.get("partyDetails"), dict) else {}
    tally_ledger["contactPerson"] = str(pd.get("contactPerson") or ledger.get("contactPerson") or "").strip()
    tally_ledger["phone"] = str(pd.get("phone") or ledger.get("phone") or pd.get("phoneNumber") or ledger.get("phoneNumber") or "").strip()
    tally_ledger["mobile"] = str(pd.get("mobile") or ledger.get("mobile") or pd.get("mobileNumber") or ledger.get("mobileNumber") or "").strip()
    tally_ledger["email"] = str(pd.get("email") or ledger.get("email") or pd.get("emailId") or ledger.get("emailId") or "").strip()
    tally_ledger["mailingName"] = str(pd.get("mailingName") or ledger.get("mailingName") or tally_ledger["ledgerName"]).strip()


    tally_ledger["country"] = str(pd.get("country") or ledger.get("country") or "").strip()
    tally_ledger["state"] = transformState(pd.get("gstState") or ledger.get("gstState") or pd.get("state") or ledger.get("state") or "")
    tally_ledger["pincode"] = str(pd.get("pinCode") or ledger.get("pinCode") or pd.get("pincode") or ledger.get("pincode") or "").strip()
    tally_ledger["pan"] = str(pd.get("panNumber") or ledger.get("panNumber") or pd.get("pan") or ledger.get("pan") or "").strip()
    tally_ledger["gstin"] = str(pd.get("gstin") or ledger.get("gstin") or pd.get("gst") or "").strip()
    
    reg_type = pd.get("gstRegistrationType") or ledger.get("gstRegistrationType") or ledger.get("registrationType") or ""
    tally_ledger["gstRegistrationType"] = str(reg_type).strip()
    tally_ledger["registrationType"] = str(reg_type).strip()

    addr_raw = pd.get("address") if pd.get("address") is not None else ledger.get("address")
    if not addr_raw and (ledger.get("add1") or ledger.get("add2")):
        addr_raw = [a for a in [ledger.get("add1"), ledger.get("add2")] if a]
    tally_ledger["address"] = transformAddress(addr_raw)

    flags = ledger.get("flags") if isinstance(ledger.get("flags"), dict) else {}
    tally_ledger["ledgerGuid"] = str(ledger.get("ledgerGuid") or "").strip()
    tally_ledger["ledgerCode"] = str(ledger.get("ledgerCode") or "").strip()
    tally_ledger["billWise"] = transformBoolean(flags.get("isBillWiseOn") if "isBillWiseOn" in flags else ledger.get("isBillWiseOn"))
    tally_ledger["costCentre"] = transformBoolean(flags.get("isCostCentresOn") if "isCostCentresOn" in flags else ledger.get("isCostCentresOn"))
    tally_ledger["affectsStock"] = transformBoolean(flags.get("affectsStock") if "affectsStock" in flags else ledger.get("affectsStock"))
    tally_ledger["payroll"] = transformBoolean(flags.get("forPayroll") if "forPayroll" in flags else ledger.get("forPayroll"))
    tally_ledger["interest"] = transformBoolean(flags.get("isInterestOn") if "isInterestOn" in flags else ledger.get("isInterestOn"))
    tally_ledger["isBehaveAsDuty"] = transformBoolean(flags.get("isBehavedAsDuty") if "isBehavedAsDuty" in flags else flags.get("isBehaveAsDuty") if "isBehaveAsDuty" in flags else ledger.get("isBehavedAsDuty"))
    tally_ledger["isEcommOperator"] = transformBoolean(flags.get("isEcommOperator") if "isEcommOperator" in flags else ledger.get("isEcommOperator"))
    tally_ledger["isTransporter"] = transformBoolean(pd.get("isTransporter") if "isTransporter" in pd else ledger.get("isTransporter"))
    
    td = ledger.get("taxDetails") if isinstance(ledger.get("taxDetails"), dict) else {}
    tally_ledger["taxType"] = str(td.get("taxType") or ledger.get("taxType") or "").strip()
    tally_ledger["isGstApplicable"] = transformBoolean(td.get("gstApplicable") if "gstApplicable" in td else ledger.get("gstApplicable"))
    tally_ledger["gstType"] = str(td.get("gstType") or ledger.get("gstType") or "").strip()
    tally_ledger["gstDutyHead"] = str(td.get("gstDutyHead") or ledger.get("gstDutyHead") or "").strip()
    tally_ledger["gstTypeOfSupply"] = str(td.get("gstTypeOfSupply") or ledger.get("gstTypeOfSupply") or "").strip()
    
    tds = ledger.get("tdsDetails") if isinstance(ledger.get("tdsDetails"), dict) else {}
    tally_ledger["isTdsApplicable"] = transformBoolean(tds.get("tdsApplicable") if "tdsApplicable" in tds else ledger.get("tdsApplicable"))
    tally_ledger["isTcsApplicable"] = transformBoolean(tds.get("tcsApplicable") if "tcsApplicable" in tds else ledger.get("tcsApplicable"))

    date_str = ledger.get("openingBalanceDate") or ledger.get("auditInfo", {}).get("createdAt") or ledger.get("createdDate") or ledger.get("createdAt")
    if date_str:
        clean_d = str(date_str).replace("-", "").replace(":", "").replace("T", "").replace(".", "")[:8]
        if len(clean_d) == 8 and clean_d.isdigit():
            tally_ledger["openingBalanceDate"] = clean_d
        else:
            tally_ledger["openingBalanceDate"] = ""
    else:
        tally_ledger["openingBalanceDate"] = ""
    
    return tally_ledger

def build_optional_tag(tag: str, val) -> str:
    """Helper to build XML tag only if value is present and not empty/Not Applicable."""
    if val is None:
        return ""
    val_clean = str(val).strip().replace("&#4;", "").replace("\x04", "").strip()
    if val_clean.lower() in ["", "none", "null", "undefined", "n/a", "not applicable"]:
        return ""
    return f"<{tag}>{escapeXml(val_clean)}</{tag}>"


def _yn(val) -> str:
    """Shortcut: convert bool/truthy to Yes/No."""
    return transformBoolean(val)


def generateTallyLedgerXML(tally_ledger: dict) -> str:
    """Generates Tally Prime-compatible Ledger XML directly from normalized tally_ledger dict.
    
    Structure follows exact Tally-exported Ledger XML reference:
      ENVELOPE > HEADER > BODY > DATA > TALLYMESSAGE > LEDGER (NAME attr)
    
    No template file is used. All XML is built in Python.
    """
    e = escapeXml  # shorthand
    bopt = build_optional_tag  # shorthand

    # ── Core fields ─────────────────────────────────────────────────────────────
    ledger_name   = e(tally_ledger.get("ledgerName") or "")
    parent_group  = e(tally_ledger.get("parentGroupName") or "")
    guid          = tally_ledger.get("ledgerGuid") or ""
    pan           = tally_ledger.get("pan") or ""
    gstin         = tally_ledger.get("gstin") or ""
    reg_type      = tally_ledger.get("gstRegistrationType") or tally_ledger.get("registrationType") or ""
    state         = transformState(tally_ledger.get("state") or "")
    country       = tally_ledger.get("country") or ""
    tax_type      = tally_ledger.get("taxType") or ""
    gst_type      = tally_ledger.get("gstType") or ""
    gst_supply    = tally_ledger.get("gstTypeOfSupply") or ""
    opening_bal   = tally_ledger.get("openingBalance") or "0"
    credit_limit  = tally_ledger.get("creditLimit") or ""
    credit_period = tally_ledger.get("creditPeriod") or ""

    # ── Boolean flags ────────────────────────────────────────────────────────────
    is_bill_wise    = _yn(tally_ledger.get("billWise"))
    is_cost_ctr     = _yn(tally_ledger.get("costCentre"))
    is_interest     = _yn(tally_ledger.get("interest"))
    affects_stock   = _yn(tally_ledger.get("affectsStock"))
    for_payroll     = _yn(tally_ledger.get("payroll"))
    is_tcs          = _yn(tally_ledger.get("isTcsApplicable"))
    is_tds          = _yn(tally_ledger.get("isTdsApplicable"))
    is_gst          = _yn(tally_ledger.get("isGstApplicable"))
    is_behave_duty  = _yn(tally_ledger.get("isBehaveAsDuty"))
    is_transporter  = _yn(tally_ledger.get("isTransporter"))
    is_ecomm        = _yn(tally_ledger.get("isEcommOperator"))

    # ── LANGUAGENAME.LIST ────────────────────────────────────────────────────────
    aliases = tally_ledger.get("aliases") or []
    lang_list_xml = "      <LANGUAGENAME.LIST>\n"
    lang_list_xml += '       <NAME.LIST TYPE="String">\n'
    lang_list_xml += f"        <NAME>{ledger_name}</NAME>\n"
    for alias in aliases:
        alias_s = str(alias).strip()
        if alias_s and alias_s.lower() != ledger_name.lower():
            lang_list_xml += f"        <NAME>{e(alias_s)}</NAME>\n"
    lang_list_xml += "       </NAME.LIST>\n"
    lang_list_xml += "       <LANGUAGEID> 1033</LANGUAGEID>\n"
    lang_list_xml += "      </LANGUAGENAME.LIST>"

    # ── LEDGSTREGDETAILS.LIST ────────────────────────────────────────────────────
    gst_reg_xml = ""
    if gstin or (reg_type and reg_type.lower() not in ["", "unregistered"]):
        from datetime import date
        applicable_from = (tally_ledger.get("openingBalanceDate") or "").strip()
        if not applicable_from or len(applicable_from) != 8 or not applicable_from.isdigit():
            applicable_from = date.today().strftime("%Y%m%d")
        gst_reg_xml = "      <LEDGSTREGDETAILS.LIST>\n"
        gst_reg_xml += f"       <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>\n"
        gst_reg_xml += f"       <GSTREGISTRATIONTYPE>{e(reg_type)}</GSTREGISTRATIONTYPE>\n"
        if state:
            gst_reg_xml += f"       <PLACEOFSUPPLY>{e(state)}</PLACEOFSUPPLY>\n"
        if gstin:
            gst_reg_xml += f"       <GSTIN>{e(gstin)}</GSTIN>\n"
        gst_reg_xml += "       <ISOTHTERRITORYASSESSEE>No</ISOTHTERRITORYASSESSEE>\n"
        gst_reg_xml += "       <CONSIDERPURCHASEFOREXPORT>No</CONSIDERPURCHASEFOREXPORT>\n"
        gst_reg_xml += f"       <ISTRANSPORTER>{is_transporter}</ISTRANSPORTER>\n"
        gst_reg_xml += "       <ISCOMMONPARTY>No</ISCOMMONPARTY>\n"
        gst_reg_xml += "      </LEDGSTREGDETAILS.LIST>"
    else:
        gst_reg_xml = "      <LEDGSTREGDETAILS.LIST>      </LEDGSTREGDETAILS.LIST>"

    # ── LEDMAILINGDETAILS.LIST ───────────────────────────────────────────────────
    addr_list   = tally_ledger.get("address") or []
    mailing_nm  = tally_ledger.get("mailingName") or tally_ledger.get("ledgerName") or ""
    pincode     = tally_ledger.get("pincode") or ""

    mailing_xml = "      <LEDMAILINGDETAILS.LIST>\n"
    if addr_list:
        mailing_xml += '       <ADDRESS.LIST TYPE="String">\n'
        for addr in addr_list:
            addr_s = str(addr).strip()
            if addr_s:
                mailing_xml += f"        <ADDRESS>{e(addr_s)}</ADDRESS>\n"
        mailing_xml += "       </ADDRESS.LIST>\n"
    else:
        mailing_xml += '       <ADDRESS.LIST TYPE="String">      </ADDRESS.LIST>\n'

    from datetime import date
    mailing_applicable = (tally_ledger.get("openingBalanceDate") or "").strip()
    if not mailing_applicable or len(mailing_applicable) != 8 or not mailing_applicable.isdigit():
        mailing_applicable = date.today().strftime("%Y%m%d")

    mailing_xml += f"       <APPLICABLEFROM>{mailing_applicable}</APPLICABLEFROM>\n"
    if pincode:
        mailing_xml += f"       <PINCODE>{e(pincode)}</PINCODE>\n"
    if mailing_nm:
        mailing_xml += f"       <MAILINGNAME>{e(mailing_nm)}</MAILINGNAME>\n"
    if state:
        mailing_xml += f"       <STATE>{e(state)}</STATE>\n"
    if country:
        mailing_xml += f"       <COUNTRY>{e(country)}</COUNTRY>\n"
    mailing_xml += "      </LEDMAILINGDETAILS.LIST>"

    # ── Credit limit / period (only if present) ──────────────────────────────────
    credit_limit_xml  = bopt("CREDITLIMIT", credit_limit)
    credit_period_xml = bopt("BILLCREDITPERIOD", credit_period)


    # ── Build the full XML ───────────────────────────────────────────────────────
    lines = []
    L = lines.append   # shorthand

    L('      <TALLYMESSAGE>')
    L(f'        <LEDGER NAME="{ledger_name}" RESERVEDNAME="">')
    L('          <OLDAUDITENTRYIDS.LIST TYPE="Number">')
    L('           <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>')
    L('          </OLDAUDITENTRYIDS.LIST>')

    # GUID tag omitted as per user request




    L('          <CURRENCYNAME>&#8377;</CURRENCYNAME>')   # ₹ as named entity

    # State / PAN / GST reg type
    if state:
        L(f'          <PRIORSTATENAME>{e(state)}</PRIORSTATENAME>')
    if pan:
        L(f'          <INCOMETAXNUMBER>{e(pan)}</INCOMETAXNUMBER>')
    if reg_type:
        L(f'          <GSTREGISTRATIONTYPE>{e(reg_type)}</GSTREGISTRATIONTYPE>')

    L(f'          <PARENT>{parent_group}</PARENT>')
    L('          <OBJECTUPDATEACTION/>')

    # Tax classification / type
    L('          <TAXCLASSIFICATIONNAME>&#4; Not Applicable</TAXCLASSIFICATIONNAME>')
    if tax_type:
        L(f'          <TAXTYPE>{e(tax_type)}</TAXTYPE>')
    else:
        L('          <TAXTYPE>Others</TAXTYPE>')

    # Country
    if country:
        L(f'          <COUNTRYOFRESIDENCE>{e(country)}</COUNTRYOFRESIDENCE>')

    # GST type
    if gst_type and gst_type.lower() not in ["not applicable", "n/a", ""]:
        L(f'          <GSTTYPE>{e(gst_type)}</GSTTYPE>')
    else:
        L('          <GSTTYPE>&#4; Not Applicable</GSTTYPE>')

    L('          <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>')

    # GSTIN at root level
    if gstin:
        L(f'          <PARTYGSTIN>{e(gstin)}</PARTYGSTIN>')

    # GST nature of supply
    if gst_supply and gst_supply.lower() not in ["not applicable", "n/a", ""]:
        L(f'          <GSTNATUREOFSUPPLY>{e(gst_supply)}</GSTNATUREOFSUPPLY>')

    L('          <SERVICECATEGORY>&#4; Not Applicable</SERVICECATEGORY>')
    L('          <EXCISELEDGERCLASSIFICATION>&#4; Not Applicable</EXCISELEDGERCLASSIFICATION>')
    L('          <EXCISEDUTYTYPE>&#4; Not Applicable</EXCISEDUTYTYPE>')
    L('          <EXCISENATUREOFPURCHASE>&#4; Not Applicable</EXCISENATUREOFPURCHASE>')
    L('          <LEDGERFBTCATEGORY>&#4; Not Applicable</LEDGERFBTCATEGORY>')

    # ── Boolean flags (Tally reference order) ───────────────────────────────────
    L(f'          <ISBILLWISEON>{is_bill_wise}</ISBILLWISEON>')
    L(f'          <ISCOSTCENTRESON>{is_cost_ctr}</ISCOSTCENTRESON>')
    L(f'          <ISINTERESTON>{is_interest}</ISINTERESTON>')
    L('          <ALLOWINMOBILE>No</ALLOWINMOBILE>')
    L('          <ISCOSTTRACKINGON>No</ISCOSTTRACKINGON>')
    L('          <ISBENEFICIARYCODEON>No</ISBENEFICIARYCODEON>')
    L('          <ISEXPORTONVCHCREATE>No</ISEXPORTONVCHCREATE>')
    L('          <PLASINCOMEEXPENSE>No</PLASINCOMEEXPENSE>')
    L('          <ISUPDATINGTARGETID>No</ISUPDATINGTARGETID>')
    L('          <ISDELETED>No</ISDELETED>')
    L('          <ISSECURITYONWHENENTERED>No</ISSECURITYONWHENENTERED>')
    L('          <ASORIGINAL>Yes</ASORIGINAL>')
    L('          <ISCONDENSED>No</ISCONDENSED>')
    L(f'          <AFFECTSSTOCK>{affects_stock}</AFFECTSSTOCK>')
    L('          <ISRATEINCLUSIVEVAT>No</ISRATEINCLUSIVEVAT>')
    L(f'          <FORPAYROLL>{for_payroll}</FORPAYROLL>')
    L('          <ISABCENABLED>No</ISABCENABLED>')
    L('          <ISCREDITDAYSCHKON>No</ISCREDITDAYSCHKON>')
    L('          <INTERESTONBILLWISE>No</INTERESTONBILLWISE>')
    L('          <OVERRIDEINTEREST>No</OVERRIDEINTEREST>')
    L('          <OVERRIDEADVINTEREST>No</OVERRIDEADVINTEREST>')
    L('          <USEFORVAT>No</USEFORVAT>')
    L('          <IGNORETDSEXEMPT>No</IGNORETDSEXEMPT>')
    L(f'          <ISTCSAPPLICABLE>{is_tcs}</ISTCSAPPLICABLE>')
    L(f'          <ISTDSAPPLICABLE>{is_tds}</ISTDSAPPLICABLE>')
    L('          <ISFBTAPPLICABLE>No</ISFBTAPPLICABLE>')
    L(f'          <ISGSTAPPLICABLE>{is_gst}</ISGSTAPPLICABLE>')
    L('          <ISEXCISEAPPLICABLE>No</ISEXCISEAPPLICABLE>')
    L('          <ISTDSEXPENSE>No</ISTDSEXPENSE>')
    L('          <ISEDLIAPPLICABLE>No</ISEDLIAPPLICABLE>')
    L('          <ISRELATEDPARTY>No</ISRELATEDPARTY>')
    L('          <USEFORESIELIGIBILITY>No</USEFORESIELIGIBILITY>')
    L('          <ISINTERESTINCLLASTDAY>No</ISINTERESTINCLLASTDAY>')
    L('          <APPROPRIATETAXVALUE>No</APPROPRIATETAXVALUE>')
    L(f'          <ISBEHAVEASDUTY>{is_behave_duty}</ISBEHAVEASDUTY>')
    L('          <INTERESTINCLDAYOFADDITION>No</INTERESTINCLDAYOFADDITION>')
    L('          <INTERESTINCLDAYOFDEDUCTION>No</INTERESTINCLDAYOFDEDUCTION>')
    L('          <ISOTHTERRITORYASSESSEE>No</ISOTHTERRITORYASSESSEE>')
    L('          <IGNOREMISMATCHWITHWARNING>No</IGNOREMISMATCHWITHWARNING>')
    L('          <USEASNOTIONALBANK>No</USEASNOTIONALBANK>')
    L('          <BEHAVEASPAYMENTGATEWAY>No</BEHAVEASPAYMENTGATEWAY>')
    L('          <OVERRIDECREDITLIMIT>No</OVERRIDECREDITLIMIT>')
    L('          <ISAGAINSTFORMC>No</ISAGAINSTFORMC>')
    L('          <ISCHEQUEPRINTINGENABLED>No</ISCHEQUEPRINTINGENABLED>')
    L('          <ISPAYUPLOAD>No</ISPAYUPLOAD>')
    L('          <ISPAYBATCHONLYSAL>No</ISPAYBATCHONLYSAL>')
    L('          <ISBNFCODESUPPORTED>No</ISBNFCODESUPPORTED>')
    L('          <ALLOWEXPORTWITHERRORS>No</ALLOWEXPORTWITHERRORS>')
    L('          <CONSIDERPURCHASEFOREXPORT>No</CONSIDERPURCHASEFOREXPORT>')
    L(f'          <ISTRANSPORTER>{is_transporter}</ISTRANSPORTER>')
    L('          <ISECASHLEDGER>No</ISECASHLEDGER>')
    L('          <USEFORNOTIONALITC>No</USEFORNOTIONALITC>')
    L(f'          <ISECOMMOPERATOR>{is_ecomm}</ISECOMMOPERATOR>')
    L('          <OVERRIDEBASEDONREALIZATION>No</OVERRIDEBASEDONREALIZATION>')
    L('          <ISECDIFFINSDATE>No</ISECDIFFINSDATE>')
    L('          <SHOWINPAYSLIP>No</SHOWINPAYSLIP>')
    L('          <USEFORGRATUITY>No</USEFORGRATUITY>')
    L('          <ISTDSPROJECTED>No</ISTDSPROJECTED>')
    L('          <ISSALARYMULFILE>No</ISSALARYMULFILE>')
    L('          <FORSERVICETAX>No</FORSERVICETAX>')
    L('          <ISINPUTCREDIT>No</ISINPUTCREDIT>')
    L('          <ISEXEMPTED>No</ISEXEMPTED>')
    L('          <ISABATEMENTAPPLICABLE>No</ISABATEMENTAPPLICABLE>')
    L('          <ISSTXPARTY>No</ISSTXPARTY>')
    L('          <ISSTXNONREALIZEDTYPE>No</ISSTXNONREALIZEDTYPE>')
    L('          <USEFORKKC>No</USEFORKKC>')
    L('          <USEFORSBC>No</USEFORSBC>')
    L('          <ISUSEDFORCVD>No</ISUSEDFORCVD>')
    L('          <LEDBELONGSTONONTAXABLE>No</LEDBELONGSTONONTAXABLE>')
    L('          <ISEXCISEMERCHANTEXPORTER>No</ISEXCISEMERCHANTEXPORTER>')
    L('          <ISPARTYEXEMPTED>No</ISPARTYEXEMPTED>')
    L('          <ISSEZPARTY>No</ISSEZPARTY>')
    L('          <TDSDEDUCTEEISSPECIALRATE>No</TDSDEDUCTEEISSPECIALRATE>')
    L('          <ISECHEQUESUPPORTED>No</ISECHEQUESUPPORTED>')
    L('          <ISEDDSUPPORTED>No</ISEDDSUPPORTED>')
    L('          <HASECHEQUEDELIVERYMODE>No</HASECHEQUEDELIVERYMODE>')
    L('          <HASECHEQUEDELIVERYTO>No</HASECHEQUEDELIVERYTO>')
    L('          <HASECHEQUEPRINTLOCATION>No</HASECHEQUEPRINTLOCATION>')
    L('          <HASECHEQUEPAYABLELOCATION>No</HASECHEQUEPAYABLELOCATION>')
    L('          <HASECHEQUEBANKLOCATION>No</HASECHEQUEBANKLOCATION>')
    L('          <HASEDDDELIVERYMODE>No</HASEDDDELIVERYMODE>')
    L('          <HASEDDDELIVERYTO>No</HASEDDDELIVERYTO>')
    L('          <HASEDDPRINTLOCATION>No</HASEDDPRINTLOCATION>')
    L('          <HASEDDPAYABLELOCATION>No</HASEDDPAYABLELOCATION>')
    L('          <HASEDDBANKLOCATION>No</HASEDDBANKLOCATION>')
    L('          <ISEBANKINGENABLED>No</ISEBANKINGENABLED>')
    L('          <ISEXPORTFILEENCRYPTED>No</ISEXPORTFILEENCRYPTED>')
    L('          <ISBATCHENABLED>No</ISBATCHENABLED>')
    L('          <ISPRODUCTCODEBASED>No</ISPRODUCTCODEBASED>')
    L('          <HASEDDCITY>No</HASEDDCITY>')
    L('          <HASECHEQUECITY>No</HASECHEQUECITY>')
    L('          <ISFILENAMEFORMATSUPPORTED>No</ISFILENAMEFORMATSUPPORTED>')
    L('          <HASCLIENTCODE>No</HASCLIENTCODE>')
    L('          <PAYINSISBATCHAPPLICABLE>No</PAYINSISBATCHAPPLICABLE>')
    L('          <PAYINSISFILENUMAPP>No</PAYINSISFILENUMAPP>')
    L('          <ISSALARYTRANSGROUPEDFORBRS>No</ISSALARYTRANSGROUPEDFORBRS>')
    L('          <ISEBANKINGSUPPORTED>No</ISEBANKINGSUPPORTED>')
    L('          <ISSCBUAE>No</ISSCBUAE>')
    L('          <ISBANKSTATUSAPP>No</ISBANKSTATUSAPP>')
    L('          <ISSALARYGROUPED>No</ISSALARYGROUPED>')
    L('          <USEFORPURCHASETAX>No</USEFORPURCHASETAX>')
    L('          <BANKISRECONCILEPERFECTMATCHES>No</BANKISRECONCILEPERFECTMATCHES>')
    L('          <ISPYMTADVONLINE>No</ISPYMTADVONLINE>')
    L('          <ISPYMTADVCCENABLED>No</ISPYMTADVCCENABLED>')
    L('          <ISINCLUDEPYMTADVBILLWISE>No</ISINCLUDEPYMTADVBILLWISE>')
    L('          <AUDITED>No</AUDITED>')
    L('          <SORTPOSITION> 1000</SORTPOSITION>')

    # ── Opening balance ─────────────────────────────────────────────────────────
    L(f'          <OPENINGBALANCE>{e(str(opening_bal))}</OPENINGBALANCE>')

    contact_person = tally_ledger.get("contactPerson") or ""
    phone = tally_ledger.get("phone") or ""
    mobile = tally_ledger.get("mobile") or ""
    email = tally_ledger.get("email") or ""

    if contact_person:
        L(f'          <LEDGERCONTACT>{e(contact_person)}</LEDGERCONTACT>')
    if phone:
        L(f'          <LEDGERPHONE>{e(phone)}</LEDGERPHONE>')
    if mobile:
        L(f'          <LEDGERMOBILE>{e(mobile)}</LEDGERMOBILE>')
    if email:
        L(f'          <EMAIL>{e(email)}</EMAIL>')

    # ── Credit limit / period (only if present) ──────────────────────────────────
    if credit_limit_xml:
        L(f'          {credit_limit_xml}')
    if credit_period_xml:
        L(f'          {credit_period_xml}')

    # ── LIST sections ───────────────────────────────────────────────────────────
    L(lang_list_xml)
    L(gst_reg_xml)
    L(mailing_xml)

    bank_details_xml = build_bank_details_xml(tally_ledger)
    contact_details_xml = build_contact_details_xml(tally_ledger)

    if bank_details_xml:
        L(bank_details_xml)
    if contact_details_xml:
        L(contact_details_xml)

    # ── Empty lists from Tally reference (required for proper import) ────────────
    L('      <GSTRECONPREFIXSUFFIXDETAILS.LIST>      </GSTRECONPREFIXSUFFIXDETAILS.LIST>')
    L('      <GSTCLASSFNIGSTRATES.LIST>      </GSTCLASSFNIGSTRATES.LIST>')
    L('      <EXTARIFFDUTYHEADDETAILS.LIST>      </EXTARIFFDUTYHEADDETAILS.LIST>')
    L('      <TEMPGSTITEMSLABRATES.LIST>      </TEMPGSTITEMSLABRATES.LIST>')
    L('      <LEDGSTADDRESS.LIST>      </LEDGSTADDRESS.LIST>')
    L('      <VOUCHERTYPEPRODUCTCODES.LIST>      </VOUCHERTYPEPRODUCTCODES.LIST>')
    L('      <LEDADDRESS.LIST>      </LEDADDRESS.LIST>')
    L('      <DEFMULTIPLETOPHONENO.LIST>      </DEFMULTIPLETOPHONENO.LIST>')

    L('        </LEDGER>')
    L('      </TALLYMESSAGE>')

    ledger_block = "\n".join(lines)

    # ── Wrap in full ENVELOPE ────────────────────────────────────────────────────
    xml_out = '<?xml version="1.0" encoding="utf-8"?>\n'
    xml_out += '<ENVELOPE>\n'
    xml_out += '  <HEADER>\n'
    xml_out += '    <VERSION>1</VERSION>\n'
    xml_out += '    <TALLYREQUEST>IMPORT</TALLYREQUEST>\n'
    xml_out += '    <TYPE>DATA</TYPE>\n'
    xml_out += '    <ID>All Masters</ID>\n'
    xml_out += '  </HEADER>\n'
    xml_out += '  <BODY>\n'
    xml_out += '    <DESC>\n'
    xml_out += '      <STATICVARIABLES />\n'
    xml_out += '    </DESC>\n'
    xml_out += '    <DATA>\n'
    xml_out += ledger_block + "\n"
    xml_out += '    </DATA>\n'
    xml_out += '  </BODY>\n'
    xml_out += '</ENVELOPE>'

    return xml_out

def generate_ledger_xml(ledger_doc: dict) -> str:
    tally_dict = ledgerToTallyMapper(ledger_doc)
    return generateTallyLedgerXML(tally_dict)


def sanitize_xml_text(val: str) -> str:
    """
    Sanitizes text for XML by removing invalid control characters (e.g. &#4;, \x00-\x08, \x0b-\x0c, \x0e-\x1f)
    and escaping XML special characters (&, <, >, ", ').
    Returns a clean UTF-8 string.
    """
    if val is None:
        return ""
    val_str = str(val).strip()
    if not val_str:
        return ""
    # Strip literal &#4; or numeric entity control codes if present
    val_str = re.sub(r'&#\d+;', '', val_str)
    # Strip invalid control characters (below \x20 except \x09, \x0a, \x0d)
    val_str = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x84\x86-\x9f]', '', val_str)
    # Escape XML entities
    return escape_xml(val_str)


def validate_stock_item_dependencies(doc: dict, db=None) -> list:
    """
    Validates master dependencies and opening stock calculations for a Stock Item.
    Returns a list of error message strings. If empty, validation passed.
    """
    errors = []

    item_name = (doc.get("itemName") or doc.get("name") or "").strip()
    if not item_name:
        errors.append("Stock Item Name is required.")

    # 1. Stock Group Validation
    parent_raw = (doc.get("stockGroupName") or doc.get("group") or doc.get("stockGroup") or "").strip()
    if parent_raw and parent_raw.lower() not in ["primary", "general", "primary / general", "none", "n/a", ""]:
        if db is not None:
            group_exists = db["stockGroups"].find_one({"$or": [{"groupName": parent_raw}, {"name": parent_raw}]}) or \
                           db["stockgroups_entry"].find_one({"$or": [{"groupName": parent_raw}, {"name": parent_raw}]})
            if not group_exists:
                errors.append(f"Stock Group '{parent_raw}' does not exist in Tally database.")

    # 2. Stock Category Validation
    category_raw = (doc.get("stockCategoryName") or doc.get("category") or doc.get("stockCategory") or "").strip()
    if category_raw and category_raw.lower() not in ["primary", "general", "not applicable", "n/a", "none", ""]:
        if db is not None:
            cat_exists = db["stockCategories"].find_one({"$or": [{"categoryName": category_raw}, {"stockCategoryName": category_raw}, {"name": category_raw}]}) or \
                         db["stockcategories_entry"].find_one({"$or": [{"categoryName": category_raw}, {"stockCategoryName": category_raw}, {"name": category_raw}]})
            if not cat_exists:
                errors.append(f"Stock Category '{category_raw}' does not exist in Tally database.")

    # 3. Unit Validation
    unit_obj = doc.get("unit") or {}
    if not isinstance(unit_obj, dict):
        unit_obj = {}
    base_unit = (unit_obj.get("baseUnit") or doc.get("baseUnit") or doc.get("unitName") or doc.get("uom") or (unit_obj if isinstance(unit_obj, str) else "") or "").strip()
    if base_unit and base_unit.lower() not in ["not applicable", "n/a", "none", ""]:
        if db is not None:
            unit_exists = db["units"].find_one({"$or": [{"symbol": base_unit}, {"unitName": base_unit}, {"name": base_unit}]}) or \
                          db["units_entry"].find_one({"$or": [{"symbol": base_unit}, {"unitName": base_unit}, {"name": base_unit}]})
            if not unit_exists:
                errors.append(f"Unit '{base_unit}' does not exist in Tally database.")

    # 4. Opening Stock Calculation Validation
    inv_obj = doc.get("inventory") or {}
    if not isinstance(inv_obj, dict):
        inv_obj = {}
    op_stock = inv_obj.get("openingStock") or {}
    if not isinstance(op_stock, dict):
        op_stock = {}

    op_qty = parse_float(inv_obj.get("openingQuantity") or doc.get("openingQuantity") or doc.get("openingQty") or op_stock.get("quantity") or op_stock.get("qty"), 0.0)
    op_rate = parse_float(inv_obj.get("openingRate") or doc.get("openingRate") or doc.get("purchasePrice") or op_stock.get("rate"), 0.0)
    op_val = parse_float(inv_obj.get("openingValue") or doc.get("openingValue") or doc.get("openingAmount") or op_stock.get("value") or op_stock.get("amount"), 0.0)

    if op_qty > 0 and op_rate > 0 and op_val > 0:
        calc_val = op_qty * op_rate
        if abs(calc_val - op_val) > 0.5:
            errors.append(f"Opening Stock calculation mismatch: Quantity ({op_qty}) × Rate ({op_rate}) = {calc_val:.2f}, but Opening Value was given as {op_val:.2f}.")

    return errors


def generate_stock_item_xml(doc: dict, db=None) -> str:
    """
    Generates a CLEAN, MINIMAL, VALID, TALLY-COMPATIBLE Stock Item XML based strictly
    on values configured in UI/database.
    - Validates dependencies and calculations.
    - Strips all invalid XML control characters (&#4;) and escapes entities.
    - Omits empty/disabled/false/VAT/Excise tags and boolean flag dumps.
    - Omits duplicate top-level HSN tags outside HSNDETAILS.LIST.
    """
    # 1. Dependency and calculation validation
    errs = validate_stock_item_dependencies(doc, db=db)
    if errs:
        raise ValueError(" / ".join(errs))

    def e(val) -> str:
        return sanitize_xml_text(val)

    def transform_date(val) -> str:
        if not val:
            return ""
        s = str(val).strip().split("T")[0].replace("-", "").replace("/", "").replace(".", "")
        if len(s) == 8 and s.isdigit():
            return s
        return s

    lines = []
    def L(line_str: str):
        lines.append(line_str)

    item_name = (doc.get("itemName") or doc.get("name") or "Unnamed Stock Item").strip()

    # Action
    action_type = str(doc.get("action") or "").strip()
    header_action = 'ACTION="Alter"' if action_type.lower() == "alter" else 'ACTION="Create"'

    # Parent Group
    parent_raw = (doc.get("stockGroupName") or doc.get("group") or doc.get("stockGroup") or "").strip()
    if parent_raw and parent_raw.lower() not in ["primary", "general", "primary / general", "none", "n/a", ""]:
        parent_group = parent_raw
    else:
        parent_group = ""

    # Category
    raw_category = (doc.get("stockCategoryName") or doc.get("category") or doc.get("stockCategory") or "").strip()
    if raw_category and raw_category.lower() not in ["not applicable", "n/a", "none", "", "null", "undefined", "primary"]:
        category_name = raw_category
    else:
        category_name = ""

    # Base Unit
    unit_obj = doc.get("unit") or {}
    if not isinstance(unit_obj, dict):
        unit_obj = {}
    base_unit = (unit_obj.get("baseUnit") or doc.get("baseUnit") or doc.get("unitName") or doc.get("uom") or (unit_obj if isinstance(unit_obj, str) else "") or "").strip()
    if base_unit.lower() in ["not applicable", "n/a", "none"]:
        base_unit = ""

    # Alternate Unit & Conversion
    alt_unit = (unit_obj.get("alternateUnit") or doc.get("alternateUnit") or (doc.get("inventory") or {}).get("alternateUnitName") or "").strip()
    if alt_unit.lower() in ["not applicable", "n/a", "none", "", base_unit.lower()]:
        alt_unit = ""

    conv_factor = unit_obj.get("conversionFactor") or doc.get("conversionFactor") or (doc.get("inventory") or {}).get("unitsPerPack") or ""
    try:
        conv_factor_num = float(conv_factor) if conv_factor else 0.0
    except (ValueError, TypeError):
        conv_factor_num = 0.0

    # Description
    desc_str = (doc.get("description") or (doc.get("basicInfo") or {}).get("description") or "").strip()

    # Identification
    ident_obj = doc.get("identification") if isinstance(doc.get("identification"), dict) else {}
    barcode = (ident_obj.get("barcode") or doc.get("barcode") or "").strip()
    brand = (ident_obj.get("brand") or doc.get("brand") or "").strip()
    part_no = (ident_obj.get("partNumber") or doc.get("partNumber") or "").strip()

    # Costing / Valuation (ONLY output if user configured explicitly)
    pricing_obj = doc.get("pricing") if isinstance(doc.get("pricing"), dict) else {}
    costing_method = (doc.get("costingMethod") or pricing_obj.get("costingMethod") or "").strip()
    valuation_method = (doc.get("valuationMethod") or pricing_obj.get("valuationMethod") or "").strip()

    # Flags (ONLY output if set to True)
    flags_obj = doc.get("flags") if isinstance(doc.get("flags"), dict) else {}
    tracking_obj = doc.get("tracking") if isinstance(doc.get("tracking"), dict) else {}

    is_cost_center = (flags_obj.get("isCostCenter") or doc.get("isCostCenter") or False)
    is_batch_wise = (tracking_obj.get("maintainBatch") or tracking_obj.get("trackBatches") or flags_obj.get("isBatchWise") or doc.get("trackBatches") or doc.get("isBatchWise") or False)
    is_perishable = (tracking_obj.get("trackExpiry") or flags_obj.get("isPerishable") or doc.get("trackExpiry") or doc.get("isPerishable") or False)
    is_cost_tracking = (flags_obj.get("isCostTrackingOn") or doc.get("isCostTrackingOn") or False)
    has_mfg_date = (tracking_obj.get("trackManufacturingDate") or flags_obj.get("hasMfgDate") or doc.get("trackManufacturingDate") or False)

    # GST Settings
    tax_obj = doc.get("tax") if isinstance(doc.get("tax"), dict) else {}
    gst_settings = doc.get("gstSettings") if isinstance(doc.get("gstSettings"), dict) else {}
    hsn_details = doc.get("hsnSacDetails") if isinstance(doc.get("hsnSacDetails"), dict) else {}

    raw_date = hsn_details.get("applicableFrom") or gst_settings.get("applicableFrom") or doc.get("applicableFrom")
    applicable_from = transform_date(raw_date) if raw_date else ""

    item_nature = str(doc.get("itemNature") or "").upper()
    gst_supply_type = "Services" if "SERVICE" in item_nature else "Goods"

    raw_gst = tax_obj.get("gstRate") or gst_settings.get("gstRate") or doc.get("gstRate") or doc.get("gst")
    if isinstance(raw_gst, str):
        raw_gst = raw_gst.replace("%", "").strip()
    gst_rate = parse_float(raw_gst, 0.0)
    igst_rate = parse_float(tax_obj.get("igstRate") or gst_settings.get("igstRate") or doc.get("igstRate"), gst_rate if gst_rate > 0 else 0.0)
    cgst_rate = parse_float(tax_obj.get("cgstRate") or gst_settings.get("cgstRate") or doc.get("cgstRate"), igst_rate / 2.0 if igst_rate > 0 else 0.0)
    sgst_rate = parse_float(tax_obj.get("sgstRate") or gst_settings.get("sgstRate") or doc.get("sgstRate"), igst_rate / 2.0 if igst_rate > 0 else 0.0)
    
    cess_enabled = doc.get("cessEnabled") if "cessEnabled" in doc else (True if parse_float(tax_obj.get("cessRate") or gst_settings.get("cessRate") or doc.get("cessRate"), 0.0) > 0 else False)
    cess_rate = parse_float(tax_obj.get("cessRate") or gst_settings.get("cessRate") or doc.get("cessRate"), 0.0) if cess_enabled else 0.0

    taxability = tax_obj.get("taxability") or gst_settings.get("taxability") or doc.get("taxability") or ("Taxable" if gst_rate > 0 else "")
    gst_applicable_flag = doc.get("gstApplicable") if "gstApplicable" in doc else (True if (gst_rate > 0 or taxability) else False)

    # HSN Code & Description
    hsn_code = str(tax_obj.get("hsnCode") or tax_obj.get("sacCode") or hsn_details.get("hsnCode") or hsn_details.get("hsn") or doc.get("hsnCode") or doc.get("hsn") or "").strip()
    hsn_desc_val = (tax_obj.get("hsnDescription") or hsn_details.get("hsnDescription") or doc.get("hsnDescription") or "").strip()
    hsn_name = hsn_desc_val if hsn_desc_val else item_name

    # Opening Stock
    inv_obj = doc.get("inventory") if isinstance(doc.get("inventory"), dict) else {}
    op_stock = inv_obj.get("openingStock") if isinstance(inv_obj.get("openingStock"), dict) else {}

    raw_op_balance = doc.get("openingBalance") or op_stock.get("balance") or ""
    op_qty_val = parse_float(inv_obj.get("openingQuantity") or doc.get("openingQuantity") or doc.get("openingQty") or op_stock.get("quantity") or op_stock.get("qty"), 0.0)
    op_rate_val = parse_float(inv_obj.get("openingRate") or doc.get("openingRate") or doc.get("purchasePrice") or op_stock.get("rate"), 0.0)
    op_amt_val = parse_float(inv_obj.get("openingValue") or doc.get("openingValue") or doc.get("openingAmount") or op_stock.get("value") or op_stock.get("amount"), op_qty_val * op_rate_val)

    has_opening_stock = (op_qty_val != 0 or op_amt_val != 0 or bool(raw_op_balance))

    # Aliases
    alias_str = (doc.get("alias") or doc.get("aliasName") or "").strip()
    aliases_list = doc.get("aliases") if isinstance(doc.get("aliases"), list) else []
    if alias_str and alias_str not in aliases_list:
        aliases_list = [alias_str] + [a for a in aliases_list if a != alias_str]

    # Batches & BOM
    batches_list = doc.get("batches") or []
    if not isinstance(batches_list, list):
        batches_list = []
    valid_batches = [b for b in batches_list if isinstance(b, dict) and (b.get("batchName") or b.get("godownName"))]

    bom_list = doc.get("BOM") or doc.get("bom") or []
    if isinstance(bom_list, dict):
        bom_list = [bom_list]
    elif not isinstance(bom_list, list):
        bom_list = []

    # ── LOGGING / DEBUG BREAKDOWN ──────────────────────────────────────────────
    print(f"\n[DEBUG STOCK ITEM XML MAPPER]")
    print(f"1. MongoDB Stock Item Data: Name='{item_name}', Action='{action_type}', Group='{parent_group}', Category='{category_name}', Unit='{base_unit}', Description='{desc_str}'")
    print(f"2. Mapped GST Values: Applicable={gst_applicable_flag}, Total GST={gst_rate}%, IGST={igst_rate}%, CGST={cgst_rate}%, SGST={sgst_rate}%, Cess={cess_rate}%")
    print(f"3. Mapped HSN Values: HSN Code='{hsn_code}', HSN Description='{hsn_name}'")
    print(f"4. Optional Sections: GST={'ENABLED' if (gst_applicable_flag and (igst_rate > 0 or taxability)) else 'DISABLED'}, Cess={'ENABLED' if cess_rate > 0 else 'DISABLED'}, HSN={'ENABLED' if hsn_code else 'DISABLED'}, Opening Stock={'ENABLED' if has_opening_stock else 'DISABLED'}, Batches={'ENABLED' if valid_batches else 'DISABLED'}, BOM={'ENABLED' if bom_list else 'DISABLED'}")

    # ── BUILD STOCKITEM XML BLOCK ───────────────────────────────────────────────
    L(f'      <TALLYMESSAGE xmlns:UDF="TallyUDF">')
    L(f'        <STOCKITEM NAME="{e(item_name)}" {header_action}>')

    if parent_group:
        L(f'          <PARENT>{e(parent_group)}</PARENT>')
    
    if category_name:
        L(f'          <CATEGORY>{e(category_name)}</CATEGORY>')

    if base_unit:
        L(f'          <BASEUNITS>{e(base_unit)}</BASEUNITS>')

    if alt_unit:
        L(f'          <ADDITIONALUNITS>{e(alt_unit)}</ADDITIONALUNITS>')
        if conv_factor_num > 0:
            L(f'          <DENOMINATOR> 1</DENOMINATOR>')
            L(f'          <CONVERSION> {conv_factor}</CONVERSION>')

    if desc_str:
        L(f'          <DESCRIPTION>{e(desc_str)}</DESCRIPTION>')

    if barcode:
        L(f'          <BARCODE>{e(barcode)}</BARCODE>')
    if brand:
        L(f'          <BRAND>{e(brand)}</BRAND>')
    if part_no:
        L('          <PARTNO.LIST TYPE="String">')
        L(f'           <PARTNO>{e(part_no)}</PARTNO>')
        L('          </PARTNO.LIST>')

    # Costing & Valuation (ONLY if configured)
    if costing_method:
        L(f'          <COSTINGMETHOD>{e(costing_method)}</COSTINGMETHOD>')
    if valuation_method:
        L(f'          <VALUATIONMETHOD>{e(valuation_method)}</VALUATIONMETHOD>')

    # Boolean Flags (ONLY if True / enabled)
    if transformBoolean(is_cost_center) == "Yes":
        L(f'          <ISCOSTCENTRESON>Yes</ISCOSTCENTRESON>')
    if transformBoolean(is_batch_wise) == "Yes":
        L(f'          <ISBATCHWISEON>Yes</ISBATCHWISEON>')
    if transformBoolean(is_perishable) == "Yes":
        L(f'          <ISPERISHABLEON>Yes</ISPERISHABLEON>')
    if transformBoolean(is_cost_tracking) == "Yes":
        L(f'          <ISCOSTTRACKINGON>Yes</ISCOSTTRACKINGON>')
    if transformBoolean(has_mfg_date) == "Yes":
        L(f'          <HASMFGDATE>Yes</HASMFGDATE>')

    # Mailing Name List (ONLY if explicitly configured with distinct value)
    explicit_mailing = doc.get("mailingName") or (doc.get("mailingNameList") or [{}])[0].get("mailingName") if isinstance(doc.get("mailingNameList"), list) else None
    if explicit_mailing and str(explicit_mailing).strip() and str(explicit_mailing).strip() != item_name:
        L('          <MAILINGNAME.LIST TYPE="String">')
        L(f'           <MAILINGNAME>{e(str(explicit_mailing).strip())}</MAILINGNAME>')
        L('          </MAILINGNAME.LIST>')

    # Language Name List (ONLY if explicit aliases exist)
    valid_aliases = [str(al).strip() for al in aliases_list if al and str(al).strip() and str(al).strip() != item_name]
    if valid_aliases:
        L('          <LANGUAGENAME.LIST>')
        L('           <NAME.LIST TYPE="String">')
        L(f'            <NAME>{e(item_name)}</NAME>')
        for al in valid_aliases:
            L(f'            <NAME>{e(al)}</NAME>')
        L('           </NAME.LIST>')
        L('           <LANGUAGEID> 1033</LANGUAGEID>')
        L('          </LANGUAGENAME.LIST>')

    # Opening Stock Inventory (ONLY if provided)
    if has_opening_stock:
        if raw_op_balance:
            bal_str = str(raw_op_balance).strip()
        elif alt_unit and conv_factor_num > 0:
            alt_qty_val = op_qty_val * conv_factor_num
            bal_str = f" {op_qty_val:.2f} {base_unit} =  {alt_qty_val:.3f} {alt_unit}".strip()
        else:
            op_qty_str = f"{int(op_qty_val)}" if op_qty_val.is_integer() else f"{op_qty_val:.2f}"
            bal_str = f" {op_qty_str} {base_unit}".strip() if base_unit else f" {op_qty_str}".strip()

        op_rate_raw = doc.get("openingRate") or op_stock.get("rate")
        if op_rate_raw and "/" in str(op_rate_raw):
            rate_str = str(op_rate_raw).strip()
        elif base_unit:
            op_rate_str = f"{int(op_rate_val)}" if op_rate_val.is_integer() else f"{op_rate_val:.2f}"
            rate_str = f"{op_rate_str}/{base_unit}".strip()
        else:
            rate_str = f"{op_rate_val:.2f}"

        op_amt_str = f"{op_amt_val:.2f}"
        
        L(f'          <OPENINGBALANCE>{e(bal_str)}</OPENINGBALANCE>')
        L(f'          <OPENINGRATE>{e(rate_str)}</OPENINGRATE>')
        L(f'          <OPENINGVALUE>{op_amt_str}</OPENINGVALUE>')

    # GST Details (ONLY if GST is configured / applicable)
    if gst_applicable_flag and (igst_rate > 0 or taxability):
        L(f'          <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>')
        L(f'          <GSTTYPEOFSUPPLY>{e(gst_supply_type)}</GSTTYPEOFSUPPLY>')
        L('          <GSTDETAILS.LIST>')
        if applicable_from:
            L(f'           <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>')
        L(f'           <CALCULATIONTYPE>On Value</CALCULATIONTYPE>')
        L(f'           <TAXABILITY>{e(taxability or "Taxable")}</TAXABILITY>')
        L(f'           <SRCOFGSTDETAILS>Specified in Stock Item</SRCOFGSTDETAILS>')
        L('           <STATEWISEDETAILS.LIST>')
        L('            <STATENAME>Any</STATENAME>')
        
        def fmt_rate_val(val) -> str:
            num = parse_float(val, 0.0)
            if num == int(num):
                return f"{int(num)}"
            return f"{num:.2f}".rstrip('0').rstrip('.')

        # Integrated Tax
        L('            <RATEDETAILS.LIST>')
        L('             <GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD>')
        L('             <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>')
        L(f'             <GSTRATE>{fmt_rate_val(igst_rate)}</GSTRATE>')
        L('            </RATEDETAILS.LIST>')

        # Central Tax
        L('            <RATEDETAILS.LIST>')
        L('             <GSTRATEDUTYHEAD>Central Tax</GSTRATEDUTYHEAD>')
        L('             <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>')
        L(f'             <GSTRATE>{fmt_rate_val(cgst_rate)}</GSTRATE>')
        L('            </RATEDETAILS.LIST>')
        
        # State Tax
        L('            <RATEDETAILS.LIST>')
        L('             <GSTRATEDUTYHEAD>State Tax</GSTRATEDUTYHEAD>')
        L('             <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>')
        L(f'             <GSTRATE>{fmt_rate_val(sgst_rate)}</GSTRATE>')
        L('            </RATEDETAILS.LIST>')

        # Cess (ONLY if > 0)
        if cess_rate > 0:
            L('            <RATEDETAILS.LIST>')
            L('             <GSTRATEDUTYHEAD>Cess</GSTRATEDUTYHEAD>')
            L('             <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>')
            L(f'             <GSTRATE>{fmt_rate_val(cess_rate)}</GSTRATE>')
            L('            </RATEDETAILS.LIST>')

        L('           </STATEWISEDETAILS.LIST>')
        L('          </GSTDETAILS.LIST>')

    # HSN Details (ONLY if HSN code exists)
    if hsn_code:
        L('          <HSNDETAILS.LIST>')
        if applicable_from:
            L(f'           <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>')
        L(f'           <HSNCODE>{e(hsn_code)}</HSNCODE>')
        L(f'           <HSNDESCRIPTION>{e(hsn_name)}</HSNDESCRIPTION>')
        L(f'           <SRCOFHSNDETAILS>Specified in Stock Item</SRCOFHSNDETAILS>')
        L('          </HSNDETAILS.LIST>')

    # Reporting UOM (ONLY if explicitly configured by user)
    reporting_uom = (doc.get("reportingUom") or doc.get("reportingUnit") or (doc.get("reportingUomDetails") or {}).get("reportingUomName") or "").strip()
    if reporting_uom and reporting_uom.lower() not in ["not applicable", "n/a", "none"]:
        L('          <REPORTINGUOMDETAILS.LIST>')
        if applicable_from:
            L(f'           <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>')
        L(f'           <REPORTINGUOMNAME>{e(reporting_uom)}</REPORTINGUOMNAME>')
        L('          </REPORTINGUOMDETAILS.LIST>')

    # Batch Allocations (ONLY if batch tracking is ON and valid batches exist)
    if transformBoolean(is_batch_wise) == "Yes" and valid_batches:
        for batch in valid_batches:
            b_name = batch.get("batchName") or "Primary Batch"
            b_godown = batch.get("godownName") or "Main Location"
            
            raw_b_bal = batch.get("openingBalance") or ""
            b_qty = parse_float(batch.get("qty") or batch.get("quantity"), 0.0)
            b_rate = parse_float(batch.get("openingRate") or batch.get("rate"), 0.0)
            b_val = parse_float(batch.get("openingValue") or batch.get("value") or batch.get("amount"), b_qty * b_rate)
            
            if raw_b_bal:
                b_bal_str = str(raw_b_bal).strip()
            elif alt_unit and conv_factor_num > 0 and b_qty > 0:
                b_alt_qty = b_qty * conv_factor_num
                b_bal_str = f" {b_qty:.2f} {base_unit} =  {b_alt_qty:.3f} {alt_unit}".strip()
            else:
                b_qty_str = f"{int(b_qty) if b_qty.is_integer() else b_qty:.2f} {base_unit}".strip() if base_unit else f"{b_qty:.2f}"
                b_bal_str = f" {b_qty_str}".strip()

            raw_b_rate = batch.get("openingRate") or batch.get("rate")
            if raw_b_rate and "/" in str(raw_b_rate):
                b_rate_str = str(raw_b_rate).strip()
            elif base_unit:
                b_rate_str = f"{b_rate:.2f}/{base_unit}"
            else:
                b_rate_str = f"{b_rate:.2f}"

            mfd_date = transform_date(batch.get("mfdOn") or batch.get("mfdDate"))
            exp_period = str(batch.get("expiryPeriod") or "").strip()

            L('          <BATCHALLOCATIONS.LIST>')
            if mfd_date:
                L(f'           <MFDON>{mfd_date}</MFDON>')
            L(f'           <GODOWNNAME>{e(b_godown)}</GODOWNNAME>')
            L(f'           <BATCHNAME>{e(b_name)}</BATCHNAME>')
            L(f'           <OPENINGBALANCE>{e(b_bal_str)}</OPENINGBALANCE>')
            L(f'           <OPENINGVALUE>{b_val:.2f}</OPENINGVALUE>')
            L(f'           <OPENINGRATE>{e(b_rate_str)}</OPENINGRATE>')
            if exp_period:
                L(f'           <EXPIRYPERIOD>{e(exp_period)}</EXPIRYPERIOD>')
            L('          </BATCHALLOCATIONS.LIST>')

    # BOM Multi-Component List (ONLY if components exist)
    if bom_list:
        for bom in bom_list:
            bom_items = bom.get("items") or bom.get("components") or []
            valid_items = [b for b in bom_items if isinstance(b, dict) and (b.get("stockItemName") or b.get("name") or "").strip()]
            if not valid_items:
                continue

            bom_cname = bom.get("componentListName") or bom.get("bomName") or "Assembly BOM"
            raw_basic_qty = bom.get("componentBasicQty") or bom.get("basicQty") or "1"
            if str(raw_basic_qty).strip() and ("=" in str(raw_basic_qty) or (base_unit and base_unit in str(raw_basic_qty))):
                bom_basic_str = str(raw_basic_qty).strip()
            else:
                bom_basic_qty_num = parse_float(raw_basic_qty, 1.0)
                if alt_unit and conv_factor_num > 0:
                    alt_basic_qty = bom_basic_qty_num * conv_factor_num
                    bom_basic_str = f" {bom_basic_qty_num:.2f} {base_unit} =  {alt_basic_qty:.3f} {alt_unit}".strip()
                elif base_unit:
                    bom_basic_str = f" {bom_basic_qty_num:.2f} {base_unit}".strip()
                else:
                    bom_basic_str = f" {bom_basic_qty_num:.2f}".strip()

            L('          <MULTICOMPONENTLIST.LIST>')
            L(f'           <COMPONENTLISTNAME>{e(bom_cname)}</COMPONENTLISTNAME>')
            L(f'           <COMPONENTBASICQTY>{e(bom_basic_str)}</COMPONENTBASICQTY>')
            
            for b_item in valid_items:
                st_item_name = (b_item.get("stockItemName") or b_item.get("name") or "").strip()
                nature = b_item.get("natureOfItem") or "Component"
                g_name = b_item.get("godownName") or "Main Location"
                addl_cost = parse_float(b_item.get("addlCostAllocPerc") or b_item.get("addlCost"), 0.0)
                
                raw_act_qty = b_item.get("actualQty") or b_item.get("qty")
                if raw_act_qty and any(c.isalpha() for c in str(raw_act_qty)):
                    a_qty_str = str(raw_act_qty).strip()
                else:
                    a_qty_num = parse_float(raw_act_qty, 1.0)
                    a_unit = b_item.get("unit") or base_unit
                    a_qty_str = f" {a_qty_num:.3f} {a_unit}".strip() if a_unit else f" {a_qty_num:.3f}".strip()

                L('           <MULTICOMPONENTITEMLIST.LIST>')
                L(f'            <NATUREOFITEM>{e(nature)}</NATUREOFITEM>')
                L(f'            <STOCKITEMNAME>{e(st_item_name)}</STOCKITEMNAME>')
                L(f'            <GODOWNNAME>{e(g_name)}</GODOWNNAME>')
                L(f'            <ADDLCOSTALLOCPERC>{int(addl_cost) if addl_cost.is_integer() else addl_cost}</ADDLCOSTALLOCPERC>')
                L(f'            <ACTUALQTY>{e(a_qty_str)}</ACTUALQTY>')
                L('           </MULTICOMPONENTITEMLIST.LIST>')

            L('          </MULTICOMPONENTLIST.LIST>')

    L('        </STOCKITEM>')
    L('      </TALLYMESSAGE>')

    stock_block = "\n".join(lines)

    # Wrap in full ENVELOPE
    xml_out = '<?xml version="1.0" encoding="utf-8"?>\n'
    xml_out += '<ENVELOPE>\n'
    xml_out += '  <HEADER>\n'
    xml_out += '    <VERSION>1</VERSION>\n'
    xml_out += '    <TALLYREQUEST>IMPORT</TALLYREQUEST>\n'
    xml_out += '    <TYPE>DATA</TYPE>\n'
    xml_out += '    <ID>All Masters</ID>\n'
    xml_out += '  </HEADER>\n'
    xml_out += '  <BODY>\n'
    xml_out += '    <DESC>\n'
    xml_out += '      <STATICVARIABLES />\n'
    xml_out += '    </DESC>\n'
    xml_out += '    <DATA>\n'
    xml_out += stock_block + "\n"
    xml_out += '    </DATA>\n'
    xml_out += '  </BODY>\n'
    xml_out += '</ENVELOPE>'

    return xml_out


def validate_xml_matches_mongodb(ledger_doc: dict, xml_str: str) -> None:


    """
    Validates every generated XML value against the currently fetched MongoDB Ledger document.
    Raises ValueError with a field-level mismatch report if any value does not match.
    """
    import xml.etree.ElementTree as ET

    cleaned_xml = xml_str.replace("&#4;", "Not Applicable").replace("&#8377;", "Rs")
    try:
        root = ET.fromstring(cleaned_xml)
    except ET.ParseError as pe:
        raise ValueError(f"XML Parsing Error for Mismatch Validation: {pe}")

    ledger_el = root.find(".//LEDGER")
    if ledger_el is None:
        raise ValueError("XML data mismatch with MongoDB record: <LEDGER> element not found in XML")

    mismatches = []

    def get_tag_text(tag_name, parent=ledger_el):
        el = parent.find(tag_name)
        return el.text.strip() if (el is not None and el.text) else ""

    def check_match(field_name, expected, actual):
        exp_str = str(expected).strip() if expected is not None else ""
        act_str = str(actual).strip() if actual is not None else ""
        if exp_str != act_str:
            mismatches.append(f"Field '{field_name}':\n  MongoDB Value: {exp_str}\n  vs\n  Generated XML Value: {act_str}")

    # 1. Ledger Name
    exp_name = ledger_doc.get("ledgerName") or ledger_doc.get("name") or ""
    act_name_attr = ledger_el.get("NAME") or ""
    check_match("ledgerName (LEDGER NAME attr)", exp_name, act_name_attr)

    # 2. Parent Group Name
    exp_parent = ledger_doc.get("groupName") or ledger_doc.get("parentGroupName") or ledger_doc.get("parentGroup") or ""
    act_parent = get_tag_text("PARENT")
    check_match("groupName (PARENT)", exp_parent, act_parent)

    # 3. PAN
    pd = ledger_doc.get("partyDetails") if isinstance(ledger_doc.get("partyDetails"), dict) else {}
    exp_pan = pd.get("panNumber") or ledger_doc.get("panNumber") or pd.get("pan") or ledger_doc.get("pan") or ""
    act_pan = get_tag_text("INCOMETAXNUMBER")
    if exp_pan:
        check_match("partyDetails.panNumber (INCOMETAXNUMBER)", exp_pan, act_pan)

    # 4. GSTIN
    exp_gstin = pd.get("gstin") or ledger_doc.get("gstin") or pd.get("gst") or ""
    act_gstin = get_tag_text("PARTYGSTIN")
    if exp_gstin:
        check_match("partyDetails.gstin (PARTYGSTIN)", exp_gstin, act_gstin)

    # 5. GST Registration Type
    exp_reg = pd.get("gstRegistrationType") or ledger_doc.get("gstRegistrationType") or ledger_doc.get("registrationType") or ""
    act_reg = get_tag_text("GSTREGISTRATIONTYPE")
    if exp_reg:
        check_match("partyDetails.gstRegistrationType (GSTREGISTRATIONTYPE)", exp_reg, act_reg)

    # 6. State
    exp_state = transformState(pd.get("gstState") or ledger_doc.get("gstState") or pd.get("state") or ledger_doc.get("state") or "")
    act_state = get_tag_text("PRIORSTATENAME")
    if exp_state:
        check_match("partyDetails.gstState (PRIORSTATENAME)", exp_state, act_state)

    # 7. Country
    exp_country = pd.get("country") or ledger_doc.get("country") or ""
    act_country = get_tag_text("COUNTRYOFRESIDENCE")
    if exp_country:
        check_match("partyDetails.country (COUNTRYOFRESIDENCE)", exp_country, act_country)

    # 8. Flags
    flags = ledger_doc.get("flags") if isinstance(ledger_doc.get("flags"), dict) else {}

    exp_bill = transformBoolean(flags.get("isBillWiseOn") if "isBillWiseOn" in flags else ledger_doc.get("isBillWiseOn"))
    act_bill = get_tag_text("ISBILLWISEON")
    check_match("flags.isBillWiseOn (ISBILLWISEON)", exp_bill, act_bill)

    exp_cost = transformBoolean(flags.get("isCostCentresOn") if "isCostCentresOn" in flags else ledger_doc.get("isCostCentresOn"))
    act_cost = get_tag_text("ISCOSTCENTRESON")
    check_match("flags.isCostCentresOn (ISCOSTCENTRESON)", exp_cost, act_cost)

    exp_stock = transformBoolean(flags.get("affectsStock") if "affectsStock" in flags else ledger_doc.get("affectsStock"))
    act_stock = get_tag_text("AFFECTSSTOCK")
    check_match("flags.affectsStock (AFFECTSSTOCK)", exp_stock, act_stock)

    exp_payroll = transformBoolean(flags.get("forPayroll") if "forPayroll" in flags else ledger_doc.get("forPayroll"))
    act_payroll = get_tag_text("FORPAYROLL")
    check_match("flags.forPayroll (FORPAYROLL)", exp_payroll, act_payroll)

    exp_interest = transformBoolean(flags.get("isInterestOn") if "isInterestOn" in flags else ledger_doc.get("isInterestOn"))
    act_interest = get_tag_text("ISINTERESTON")
    check_match("flags.isInterestOn (ISINTERESTON)", exp_interest, act_interest)

    exp_duty = transformBoolean(flags.get("isBehavedAsDuty") if "isBehavedAsDuty" in flags else flags.get("isBehaveAsDuty") if "isBehaveAsDuty" in flags else ledger_doc.get("isBehavedAsDuty"))
    act_duty = get_tag_text("ISBEHAVEASDUTY")
    check_match("flags.isBehavedAsDuty (ISBEHAVEASDUTY)", exp_duty, act_duty)

    exp_ecomm = transformBoolean(flags.get("isEcommOperator") if "isEcommOperator" in flags else ledger_doc.get("isEcommOperator"))
    act_ecomm = get_tag_text("ISECOMMOPERATOR")
    check_match("flags.isEcommOperator (ISECOMMOPERATOR)", exp_ecomm, act_ecomm)

    exp_trans = transformBoolean(pd.get("isTransporter") if "isTransporter" in pd else ledger_doc.get("isTransporter"))
    act_trans = get_tag_text("ISTRANSPORTER")
    check_match("partyDetails.isTransporter (ISTRANSPORTER)", exp_trans, act_trans)

    # 9. Tax Details
    td = ledger_doc.get("taxDetails") if isinstance(ledger_doc.get("taxDetails"), dict) else {}
    exp_gst = transformBoolean(td.get("gstApplicable") if "gstApplicable" in td else ledger_doc.get("gstApplicable"))
    act_gst = get_tag_text("ISGSTAPPLICABLE")
    check_match("taxDetails.gstApplicable (ISGSTAPPLICABLE)", exp_gst, act_gst)

    exp_supply = td.get("gstTypeOfSupply") or ledger_doc.get("gstTypeOfSupply") or ""
    act_supply = get_tag_text("GSTNATUREOFSUPPLY")
    if exp_supply and exp_supply.lower() not in ["not applicable", "n/a", ""]:
        check_match("taxDetails.gstTypeOfSupply (GSTNATUREOFSUPPLY)", exp_supply, act_supply)

    # 10. TDS Details
    tds = ledger_doc.get("tdsDetails") if isinstance(ledger_doc.get("tdsDetails"), dict) else {}
    exp_tds = transformBoolean(tds.get("tdsApplicable") if "tdsApplicable" in tds else ledger_doc.get("tdsApplicable"))
    act_tds = get_tag_text("ISTDSAPPLICABLE")
    check_match("tdsDetails.tdsApplicable (ISTDSAPPLICABLE)", exp_tds, act_tds)

    exp_tcs = transformBoolean(tds.get("tcsApplicable") if "tcsApplicable" in tds else ledger_doc.get("tcsApplicable"))
    act_tcs = get_tag_text("ISTCSAPPLICABLE")
    check_match("tdsDetails.tcsApplicable (ISTCSAPPLICABLE)", exp_tcs, act_tcs)

    # 11. Opening Balance
    bal_obj = ledger_doc.get("balances", {}).get("openingBalance") if isinstance(ledger_doc.get("balances"), dict) else None
    if not bal_obj or not isinstance(bal_obj, dict):
        bal_obj = ledger_doc.get("openingBalance") if isinstance(ledger_doc.get("openingBalance"), dict) else {}

    if isinstance(bal_obj, dict):
        amt = bal_obj.get("amount") if bal_obj.get("amount") is not None else ledger_doc.get("openingBalanceAmount")
        btype = bal_obj.get("type") or ledger_doc.get("openingBalanceType") or "DR"
    else:
        amt = ledger_doc.get("openingBalance") or ledger_doc.get("openingBalanceAmount") or 0.0
        btype = ledger_doc.get("openingBalanceType") or "DR"

    if amt is None:
        amt = 0.0

    exp_op_bal = transformOpeningBalance(amt, btype)
    act_op_bal = get_tag_text("OPENINGBALANCE")
    check_match("openingBalance (OPENINGBALANCE)", exp_op_bal, act_op_bal)

    # 12. Address
    addr_raw = pd.get("address") if pd.get("address") is not None else ledger_doc.get("address")
    if not addr_raw and (ledger_doc.get("add1") or ledger_doc.get("add2")):
        addr_raw = [a for a in [ledger_doc.get("add1"), ledger_doc.get("add2")] if a]
    exp_addrs = transformAddress(addr_raw)

    act_addrs = []
    mailing_el = ledger_el.find("LEDMAILINGDETAILS.LIST")
    if mailing_el is not None:
        addr_list_el = mailing_el.find("ADDRESS.LIST")
        if addr_list_el is not None:
            for addr_node in addr_list_el.findall("ADDRESS"):
                if addr_node.text:
                    act_addrs.append(addr_node.text.strip())

    if exp_addrs:
        check_match("partyDetails.address (LEDMAILINGDETAILS.LIST > ADDRESS.LIST)", exp_addrs, act_addrs)

    # 13. Aliases
    raw_aliases = ledger_doc.get("nameAliases")
    if raw_aliases is None or raw_aliases == "":
        raw_aliases = ledger_doc.get("alias")
    exp_aliases = transformAliases(raw_aliases)

    act_names = []
    lang_el = ledger_el.find("LANGUAGENAME.LIST")
    if lang_el is not None:
        name_list_el = lang_el.find("NAME.LIST")
        if name_list_el is not None:
            for name_node in name_list_el.findall("NAME"):
                if name_node.text:
                    act_names.append(name_node.text.strip())

    for alias_val in exp_aliases:
        if alias_val and alias_val not in act_names:
            mismatches.append(f"Field 'nameAliases':\n  MongoDB Alias '{alias_val}' not found in XML <LANGUAGENAME.LIST>: {act_names}")

    if mismatches:
        report = "Generated XML does not match current MongoDB Ledger data.\n\nField Mismatch Report:\n" + "\n\n".join(mismatches)
        raise ValueError(report)






def validate_ledger_data(ledger: dict) -> None:
    """Validates MongoDB Ledger document data before generating Tally XML."""
    # 1. Missing parent group
    parent = ledger.get("groupName") or ledger.get("parentGroupName") or ledger.get("parentGroup")
    if not parent:
        raise ValueError("Validation Failed: Parent Group name is missing.")

    # 2. Invalid GSTIN
    pd = ledger.get("partyDetails") or {}
    gstin = pd.get("gstin") or ledger.get("gstin") or ""
    if gstin and str(gstin).strip().upper() not in ["", "N/A", "NONE", "NULL", "UNDEFINED"]:
        gst_str = str(gstin).strip()
        import re
        if not re.match(r"^[0-9]{2}[A-Z0-9]{13}$", gst_str, re.IGNORECASE):
            raise ValueError(f"Validation Failed: Invalid GSTIN format '{gst_str}'. Must be a 15-digit alphanumeric identifier.")

    # 3. Invalid PAN
    pan = pd.get("panNumber") or ledger.get("panNumber") or pd.get("pan") or ledger.get("pan") or ""
    if pan and str(pan).strip().upper() not in ["", "N/A", "NONE", "NULL", "UNDEFINED"]:
        pan_str = str(pan).strip()
        import re
        if not re.match(r"^[A-Z0-9]{5,10}$", pan_str, re.IGNORECASE):
            raise ValueError(f"Validation Failed: Invalid PAN format '{pan_str}'.")


    # 4. Invalid opening balance type
    bal_obj = ledger.get("balances", {}).get("openingBalance") or {}
    btype = bal_obj.get("type") or ledger.get("openingBalanceType") or ""
    if btype:
        btype_upper = str(btype).upper().strip()
        if btype_upper not in ["DR", "CR", "DEBIT", "CREDIT", ""]:
            raise ValueError(f"Validation Failed: Invalid Opening Balance Type '{btype}'. Allowed values: DR, CR, Debit, Credit.")

    # 5. Invalid XML characters
    def check_invalid_chars(val):
        if isinstance(val, str):
            for ch in val:
                o = ord(ch)
                if not (o == 0x9 or o == 0xA or o == 0xD or (0x20 <= o <= 0xD7FF) or (0xE000 <= o <= 0xFFFD) or (0x10000 <= o <= 0x10FFFF)):
                    raise ValueError(f"Validation Failed: String contains invalid XML character code: {hex(o)}")
        elif isinstance(val, dict):
            for k, v in val.items():
                check_invalid_chars(k)
                check_invalid_chars(v)
        elif isinstance(val, list):
            for item in val:
                check_invalid_chars(item)

    check_invalid_chars(ledger.get("ledgerName"))
    check_invalid_chars(parent)

def validateTallyLedgerXML(xml_str: str) -> None:
    """Validates Tally Ledger XML syntax and structural completeness."""
    cleaned_xml = xml_str.strip()
    # Strip special Tally entity &#4; before parsing since Python's XML parser rejects it
    temp_xml = cleaned_xml.replace("&#4;", "_TALLY_NA_").replace("&#8377;", "Rs")
    try:
        ET.fromstring(temp_xml)
    except ET.ParseError as e:
        raise ValueError(f"XML Syntax Validation Failed: {e}")

    if "<TALLYMESSAGE>" not in xml_str:
        raise ValueError("Validation Failed: XML must contain <TALLYMESSAGE> tag.")
    if "<LEDGER " not in xml_str and "<LEDGER>" not in xml_str:
        raise ValueError("Validation Failed: XML must contain <LEDGER> tag.")
    if "<PARENT>" not in xml_str:
        raise ValueError("Validation Failed: XML must contain <PARENT> tag.")
    import re
    unresolved = re.findall(r"\{\{[a-zA-Z0-9_]+\}\}", xml_str)
    if unresolved:
        raise ValueError(f"Validation Failed: Unresolved placeholders found: {unresolved}")
    invalid_tokens = re.findall(r">\s*(null|undefined|NaN)\s*<", xml_str, re.IGNORECASE)
    if invalid_tokens:
        raise ValueError(f"Validation Failed: Invalid placeholder/null string value found in XML: {invalid_tokens}")


class TallyXmlGenerator:
    TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "templates")

    @classmethod
    def load_template(cls, voucher_type: str) -> str:
        """Loads XML template file by type."""
        vch_type_lower = voucher_type.lower()
        if "ledger" in vch_type_lower:
            filename = "ledger.xml"
        elif "sales" in vch_type_lower or "credit" in vch_type_lower:
            filename = "sales.xml"
        elif "purchase" in vch_type_lower or "debit" in vch_type_lower:
            filename = "purchase.xml"
        elif "payment" in vch_type_lower:
            filename = "payment.xml"
        elif "receipt" in vch_type_lower:
            filename = "receipt.xml"
        elif "contra" in vch_type_lower:
            filename = "contra.xml"
        else:
            filename = "journal.xml"

        filepath = os.path.join(cls.TEMPLATE_DIR, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Template not found at: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()

    @classmethod
    def generate_ledger_xml(cls, ledger: dict) -> str:
        """Generates Tally-compliant XML string from Ledger dict/object."""
        validate_ledger_data(ledger)
        tally_ledger = ledgerToTallyMapper(ledger)
        xml_str = generateTallyLedgerXML(tally_ledger)
        validateTallyLedgerXML(xml_str)
        # Verify XML values against original MongoDB document
        validate_xml_matches_mongodb(ledger, xml_str)
        if not xml_str.startswith("<?xml"):
            xml_str = '<?xml version="1.0" encoding="utf-8"?>\n' + xml_str
        return xml_str

    @classmethod
    def generate_ledger_xml_message(cls, ledger: dict) -> str:
        """Generates the TALLYMESSAGE block for a ledger."""
        validate_ledger_data(ledger)
        tally_ledger = ledgerToTallyMapper(ledger)
        xml_str = generateTallyLedgerXML(tally_ledger)
        validate_xml_matches_mongodb(ledger, xml_str)
        start = xml_str.find("<TALLYMESSAGE")
        end = xml_str.rfind("</TALLYMESSAGE>")
        if start != -1 and end != -1:
            return xml_str[start : end + len("</TALLYMESSAGE>")]
        return f'<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="{escapeXml(tally_ledger.get("ledgerName"))}" ACTION="CREATE"><NAME>{escapeXml(tally_ledger.get("ledgerName"))}</NAME></LEDGER></TALLYMESSAGE>'


    @classmethod
    def wrap_messages_in_envelope(cls, messages: list) -> str:
        """Wraps multiple TALLYMESSAGE blocks into a single standard ENVELOPE structure."""
        envelope = """<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>IMPORT</TALLYREQUEST>
    <TYPE>DATA</TYPE>
    <ID>All Masters</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES />
    </DESC>
    <DATA>
"""
        for msg in messages:
            envelope += "      " + msg + "\n"
        envelope += """    </DATA>
  </BODY>
</ENVELOPE>"""
        return envelope

    @classmethod
    def validate_voucher(cls, voucher: TallyVoucher, all_ledgers: List[TallyLedgerEntry]) -> None:
        """
        Validates the voucher data and checks that all required masters exist.
        Throws ValueError on validation failure.
        """
        # 1. Company exists
        if not voucher.companyName:
            raise ValueError("Validation Failed: Required master 'Company Name' is missing.")

        # 2. Voucher Type exists
        if not voucher.voucherType:
            raise ValueError("Validation Failed: Required master 'Voucher Type' is missing.")

        # 3. Party Ledger exists
        if not voucher.partyLedgerName:
            raise ValueError("Validation Failed: Required master 'Party Ledger' is missing.")

        vch_type_lower = voucher.voucherType.lower()
        is_sales_or_purchase = "sales" in vch_type_lower or "purchase" in vch_type_lower or "credit" in vch_type_lower or "debit" in vch_type_lower

        if is_sales_or_purchase:
            # 4. Sales/Purchase Ledger, Stock Items, Units exist for With Item
            if voucher.inventoryEntries:
                for idx, inv in enumerate(voucher.inventoryEntries, 1):
                    if not inv.stockItem:
                        raise ValueError(f"Validation Failed: Required master 'Stock Item' is missing in item entry {idx}.")
                    if not inv.unit:
                        raise ValueError(f"Validation Failed: Required master 'Unit of Measure' is missing for stock item '{inv.stockItem}'.")
                    if not inv.salesLedger:
                        raise ValueError(f"Validation Failed: Required master 'Sales/Purchase Ledger' is missing for stock item '{inv.stockItem}'.")
            else:
                # Without Item - ensure there is a Sales/Purchase ledger
                if len(voucher.ledgerEntries) < 2:
                    raise ValueError("Validation Failed: Required master 'Sales/Purchase Ledger' is missing in ledger entries.")
                for idx, entry in enumerate(voucher.ledgerEntries):
                    if not entry.ledgerName:
                        raise ValueError(f"Validation Failed: Required master 'Ledger' name is missing at entry index {idx + 1}.")

            # 5. GST Ledgers exist (if GST is applicable)
            for idx, tax in enumerate(voucher.taxEntries, 1):
                if not tax.ledgerName:
                    raise ValueError(f"Validation Failed: Required master 'GST Ledger' name is missing in tax entry {idx}.")
        else:
            # Non-sales/purchase: check ledger names
            for idx, entry in enumerate(voucher.ledgerEntries):
                if not entry.ledgerName:
                    raise ValueError(f"Validation Failed: Required master 'Ledger' name is missing at entry index {idx + 1}.")

        # 6. Cost Centres exist (if used)
        for entry in all_ledgers:
            if entry.costAllocations:
                for cost in entry.costAllocations:
                    if not cost.category:
                        raise ValueError(f"Validation Failed: Required master 'Cost Category' is missing under ledger '{entry.ledgerName}'.")
                    if not cost.name:
                        raise ValueError(f"Validation Failed: Required master 'Cost Centre' is missing under ledger '{entry.ledgerName}'.")

        # 7. Check at least one ledger entry
        if not all_ledgers:
            raise ValueError("Validation Failed: Voucher must contain at least one ledger entry.")

        # 8. Balancing Verification (verify debit total equals credit total)
        ledger_sum = sum(e.amount for e in all_ledgers)
        if abs(ledger_sum) > 0.05:
            raise ValueError(
                f"Validation Failed: Voucher is unbalanced. Sum of debits and credits is {ledger_sum:.2f}."
            )

    @classmethod
    def validate_xml_syntax(cls, xml_str: str) -> None:
        """Validates XML syntax by parsing it with ElementTree."""
        try:
            cleaned_xml = xml_str.strip()
            ET.fromstring(cleaned_xml)
        except ET.ParseError as e:
            raise ValueError(f"XML Syntax Validation Failed: {e}")

    @classmethod
    def generate_ledger_xml(cls, ledger_doc: dict) -> str:
        return generate_ledger_xml(ledger_doc)

    @classmethod
    def generate_stock_item_xml(cls, stock_item_doc: dict, db=None) -> str:
        return generate_stock_item_xml(stock_item_doc, db=db)

    @classmethod
    def generate_unit_xml(cls, unit_doc: dict, action: str = "Create", db=None) -> str:
        uname = (unit_doc.get("name") or unit_doc.get("unitName") or unit_doc.get("symbol") or "").strip()
        formal_name = (unit_doc.get("formalName") or unit_doc.get("formal_name") or "").strip()
        
        raw_type = str(unit_doc.get("unitType") or unit_doc.get("type") or "").strip().lower()
        is_compound = raw_type == "compound" or bool(unit_doc.get("firstUnitId")) or bool(unit_doc.get("firstUnit"))
        
        decimal_places = unit_doc.get("decimalPlaces")
        if decimal_places is None:
            conv = unit_doc.get("conversion") or {}
            decimal_places = conv.get("decimalPlaces", 2)
            
        gst_uqc = unit_doc.get("gstUqc") or unit_doc.get("uqc") or ""
        
        original_name = formal_name if formal_name else ""
        if original_name.lower() == uname.lower():
            original_name = ""

        first_unit = (unit_doc.get("firstUnitName") or unit_doc.get("firstUnit") or (unit_doc.get("compound") or {}).get("firstUnit") or "").strip()
        second_unit = (unit_doc.get("secondUnitName") or unit_doc.get("secondUnit") or (unit_doc.get("compound") or {}).get("secondUnit") or "").strip()
        conv_factor = unit_doc.get("conversionFactor") or (unit_doc.get("compound") or {}).get("conversionFactor") or 1
        try:
            cf_val = float(conv_factor)
            conv_str = str(int(cf_val)) if cf_val.is_integer() else str(cf_val)
        except Exception:
            conv_str = str(conv_factor)

        if is_compound:
            if not first_unit or not second_unit:
                raise ValueError("Compound Unit XML generation requires both First Unit and Second Unit")

            uname = f"{first_unit} of {conv_str} {second_unit}"

            original_name = ""

            if db is not None:
                f_filter = {"_id": ObjectId(unit_doc["firstUnitId"])} if unit_doc.get("firstUnitId") and ObjectId.is_valid(unit_doc["firstUnitId"]) else {"name": {"$regex": f"^{re.escape(first_unit)}$", "$options": "i"}}
                s_filter = {"_id": ObjectId(unit_doc["secondUnitId"])} if unit_doc.get("secondUnitId") and ObjectId.is_valid(unit_doc["secondUnitId"]) else {"name": {"$regex": f"^{re.escape(second_unit)}$", "$options": "i"}}

                f_exists = db["units_entry"].find_one(f_filter) or db["units"].find_one(f_filter)
                s_exists = db["units_entry"].find_one(s_filter) or db["units"].find_one(s_filter)

                if not f_exists:
                    raise ValueError(f"Cannot generate XML: Referenced First Unit '{first_unit}' does not exist in database")
                if not s_exists:
                    raise ValueError(f"Cannot generate XML: Referenced Second Unit '{second_unit}' does not exist in database")
        else:
            if original_name.lower() == uname.lower():
                original_name = ""


        action_attr = action.strip() if action else "Create"

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC>',
            '      <STATICVARIABLES />',
            '    </DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <UNIT NAME="{escape_xml(uname)}" ACTION="{escape_xml(action_attr)}">',
            f'          <NAME>{escape_xml(uname)}</NAME>'
        ]

        if original_name:
            lines.append(f'          <ORIGINALNAME>{escape_xml(original_name)}</ORIGINALNAME>')

        lines.extend([
            f'          <DECIMALPLACES>{int(decimal_places or 0)}</DECIMALPLACES>',
            f'          <ISSIMPLEUNIT>{"No" if is_compound else "Yes"}</ISSIMPLEUNIT>'
        ])

        if is_compound:
            lines.append(f'          <FIRSTUNIT>{escape_xml(first_unit)}</FIRSTUNIT>')
            lines.append(f'          <SECONDUNIT>{escape_xml(second_unit)}</SECONDUNIT>')
            lines.append(f'          <CONVERSION>{conv_str}</CONVERSION>')

        if gst_uqc and str(gst_uqc).strip().lower() not in ["", "none", "null", "undefined", "n/a"]:
            lines.append(f'          <GSTREPUQC>{escape_xml(gst_uqc)}</GSTREPUQC>')

        lines.extend([
            '        </UNIT>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ])
        return "\n".join(lines)

    @staticmethod
    def generate_voucher_type_xml(doc: dict, action: str = "Create") -> str:
        """Generates Tally-compliant XML for Voucher Type Master import."""
        vname = (doc.get("voucherTypeName") or doc.get("name") or "VoucherType").strip()
        parent = (doc.get("parent") or doc.get("parentGroup") or doc.get("parentVoucherType") or "Sales").strip()
        abbrev = (doc.get("abbreviation") or doc.get("mailingName") or vname).strip()
        num_method = (doc.get("numberingMethod") or (doc.get("numbering") or {}).get("numberingMethod") or "Automatic").strip()
        
        behavior = doc.get("behavior") or doc.get("flags") or {}
        is_inventory = transformBoolean(behavior.get("inventoryEffect", doc.get("inventoryEffect", True)))
        
        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC>',
            '      <STATICVARIABLES />',
            '    </DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <VOUCHERTYPE NAME="{escape_xml(vname)}" ACTION="{escape_xml(action)}">',
            f'          <NAME>{escape_xml(vname)}</NAME>',
            f'          <PARENT>{escape_xml(parent)}</PARENT>',
            f'          <ABBREVIATION>{escape_xml(abbrev)}</ABBREVIATION>',
            f'          <NUMBERINGMETHOD>{escape_xml(num_method)}</NUMBERINGMETHOD>',
            f'          <ISINVENTORYAFFECTED>{is_inventory}</ISINVENTORYAFFECTED>',
            '          <COMMONNARRATION>Yes</COMMONNARRATION>',
            '        </VOUCHERTYPE>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ]
        return "\n".join(lines)

    @classmethod
    def generate_cost_center_xml(cls, cc_doc: dict, action: str = "Create") -> str:
        cc_name = (cc_doc.get("costCenterName") or cc_doc.get("name") or "Cost Center").strip()
        cat_name = (cc_doc.get("costCategoryName") or cc_doc.get("costCategoryId") or "Primary Cost Category").strip()
        parent_name = cc_doc.get("parentName") or cc_doc.get("parentId") or "Primary"
        if isinstance(parent_name, dict):
            parent_name = parent_name.get("costCenterName") or parent_name.get("name") or "Primary"
        parent_name = str(parent_name).strip()
        if parent_name in ["Primary / None", "None", ""]:
            parent_name = "Primary"

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC>',
            '      <STATICVARIABLES />',
            '    </DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <COSTCENTRE NAME="{escape_xml(cc_name)}" ACTION="{escape_xml(action)}">',
            f'          <NAME>{escape_xml(cc_name)}</NAME>',
            f'          <CATEGORY>{escape_xml(cat_name)}</CATEGORY>',
            f'          <PARENT>{escape_xml(parent_name)}</PARENT>',
            '        </COSTCENTRE>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ]
        return "\n".join(lines)

    @classmethod
    def generate_cost_category_xml(cls, cat_doc: dict, action: str = "Create") -> str:
        cat_name = (cat_doc.get("categoryName") or cat_doc.get("costCategoryName") or cat_doc.get("name") or "Cost Category").strip()
        alloc_rev = "Yes" if cat_doc.get("allocateRevenueItems", True) else "No"
        alloc_non_rev = "Yes" if cat_doc.get("allocateNonRevenueItems", True) else "No"

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC><STATICVARIABLES /></DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <COSTCATEGORY NAME="{escape_xml(cat_name)}" ACTION="{escape_xml(action)}">',
            f'          <NAME>{escape_xml(cat_name)}</NAME>',
            f'          <ALLOCATEREVENUE>{alloc_rev}</ALLOCATEREVENUE>',
            f'          <ALLOCATENONREVENUE>{alloc_non_rev}</ALLOCATENONREVENUE>',
            '        </COSTCATEGORY>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ]
        return "\n".join(lines)

    @classmethod
    def generate_cost_centre_class_xml(cls, class_doc: dict, action: str = "Create") -> str:
        class_name = (class_doc.get("className") or class_doc.get("name") or "Cost Centre Class").strip()
        allocations = class_doc.get("allocations") or []

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC><STATICVARIABLES /></DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <COSTCLASS NAME="{escape_xml(class_name)}" ACTION="{escape_xml(action)}">',
            f'          <NAME>{escape_xml(class_name)}</NAME>'
        ]

        for alloc in allocations:
            if isinstance(alloc, dict):
                c_name = escape_xml(alloc.get("categoryName") or alloc.get("costCategoryName") or "Primary Cost Category")
                cc_name = escape_xml(alloc.get("costCentreName") or alloc.get("costCenterName") or "")
                pct = float(alloc.get("percentage") or alloc.get("pct") or 0.0)
                if cc_name:
                    lines.append('          <COSTCENTREALLOCATION.LIST>')
                    lines.append(f'            <CATEGORYNAME>{c_name}</CATEGORYNAME>')
                    lines.append(f'            <COSTCENTRENAME>{cc_name}</COSTCENTRENAME>')
                    lines.append(f'            <PERCENTAGE>{pct}</PERCENTAGE>')
                    lines.append('          </COSTCENTREALLOCATION.LIST>')

        lines.extend([
            '        </COSTCLASS>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ])
        return "\n".join(lines)

    @classmethod
    def generate_bom_xml(cls, bom_doc: dict, action: str = "Create") -> str:
        bom_name = (bom_doc.get("bomName") or bom_doc.get("name") or "Standard BOM").strip()
        finished = (bom_doc.get("finishedItemName") or bom_doc.get("stockItemName") or "Finished Stock Item").strip()
        base_qty = bom_doc.get("baseQuantity") or bom_doc.get("basicQty") or 1.0
        unit = (bom_doc.get("baseUnit") or bom_doc.get("unit") or "Pcs").strip()
        items = bom_doc.get("components") or bom_doc.get("items") or []

        comp_blocks = []
        for comp in items:
            if isinstance(comp, dict):
                c_name = comp.get("stockItemName") or comp.get("itemName") or ""
                c_qty = comp.get("quantity") or comp.get("actualQty") or comp.get("qty") or 0
                c_unit = comp.get("unitName") or comp.get("unit") or ""
                if c_name:
                    qty_str = f"{c_qty} {c_unit}".strip()
                    comp_blocks.append(f"""            <MULTICOMPONENTITEMLIST.LIST>
              <NATUREOFITEM>Component</NATUREOFITEM>
              <STOCKITEMNAME>{escape_xml(c_name)}</STOCKITEMNAME>
              <ACTUALQTY>{escape_xml(qty_str)}</ACTUALQTY>
            </MULTICOMPONENTITEMLIST.LIST>""")

        comps_xml = "\n".join(comp_blocks)
        base_qty_str = f"{base_qty} {unit}".strip()

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC>',
            '      <STATICVARIABLES />',
            '    </DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <STOCKITEM NAME="{escape_xml(finished)}" ACTION="{escape_xml(action)}">',
            f'          <NAME>{escape_xml(finished)}</NAME>',
            '          <MULTICOMPONENTLIST.LIST>',
            f'            <COMPONENTLISTNAME>{escape_xml(bom_name)}</COMPONENTLISTNAME>',
            f'            <COMPONENTBASICQTY>{escape_xml(base_qty_str)}</COMPONENTBASICQTY>',
            comps_xml,
            '          </MULTICOMPONENTLIST.LIST>',
            '        </STOCKITEM>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ]
        return "\n".join(lines)




    @classmethod
    def generate_ledger_group_xml(cls, group_doc: dict, action: str = "Create") -> str:
        gname = (group_doc.get("groupName") or group_doc.get("name") or "Ledger Group").strip()
        alias = (group_doc.get("alias") or "").strip()
        raw_parent = (group_doc.get("parentGroup") or group_doc.get("parentGroupName") or "").strip()
        clean_parent = str(raw_parent).strip()
        is_primary = clean_parent.lower() in ["", "primary", "primary / root group", "primary / root category", "none", "null", "undefined"]
        parent = "" if is_primary else clean_parent

        action_attr = action.strip() if action else "Create"

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC>',
            '      <STATICVARIABLES />',
            '    </DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <GROUP NAME="{escape_xml(gname)}" ACTION="{escape_xml(action_attr)}">',
            f'          <NAME>{escape_xml(gname)}</NAME>'
        ]

        if alias and alias.lower() not in ["none", "null", "undefined"]:
            lines.extend([
                '          <NAME.LIST TYPE="String">',
                f'            <NAME>{escape_xml(gname)}</NAME>',
                f'            <NAME>{escape_xml(alias)}</NAME>',
                '          </NAME.LIST>'
            ])

        if not is_primary and parent:
            lines.append(f'          <PARENT>{escape_xml(parent)}</PARENT>')

        lines.extend([
            '        </GROUP>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ])
        return "\n".join(lines)

    @classmethod
    def generate_stock_group_xml(cls, sg_doc: dict) -> str:
        gname = sg_doc.get("groupName") or sg_doc.get("name") or "Stock Group"
        alias = sg_doc.get("alias") or ""
        raw_parent = sg_doc.get("parentGroup") or sg_doc.get("parentGroupName") or ""
        clean_parent = str(raw_parent).strip()
        is_primary = clean_parent.lower() in ["", "primary", "primary / root group", "primary / root category", "none", "null", "undefined"]
        parent = "" if is_primary else clean_parent
            
        behaviour = sg_doc.get("behaviour") if isinstance(sg_doc.get("behaviour"), dict) else {}
        is_addable = transformBoolean(behaviour.get("isAddable") if "isAddable" in behaviour else sg_doc.get("isAddable", True))
        is_batch_wise = transformBoolean(behaviour.get("isBatchWiseOn") if "isBatchWiseOn" in behaviour else sg_doc.get("isBatchWiseOn", False))
        maintain_mrp = transformBoolean(behaviour.get("maintainMrp") if "maintainMrp" in behaviour else sg_doc.get("maintainMrp", False))
        maintain_expiry = transformBoolean(behaviour.get("maintainExpiry") if "maintainExpiry" in behaviour else sg_doc.get("maintainExpiry", False))
        
        gst_details = sg_doc.get("gstDetails") if isinstance(sg_doc.get("gstDetails"), dict) else {}
        hsn_details = sg_doc.get("hsnDetails") if isinstance(sg_doc.get("hsnDetails"), dict) else {}
        
        is_gst = transformBoolean(gst_details.get("gstApplicable") if "gstApplicable" in gst_details else sg_doc.get("gstApplicable", True))
        hsn_code = hsn_details.get("hsnCode") or gst_details.get("hsnCode") or sg_doc.get("hsnCode") or ""
        gst_rate = gst_details.get("gstRate") or sg_doc.get("gstRate") or ""
        taxability = gst_details.get("taxability") or sg_doc.get("taxability") or ""

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC>',
            '      <STATICVARIABLES />',
            '    </DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <STOCKGROUP NAME="{escape_xml(gname)}" ACTION="Create">',
            f'          <NAME>{escape_xml(gname)}</NAME>'
        ]

        if alias and str(alias).strip().lower() not in ["", "none", "null", "undefined"]:
            lines.extend([
                '          <NAME.LIST TYPE="String">',
                f'            <NAME>{escape_xml(gname)}</NAME>',
                f'            <NAME>{escape_xml(alias.strip())}</NAME>',
                '          </NAME.LIST>'
            ])

        if not is_primary and parent:
            lines.append(f'          <PARENT>{escape_xml(parent)}</PARENT>')

        lines.extend([
            f'          <ISADDABLE>{is_addable}</ISADDABLE>',
            f'          <ISBATCHWISEON>{is_batch_wise}</ISBATCHWISEON>',
            f'          <MAINTAINMRP>{maintain_mrp}</MAINTAINMRP>',
            f'          <MAINTAINEXPIRY>{maintain_expiry}</MAINTAINEXPIRY>',
            f'          <ISGSTAPPLICABLE>{is_gst}</ISGSTAPPLICABLE>'
        ])

        if hsn_code and str(hsn_code).strip().lower() not in ["", "none", "null", "undefined"]:
            lines.append(f'          <HSNCODE>{escape_xml(hsn_code)}</HSNCODE>')
        if gst_rate and str(gst_rate).strip().lower() not in ["", "none", "null", "undefined"]:
            lines.append(f'          <GSTRATE>{escape_xml(gst_rate)}</GSTRATE>')
        if taxability and str(taxability).strip().lower() not in ["", "none", "null", "undefined"]:
            lines.append(f'          <TAXABILITY>{escape_xml(taxability)}</TAXABILITY>')

        lines.extend([
            '        </STOCKGROUP>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ])
        return "\n".join(lines)

    @classmethod
    def generate_stock_category_xml(cls, cat_doc: dict, action: str = "Create") -> str:
        cname = (cat_doc.get("stockCategoryName") or cat_doc.get("categoryName") or cat_doc.get("name") or "Stock Category").strip()
        alias = (cat_doc.get("alias") or "").strip()
        raw_parent = (cat_doc.get("parentCategory") or cat_doc.get("parentCategoryName") or cat_doc.get("parentName") or "").strip()
        clean_parent = str(raw_parent).strip()
        is_primary = clean_parent.lower() in ["", "primary", "primary / root category", "primary / root group", "none", "null", "undefined"]
        parent = "" if is_primary else clean_parent

        action_attr = action.strip() if action else "Create"

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC>',
            '      <STATICVARIABLES />',
            '    </DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <STOCKCATEGORY NAME="{escape_xml(cname)}" ACTION="{escape_xml(action_attr)}">',
            f'          <NAME>{escape_xml(cname)}</NAME>'
        ]

        if alias and alias.lower() not in ["none", "null", "undefined"]:
            lines.extend([
                '          <NAME.LIST TYPE="String">',
                f'            <NAME>{escape_xml(cname)}</NAME>',
                f'            <NAME>{escape_xml(alias)}</NAME>',
                '          </NAME.LIST>'
            ])

        if not is_primary and parent:
            lines.append(f'          <PARENT>{escape_xml(parent)}</PARENT>')

        lines.extend([
            '        </STOCKCATEGORY>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ])
        return "\n".join(lines)

    @classmethod
    def generate_godown_xml(cls, godown_doc: dict, action: str = "Create") -> str:
        gname = (godown_doc.get("godownName") or godown_doc.get("name") or "Main Warehouse").strip()
        alias = (godown_doc.get("alias") or "").strip()
        parent = (godown_doc.get("parentName") or godown_doc.get("parentGodown") or godown_doc.get("parent") or "Primary").strip()
        if parent in ["Primary / Root Godown", "Primary / Root Category", "Primary / Root Group"]:
            parent = "Primary"

        action_attr = action.strip() if action else "Create"
        address = godown_doc.get("address")
        state_name = godown_doc.get("stateName") or godown_doc.get("state")
        pincode = godown_doc.get("pincode")
        loc_type = godown_doc.get("locationType")

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC>',
            '      <STATICVARIABLES />',
            '    </DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <GODOWN NAME="{escape_xml(gname)}" ACTION="{escape_xml(action_attr)}">',
            f'          <NAME>{escape_xml(gname)}</NAME>'
        ]

        if alias and alias.lower() not in ["none", "null", "undefined"]:
            lines.extend([
                '          <NAME.LIST TYPE="String">',
                f'            <NAME>{escape_xml(gname)}</NAME>',
                f'            <NAME>{escape_xml(alias)}</NAME>',
                '          </NAME.LIST>'
            ])

        lines.append(f'          <PARENT>{escape_xml(parent if parent != "Primary" else "")}</PARENT>')

        if address and str(address).strip().lower() not in ["", "none", "null", "undefined"]:
            lines.extend([
                '          <ADDRESS.LIST TYPE="String">',
                f'            <ADDRESS>{escape_xml(str(address).strip())}</ADDRESS>',
                '          </ADDRESS.LIST>'
            ])

        if state_name and str(state_name).strip().lower() not in ["", "none", "null", "undefined"]:
            lines.append(f'          <STATE>{escape_xml(str(state_name).strip())}</STATE>')

        if pincode and str(pincode).strip().lower() not in ["", "none", "null", "undefined"]:
            lines.append(f'          <PINCODE>{escape_xml(str(pincode).strip())}</PINCODE>')

        if loc_type and str(loc_type).strip().lower() not in ["", "none", "null", "undefined"]:
            lines.append(f'          <LOCATIONTYPE>{escape_xml(str(loc_type).strip())}</LOCATIONTYPE>')

        lines.extend([
            '        </GODOWN>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ])
        return "\n".join(lines)

    @classmethod
    def generate_voucher_type_xml(cls, vt_doc: dict, action: str = "Create") -> str:
        vname = (vt_doc.get("voucherTypeName") or vt_doc.get("name") or "Voucher Type").strip()
        alias = (vt_doc.get("abbreviation") or vt_doc.get("alias") or "").strip()
        raw_parent = (vt_doc.get("parent") or vt_doc.get("parentGroup") or vt_doc.get("parentVoucherType") or "Sales").strip()
        
        # If parent is None, empty, or Primary, fallback to category or Sales
        if not raw_parent or raw_parent.lower() in ["none", "null", "undefined", "primary", ""]:
            category = (vt_doc.get("voucherCategory") or "Sales").capitalize()
            parent = category if category else "Sales"
        else:
            parent = raw_parent

        numbering_method = vt_doc.get("numberingMethod") or "Automatic"
        action_attr = action.strip() if action else "Create"

        lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<ENVELOPE>',
            '  <HEADER>',
            '    <VERSION>1</VERSION>',
            '    <TALLYREQUEST>IMPORT</TALLYREQUEST>',
            '    <TYPE>DATA</TYPE>',
            '    <ID>All Masters</ID>',
            '  </HEADER>',
            '  <BODY>',
            '    <DESC>',
            '      <STATICVARIABLES />',
            '    </DESC>',
            '    <DATA>',
            '      <TALLYMESSAGE xmlns:UDF="TallyUDF">',
            f'        <VOUCHERTYPE NAME="{escape_xml(vname)}" ACTION="{escape_xml(action_attr)}">',
            f'          <NAME>{escape_xml(vname)}</NAME>'
        ]

        if alias and alias.lower() not in ["none", "null", "undefined"]:
            lines.extend([
                '          <NAME.LIST TYPE="String">',
                f'            <NAME>{escape_xml(vname)}</NAME>',
                f'            <NAME>{escape_xml(alias)}</NAME>',
                '          </NAME.LIST>'
            ])

        lines.extend([
            f'          <PARENT>{escape_xml(parent)}</PARENT>',
            f'          <NUMBERINGMETHOD>{escape_xml(numbering_method)}</NUMBERINGMETHOD>',
            '        </VOUCHERTYPE>',
            '      </TALLYMESSAGE>',
            '    </DATA>',
            '  </BODY>',
            '</ENVELOPE>'
        ])
        return "\n".join(lines)









    @classmethod
    def generate_xml(cls, voucher: TallyVoucher) -> str:

        """Generates Tally-compliant XML string from TallyVoucher object."""
        # 1. Compile all ledger impacts to perform the balancing check with Tally signs
        all_ledgers = []
        for entry in voucher.ledgerEntries:
            is_dr = (entry.isDeemedPositive == "Yes")
            amt = -abs(entry.amount) if is_dr else abs(entry.amount)
            all_ledgers.append(TallyLedgerEntry(
                ledgerName=entry.ledgerName,
                amount=amt,
                isDeemedPositive=entry.isDeemedPositive,
                costAllocations=entry.costAllocations
            ))
            
        for entry in voucher.taxEntries:
            is_dr = (entry.isDeemedPositive == "Yes")
            amt = -abs(entry.amount) if is_dr else abs(entry.amount)
            all_ledgers.append(TallyLedgerEntry(
                ledgerName=entry.ledgerName,
                amount=amt,
                isDeemedPositive=entry.isDeemedPositive,
                costAllocations=entry.costAllocations
            ))
            
        for inv in voucher.inventoryEntries:
            is_dr = (inv.isDeemedPositive == "Yes")
            amt = -abs(inv.amount) if is_dr else abs(inv.amount)
            all_ledgers.append(TallyLedgerEntry(
                ledgerName=inv.salesLedger or "Sales Account",
                amount=amt,
                isDeemedPositive=inv.isDeemedPositive
            ))

        # 2. Validate voucher data and balancing BEFORE XML generation
        cls.validate_voucher(voucher, all_ledgers)

        # 3. Load the template
        template = cls.load_template(voucher.voucherType)

        # 4. Determine dynamic parameters
        action = "Alter" if voucher.isUpdate else "Create"
        # Only populate MASTERID and ALTERID when updating an existing voucher, otherwise keep them empty
        if voucher.isUpdate:
            master_id_val = voucher.masterId
            alter_id_val = str(int(voucher.alterId or "1") + 1)
        else:
            master_id_val = ""
            alter_id_val = ""

        # Set PERSISTEDVIEW dynamically
        vch_type_lower = voucher.voucherType.lower()
        is_sales_or_purchase = "sales" in vch_type_lower or "purchase" in vch_type_lower or "credit" in vch_type_lower or "debit" in vch_type_lower
        if is_sales_or_purchase and voucher.inventoryEntries:
            persisted_view = "Invoice Voucher View"
        else:
            persisted_view = "Accounting Voucher View"

        # Narration is optional
        narration_xml = ""
        if voucher.narration:
            narration_xml = f"<NARRATION>{escape_xml(voucher.narration)}</NARRATION>"

        # Basic ship note is optional
        basic_ship_note_xml = ""
        if voucher.basicShipDeliveryNote:
            basic_ship_note_xml = f"<BASICSHIPDELIVERYNOTE>{escape_xml(voucher.basicShipDeliveryNote)}</BASICSHIPDELIVERYNOTE>"

        # Generate PARTYLEDGERNAME tag dynamically whenever the voucher type requires it (Sales and Purchase)
        party_ledger_name_xml = ""
        if is_sales_or_purchase and voucher.partyLedgerName:
            party_ledger_name_xml = f"<PARTYLEDGERNAME>{escape_xml(voucher.partyLedgerName)}</PARTYLEDGERNAME>"

        # 5. Build dynamic ledger entries XML list
        ledger_blocks = []
        index = 1
        for entry in voucher.ledgerEntries:
            ledger_blocks.append(cls._build_single_ledger_entry(entry, index))
            index += 1
        for entry in voucher.taxEntries:
            ledger_blocks.append(cls._build_single_ledger_entry(entry, index))
            index += 1
        ledger_entries_xml = "".join(ledger_blocks)

        # 6. Build dynamic inventory entries XML list (Only for Sales and Purchase vouchers with items)
        inventory_entries_xml = ""
        if is_sales_or_purchase and voucher.inventoryEntries:
            inventory_entries_xml = cls._build_inventory_entries(voucher.inventoryEntries)

        # 7. Replace placeholders in the XML template
        xml_str = template
        xml_str = xml_str.replace("{{companyName}}", escape_xml(voucher.companyName))
        xml_str = xml_str.replace("{{voucherType}}", escape_xml(voucher.voucherType))
        xml_str = xml_str.replace("{{voucherDate}}", escape_xml(voucher.voucherDate))
        xml_str = xml_str.replace("{{action}}", action)
        xml_str = xml_str.replace("{{masterId}}", master_id_val)
        xml_str = xml_str.replace("{{alterId}}", alter_id_val)
        xml_str = xml_str.replace("{{persistedView}}", persisted_view)
        xml_str = xml_str.replace("{{narration}}", narration_xml)
        xml_str = xml_str.replace("{{basicShipDeliveryNote}}", basic_ship_note_xml)
        xml_str = xml_str.replace("{{voucherNumber}}", escape_xml(voucher.voucherNumber))
        xml_str = xml_str.replace("{{referenceNumber}}", escape_xml(voucher.referenceNumber))
        xml_str = xml_str.replace("{{partyName}}", escape_xml(voucher.partyLedgerName))
        xml_str = xml_str.replace("{{partyLedgerName}}", party_ledger_name_xml)
        xml_str = xml_str.replace("{{ledgerEntries}}", ledger_entries_xml)
        xml_str = xml_str.replace("{{inventoryEntries}}", inventory_entries_xml)

        # 8. Final syntax validation check
        cls.validate_xml_syntax(xml_str)

        return xml_str

    @classmethod
    def _build_single_ledger_entry(cls, entry: TallyLedgerEntry, index: int) -> str:
        escaped_ledger_name = escape_xml(entry.ledgerName)
        is_dr = (entry.isDeemedPositive == "Yes")
        amount_val = -abs(entry.amount) if is_dr else abs(entry.amount)

        # Build optional bill allocations
        bill_xml = ""
        if entry.billAllocations:
            for bill in entry.billAllocations:
                escaped_bill_name = escape_xml(bill.refNo)
                escaped_bill_type = escape_xml(bill.billType)
                bill_amt = -abs(bill.amount) if is_dr else abs(bill.amount)
                bill_xml += f"""
                                    <BILLALLOCATIONS.LIST>
                                        <NAME>{escaped_bill_name}</NAME>
                                        <BILLTYPE>{escaped_bill_type}</BILLTYPE>
                                        <AMOUNT>{bill_amt:.2f}</AMOUNT>
                                    </BILLALLOCATIONS.LIST>"""

        # Build optional bank allocations
        bank_xml = ""
        if entry.bankAllocations:
            for bank in entry.bankAllocations:
                escaped_trans_type = escape_xml(bank.transType or "Inter Bank Transfer")
                escaped_inst_no = escape_xml(bank.instNumber)
                bank_amt = -abs(bank.amount) if is_dr else abs(bank.amount)
                bank_xml += f"""
                                    <BANKALLOCATIONS.LIST>
                                        <DATE>{bank.date}</DATE>
                                        <TRANSACTIONTYPE>{escaped_trans_type}</TRANSACTIONTYPE>
                                        <INSTRUMENTNUMBER>{escaped_inst_no}</INSTRUMENTNUMBER>
                                        <AMOUNT>{bank_amt:.2f}</AMOUNT>
                                    </BANKALLOCATIONS.LIST>"""

        # Build optional cost allocations (CATEGORYALLOCATIONS.LIST only if cost category/centre exists)
        cost_xml = ""
        if entry.costAllocations:
            for cost in entry.costAllocations:
                escaped_category = escape_xml(cost.category or "Primary Cost Category")
                escaped_cost_name = escape_xml(cost.name)
                cost_amt = -abs(cost.amount) if is_dr else abs(cost.amount)
                cost_xml += f"""
                                    <CATEGORYALLOCATIONS.LIST>
                                        <CATEGORY>{escaped_category}</CATEGORY>
                                        <COSTCENTREALLOCATIONS.LIST>
                                            <NAME>{escaped_cost_name}</NAME>
                                            <AMOUNT>{cost_amt:.2f}</AMOUNT>
                                        </COSTCENTREALLOCATIONS.LIST>
                                    </CATEGORYALLOCATIONS.LIST>"""

        return f"""
                        <LEDGERENTRIES.LIST>
                            <INDEXNUMBER>{index}</INDEXNUMBER>
                            <LEDGERNAME>{escaped_ledger_name}</LEDGERNAME>
                            <ISDEEMEDPOSITIVE>{entry.isDeemedPositive}</ISDEEMEDPOSITIVE>
                            <AMOUNT>{amount_val:.2f}</AMOUNT>{bill_xml}{bank_xml}{cost_xml}
                        </LEDGERENTRIES.LIST>"""

    @classmethod
    def _build_inventory_entries(cls, entries: List[TallyInventoryEntry]) -> str:
        if not entries:
            return ""

        blocks = []
        for entry in entries:
            escaped_item_name = escape_xml(entry.stockItem)
            escaped_ledger_name = escape_xml(entry.salesLedger or "Sales Account")
            
            is_dr = (entry.isDeemedPositive == "Yes")
            amount_val = -abs(entry.amount) if is_dr else abs(entry.amount)
            rate_val = abs(entry.rate)
            qty_val = abs(entry.quantity)
            unit_val = entry.unit
            
            qty_str = format_qty(qty_val, unit_val)
            rate_str = format_rate(rate_val, unit_val)

            # Build batch details (default to Primary Batch and Main Location if not provided)
            batch_xml = ""
            if entry.batchDetails:
                for batch in entry.batchDetails:
                    escaped_batch_name = escape_xml(batch.batchName)
                    batch_qty = abs(batch.quantity)
                    batch_amt = -abs(batch.amount) if is_dr else abs(batch.amount)
                    batch_qty_str = format_qty(batch_qty, unit_val)
                    batch_xml += f"""
                            <BATCHALLOCATIONS.LIST>
                                <GODOWNNAME>Main Location</GODOWNNAME>
                                <DESTINATIONGODOWNNAME>Main Location</DESTINATIONGODOWNNAME>
                                <BATCHNAME>{escaped_batch_name}</BATCHNAME>
                                <AMOUNT>{batch_amt:.2f}</AMOUNT>
                                <ACTUALQTY>{batch_qty_str}</ACTUALQTY>
                                <BILLEDQTY>{batch_qty_str}</BILLEDQTY>
                            </BATCHALLOCATIONS.LIST>"""
            else:
                batch_xml = f"""
                            <BATCHALLOCATIONS.LIST>
                                <GODOWNNAME>Main Location</GODOWNNAME>
                                <DESTINATIONGODOWNNAME>Main Location</DESTINATIONGODOWNNAME>
                                <BATCHNAME>Primary Batch</BATCHNAME>
                                <AMOUNT>{amount_val:.2f}</AMOUNT>
                                <ACTUALQTY>{qty_str}</ACTUALQTY>
                                <BILLEDQTY>{qty_str}</BILLEDQTY>
                            </BATCHALLOCATIONS.LIST>"""

            # Calculate CGST, SGST, IGST rates dynamically from entry.gstRate
            gst_rate = entry.gstRate
            cgst_rate = gst_rate / 2
            sgst_rate = gst_rate / 2
            igst_rate = gst_rate

            cgst_rate_str = f"{int(cgst_rate)}" if cgst_rate.is_integer() else f"{cgst_rate:.2f}"
            sgst_rate_str = f"{int(sgst_rate)}" if sgst_rate.is_integer() else f"{sgst_rate:.2f}"
            igst_rate_str = f"{int(igst_rate)}" if igst_rate.is_integer() else f"{igst_rate:.2f}"

            blocks.append(f"""
                        <ALLINVENTORYENTRIES.LIST>
                            <STOCKITEMNAME>{escaped_item_name}</STOCKITEMNAME>
                            <ISDEEMEDPOSITIVE>{entry.isDeemedPositive}</ISDEEMEDPOSITIVE>
                            <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
                            <ISAUTONEGATE>No</ISAUTONEGATE>
                            <ISCUSTOMSCLEARANCE>No</ISCUSTOMSCLEARANCE>
                            <ISTRACKCOMPONENT>No</ISTRACKCOMPONENT>
                            <ISTRACKPRODUCTION>No</ISTRACKPRODUCTION>
                            <ISPRIMARYITEM>No</ISPRIMARYITEM>
                            <ISSCRAP>No</ISSCRAP>
                            <RATE>{rate_str}</RATE>
                            <ACTUALQTY>{qty_str}</ACTUALQTY>
                            <BILLEDQTY>{qty_str}</BILLEDQTY>
                            <AMOUNT>{amount_val:.2f}</AMOUNT>
                            {batch_xml}
                            <ACCOUNTINGALLOCATIONS.LIST>
                                <LEDGERNAME>{escaped_ledger_name}</LEDGERNAME>
                                <ISDEEMEDPOSITIVE>{entry.isDeemedPositive}</ISDEEMEDPOSITIVE>
                                <LEDGERFROMITEM>No</LEDGERFROMITEM>
                                <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
                                <ISPARTYLEDGER>No</ISPARTYLEDGER>
                                <AMOUNT>{amount_val:.2f}</AMOUNT>
                            </ACCOUNTINGALLOCATIONS.LIST>
                            <RATEDETAILS.LIST>
                                <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>
                                <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
                                <GSTRATE>{cgst_rate_str}</GSTRATE>
                            </RATEDETAILS.LIST>
                            <RATEDETAILS.LIST>
                                <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>
                                <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
                                <GSTRATE>{sgst_rate_str}</GSTRATE>
                            </RATEDETAILS.LIST>
                            <RATEDETAILS.LIST>
                                <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>
                                <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
                                <GSTRATE>{igst_rate_str}</GSTRATE>
                            </RATEDETAILS.LIST>
                        </ALLINVENTORYENTRIES.LIST>""")

        return "".join(blocks)
