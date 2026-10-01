import re
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger("voucher_history_matcher")

_INDEXED_DBS = set()

class VoucherHistoryMatcher:
    """
    Cross-references bank transaction narrations and reference numbers against
    the tenant's confirmed historical vouchers (15,000+ entries) to achieve
    near-100% precision for recurring business counterparties.
    """

    def __init__(self, db: Any):
        self.db = db
        self._cache: Dict[str, Any] = {}
        self._ref_cache: Dict[str, Optional[Dict[str, Any]]] = {}
        self._aliases_cache: Optional[Dict[str, str]] = None

        if self.db is not None:
            db_name = getattr(self.db, "name", str(id(self.db)))
            if db_name not in _INDEXED_DBS:
                _INDEXED_DBS.add(db_name)
                try:
                    self.db["vouchers"].create_index("reference.reference", background=True)
                    self.db["vouchers"].create_index("voucherNumber", background=True)
                    self.db["vouchers"].create_index("ledgerEntries.billAllocations.name", background=True)
                    self.db["bank_party_aliases"].create_index("alias", background=True)
                    self.db["bank_party_aliases"].create_index("partyName", background=True)
                except Exception:
                    pass

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
            if ref_val in self._ref_cache:
                vch = self._ref_cache[ref_val]
            else:
                try:
                    query = {"$or": [
                        {"reference.reference": ref_val},
                        {"voucherNumber": ref_val}
                    ]}
                    vch = self.db["vouchers"].find_one(
                        query,
                        {"partyLedgerName": 1, "ledgerEntries.ledgerName": 1, "voucherTypeName": 1, "voucherNumber": 1}
                    )
                    self._ref_cache[ref_val] = vch
                except Exception as e:
                    logger.debug(f"Error querying vouchers for ref '{ref_val}': {e}")
                    vch = None
                    self._ref_cache[ref_val] = None

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

        # 2. Match by exact party alias using batch pre-cached aliases
        unique_handle = (extracted_party or "").strip().lower()
        if unique_handle and len(unique_handle) >= 4 and not re.match(r'^(MMT|TRF|INF|CLG|NEFT|RTGS|UPI|\d+)$', unique_handle, re.I):
            if self._aliases_cache is None:
                self._aliases_cache = {}
                try:
                    q = {}
                    if company_id and company_id != "default":
                        q["$or"] = [{"companyId": company_id}, {"company_id": company_id}]
                    for alias_doc in self.db["bank_party_aliases"].find(q):
                        al = (alias_doc.get("alias") or "").strip().lower()
                        pn = (alias_doc.get("partyName") or "").strip().lower()
                        led = alias_doc.get("ledgerName") or alias_doc.get("resolvedLedger")
                        if al and led:
                            self._aliases_cache[al] = led
                        if pn and led:
                            self._aliases_cache[pn] = led
                except Exception as e:
                    logger.debug(f"Error prefetching bank_party_aliases: {e}")

            if unique_handle in self._aliases_cache:
                resolved_ledger = self._aliases_cache[unique_handle]
                res = {
                    "resolvedLedger": resolved_ledger,
                    "confidence": 98.0,
                    "matchMethod": "history_voucher_handle",
                    "isAmbiguous": False,
                    "reasoning": f"Matched confirmed alias '{unique_handle}' to '{resolved_ledger}'."
                }
                self._cache[cache_key] = res
                return res

        self._cache[cache_key] = None
        return None
