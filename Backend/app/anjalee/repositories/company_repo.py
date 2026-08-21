from typing import List, Optional, Dict, Any
from app.anjalee.repositories.base_repo import BaseRepository
from app.anjalee.constants.business_constants import (
    COMPANIES_COLLECTION, LEDGERS_COLLECTION, STOCK_ITEMS_COLLECTION, 
    VOUCHER_TYPES_COLLECTION
)

class CompanyRepository(BaseRepository):
    def list_all_companies(self) -> List[Dict[str, Any]]:
        return list(self.db[COMPANIES_COLLECTION].find())

    def create_company(self, company_doc: Dict[str, Any]) -> str:
        # Pre-create indexes on dynamic collections for the tenant database
        try:
            from app.db import ensure_db_indexes
            ensure_db_indexes(self.db)
        except Exception:
            pass

        result = self.db[COMPANIES_COLLECTION].insert_one(company_doc)
        return str(result.inserted_id)

    def find_one_company(self) -> Optional[Dict[str, Any]]:
        return self.db[COMPANIES_COLLECTION].find_one()

    def get_ledgers_by_group(self, group_name: str, company_id: Optional[Any] = None) -> List[str]:
        try:
            from app.anjalee.repositories.sales_repo import build_company_id_query
            g_query = {"groupName": group_name}
            comp_q = build_company_id_query(company_id)
            query = {"$and": [g_query, comp_q]} if comp_q else g_query

            main_docs = list(self.db[LEDGERS_COLLECTION].find(query, {"ledgerName": 1}))
            entry_docs = list(self.db["ledgers_entry"].find(query, {"ledgerName": 1}))
            return [doc.get("ledgerName") for doc in (entry_docs + main_docs) if doc.get("ledgerName")]
        except Exception:
            return []

    def get_ledgers_by_groups(self, groups: List[str], company_id: Optional[Any] = None) -> List[str]:
        try:
            from app.anjalee.repositories.sales_repo import build_company_id_query
            g_query = {"groupName": {"$in": groups}}
            comp_q = build_company_id_query(company_id)
            query = {"$and": [g_query, comp_q]} if comp_q else g_query

            main_docs = list(self.db[LEDGERS_COLLECTION].find(query, {"ledgerName": 1}))
            entry_docs = list(self.db["ledgers_entry"].find(query, {"ledgerName": 1}))
            return [doc.get("ledgerName") for doc in (entry_docs + main_docs) if doc.get("ledgerName")]
        except Exception:
            return []

    def get_stock_items(self, company_id: Optional[Any] = None) -> List[str]:
        try:
            from app.anjalee.repositories.sales_repo import build_company_id_query
            comp_q = build_company_id_query(company_id)
            query = comp_q if comp_q else {}

            main_docs = list(self.db[STOCK_ITEMS_COLLECTION].find(query, {"itemName": 1, "name": 1}))
            entry_docs = list(self.db["stockitems_entry"].find(query, {"itemName": 1, "name": 1}))
            return [doc.get("itemName") or doc.get("name") for doc in (entry_docs + main_docs) if doc.get("itemName") or doc.get("name")]
        except Exception:
            return []

    def get_stock_item_details(self, company_id: Optional[Any] = None) -> List[Dict[str, Any]]:
        """Return stock items with name, hsnCode, and gstRate for autofillScoping."""
        try:
            from app.anjalee.repositories.sales_repo import build_company_id_query
            results = []
            comp_q = build_company_id_query(company_id)
            query = comp_q if comp_q else {}

            main_docs = list(self.db[STOCK_ITEMS_COLLECTION].find(query, {"itemName": 1, "hsnCode": 1, "hsnDetails": 1, "gstDetails": 1, "taxRate": 1}))
            entry_docs = list(self.db["stockitems_entry"].find(query, {"itemName": 1, "hsnCode": 1, "hsnDetails": 1, "gstDetails": 1, "taxRate": 1}))
            for doc in (entry_docs + main_docs):
                name = doc.get("itemName") or doc.get("name") or ""
                if not name:
                    continue
                # hsnCode may be stored directly or inside hsnDetails sub-doc
                hsn = (
                    doc.get("hsnCode")
                    or (doc.get("hsnDetails") or {}).get("hsnCode")
                    or (doc.get("hsnDetails") or {}).get("hsn")
                    or ""
                )
                # gstRate may be stored directly or inside gstDetails sub-doc
                gst_rate = (
                    doc.get("taxRate")
                    or (doc.get("gstDetails") or {}).get("taxRate")
                    or (doc.get("gstDetails") or {}).get("gstRate")
                    or 0
                )
                results.append({"name": name, "hsnCode": str(hsn), "gstRate": float(gst_rate)})
            return results
        except Exception:
            return []

    def get_tcs_ledgers(self, company_id: Optional[Any] = None) -> List[str]:
        try:
            from app.anjalee.repositories.sales_repo import build_company_id_query
            g_query = {
                "$or": [
                    {"groupName": "Duties & Taxes"},
                    {"ledgerName": {"$regex": "TCS", "$options": "i"}}
                ]
            }
            comp_q = build_company_id_query(company_id)
            query = {"$and": [g_query, comp_q]} if comp_q else g_query

            main_docs = list(self.db[LEDGERS_COLLECTION].find(query, {"ledgerName": 1}))
            entry_docs = list(self.db["ledgers_entry"].find(query, {"ledgerName": 1}))
            return [doc.get("ledgerName") for doc in (entry_docs + main_docs) if doc.get("ledgerName")]
        except Exception:
            return []

    def get_voucher_types_by_parents(self, parents: List[str]) -> List[str]:
        try:
            return [
                doc.get("voucherTypeName")
                for doc in self.db[VOUCHER_TYPES_COLLECTION].find({"parent": {"$in": parents}}, {"voucherTypeName": 1})
                if doc.get("voucherTypeName")
            ]
        except Exception:
            return []
