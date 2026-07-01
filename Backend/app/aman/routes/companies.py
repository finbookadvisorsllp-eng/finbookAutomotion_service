"""Company + master-data routes (/api/v3/companies)."""
from datetime import datetime

from fastapi import APIRouter, Depends

from app.aman.core.dependencies import get_db
from app.aman.core.serializers import serialize_doc
from app.aman.models.common import ok
from app.aman.services.financial_year import list_financial_years, current_fy

router = APIRouter(prefix="/companies", tags=["aman:companies"])


def _company_gstin(doc: dict):
    gst = doc.get("gstDetails")
    if isinstance(gst, dict):
        return gst.get("gstin")
    if isinstance(gst, str):
        return gst
    return doc.get("gstin")


@router.get("/all")
async def all_companies():
    """Every company across all tenant databases — drives the company switcher.

    The returned ``id`` is the tenant id (the suffix of ``sf_tenant_<id>``), i.e.
    exactly the value the frontend sends as ``x-company-id`` to scope all reports.
    Cross-tenant, read-only; not scoped to one company.
    """
    from app.db import client as mongo_client
    out = []
    try:
        names = mongo_client.list_database_names()
    except Exception:
        names = []
    for name in names:
        if not name.startswith("sf_tenant_"):
            continue
        try:
            comp = mongo_client[name]["companies"].find_one(
                {}, {"companyName": 1, "basicCompantFormalName": 1, "financialYear": 1})
        except Exception:
            comp = None
        if not comp:
            continue
        out.append({
            "id": name.replace("sf_tenant_", ""),
            "name": comp.get("companyName") or comp.get("basicCompantFormalName") or name,
            "financialYear": comp.get("financialYear"),
        })
    out.sort(key=lambda c: (c["name"] or "").lower())
    return ok(out)


@router.get("")
async def list_companies(db=Depends(get_db)):
    companies = []
    for doc in db["companies"].find():
        companies.append({
            "id": str(doc["_id"]),
            "name": doc.get("companyName") or doc.get("basicCompantFormalName") or "Unknown",
            "formalName": doc.get("basicCompantFormalName"),
            "gstin": _company_gstin(doc),
            "financialYear": doc.get("financialYear"),
        })
    return ok(companies)


@router.get("/current")
async def current_company(db=Depends(get_db)):
    doc = db["companies"].find_one()
    if not doc:
        return ok(None)
    data = serialize_doc(doc)
    data["id"] = data.pop("_id", None)
    data["name"] = doc.get("companyName") or doc.get("basicCompantFormalName")
    data["gstin"] = _company_gstin(doc)
    return ok(data)


@router.get("/current/financial-years")
async def financial_years(db=Depends(get_db)):
    return ok({"years": list_financial_years(db), "current": current_fy()})


@router.get("/current/master-data")
async def master_data(db=Depends(get_db)):
    """Ledgers / stock items / voucher types for form auto-fill (dynamic)."""
    def names(filter_):
        return sorted({d["ledgerName"] for d in db["ledgers"].find(filter_, {"ledgerName": 1})
                       if d.get("ledgerName")})

    sales_ledgers = names({"groupName": "Sales Accounts"})
    party_ledgers = names({"groupName": {"$in": ["Sundry Debtors", "Sundry Creditors",
                                                 "Bank Accounts", "Cash-in-Hand"]}})
    purchase_ledgers = names({"groupName": "Purchase Accounts"})
    tax_ledgers = names({"groupName": {"$in": ["Duties & Taxes", "GST INPUT", "Output"]}})
    expense_ledgers = names({"groupName": {"$in": ["Indirect Expenses", "Direct Expenses",
                                                   "Indirect Incomes", "Direct Incomes"]}})
    stock_items = sorted({d["itemName"] for d in db["stockItems"].find({}, {"itemName": 1})
                          if d.get("itemName")})
    voucher_types = sorted({d["voucherTypeName"] for d in db["voucherTypes"].find({}, {"voucherTypeName": 1})
                            if d.get("voucherTypeName")})

    return ok({
        "salesLedgers": sales_ledgers,
        "purchaseLedgers": purchase_ledgers,
        "partyLedgers": party_ledgers,
        "taxLedgers": tax_ledgers,
        "additionalChargeLedgers": expense_ledgers,
        "stockItems": stock_items,
        "voucherTypes": voucher_types,
    })
