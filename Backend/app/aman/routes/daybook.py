"""Day Book route (/api/v3/reports/daybook) — all vouchers for a date/range."""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.aman.core.dependencies import get_db, get_fy
from app.aman.core.serializers import serialize_doc, fmt_date, iso_date, parse_qty
from app.aman.models.common import ok, paginate
from app.aman.repositories.ledger_repo import find_ledger
from app.aman.services.financial_year import fy_bounds

router = APIRouter(prefix="/reports", tags=["aman:reports:daybook"])


def get_all_child_groups(db, group_name: str) -> set[str]:
    all_gps = list(db["groups"].find({}, {"groupName": 1, "parentGroupName": 1}))
    parent_to_children = {}
    for g in all_gps:
        parent = g.get("parentGroupName")
        name = g.get("groupName")
        if name:
            parent_to_children.setdefault(parent, []).append(name)
            
    visited = {group_name}
    queue = [group_name]
    while queue:
        curr = queue.pop(0)
        children = parent_to_children.get(curr, [])
        for child in children:
            if child not in visited:
                visited.add(child)
                queue.append(child)
    return visited


def parse_date_range(date_str: str) -> tuple[datetime, datetime] | None:
    parts = date_str.split(" - ")
    if len(parts) == 2:
        try:
            start_str = parts[0].strip()
            if "/" in start_str:
                start_dt = datetime.strptime(start_str, "%d/%m/%Y")
            else:
                start_dt = datetime.strptime(start_str, "%d-%m-%Y")
                
            end_str = parts[1].strip()
            if "/" in end_str:
                end_dt = datetime.strptime(end_str, "%d/%m/%Y")
            else:
                end_dt = datetime.strptime(end_str, "%d-%m-%Y")
                
            end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999000)
            return start_dt, end_dt
        except ValueError:
            pass
            
    try:
        if "/" in date_str:
            dt = datetime.strptime(date_str.strip(), "%d/%m/%Y")
        else:
            dt = datetime.strptime(date_str.strip(), "%d-%m-%Y")
        start_dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = dt.replace(hour=23, minute=59, second=59, microsecond=999000)
        return start_dt, end_dt
    except ValueError:
        pass
    return None


def _row_amounts(v: dict, cash_bank_ledgers: set) -> tuple[str, float, float]:
    """Tally Day Book row: (particulars ledger, debit, credit).

    Particulars = the counter-party ledger (Sales->customer, Purchase->supplier,
    Payment/Receipt->the non-bank ledger actually posted, Contra->the bank). The
    amount and side come from that ledger, so a ₹3,000 salary payment with a
    ₹5.90 bank charge shows ₹3,000 Dr against the expense — matching Tally.
    """
    entries = v.get("ledgerEntries") or []
    party_name = v.get("partyLedgerName") or v.get("partyName")

    particulars_entry = None
    if party_name and party_name not in cash_bank_ledgers:
        particulars_entry = next((e for e in entries if e.get("ledgerName") == party_name), None)
    if not particulars_entry:
        non_bank = [e for e in entries
                    if e.get("ledgerName") and e.get("ledgerName") not in cash_bank_ledgers]
        if non_bank:
            particulars_entry = max(non_bank, key=lambda e: abs(float(e.get("amount") or 0)))
        elif party_name:
            particulars_entry = next((e for e in entries if e.get("ledgerName") == party_name), None)
        if not particulars_entry and entries:
            particulars_entry = entries[0]

    if particulars_entry:
        particulars = particulars_entry.get("ledgerName") or (party_name or "")
        amt = float(particulars_entry.get("amount") or 0)   # < 0 => Debit, > 0 => Credit
    else:
        particulars = party_name or ""
        amt = -abs(float((v.get("totals") or {}).get("totalDebit") or 0.0))

    debit = round(abs(amt), 2) if amt < 0 else 0.0
    credit = round(abs(amt), 2) if amt > 0 else 0.0
    return particulars, debit, credit


@router.get("/daybook")
async def daybook(
    fy: str = Depends(get_fy),
    date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=500),
    voucherType: Optional[str] = Query(None),
    ledger: Optional[str] = Query(None),
    group: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db=Depends(get_db)
):
    match = {}
    
    # 1. Date / Period filter
    start_dt, end_dt = None, None
    if date:
        parsed = parse_date_range(date)
        if parsed:
            start_dt, end_dt = parsed
            
    if not start_dt or not end_dt:
        start_dt, end_dt = fy_bounds(fy)
        
    match["dates.date"] = {"$gte": start_dt, "$lte": end_dt}
    
    # 2. Voucher Type filter
    if voucherType:
        match["voucherTypeName"] = {"$regex": f"^{voucherType}$", "$options": "i"}
        
    # 3 & 4. Ledger & Group filter (composite)
    ledger_match_conditions = []
    if ledger:
        l_doc = find_ledger(db, ledger)
        l_name = l_doc.get("ledgerName") if l_doc else ledger
        ledger_match_conditions.append({"ledgerEntries.ledgerName": l_name})
    if group:
        child_groups = get_all_child_groups(db, group)
        ledgers = list(db["ledgers"].find({"groupName": {"$in": list(child_groups)}}, {"ledgerName": 1}))
        ledger_names = [l["ledgerName"] for l in ledgers if l.get("ledgerName")]
        ledger_match_conditions.append({"ledgerEntries.ledgerName": {"$in": ledger_names}})
        
    if ledger_match_conditions:
        if len(ledger_match_conditions) == 1:
            match.update(ledger_match_conditions[0])
        else:
            match["$and"] = ledger_match_conditions
            
    # 5. Search Text filter
    if search:
        import re
        escaped_search = re.escape(search)
        match["$or"] = [
            {"voucherNumber": {"$regex": escaped_search, "$options": "i"}},
            {"partyLedgerName": {"$regex": escaped_search, "$options": "i"}},
            {"partyName": {"$regex": escaped_search, "$options": "i"}},
            {"ledgerEntries.ledgerName": {"$regex": escaped_search, "$options": "i"}},
            {"narration": {"$regex": escaped_search, "$options": "i"}},
        ]
        
    # 6. Fetch cash/bank ledgers to help resolve Particulars counterparty
    cash_bank_ledgers = set(
        l["ledgerName"] for l in db["ledgers"].find(
            {"groupName": {"$in": ["Cash-in-Hand", "Bank Accounts", "Bank OD A/c"]}}, 
            {"ledgerName": 1}
        ) if l.get("ledgerName")
    )
    
    total_records = db["vouchers"].count_documents(match)
    skip_count = (page - 1) * limit
    cur = db["vouchers"].find(match).sort([("dates.date", 1), ("voucherNumber", 1), ("_id", 1)]).skip(skip_count).limit(limit)
    vouchers = list(cur)
    
    rows = []
    INWARD_QUANTITY_TYPES = {"Purchase", "Purchase Order", "Receipt Note", "Credit Note", "Material In", "Rejections In"}
    OUTWARD_QUANTITY_TYPES = {"Sales", "Sales Order", "Delivery Challan", "Delivery Note", "Debit Note", "Material Out", "Rejections Out"}
    
    for v in vouchers:
        particulars, debit_amount, credit_amount = _row_amounts(v, cash_bank_ledgers)
                
        inward_qty = 0.0
        outward_qty = 0.0
        
        for ie in v.get("inventoryEntriesIn", []):
            inward_qty += parse_qty(ie.get("billedQty") or ie.get("actualQty"))
        for ie in v.get("inventoryEntriesOut", []):
            outward_qty += parse_qty(ie.get("billedQty") or ie.get("actualQty"))
            
        if inward_qty == 0.0 and outward_qty == 0.0:
            v_type = v.get("voucherTypeName") or ""
            for ie in v.get("inventoryEntries", []):
                qty = parse_qty(ie.get("billedQty") or ie.get("actualQty"))
                if qty:
                    is_deemed_positive = ie.get("isDeemedPositive")
                    if is_deemed_positive is True:
                        inward_qty += qty
                    elif is_deemed_positive is False:
                        outward_qty += qty
                    else:
                        if v_type in INWARD_QUANTITY_TYPES:
                            inward_qty += qty
                        elif v_type in OUTWARD_QUANTITY_TYPES:
                            outward_qty += qty
                        else:
                            outward_qty += qty
                            
        rows.append({
            "date": fmt_date((v.get("dates") or {}).get("date")),
            "isoDate": iso_date((v.get("dates") or {}).get("date")),
            "particulars": particulars,
            "voucherType": v.get("voucherTypeName") or "",
            "voucherNumber": v.get("voucherNumber") or "",
            "debitAmount": debit_amount,
            "creditAmount": credit_amount,
            "inwardQty": inward_qty,
            "outwardQty": outward_qty,
            "voucherId": str(v.get("_id"))
        })

    # ── Period-wide summary for the KPI cards (reconciles with the table) ──
    # Computed over the full filtered set (date-bounded), using the same row
    # logic so the cards always tie out with the displayed Debit/Credit columns.
    summary = {"totalVouchers": total_records, "totalDebit": 0.0, "totalCredit": 0.0,
               "byType": {}}
    proj = {"ledgerEntries": 1, "voucherTypeName": 1, "totals": 1,
            "partyLedgerName": 1, "partyName": 1}
    for sv in db["vouchers"].find(match, proj):
        _, d, c = _row_amounts(sv, cash_bank_ledgers)
        summary["totalDebit"] += d
        summary["totalCredit"] += c
        vt = sv.get("voucherTypeName") or "Other"
        bt = summary["byType"].setdefault(vt, {"count": 0, "debit": 0.0, "credit": 0.0})
        bt["count"] += 1
        bt["debit"] = round(bt["debit"] + d, 2)
        bt["credit"] = round(bt["credit"] + c, 2)
    summary["totalDebit"] = round(summary["totalDebit"], 2)
    summary["totalCredit"] = round(summary["totalCredit"], 2)
    summary["netFlow"] = round(summary["totalDebit"] - summary["totalCredit"], 2)

    return ok(rows, pagination=paginate(total_records, page, limit),
              meta={"fy": fy, "summary": summary})
