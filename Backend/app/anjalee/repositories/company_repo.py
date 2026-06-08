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
            self.db["sales_transactions"].create_index([("voucherType", 1), ("status", 1), ("createdAt", -1)])
            self.db["sales_transactions"].create_index([("createdAt", -1)])
            self.db["purchase_transactions"].create_index([("voucherType", 1), ("status", 1), ("createdAt", -1)])
            self.db["purchase_transactions"].create_index([("createdAt", -1)])
            self.db["fund_flow_transactions"].create_index([("voucherType", 1), ("status", 1), ("createdAt", -1)])
            self.db["fund_flow_transactions"].create_index([("createdAt", -1)])
            self.db["ledgers"].create_index([("groupName", 1)])
            self.db["ledgers"].create_index([("ledgerName", 1)])
        except Exception:
            pass

        result = self.db[COMPANIES_COLLECTION].insert_one(company_doc)
        return str(result.inserted_id)

    def find_one_company(self) -> Optional[Dict[str, Any]]:
        return self.db[COMPANIES_COLLECTION].find_one()

    def get_ledgers_by_group(self, group_name: str) -> List[str]:
        try:
            return [
                doc.get("ledgerName")
                for doc in self.db[LEDGERS_COLLECTION].find({"groupName": group_name}, {"ledgerName": 1})
                if doc.get("ledgerName")
            ]
        except Exception:
            return []

    def get_ledgers_by_groups(self, groups: List[str]) -> List[str]:
        try:
            return [
                doc.get("ledgerName")
                for doc in self.db[LEDGERS_COLLECTION].find({"groupName": {"$in": groups}}, {"ledgerName": 1})
                if doc.get("ledgerName")
            ]
        except Exception:
            return []

    def get_stock_items(self) -> List[str]:
        try:
            return [
                doc.get("itemName")
                for doc in self.db[STOCK_ITEMS_COLLECTION].find({}, {"itemName": 1})
                if doc.get("itemName")
            ]
        except Exception:
            return []

    def get_tcs_ledgers(self) -> List[str]:
        try:
            return [
                doc.get("ledgerName")
                for doc in self.db[LEDGERS_COLLECTION].find({
                    "$or": [
                        {"groupName": "Duties & Taxes"},
                        {"ledgerName": {"$regex": "TCS", "$options": "i"}}
                    ]
                }, {"ledgerName": 1})
                if doc.get("ledgerName")
            ]
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
