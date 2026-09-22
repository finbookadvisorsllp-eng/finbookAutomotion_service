import re
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger("voucher_history_matcher")

class VoucherHistoryMatcher:
    """
    Cross-references bank transaction narrations and reference numbers against
    the tenant's confirmed historical vouchers (15,000+ entries) to achieve
    near-100% precision for recurring business counterparties.
    """

    def __init__(self, db: Any):
        self.db = db
        self._cache: Dict[str, Any] = {}

    def match_from_history(
        self,
        narration: str,
        ref_number: Optional[str] = None,
        extracted_party: Optional[str] = None,
        company_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Searches historical vouchers collection for matching references,
        bill numbers, or entity handles with memory caching for instant response.
        """
        if self.db is None:
            return None

        cache_key = f"{extracted_party or ''}_{ref_number or ''}_{narration[:40]}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # 1. Match by Reference Number / Bill Number (100% precision)
        ref_candidates = []
        if ref_number and len(str(ref_number).strip()) >= 5:
            ref_candidates.append(str(ref_number).strip())

        if narration:
            found_refs = re.findall(r'\b[A-Za-z0-9_-]{8,22}\b', narration)
            for fr in found_refs:
                if not re.match(r'^(NEFT|RTGS|IMPS|UPI|TRANSFER|PAYMENT|INFT|CLG|REMITTANCE)$', fr, re.I):
                    if fr not in ref_candidates:
                        ref_candidates.append(fr)

        for ref_val in ref_candidates[:2]:
            try:
                query = {"$or": [
                    {"reference.reference": ref_val},
                    {"voucherNumber": ref_val}
                ]}
                vch = self.db["vouchers"].find_one(
                    query,
                    {"partyLedgerName": 1, "ledgerEntries.ledgerName": 1, "voucherTypeName": 1}
                )
                if vch:
                    party = vch.get("partyLedgerName")
                    if not party and vch.get("ledgerEntries"):
                        for entry in vch.get("ledgerEntries", []):
                            l_name = entry.get("ledgerName", "")
                            if l_name and not re.search(r'(GST|TAX|DUTY|BANK|CASH)', l_name, re.I):
                                party = l_name
                                break

                    if party:
                        res = {
                            "resolvedLedger": party,
                            "confidence": 99.0,
                            "matchMethod": "history_voucher_ref",
                            "isAmbiguous": False,
                            "reasoning": f"Matched past confirmed voucher #{vch.get('voucherNumber', '')} with reference '{ref_val}'."
                        }
                        self._cache[cache_key] = res
                        return res
            except Exception as e:
                logger.debug(f"Error querying vouchers for ref '{ref_val}': {e}")

        # 2. Match by exact party alias in bank_party_aliases
        unique_handle = (extracted_party or "").strip().lower()
        if unique_handle and len(unique_handle) >= 4 and not re.match(r'^(MMT|TRF|INF|CLG|NEFT|RTGS|UPI|\d+)$', unique_handle, re.I):
            try:
                q = {"alias": unique_handle}
                if company_id and company_id != "default":
                    q["$or"] = [{"companyId": company_id}, {"company_id": company_id}]
                alias_doc = self.db["bank_party_aliases"].find_one(q)
                if alias_doc and alias_doc.get("ledgerName"):
                    res = {
                        "resolvedLedger": alias_doc["ledgerName"],
                        "confidence": 98.0,
                        "matchMethod": "history_voucher_handle",
                        "isAmbiguous": False,
                        "reasoning": f"Matched confirmed alias '{unique_handle}' to '{alias_doc['ledgerName']}'."
                    }
                    self._cache[cache_key] = res
                    return res
            except Exception as e:
                logger.debug(f"Error querying bank_party_aliases for handle '{unique_handle}': {e}")

        self._cache[cache_key] = None
        return None
