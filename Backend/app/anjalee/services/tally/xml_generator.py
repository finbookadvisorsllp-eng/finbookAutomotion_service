import os
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


def generate_stock_item_xml(doc: dict, db=None) -> str:

    """
    Generates Tally-compliant XML for a STOCK ITEM master.
    Strictly follows 27 Tally Stock Item XML mapping rules:
    - Omits empty/null/Not Applicable tags
    - Dynamic GST, HSN, MRP (with priority logic), Units, Batches, and BOM
    - Zero hardcoded fallback values
    """
    def e(val) -> str:
        return escape_xml(val)

    def transform_date(val) -> str:
        """Converts date string (e.g. '2026-08-14' or ISO) to Tally YYYYMMDD format ('20260814')."""
        if not val:
            return ""
        s = str(val).strip().split("T")[0].replace("-", "").replace("/", "").replace(".", "")
        if len(s) == 8 and s.isdigit():
            return s
        return s

    lines = []
    def L(line_str: str):
        lines.append(line_str)

    # 1. Base item details
    item_name = doc.get("itemName") or doc.get("name") or "Unnamed Stock Item"
    
    parent_raw = doc.get("stockGroupName") or doc.get("group") or doc.get("stockGroup") or "General"
    if str(parent_raw).strip().lower() in ["primary", "primary / general", "none", ""]:
        parent_group = "General"
    else:
        parent_group = str(parent_raw).strip()

    # Rule 1 & 4: CATEGORY only generated when valid category exists
    raw_category = doc.get("stockCategoryName") or doc.get("category") or doc.get("stockCategory") or ""
    cat_id = str(doc.get("stockCategoryId") or "").strip()
    if cat_id in ["null", "undefined", "0"]:
        cat_id = ""

    if str(raw_category).strip().lower() in ["not applicable", "n/a", "none", "", "null", "undefined", "primary"]:
        category_name = ""
    else:
        category_name = str(raw_category).strip()

    # Pricing & Valuation
    pricing_obj = doc.get("pricing") or {}
    if not isinstance(pricing_obj, dict):
        pricing_obj = {}
    costing_method = pricing_obj.get("costingMethod") or doc.get("costingMethod") or "FIFO"
    valuation_method = pricing_obj.get("valuationMethod") or doc.get("valuationMethod") or "Last Sale Price"

    # Unit configuration (Rule 5 & 9)
    unit_obj = doc.get("unit") or {}
    if not isinstance(unit_obj, dict):
        unit_obj = {}
    base_unit = unit_obj.get("baseUnit") or doc.get("baseUnit") or doc.get("uom") or (unit_obj if isinstance(unit_obj, str) else "") or "Nos"
    
    alt_unit = unit_obj.get("alternateUnit") or doc.get("alternateUnit") or ""
    if str(alt_unit).strip().lower() in ["not applicable", "n/a", "none", "", str(base_unit).strip().lower()]:
        alt_unit = ""

    vat_base_unit = unit_obj.get("vatBaseUnit") or doc.get("vatBaseUnit") or base_unit
    if not vat_base_unit or str(vat_base_unit).strip().lower() in ["not applicable", "n/a", "none", ""]:
        vat_base_unit = base_unit

    conv_factor = unit_obj.get("conversionFactor") or doc.get("conversionFactor") or ""
    try:
        conv_factor_num = float(conv_factor) if conv_factor else 0.0
    except (ValueError, TypeError):
        conv_factor_num = 0.0

    # Flags
    flags_obj = doc.get("flags") or {}
    if not isinstance(flags_obj, dict):
        flags_obj = {}
    tracking_obj = doc.get("tracking") or {}
    if not isinstance(tracking_obj, dict):
        tracking_obj = {}

    is_cost_center = transformBoolean(flags_obj.get("isCostCenter") or doc.get("isCostCenter"))
    is_batch_wise = transformBoolean(tracking_obj.get("trackBatches") or flags_obj.get("isBatchWise") or doc.get("trackBatches") or doc.get("isBatchWise"))
    is_perishable = transformBoolean(tracking_obj.get("trackExpiry") or flags_obj.get("isPerishable") or doc.get("trackExpiry") or doc.get("isPerishable"))
    is_cost_tracking = transformBoolean(flags_obj.get("isCostTrachingOn") or flags_obj.get("isCostTrackingOn") or doc.get("isCostTrachingOn") or doc.get("isCostTrackingOn"))
    as_original = transformBoolean(flags_obj.get("asOriginal") if "asOriginal" in flags_obj else False)
    has_mfg_date = transformBoolean(tracking_obj.get("trackManufacturingDate") or flags_obj.get("hasMfgDate") or doc.get("trackManufacturingDate"))

    ignore_negative_stock = transformBoolean(flags_obj.get("ignoreNegativeStock") or doc.get("negativeStockAllowed"))
    treat_sales_as_mfg = transformBoolean(flags_obj.get("treatSalesAsManufactured") or doc.get("treatSalesAsManufactured"))
    treat_purchases_as_consumed = transformBoolean(flags_obj.get("treatPurchaseAsConsumed") or doc.get("treatPurchaseAsConsumed"))
    treat_rejects_as_scrap = transformBoolean(flags_obj.get("treatRejectAsScrap") or doc.get("treatRejectAsScrap"))
    allow_use_of_expired = transformBoolean(flags_obj.get("allowUseOfExpiredItems") or doc.get("allowUseOfExpiredItems"))
    ignore_batches = transformBoolean(flags_obj.get("ignoreBatches") or doc.get("ignoreBatches"))
    ignore_godowns = transformBoolean(flags_obj.get("ignoreGodowns") or doc.get("ignoreGodowns"))
    calc_on_mrp = transformBoolean(flags_obj.get("calcOnMrp") or doc.get("calcOnMrp"))
    is_additional_tax = transformBoolean(flags_obj.get("isAdditionalTax") or doc.get("isAdditionalTax"))
    is_cess_exempted = transformBoolean(flags_obj.get("isCessExempted") or doc.get("isCessExempted"))

    # Opening Inventory (Rules 6, 7, 8)
    inv_obj = doc.get("inventory") or {}
    if not isinstance(inv_obj, dict):
        inv_obj = {}
    op_stock = inv_obj.get("openingStock") or {}
    if not isinstance(op_stock, dict):
        op_stock = {}

    raw_op_balance = doc.get("openingBalance") or op_stock.get("balance") or ""
    op_qty_val = parse_float(doc.get("openingQuantity") or doc.get("openingQty") or op_stock.get("quantity") or op_stock.get("qty"), 0.0)
    op_rate_val = parse_float(doc.get("openingRate") or doc.get("purchasePrice") or op_stock.get("rate"), 0.0)
    op_amt_val = parse_float(doc.get("openingValue") or doc.get("openingAmount") or op_stock.get("value") or op_stock.get("amount"), op_qty_val * op_rate_val)

    # GST Details (Rules 10-15)
    gst_settings = doc.get("gstSettings") or {}
    if not isinstance(gst_settings, dict):
        gst_settings = {}
    hsn_details = doc.get("hsnSacDetails") or {}
    if not isinstance(hsn_details, dict):
        hsn_details = {}

    applicable_from = transform_date(hsn_details.get("applicableFrom") or gst_settings.get("applicableFrom") or doc.get("applicableFrom") or "20240401")
    taxability = gst_settings.get("taxability") or doc.get("taxability") or "Taxable"
    
    raw_src_gst = gst_settings.get("sourceOfGstDetails") or hsn_details.get("srcOfHsnDetails") or doc.get("srcOfHsnDetails") or "Specified in Stock Item"
    if "specify" in str(raw_src_gst).lower():
        src_of_gst = "Specified in Stock Item"
    elif "company" in str(raw_src_gst).lower() or "group" in str(raw_src_gst).lower():
        src_of_gst = "As per Company/Group"
    else:
        src_of_gst = "Specified in Stock Item"

    gst_rate = parse_float(gst_settings.get("gstRate") or doc.get("gstRate") or doc.get("gst"), 0.0)
    cgst_rate = parse_float(gst_settings.get("cgstRate") or doc.get("cgstRate"), gst_rate / 2.0 if gst_rate > 0 else 0.0)
    sgst_rate = parse_float(gst_settings.get("sgstRate") or doc.get("sgstRate"), gst_rate / 2.0 if gst_rate > 0 else 0.0)
    igst_rate = parse_float(gst_settings.get("igstRate") or doc.get("igstRate"), gst_rate if gst_rate > 0 else 0.0)
    cess_rate = parse_float(gst_settings.get("cessRate") or doc.get("cessRate"), 0.0)
    state_cess_rate = parse_float(gst_settings.get("stateCessRate") or doc.get("stateCessRate"), 0.0)

    has_gst_data = bool(gst_settings or doc.get("gstRate") or doc.get("taxability") or gst_rate > 0)

    # HSN Details (Rules 16 & 17)
    hsn_code = str(hsn_details.get("hsnCode") or hsn_details.get("hsn") or doc.get("hsnCode") or doc.get("hsn") or "").strip()
    hsn_class = hsn_details.get("hsnClassificationName") or doc.get("hsnClassificationName") or ""
    hsn_name = hsn_details.get("hsn") or doc.get("hsn") or hsn_code or item_name

    # MRP Details Priority (Rules 18, 19, 20)
    mrp_rates = []
    if isinstance(pricing_obj.get("MRP"), dict) and pricing_obj.get("MRP", {}).get("rates"):
        mrp_rates = pricing_obj.get("MRP", {}).get("rates")
    elif doc.get("mrpRates") and isinstance(doc.get("mrpRates"), list):
        mrp_rates = doc.get("mrpRates")

    mrp_from_date = transform_date((pricing_obj.get("MRP", {}).get("fromDate") if isinstance(pricing_obj.get("MRP"), dict) else "") or doc.get("mrpFromDate") or applicable_from)
    mrp_ver_count = (pricing_obj.get("MRP", {}).get("verCount") if isinstance(pricing_obj.get("MRP"), dict) else "") or doc.get("mrpVerCount") or "1"
    single_mrp = parse_float(doc.get("mrp") or (pricing_obj.get("MRP", {}).get("rates", [{}])[0].get("mrpRate") if isinstance(pricing_obj.get("MRP"), dict) else 0.0), 0.0)

    has_mrp_data = bool(mrp_rates or single_mrp > 0)

    # Batches & BOM (Rule 25)
    batches_list = doc.get("batches") or []
    if not isinstance(batches_list, list):
        batches_list = []
    valid_batches = [b for b in batches_list if isinstance(b, dict) and (b.get("batchName") or b.get("godownName"))]

    bom_list = doc.get("BOM") or doc.get("bom") or []
    if isinstance(bom_list, dict):
        bom_list = [bom_list]
    elif not isinstance(bom_list, list):
        bom_list = []

    # Action Rule (Rule 23)
    action_type = str(doc.get("action") or "").strip()
    if action_type.lower() == "create":
        header_action = 'ACTION="Create"'
    else:
        header_action = 'RESERVEDNAME=""'

    # ── BUILD STOCKITEM XML BLOCK ───────────────────────────────────────────────
    L(f'      <TALLYMESSAGE xmlns:UDF="TallyUDF">')
    L(f'        <STOCKITEM NAME="{e(item_name)}" {header_action}>')

    L(f'          <PARENT>{e(parent_group)}</PARENT>')
    
    if category_name:
        L(f'          <CATEGORY>{e(category_name)}</CATEGORY>')

    L(f'          <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>')
    L(f'          <GSTTYPEOFSUPPLY>Goods</GSTTYPEOFSUPPLY>')
    L(f'          <EXCISEAPPLICABILITY>&#4; Applicable</EXCISEAPPLICABILITY>')
    L(f'          <VATAPPLICABLE>&#4; Applicable</VATAPPLICABLE>')

    L(f'          <COSTINGMETHOD>{e(costing_method)}</COSTINGMETHOD>')
    L(f'          <VALUATIONMETHOD>{e(valuation_method)}</VALUATIONMETHOD>')
    L(f'          <BASEUNITS>{e(base_unit)}</BASEUNITS>')

    if alt_unit:
        L(f'          <ADDITIONALUNITS>{e(alt_unit)}</ADDITIONALUNITS>')
        if conv_factor_num > 0:
            L(f'          <DENOMINATOR> 1</DENOMINATOR>')
            L(f'          <CONVERSION> {conv_factor}</CONVERSION>')

    if vat_base_unit:
        L(f'          <VATBASEUNIT>{e(vat_base_unit)}</VATBASEUNIT>')

    # Boolean Flags
    L(f'          <ISCOSTCENTRESON>{is_cost_center}</ISCOSTCENTRESON>')
    L(f'          <ISBATCHWISEON>{is_batch_wise}</ISBATCHWISEON>')
    L(f'          <ISPERISHABLEON>{is_perishable}</ISPERISHABLEON>')
    L(f'          <ISCOSTTRACKINGON>{is_cost_tracking}</ISCOSTTRACKINGON>')
    L(f'          <HASMFGDATE>{has_mfg_date}</HASMFGDATE>')
    L(f'          <ASORIGINAL>{as_original}</ASORIGINAL>')

    L(f'          <IGNORENEGATIVESTOCK>{ignore_negative_stock}</IGNORENEGATIVESTOCK>')
    L(f'          <TREATSALESASMANUFACTURED>{treat_sales_as_mfg}</TREATSALESASMANUFACTURED>')
    L(f'          <TREATPURCHASESASCONSUMED>{treat_purchases_as_consumed}</TREATPURCHASESASCONSUMED>')
    L(f'          <TREATREJECTSASSCRAP>{treat_rejects_as_scrap}</TREATREJECTSASSCRAP>')
    L(f'          <ALLOWUSEOFEXPIREDITEMS>{allow_use_of_expired}</ALLOWUSEOFEXPIREDITEMS>')
    L(f'          <IGNOREBATCHES>{ignore_batches}</IGNOREBATCHES>')
    L(f'          <IGNOREGODOWNS>{ignore_godowns}</IGNOREGODOWNS>')
    L(f'          <CALCONMRP>{calc_on_mrp}</CALCONMRP>')
    L(f'          <ISADDITIONALTAX>{is_additional_tax}</ISADDITIONALTAX>')
    L(f'          <ISCESSEXEMPTED>{is_cess_exempted}</ISCESSEXEMPTED>')

    # Language Name List
    L('          <LANGUAGENAME.LIST>')
    L('           <NAME.LIST TYPE="String">')
    L(f'            <NAME>{e(item_name)}</NAME>')
    L('           </NAME.LIST>')
    L('           <LANGUAGEID> 1033</LANGUAGEID>')
    L('          </LANGUAGENAME.LIST>')

    # Opening Stock Inventory
    if op_qty_val != 0 or op_amt_val != 0 or raw_op_balance:
        if raw_op_balance:
            bal_str = str(raw_op_balance).strip()
        elif alt_unit and conv_factor_num > 0:
            alt_qty_val = op_qty_val * conv_factor_num
            bal_str = f" {op_qty_val:.2f} {base_unit} =  {alt_qty_val:.3f} {alt_unit}".strip()
        else:
            op_qty_str = f"{int(op_qty_val)}" if op_qty_val.is_integer() else f"{op_qty_val:.2f}"
            bal_str = f" {op_qty_str} {base_unit}".strip()

        op_rate_raw = doc.get("openingRate") or op_stock.get("rate")
        if op_rate_raw and "/" in str(op_rate_raw):
            rate_str = str(op_rate_raw).strip()
        else:
            op_rate_str = f"{int(op_rate_val)}" if op_rate_val.is_integer() else f"{op_rate_val:.2f}"
            rate_str = f"{op_rate_str}/{base_unit}".strip()

        op_amt_str = f"{op_amt_val:.2f}"
        
        L(f'          <OPENINGBALANCE>{e(bal_str)}</OPENINGBALANCE>')
        L(f'          <OPENINGRATE>{e(rate_str)}</OPENINGRATE>')
        L(f'          <OPENINGVALUE>{op_amt_str}</OPENINGVALUE>')

    # GSTDETAILS.LIST (Rules 10-15)
    if has_gst_data:
        L('          <GSTDETAILS.LIST>')
        if applicable_from:
            L(f'           <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>')
        L(f'           <TAXABILITY>{e(taxability)}</TAXABILITY>')
        L(f'           <SRCOFGSTDETAILS>{e(src_of_gst)}</SRCOFGSTDETAILS>')
        L('           <STATEWISEDETAILS.LIST>')
        L('            <STATENAME>&#4; Any</STATENAME>')
        
        def fmt_rate_val(val) -> str:
            num = parse_float(val, 0.0)
            if num == int(num):
                return f" {int(num)}"
            return f" {num:.2f}"

        # CGST
        L('            <RATEDETAILS.LIST>')
        L('             <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>')
        L('             <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>')
        L(f'             <GSTRATE>{fmt_rate_val(cgst_rate)}</GSTRATE>')
        L('             <GSTRATEPERUNIT>0</GSTRATEPERUNIT>')
        L('            </RATEDETAILS.LIST>')
        
        # SGST
        L('            <RATEDETAILS.LIST>')
        L('             <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>')
        L('             <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>')
        L(f'             <GSTRATE>{fmt_rate_val(sgst_rate)}</GSTRATE>')
        L('             <GSTRATEPERUNIT>0</GSTRATEPERUNIT>')
        L('            </RATEDETAILS.LIST>')

        # IGST
        L('            <RATEDETAILS.LIST>')
        L('             <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>')
        L('             <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>')
        L(f'             <GSTRATE>{fmt_rate_val(igst_rate)}</GSTRATE>')
        L('             <GSTRATEPERUNIT>0</GSTRATEPERUNIT>')
        L('            </RATEDETAILS.LIST>')

        # Cess
        L('            <RATEDETAILS.LIST>')
        L('             <GSTRATEDUTYHEAD>Cess</GSTRATEDUTYHEAD>')
        L('             <GSTRATEVALUATIONTYPE>&#4; Not Applicable</GSTRATEVALUATIONTYPE>')
        L(f'             <GSTRATE>{cess_rate:.2f}</GSTRATE>')
        L('             <GSTRATEPERUNIT>0</GSTRATEPERUNIT>')
        L('            </RATEDETAILS.LIST>')

        # State Cess
        L('            <RATEDETAILS.LIST>')
        L('             <GSTRATEDUTYHEAD>State Cess</GSTRATEDUTYHEAD>')
        L('             <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>')
        L(f'             <GSTRATE>{state_cess_rate:.2f}</GSTRATE>')
        L('             <GSTRATEPERUNIT>0</GSTRATEPERUNIT>')
        L('            </RATEDETAILS.LIST>')

        L('           </STATEWISEDETAILS.LIST>')
        L('          </GSTDETAILS.LIST>')

    # HSNDETAILS.LIST (Rules 16 & 17)
    if hsn_code:
        L('          <HSNDETAILS.LIST>')
        if applicable_from:
            L(f'           <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>')
        L(f'           <HSNCODE>{e(hsn_code)}</HSNCODE>')
        L(f'           <HSN>{e(hsn_name)}</HSN>')
        if hsn_class:
            L(f'           <HSNCLASSIFICATIONNAME>{e(hsn_class)}</HSNCLASSIFICATIONNAME>')
        L(f'           <SRCOFHSNDETAILS>{e(src_of_gst)}</SRCOFHSNDETAILS>')
        L('          </HSNDETAILS.LIST>')

    # MRPDETAILS.LIST / MRPRATEDETAILS.LIST (Rules 18, 19, 20)
    if has_mrp_data:
        L('          <MRPDETAILS.LIST>')
        if mrp_from_date:
            L(f'           <FROMDATE>{mrp_from_date}</FROMDATE>')
        L(f'           <TOTALVERCOUNT TYPE="Number"> {mrp_ver_count}</TOTALVERCOUNT>')
        L(f'           <VERCOUNT TYPE="Number"> {mrp_ver_count}</VERCOUNT>')
        if mrp_rates:
            for mrp_item in mrp_rates:
                st_name = mrp_item.get("stateName") or mrp_item.get("state") or "&#4; Any"
                raw_mrp_rate = mrp_item.get("mrpRate") or mrp_item.get("rate") or mrp_item.get("mrp")
                if raw_mrp_rate and "/" in str(raw_mrp_rate):
                    m_rate_str = str(raw_mrp_rate).strip()
                else:
                    m_rate_val = parse_float(raw_mrp_rate, 0.0)
                    m_rate_str = f"{m_rate_val:.2f}/{base_unit}"
                L('           <MRPRATEDETAILS.LIST>')
                L(f'            <STATENAME>{e(st_name)}</STATENAME>')
                L(f'            <MRPRATE>{e(m_rate_str)}</MRPRATE>')
                L('           </MRPRATEDETAILS.LIST>')
        else:
            m_rate_str = f"{single_mrp:.2f}/{base_unit}"
            L('           <MRPRATEDETAILS.LIST>')
            L('            <STATENAME>&#4; Any</STATENAME>')
            L(f'            <MRPRATE>{e(m_rate_str)}</MRPRATE>')
            L('           </MRPRATEDETAILS.LIST>')
        L('          </MRPDETAILS.LIST>')

    # REPORTINGUOMDETAILS.LIST
    L('          <REPORTINGUOMDETAILS.LIST>')
    if applicable_from:
        L(f'           <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>')
    L(f'           <REPORTINGUOMNAME>{e(base_unit)}</REPORTINGUOMNAME>')
    L('          </REPORTINGUOMDETAILS.LIST>')

    # BATCHALLOCATIONS.LIST (Rule 25)
    if valid_batches and is_batch_wise == "Yes":
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
                b_qty_str = f"{int(b_qty) if b_qty.is_integer() else b_qty:.2f} {base_unit}".strip()
                b_bal_str = f" {b_qty_str}".strip()

            raw_b_rate = batch.get("openingRate") or batch.get("rate")
            if raw_b_rate and "/" in str(raw_b_rate):
                b_rate_str = str(raw_b_rate).strip()
            else:
                b_rate_str = f"{b_rate:.2f}/{base_unit}"

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

    # MULTICOMPONENTLIST.LIST (BOM) (Rule 25)
    if bom_list:
        for bom in bom_list:
            bom_items = bom.get("items") or bom.get("components") or []
            valid_items = [b for b in bom_items if isinstance(b, dict) and (b.get("stockItemName") or b.get("name") or "").strip()]
            if not valid_items:
                continue

            bom_cname = bom.get("componentListName") or bom.get("bomName") or "Assembly BOM"
            raw_basic_qty = bom.get("componentBasicQty") or bom.get("basicQty") or "1"
            if str(raw_basic_qty).strip() and ("=" in str(raw_basic_qty) or base_unit in str(raw_basic_qty)):
                bom_basic_str = str(raw_basic_qty).strip()
            else:
                bom_basic_qty_num = parse_float(raw_basic_qty, 1.0)
                if alt_unit and conv_factor_num > 0:
                    alt_basic_qty = bom_basic_qty_num * conv_factor_num
                    bom_basic_str = f" {bom_basic_qty_num:.2f} {base_unit} =  {alt_basic_qty:.3f} {alt_unit}".strip()
                else:
                    bom_basic_str = f" {bom_basic_qty_num:.2f} {base_unit}".strip()

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
                    a_qty_str = f" {a_qty_num:.3f} {a_unit}".strip()

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
