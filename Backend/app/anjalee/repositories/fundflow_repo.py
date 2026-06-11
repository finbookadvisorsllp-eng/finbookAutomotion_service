from typing import List, Optional, Dict, Any
from bson import ObjectId
from app.anjalee.repositories.base_repo import BaseRepository
from app.anjalee.constants.business_constants import (
    FUNDFLOW_COLLECTION, VOUCHERS_COLLECTION, COUNTERS_COLLECTION
)
from pymongo import ReturnDocument

class FundFlowRepository(BaseRepository):
    def get_summary_cursor(self, query: Optional[Dict[str, Any]] = None) -> Any:
        q = query or {}
        return self.db[FUNDFLOW_COLLECTION].find(q, {"amount": 1, "transferAmount": 1, "status": 1})

    def count_transactions(self, query: Dict[str, Any]) -> int:
        return self.db[FUNDFLOW_COLLECTION].count_documents(query)

    def find_transactions(self, query: Dict[str, Any], skip: int, limit: int) -> List[Dict[str, Any]]:
        return list(
            self.db[FUNDFLOW_COLLECTION]
            .find(query)
            .sort("createdAt", -1)
            .skip(skip)
            .limit(limit)
        )

    def get_next_sequence_value(self, sequence_id: str) -> int:
        counter = self.db[COUNTERS_COLLECTION].find_one_and_update(
            {"_id": sequence_id},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        return counter["seq"]

    def insert_transaction(self, doc_data: Dict[str, Any]) -> str:
        result = self.db[FUNDFLOW_COLLECTION].insert_one(doc_data)
        return str(result.inserted_id)

    def find_transaction_by_id(self, tx_id: str) -> Optional[Dict[str, Any]]:
        try:
            return self.db[FUNDFLOW_COLLECTION].find_one({"_id": ObjectId(tx_id)})
        except Exception:
            return None

    def find_voucher_by_id(self, voucher_id: str) -> Optional[Dict[str, Any]]:
        try:
            return self.db[VOUCHERS_COLLECTION].find_one({"_id": ObjectId(voucher_id)})
        except Exception:
            return None

    def update_transaction(self, tx_id: str, update_data: Dict[str, Any]) -> bool:
        try:
            result = self.db[FUNDFLOW_COLLECTION].update_one(
                {"_id": ObjectId(tx_id)},
                {"$set": update_data}
            )
            return result.matched_count > 0
        except Exception:
            return False

    def delete_transaction(self, tx_id: str) -> bool:
        try:
            result = self.db[FUNDFLOW_COLLECTION].delete_one({"_id": ObjectId(tx_id)})
            return result.deleted_count > 0
        except Exception:
            return False

    def update_transaction_custom(self, tx_id: str, update_op: Dict[str, Any]) -> bool:
        try:
            result = self.db[FUNDFLOW_COLLECTION].update_one(
                {"_id": ObjectId(tx_id)},
                update_op
            )
            return result.matched_count > 0
        except Exception:
            return False
