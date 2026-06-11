from datetime import datetime
from typing import List, Dict, Any
from app.anjalee.repositories.company_repo import CompanyRepository
from app.anjalee.schemas.company_schemas import CompanyResponse, CreateCompanyRequest

class CompanyService:
    def __init__(self, repo: CompanyRepository):
        self.repo = repo

    def list_companies(self) -> List[CompanyResponse]:
        companies = []
        raw_companies = self.repo.list_all_companies()
        
        for doc in raw_companies:
            gst_details = doc.get("gstDetails")
            gstin = None
            if isinstance(gst_details, dict):
                gstin = gst_details.get("gstin")
            elif isinstance(gst_details, str):
                gstin = gst_details
            else:
                gstin = doc.get("gstin")
                
            audit_info = doc.get("auditInfo")
            created_at = None
            if isinstance(audit_info, dict):
                created_at = audit_info.get("createdAt")
            if not created_at:
                created_at = doc.get("createdAt")
                
            companies.append(CompanyResponse(
                id=str(doc["_id"]),
                name=doc.get("companyName") or doc.get("basicCompantFormalName") or doc.get("name") or "Unknown",
                gstin=gstin,
                createdAt=str(created_at) if created_at else None
            ))
        
        if not companies:
            # Fallback/mock for frontend if DB is empty
            companies.append(CompanyResponse(
                id="6a182ee36efd32db3c490a6c",
                name="Friends Grafix FY 2024-25",
                gstin="23AAOFG0550B1ZZ",
                createdAt=datetime.now().isoformat()
            ))
            
        return companies

    def create_company(self, payload: CreateCompanyRequest) -> CompanyResponse:
        new_company = {
            "companyName": payload.name,
            "basicCompantFormalName": payload.name,
            "gstDetails": {
                "gstin": payload.gstin,
                "registrationType": "Regular",
                "isGstOn": "Yes"
            },
            "createdAt": datetime.now(),
            "status": "ACTIVE"
        }
        inserted_id = self.repo.create_company(new_company)
        
        return CompanyResponse(
            id=inserted_id,
            name=payload.name,
            gstin=payload.gstin,
            createdAt=new_company["createdAt"].isoformat()
        )

    def get_company_master_data(self) -> Dict[str, Any]:
        sales_ledgers = self.repo.get_ledgers_by_group("Sales Accounts")
        if not sales_ledgers:
            sales_ledgers = ["General Sales", "Service Sales"]

        party_groups = ["Sundry Debtors", "Sundry Creditors", "Bank Accounts", "Cash-in-Hand"]
        
        # Query full ledgers to extract details for auto-populating
        party_details = {}
        party_ledgers = []
        try:
            raw_ledgers = list(self.repo.db["ledgers"].find(
                {"groupName": {"$in": party_groups}},
                {"ledgerName": 1, "partyDetails.gstin": 1, "partyDetails.gstState": 1, "gstin": 1}
            ))
            for doc in raw_ledgers:
                name = doc.get("ledgerName")
                if name:
                    party_ledgers.append(name)
                    pd = doc.get("partyDetails") or {}
                    gstin = pd.get("gstin") or doc.get("gstin") or ""
                    
                    # Resolve state from gstin prefix or gstState
                    gst_state = pd.get("gstState") or ""
                    if not gst_state and gstin and len(gstin) >= 2:
                        state_codes = {
                            "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
                            "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
                            "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
                            "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
                            "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
                            "24": "Gujarat", "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
                            "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
                            "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
                            "38": "Ladakh"
                        }
                        prefix = gstin[:2]
                        gst_state = state_codes.get(prefix, "")
                    
                    party_details[name] = {
                        "gstin": gstin,
                        "gstState": gst_state
                    }
        except Exception:
            pass

        if not party_ledgers:
            party_ledgers = self.repo.get_ledgers_by_groups(party_groups)
            if not party_ledgers:
                party_ledgers = ["HDFC Bank", "Cash", "Sundry Debtor A"]
                party_details = {
                    "Sundry Debtor A": {"gstin": "23ABOPN2351G1ZS", "gstState": "Madhya Pradesh"}
                }

        gst_registrations = []
        comp = self.repo.find_one_company()
        if comp and "gstDetails" in comp:
            gst_state = comp["gstDetails"].get("gstState")
            if gst_state:
                gst_registrations.append(f"{gst_state} Registration")
        if not gst_registrations:
            gst_registrations = ["Madhya Pradesh Registration", "Maharashtra Registration"]

        stock_items = self.repo.get_stock_items()
        if not stock_items:
            stock_items = ["Monitor", "Keyboard"]

        # Build a details dict keyed by item name for HSN autofill
        stock_item_details_list = self.repo.get_stock_item_details()
        stock_item_details = {item["name"]: {"hsnCode": item["hsnCode"], "gstRate": item["gstRate"]} for item in stock_item_details_list}

        tcs_ledgers = self.repo.get_tcs_ledgers()
        if not tcs_ledgers:
            tcs_ledgers = ["TCS on Sales"]

        expense_groups = ["Indirect Expenses", "Direct Expenses", "Indirect Incomes", "Direct Incomes"]
        additional_charge_ledgers = self.repo.get_ledgers_by_groups(expense_groups)
        if not additional_charge_ledgers:
            additional_charge_ledgers = ["Freight Charges"]

        parents = ["Sales", "Sales Order", "Credit Note"]
        voucher_types = self.repo.get_voucher_types_by_parents(parents)
        if not voucher_types:
            voucher_types = ["sales_invoice", "sales_order", "credit_note"]

        return {
            "salesLedgers": sorted(list(set(sales_ledgers))),
            "partyLedgers": sorted(list(set(party_ledgers))),
            "partyLedgerDetails": party_details,
            "gstRegistrations": gst_registrations,
            "stockItems": sorted(list(set(stock_items))),
            "stockItemDetails": stock_item_details,
            "tcsLedgers": sorted(list(set(tcs_ledgers))),
            "additionalChargeLedgers": sorted(list(set(additional_charge_ledgers))),
            "voucherTypes": sorted(list(set(voucher_types)))
        }
