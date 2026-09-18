"""
MasterMappingEngine
===================
5-Level Master Mapping Engine for Accounting Ingestion.

Pipelines:
  1. Level 1: Exact Match (100%)
  2. Level 2: Normalized Match (98%)
  3. Level 3: Company Alias Match (95%)
  4. Level 4: Category-Aware Fuzzy Match (Levenshtein / difflib)
  5. Level 5: LLM Semantic Mapping (Structured JSON via LLM Service)

Rule: NEVER auto-create fake masters without user confirmation. Unmapped values
return status='UNMATCHED' with confidence=0.0 and suggested matches.
"""

import re
import difflib
import logging
from typing import Dict, Any, Tuple, Optional, List
from datetime import datetime

logger = logging.getLogger("master_mapping_engine")


def normalize_string(val: str) -> str:
    """Normalize string by removing punctuation, extra spaces, and legal suffixes."""
    if not val:
        return ""
    s = str(val).strip().lower()
    # Remove common business entity suffixes
    s = re.sub(r'\b(pvt|private|ltd|limited|llp|inc|corp|co|company|firm|traders|enterprises|store|stores|agency|agencies)\b', '', s)
    # Remove punctuation & non-alphanumeric except spaces
    s = re.sub(r'[^a-z0-9\s]', '', s)
    # Collapse multiple spaces
    s = re.sub(r'\s+', ' ', s).strip()
    return s


class MasterMappingEngine:
    def __init__(self, db, company_id: Optional[str] = None):
        self.db = db
        self.company_id = company_id
        self.aliases: Dict[str, Dict[str, str]] = {}  # {category: {normalized_uploaded: original_master_name}}

    async def load_aliases(self):
        """Loads saved user-approved mappings from MongoDB company_aliases collection."""
        if not self.db:
            return
        query = {}
        if self.company_id:
            query["company_id"] = self.company_id

        try:
            cur = self.db["company_aliases"].find(query)
            for doc in await cur.to_list(length=5000):
                cat = doc.get("category", "general")
                if cat not in self.aliases:
                    self.aliases[cat] = {}
                u_norm = normalize_string(doc.get("uploaded_value", ""))
                m_name = doc.get("master_name", "")
                if u_norm and m_name:
                    self.aliases[cat][u_norm] = m_name
        except Exception as e:
            logger.warning(f"Failed to load company aliases: {e}")

    async def save_alias(self, uploaded_val: str, approved_master_name: str, category: str):
        """Persists a user-approved master mapping as a re-usable company alias."""
        if not self.db or not uploaded_val or not approved_master_name:
            return
        try:
            alias_doc = {
                "uploaded_value": uploaded_val.strip(),
                "normalized_uploaded": normalize_string(uploaded_val),
                "master_name": approved_master_name.strip(),
                "category": category,
                "company_id": self.company_id or "default",
                "created_at": datetime.utcnow()
            }
            await self.db["company_aliases"].update_one(
                {
                    "normalized_uploaded": alias_doc["normalized_uploaded"],
                    "category": category,
                    "company_id": alias_doc["company_id"]
                },
                {"$set": alias_doc},
                upsert=True
            )
            if category not in self.aliases:
                self.aliases[category] = {}
            self.aliases[category][alias_doc["normalized_uploaded"]] = approved_master_name.strip()
        except Exception as e:
            logger.error(f"Failed to save company alias: {e}")

    async def match_value(
        self,
        val: str,
        category: str,
        available_masters: Dict[str, str],  # {lower_key: original_master_name}
        context_info: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes the 5-level mapping pipeline for a given uploaded value against available_masters.
        category: 'party' | 'item' | 'bank' | 'cost_center' | 'godown' | 'ledger'
        """
        if not val or not str(val).strip():
            return {
                "matchFound": False,
                "selectedMasterName": None,
                "confidence": 0.0,
                "status": "MISSING",
                "reason": "Uploaded value is empty",
                "suggestedMatches": [],
                "createNewMaster": False
            }

        clean_val = str(val).strip()
        val_lower = clean_val.lower()

        # ── Level 1: Exact Match (100%) ──────────────────────────────────────
        if val_lower in available_masters:
            return {
                "matchFound": True,
                "selectedMasterName": available_masters[val_lower],
                "confidence": 1.0,
                "status": "EXACT_MATCH",
                "reason": "Exact match found in company masters",
                "suggestedMatches": [],
                "createNewMaster": False
            }

        # ── Level 2: Normalized Match (98%) ─────────────────────────────────
        norm_val = normalize_string(clean_val)
        for lower_k, orig_name in available_masters.items():
            if normalize_string(lower_k) == norm_val and norm_val != "":
                return {
                    "matchFound": True,
                    "selectedMasterName": orig_name,
                    "confidence": 0.98,
                    "status": "NORMALIZED_MATCH",
                    "reason": f"Normalized match found: '{orig_name}'",
                    "suggestedMatches": [],
                    "createNewMaster": False
                }

        # ── Level 3: Alias Match (95%) ──────────────────────────────────────
        cat_aliases = self.aliases.get(category, {})
        if norm_val in cat_aliases:
            alias_master = cat_aliases[norm_val]
            return {
                "matchFound": True,
                "selectedMasterName": alias_master,
                "confidence": 0.95,
                "status": "ALIAS_MATCH",
                "reason": f"Matched using approved company alias: '{alias_master}'",
                "suggestedMatches": [],
                "createNewMaster": False
            }

        # ── Level 4: Category-Aware Fuzzy Match (Levenshtein/difflib) ────────
        candidates = list(available_masters.keys())
        suggestions = []

        if candidates:
            # 1. Primary fuzzy check using normalized keys
            norm_map = {normalize_string(k): available_masters[k] for k in candidates}
            norm_keys = list(norm_map.keys())

            close_matches = difflib.get_close_matches(norm_val, norm_keys, n=3, cutoff=0.45)
            for m_key in close_matches:
                ratio = round(difflib.SequenceMatcher(None, norm_val, m_key).ratio(), 2)
                orig = norm_map[m_key]
                suggestions.append({"name": orig, "confidence": ratio})

            # Substring containment fallback
            if not suggestions:
                for lower_k, orig in available_masters.items():
                    if val_lower in lower_k or lower_k in val_lower:
                        ratio = round(difflib.SequenceMatcher(None, val_lower, lower_k).ratio(), 2)
                        suggestions.append({"name": orig, "confidence": max(0.5, ratio)})

            suggestions.sort(key=lambda x: x["confidence"], reverse=True)

        if suggestions and suggestions[0]["confidence"] >= 0.85:
            best = suggestions[0]
            return {
                "matchFound": True,
                "selectedMasterName": best["name"],
                "confidence": best["confidence"],
                "status": "FUZZY_MATCH",
                "reason": f"Fuzzy match ({int(best['confidence']*100)}% similarity) to '{best['name']}'",
                "suggestedMatches": suggestions,
                "createNewMaster": False
            }

        # ── Level 5: LLM Semantic Mapping for Ambiguous Cases ────────────────
        if suggestions and suggestions[0]["confidence"] >= 0.50:
            try:
                from app.anjalee.services.llm_service import call_llm
                prompt = (
                    f"You are an Accounting Master Data Matching Agent.\n"
                    f"Match the uploaded value '{clean_val}' (Category: {category}) to the best matching master from candidates:\n"
                    f"{[s['name'] for s in suggestions]}\n\n"
                    f"Return JSON:\n"
                    f"{{\"selectedMasterName\": \"<exact candidate name or null>\", \"confidence\": <0.0 to 1.0>, \"reason\": \"<short reason>\"}}"
                )
                llm_res = await call_llm(prompt, response_format="json")
                if llm_res and isinstance(llm_res, dict) and llm_res.get("selectedMasterName"):
                    sel = llm_res["selectedMasterName"]
                    conf = float(llm_res.get("confidence", 0.90))
                    if sel in [s["name"] for s in suggestions]:
                        return {
                            "matchFound": True,
                            "selectedMasterName": sel,
                            "confidence": conf,
                            "status": "AI_MATCH",
                            "reason": llm_res.get("reason", "AI semantic match"),
                            "suggestedMatches": suggestions,
                            "createNewMaster": False
                        }
            except Exception as e:
                logger.debug(f"LLM semantic mapping skipped: {e}")

        # ── UNMATCHED ────────────────────────────────────────────────────────
        return {
            "matchFound": False,
            "selectedMasterName": suggestions[0]["name"] if suggestions else None,
            "confidence": suggestions[0]["confidence"] if suggestions else 0.0,
            "status": "UNMATCHED",
            "reason": f"No master found matching '{clean_val}' in {category} database.",
            "suggestedMatches": suggestions,
            "createNewMaster": True
        }
