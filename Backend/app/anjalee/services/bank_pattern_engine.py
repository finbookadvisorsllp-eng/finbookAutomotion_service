import re
import os
import math
import logging
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
from bson import ObjectId
from collections import defaultdict, Counter
from openai import OpenAI

from app.config import settings
from app.anjalee.utils.serialization import serialize_doc
from app.anjalee.services.voucher_history_matcher import VoucherHistoryMatcher

logger = logging.getLogger("bank_pattern_engine")

_TAXONOMY_CACHE = None

def get_bank_taxonomy_cache() -> Dict[str, Any]:
    global _TAXONOMY_CACHE
    if _TAXONOMY_CACHE is not None:
        return _TAXONOMY_CACHE

    candidates = [
        Path("d:/finbookAutomotion_service/bank.json"),
        Path(__file__).resolve().parent.parent.parent.parent / "bank.json",
        Path(__file__).resolve().parent.parent.parent / "bank.json",
        Path(os.getcwd()) / "bank.json",
        Path(os.getcwd()).parent / "bank.json"
    ]
    raw_data = {}
    for p in candidates:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    break
            except Exception as e:
                logger.warning(f"Failed to read bank.json from {p}: {e}")

    core_types = [
        "UPI", "NEFT", "RTGS", "IMPS", "CLG", "CHEQUE", "CASH", "ATM", 
        "POS", "NACH", "ECS", "INTERNAL_TRANSFER", "BANK_CHARGES", 
        "INTEREST", "SALARY", "REFUND", "REVERSAL", "OTHER_TRANSFER"
    ]
    
    banks_covered = raw_data.get("scope", {}).get("banks_covered", [])

    _TAXONOMY_CACHE = {
        "raw": raw_data,
        "banks_covered": banks_covered,
        "core_types": core_types,
        "taxonomy": raw_data.get("transaction_taxonomy", {}),
        "profiles": raw_data.get("bank_narration_profiles", {})
    }
    return _TAXONOMY_CACHE


def get_default_transaction_types_library(bank_ledger: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns the standard default transaction type library from bank.json
    in an empty state (0 detected transactions) before statement upload.
    Zero fake counts, zero fake parties.
    """
    cache = get_bank_taxonomy_cache()
    core_types = cache.get("core_types", [
        "UPI", "NEFT", "RTGS", "IMPS", "CLG", "CHEQUE", "CASH", "ATM", 
        "POS", "NACH", "ECS", "INTERNAL_TRANSFER", "BANK_CHARGES", 
        "INTEREST", "SALARY", "REFUND", "REVERSAL", "OTHER_TRANSFER"
    ])
    
    bank_code = PatternDiscoveryEngine.derive_bank_code(bank_ledger or "BANK")
    
    library = []
    for idx, t in enumerate(core_types):
        library.append({
            "id": f"def_type_{t.lower()}",
            "_id": f"def_type_{t.lower()}",
            "patternId": f"DEF-{bank_code}-{t}",
            "patternName": f"{t} Default Library",
            "transactionType": t,
            "txnType": t,
            "channel": t,
            "matchingCount": 0,
            "frequency": 0,
            "typeTotalCount": 0,
            "separator": "—",
            "pattern": "Awaiting statement upload",
            "candidatePattern": "Awaiting statement upload",
            "tokens": [],
            "txnIdPosition": -1,
            "txnIdRule": "Not detected",
            "partyPosition": -1,
            "partyRule": "Not detected",
            "partyField": "Not detected",
            "distinctParties": [],
            "distinctPartiesCount": 0,
            "extractedParty": "—",
            "suggestedLedger": "Awaiting Statement",
            "mappedLedger": "Awaiting Statement",
            "confidence": 0,
            "validationStatus": "Awaiting Statement Upload",
            "validationPercent": 0,
            "isDefaultLibrary": True,
            "isPatternA": False,
            "isAiAnalyzed": False,
            "sampleNarrations": [],
            "transactions": []
        })
    return library

# ─── Module-level LLM result cache + background executor ──────────────────────
import hashlib as _hashlib
import concurrent.futures as _futures
_LLM_PATTERN_CACHE: dict = {}
_LLM_EXECUTOR = _futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="llm_worker")
_LLM_IN_FLIGHT: set = set()  # track which cache_keys are already being fetched
# ──────────────────────────────────────────────────────────────────────────────


def _build_llm_prompt(samples_text: str, bank_ledger: str, channel: str) -> str:
    return (
        f"You are an expert AI parser for Indian bank statement narrations.\n"
        f"Bank Account: {bank_ledger}\n"
        f"Transaction Rail / Channel: {channel}\n\n"
        f"Here are sample narrations for this pattern (Pattern A):\n"
        f"{samples_text}\n\n"
        f"Determine: separator, txnIdPosition, partyPosition, vpaPosition, skeleton.\n"
        f"Return STRICT JSON only (no markdown):\n"
        f'{{"separator":"/","txnIdPosition":1,"partyPosition":2,"vpaPosition":-1,'
        f'"skeleton":"{channel} / {{TxnId}} / {{Party}}","reasoning":"brief"}}'
    )


def _run_llm_sync(cache_key: str, samples_text: str, bank_ledger: str, channel: str) -> None:
    """Runs in background thread. Stores result in _LLM_PATTERN_CACHE when done."""
    try:
        nv_key = (settings.NVIDIA_API_KEY or "").strip("\"'")
        or_key = (settings.OPENROUTER_API_KEY or "").strip("\"'")
        prompt = _build_llm_prompt(samples_text, bank_ledger, channel)

        # ONLY use NVIDIA with the user-specified model (openai/gpt-oss-20b)
        providers = []
        if nv_key:
            providers.append({
                "name": "NVIDIA",
                "base_url": (getattr(settings, "NVIDIA_BASE_URL", None) or "https://integrate.api.nvidia.com/v1").strip("\"'"),
                "api_key": nv_key,
                "model": (getattr(settings, "LLM_MODEL", None) or "openai/gpt-oss-20b").strip("\"'"),
                "timeout": 45.0  # Increased from 15.0s to 45.0s so NVIDIA has ample time
            })
        if or_key:
            providers.append({
                "name": "OpenRouter",
                "base_url": "https://openrouter.ai/api/v1",
                "api_key": or_key,
                "model": "meta-llama/llama-3.2-3b-instruct",
                "timeout": 20.0
            })

        for prov in providers:
            try:
                client = OpenAI(base_url=prov["base_url"], api_key=prov["api_key"], timeout=prov["timeout"])
                resp = client.chat.completions.create(
                    model=prov["model"],
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0,
                    max_tokens=150
                )
                content = resp.choices[0].message.content or ""
                content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
                content = re.sub(r"\s*```$", "", content.strip(), flags=re.MULTILINE)
                m = re.search(r"(\{.*\})", content, re.DOTALL)
                if m:
                    content = m.group(1)
                parsed = json.loads(content)
                if isinstance(parsed, dict) and "partyPosition" in parsed:
                    logger.info(f"LLM Pattern A [BG] succeeded via {prov['name']} ({prov['model']}) — cached for next poll.")
                    _LLM_PATTERN_CACHE[cache_key] = parsed
                    return
            except Exception as e:
                logger.warning(f"LLM Pattern A [BG] via {prov['name']} failed ({e}); trying next.")
    finally:
        _LLM_IN_FLIGHT.discard(cache_key)


def analyze_pattern_a_with_llm(
    sample_narrations: List[str],
    bank_ledger: str = "BANK",
    channel: str = "UPI"
) -> Optional[Dict[str, Any]]:
    """
    NON-BLOCKING wrapper around LLM pattern analysis.

    - Cache HIT  → returns cached result instantly (microseconds).
    - Cache MISS → fires LLM in a background thread, returns None IMMEDIATELY
                   so the deterministic engine takes over for this request.
                   Next poll will get the LLM-enriched result from cache.

    This ensures getSuggestions API never blocks more than a few ms on LLM.
    """
    samples_text = "\n".join(f"- {s}" for s in sample_narrations[:5] if s)
    if not samples_text:
        return None

    cache_key = f"{channel}|{_hashlib.md5(samples_text.encode()).hexdigest()}"

    # ── Cache HIT: return instantly ──────────────────────────────────────────
    if cache_key in _LLM_PATTERN_CACHE:
        logger.info(f"LLM Pattern A cache HIT for channel={channel} — instant return.")
        return _LLM_PATTERN_CACHE[cache_key]

    # ── Cache MISS: fire background thread (non-blocking) ────────────────────
    nv_key = (settings.NVIDIA_API_KEY or "").strip("\"'")
    or_key = (settings.OPENROUTER_API_KEY or "").strip("\"'")
    if (nv_key or or_key) and cache_key not in _LLM_IN_FLIGHT:
        _LLM_IN_FLIGHT.add(cache_key)
        _LLM_EXECUTOR.submit(_run_llm_sync, cache_key, samples_text, bank_ledger, channel)
        logger.info(f"LLM Pattern A [BG] submitted for channel={channel} — using deterministic now, LLM result on next poll.")

    # Return None immediately → deterministic extraction handles this request
    return None



def jaro_winkler_similarity(s1: str, s2: str, p: float = 0.1) -> float:
    """
    Computes Jaro-Winkler distance between two strings s1 and s2.
    Returns float in range [0.0, 1.0].
    """
    if s1 == s2:
        return 1.0
    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0

    match_distance = max(len1, len2) // 2 - 1
    s1_matches = [False] * len1
    s2_matches = [False] * len2

    matches = 0
    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len2)
        for j in range(start, end):
            if s2_matches[j]:
                continue
            if s1[i] != s2[j]:
                continue
            s1_matches[i] = True
            s2_matches[j] = True
            matches += 1
            break

    if matches == 0:
        return 0.0

    k = 0
    transpositions = 0
    for i in range(len1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1

    transpositions /= 2
    jaro = (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3.0

    prefix = 0
    for i in range(min(4, min(len1, len2))):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break

    return jaro + prefix * p * (1.0 - jaro)


# =====================================================================
# 1. NARRATION NORMALIZATION SERVICE
# =====================================================================
class NarrationNormalizationService:
    """
    Standardizes raw bank statement narrations, tokenizes into indexed segments,
    preserves original text and extracts reference numbers, UPI handles, and party candidates.
    """

    DELIMITER_REGEX = re.compile(r'[/ \-_:*~|]+')
    STOP_WORDS = {
        "BANK", "NEFT", "RTGS", "UPI", "IMPS", "CLG", "CTS", "CHQ", "CHEQUE",
        "TRANSFER", "PAYMENT", "RECEIVED", "TRF", "INFT", "INF", "IFT", "PAID",
        "LTD", "PVT", "PVTLTD", "LIMITED", "PRIVATE", "CR", "DR", "TXN", "REF",
        "RRN", "MOB", "NA", "NIL", "NULL", "BY", "TO", "FOR", "SLB", "SLBL", "SLBN"
    }

    @classmethod
    def normalize_text(cls, text: str) -> str:
        """Trims, de-wraps PDF cell breaks within segments, collapses whitespace, and normalizes."""
        if not text:
            return ""
        s = text.strip()

        # If slashes are present, normalize segment by segment
        if '/' in s:
            parts = s.split('/')
            clean_parts = []
            for p in parts:
                p_str = p.strip()
                if ' ' not in p_str:
                    p_clean = re.sub(r'[\r\n]+', '', p_str)
                else:
                    p_clean = re.sub(r'[\r\n]+', ' ', p_str)
                # Fix single character broken wrap (e.g. 'P OONAM' -> 'POONAM')
                p_clean = re.sub(r'\b([A-Za-z])\s+([A-Za-z]{2,})\b', r'\1\2', p_clean)
                clean_parts.append(re.sub(r'\s{2,}', ' ', p_clean).strip())
            return '/'.join(clean_parts)

        # De-wrap single-character breaks and normalize whitespace
        s = re.sub(r'\b([A-Za-z])[\r\n]+([A-Za-z]{2,})\b', r'\1\2', s)
        s = re.sub(r'[\r\n\t]+', ' ', s)
        s = re.sub(r'\s{2,}', ' ', s)
        return s.strip()

    @classmethod
    def tokenize(cls, text: str) -> List[Dict[str, Any]]:
        """
        Tokenizes narration into indexed segments while tracking original token and clean token.
        """
        raw = cls.normalize_text(text)
        if not raw:
            return []

        parts = [p.strip() for p in re.split(cls.DELIMITER_REGEX, raw) if p.strip()]
        tokens = []
        for idx, p in enumerate(parts):
            p_upper = p.upper()
            token_type = "OTHER"
            if p_upper in ["UPI", "NEFT", "RTGS", "IMPS", "CLG", "CTS", "CHQ", "INFT", "ATM", "POS", "CDM"]:
                token_type = "CHANNEL"
            elif p.isdigit():
                token_type = "NUMERIC"
            elif re.match(r'^[A-Z]{4}[A-Z0-9]{7,14}$', p_upper):
                token_type = "UTR"
            elif "@" in p:
                token_type = "VPA"
            elif re.match(r'^\d{2}[A-Z]{3}\d{2,4}$|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$', p_upper):
                token_type = "DATE"
            elif len(p) >= 3 and p_upper not in cls.STOP_WORDS:
                token_type = "PARTY_CANDIDATE"

            tokens.append({
                "index": idx,
                "raw": p,
                "clean": p_upper,
                "type": token_type,
                "is_numeric": p.isdigit(),
                "length": len(p)
            })
        return tokens

    @classmethod
    def process_narration(cls, narration: str) -> Dict[str, Any]:
        """
        Returns full normalization object preserving original and normalized views.
        """
        original = narration or ""
        normalized = cls.normalize_text(original)
        tokens = cls.tokenize(normalized)
        ref = cls.extract_reference_number(normalized)
        party, extract_conf = cls.extract_party_candidate(normalized)
        channel, channel_conf = TransactionClassifierService.classify_channel(normalized)

        return {
            "originalNarration": original,
            "normalizedNarration": normalized,
            "tokens": tokens,
            "channel": channel,
            "channelConfidence": channel_conf,
            "referenceNumber": ref,
            "extractedParty": party,
            "extractionConfidence": extract_conf
        }

    @classmethod
    def extract_reference_number(cls, narration: str) -> Optional[str]:
        """Extracts UTR number, UPI RRN, cheque number, or transaction reference."""
        if not narration:
            return None

        # 1. Standard UTR / NEFT / RTGS (e.g. HDFCH01163185685, UTIB0001234567, ICIC123456789)
        utr_m = re.search(r'\b([A-Z]{4}H\d{9,12}|[A-Z]{4}R\d{9,12}|[A-Z]{4}N\d{9,12}|[A-Z]{4}\d{9,16})\b', narration, re.I)
        if utr_m:
            return utr_m.group(1).upper()

        # 2. UPI Reference / RRN (12 digits)
        upi_m = re.search(r'(?:UPI/|UPI-|UPI/CR/|UPI/DR/)(\d{12})\b', narration, re.I)
        if upi_m:
            return upi_m.group(1)

        # 3. Explicit Ref / UTR / Chq labels
        gen_m = re.search(r'\b(?:UTR|REF|RRN|CHQ|CHEQUE|TXN|NO)[-:\s/]+([A-Za-z0-9]{6,22})\b', narration, re.I)
        if gen_m:
            return gen_m.group(1).upper()

        # 4. Long numeric token (6-16 digits)
        num_m = re.search(r'\b(\d{9,16})\b', narration)
        if num_m:
            return num_m.group(1)

        return None

    @classmethod
    def extract_party_candidate(cls, narration: str) -> Tuple[Optional[str], float]:
        """
        Extracts candidate party / entity name from narration with extraction confidence (0-100).
        Safely strips reference numbers, bank identifiers, and status codes.
        """
        if not narration:
            return (None, 0.0)

        return RegexPositionalExtractor.extract_party(narration)

    @classmethod
    def detect_channel(cls, narration: str) -> Tuple[str, float]:
        """Backward-compatible wrapper routing to TransactionClassifierService."""
        return TransactionClassifierService.classify_channel(narration)


# Alias for naming consistency
NarrationNormalizerService = NarrationNormalizationService


# =====================================================================
# 2. TRANSACTION CLASSIFICATION SERVICE
# =====================================================================
class TransactionClassifierService:
    """
    Identifies transaction channels and accounting subtypes from narration evidence.
    Supports NEFT, RTGS, IMPS, UPI, CHEQUE, CASH, ATM, SELF/INTERNAL TRF, CHARGES, INTEREST, OTHER.
    """

    CHANNEL_PATTERNS = [
        ("UPI", [
            re.compile(r'\b(UPI|BHIM|PAYTM|GPAY|PHONEPE)\b', re.I),
            re.compile(r'/[Uu][Pp][Ii]/|^UPI/|[-/]UPI[-/]', re.I),
            re.compile(r'@[a-zA-Z0-9]+', re.I)
        ]),
        ("NEFT", [
            re.compile(r'\b(NEFT|N-E-F-T)\b', re.I),
            re.compile(r'[-/]NEFT[-/]', re.I),
            re.compile(r'\b[A-Z]{4}N\d{9,12}\b', re.I)
        ]),
        ("RTGS", [
            re.compile(r'\b(RTGS|R-T-G-S)\b', re.I),
            re.compile(r'[-/]RTGS[-/]', re.I),
            re.compile(r'\b[A-Z]{4}R\d{9,12}\b', re.I)
        ]),
        ("IMPS", [
            re.compile(r'\b(IMPS|I-M-P-S|MOB)\b', re.I),
            re.compile(r'[-/]IMPS[-/]', re.I),
            re.compile(r'\bMMID\b', re.I)
        ]),
        ("CLG", [
            re.compile(r'\b(CLG|CLEARING|CTS|CTS\s+CLEARING|INWARD\s+CLEARING|OUTWARD\s+CLEARING)\b', re.I),
            re.compile(r'[-/]CLG[-/]', re.I),
            re.compile(r'^CLG/', re.I)
        ]),
        ("CHEQUE", [
            re.compile(r'\b(CHEQUE|CHQ|CHQ\s+DEP|CHQ\s+PAID|CHQ\s+NO|CHEQUE\s+PAYMENT)\b', re.I)
        ]),
        ("CASH", [
            re.compile(r'\b(CASH\s+DEP|CDM|CASH\s+DEPOSIT|CASH\s+WDL|CASH\s+WITHDRAWAL|CWDR|BY\s+CASH|CASH\s+CR|CASH\s+DR)\b', re.I)
        ]),
        ("ATM", [
            re.compile(r'\b(ATM|NFS|ATM\s+WDL|CASH\s+ATM|ATM\s+WITHDRAWAL|CASH\s+DISPENSE)\b', re.I)
        ]),
        ("POS", [
            re.compile(r'\b(POS|POS\s+PURCHASE|POS\s+DEBIT|CARD\s+PURCHASE|DEBIT\s+CARD|DC\s+POS|MERCHANT\s+PURCHASE)\b', re.I)
        ]),
        ("NACH", [
            re.compile(r'\b(NACH|NACH\s+DR|NACH\s+CR|NACH\s+DEBIT|NACH\s+CREDIT|ACH|ACH\s+DR|ACH\s+CR)\b', re.I)
        ]),
        ("ECS", [
            re.compile(r'\b(ECS|ECS\s+DR|ECS\s+CR|ECS\s+DEBIT|ECS\s+CREDIT)\b', re.I)
        ]),
        ("INTERNAL_TRANSFER", [
            re.compile(r'\b(INTERNAL\s+TRF|INTRA\s+TRF|INFT|INF|IFT|OWN\s+ACC|TO\s+SELF|SELF\s+TRF|OWN\s+A/C|BOOK\s+TRANSFER)\b', re.I),
            re.compile(r'[-/]INFT[-/]|[-/]INF[-/]', re.I)
        ]),
        ("BANK_CHARGES", [
            re.compile(r'\b(CHG|CHARGE|CHARGES|FEE|PROC\s+FEE|SMS\s+CHG|MIN\s+BAL|SERVICE\s+TAX|GST|CONSOL\s+CHG|ANNUAL\s+FEE|BANK\s+CHARGES|SERVICE\s+CHARGE)\b', re.I)
        ]),
        ("INTEREST", [
            re.compile(r'\b(INT|INTEREST|INT\.PD|INT\.REC|SAVINGS\s+INT|FD\s+INT)\b', re.I)
        ]),
        ("SALARY", [
            re.compile(r'\b(SALARY|SALARY\s+CR|MONTHLY\s+SALARY|PAYROLL)\b', re.I)
        ]),
        ("REFUND", [
            re.compile(r'\b(REFUND|REVERSAL|RETURN|CHARGEBACK|REVERSED)\b', re.I)
        ]),
        ("OTHER_TRANSFER", [
            re.compile(r'\b(TRF|TRANSFER|TRFR|XFER|FUND\s+TRANSFER|FUNDS\s+TRANSFER|FT)\b', re.I)
        ])
    ]

    @classmethod
    def classify_channel(cls, narration: str) -> Tuple[str, float]:
        """
        Classifies transaction channel with confidence score.
        Returns (channel_name, confidence).
        """
        if not narration:
            return ("OTHER", 25.0)

        n = NarrationNormalizationService.normalize_text(narration)

        for channel, regexes in cls.CHANNEL_PATTERNS:
            for rgx in regexes:
                if rgx.search(n):
                    if channel in ["UPI", "NEFT", "RTGS", "IMPS", "CHEQUE", "INTERNAL_TRANSFER"]:
                        return (channel, 95.0)
                    if channel in ["BANK_CHARGES", "INTEREST", "CASH", "ATM"]:
                        return (channel, 90.0)
                    return (channel, 85.0)

        return ("OTHER", 40.0)

    @classmethod
    def classify_transaction_full(
        cls,
        narration: str,
        amount: float = 0.0,
        is_credit: bool = False
    ) -> Dict[str, Any]:
        """
        Full classification returning channel, subtype, confidence, and reasoning.
        """
        n = NarrationNormalizationService.normalize_text(narration)
        channel, conf = cls.classify_channel(n)

        subtype = "GENERAL"
        if channel == "UPI":
            if "@" in n and re.search(r'paytm|billdesk|bharatpe|razorpay|swiggy|zomato', n, re.I):
                subtype = "UPI_MERCHANT"
            else:
                subtype = "UPI_P2P"
        elif channel == "NEFT":
            subtype = "NEFT_CREDIT" if is_credit else "NEFT_DEBIT"
        elif channel == "CHEQUE":
            subtype = "CLEARING_CTS"
        elif channel == "INTERNAL_TRANSFER":
            subtype = "INTERNAL_TRANSFER"
        elif channel == "BANK_CHARGES":
            subtype = "CHARGES_DEBIT"
        elif channel == "INTEREST":
            subtype = "INTEREST_CREDIT" if is_credit else "INTEREST_DEBIT"

        return {
            "channel": channel,
            "subtype": subtype,
            "confidence": conf,
            "isCredit": is_credit,
            "amount": amount,
            "reasoning": f"Identified {channel} ({subtype}) with confidence {conf}% based on narration pattern."
        }


# =====================================================================
# 3. REGEX & POSITIONAL EXTRACTION SERVICE
# =====================================================================
class RegexPositionalExtractor:
    """
    Safely executes validated regex rules and token-position extraction
    to isolate clean party names and reference numbers without overmatching.
    """

    BANK_STOPWORDS = {
        # Public sector banks
        "HDFC", "ICICI", "ICIC", "SBIN", "SBI", "AXIS", "PUNB", "PNB", "KKBK", "KOTAK",
        "BARB", "BOB", "CNRB", "CANARA", "UBIN", "UNION", "IDFB", "IDFC", "IDFCFIRST",
        "YESB", "YES", "YESBANK",
        # Other nationalized / private banks
        "IDB", "IDBI", "UCO", "CBI", "IOB", "OBC", "UTIB", "FDRL", "FEDERAL",
        "DENA", "VIJAYA", "TMBL", "KARB", "KVB", "KVBL",
        "RBL", "RBLB", "CITI", "CITIBANK", "SCB", "HSBC", "DBS",
        "BANDHAN", "BDBL", "FINO", "PAYTM", "AIRTEL", "JSFB", "JANA",
        "NKGSB", "SARASWAT", "APGV", "ANDB", "ALLA", "ALLAHABAD",
        "SIBL", "CSB", "LAKSHMI", "LVB", "DCBL", "DCB",
        "IBKL", "INDUSIND", "INDB", "PMC", "MAHB", "MAHABANK"
    }

    LOCATION_STOPWORDS = {
        "MUMBAI", "DELHI", "KOLKATA", "CHENNAI", "BANGALORE", "HYDERABAD",
        "PUNE", "AHMEDABAD", "SURAT", "JAIPUR", "INDORE", "NAGPUR", "BHOPAL", "LUCKNOW"
    }

    STOP_SEGMENTS = {
        'UPI', 'NEFT', 'RTGS', 'IMPS', 'CLG', 'CTS', 'INFT', 'INF', 'MMT', 'IFT',
        'TRF', 'TRANSFER', 'PAYMENT', 'PAY', 'RECEIPT', 'CR', 'DR', 'NA', 'INT',
        'COLL', 'SERVICE', 'CHG', 'CHARGE', 'FEE', 'CHARGES', 'TDS', 'ATM', 'WDL',
        'CASH', 'SLB', 'SLBL', 'SLBN',
        # Bank codes also stop here so they are never extracted as party names
        'IDB', 'IDBI', 'UCO', 'CBI', 'IOB', 'OBC', 'UTIB', 'FDRL', 'FEDERAL',
        'DENA', 'VIJAYA', 'RBL', 'BANDHAN', 'FINO', 'IBKL', 'INDUSIND', 'INDB'
    }

    @classmethod
    def clean_extracted_party(cls, party_raw: str) -> Optional[str]:
        """
        Sanitizes raw party candidates: removes leading/trailing delimiters,
        long numbers, IFSC codes, and extraneous noise.
        """
        if not party_raw:
            return None

        cleaned = re.sub(r'[-_./:]+', ' ', party_raw).strip()
        cleaned = re.sub(r'\b\d{4,}\b', '', cleaned).strip()
        # Remove standard Indian IFSC codes (4 letters + '0' + 6 alphanumeric)
        cleaned = re.sub(r'\b[A-Z]{4}0[A-Z0-9]{6}\b', '', cleaned, flags=re.I).strip()
        cleaned = re.sub(r'\b[A-Z]{4}\d{6,}\b', '', cleaned, flags=re.I).strip()

        # Reconstruct broken name fragments caused by multiline column wrapping (e.g. "P OONAM" -> "POONAM")
        cleaned = re.sub(r'\b([A-Za-z])\s+([A-Za-z]{2,})\b', r'\1\2', cleaned)

        tokens = cleaned.split()
        if tokens and tokens[-1].upper() in cls.LOCATION_STOPWORDS:
            tokens.pop()
        if tokens and tokens[-1].upper() in cls.BANK_STOPWORDS:
            tokens.pop()

        # Reconstruct broken suffixes (e.g. "ALKE SH" -> "ALKESH", "JITEN DRA" -> "JITENDRA")
        if len(tokens) == 2 and tokens[0].isalpha() and tokens[1].isalpha():
            if len(tokens[1]) <= 3 and len(tokens[0]) >= 3 and tokens[1].upper() not in ["LTD", "PVT", "AND", "CO"]:
                tokens = [tokens[0] + tokens[1]]
            elif len(tokens[0]) <= 2 and len(tokens[1]) >= 3:
                tokens = [tokens[0] + tokens[1]]

        cleaned = " ".join(tokens).strip()

        if len(cleaned) < 3 or cleaned.isdigit() or cleaned.upper() in cls.STOP_SEGMENTS:
            return None

        return cleaned

    @classmethod
    def extract_party(cls, narration: str) -> Tuple[Optional[str], float]:
        """
        Extracts party name candidate from narration with confidence score.
        """
        text = NarrationNormalizationService.normalize_text(narration)
        if not text or len(text) < 3:
            return (None, 0.0)

        # ── Dynamic Delimiter & Entity Role Extraction ───────────────────────
        # Determine dominant delimiter dynamically
        delimiters = ['/', '-', '|']
        delim = '/'
        max_splits = 0
        for d in delimiters:
            splits_count = text.count(d)
            if splits_count > max_splits:
                max_splits = splits_count
                delim = d

        segments = [s.strip() for s in text.split(delim) if s.strip()] if max_splits > 0 else [s.strip() for s in text.split() if s.strip()]

        # Filter and score candidates dynamically
        candidates = []
        for idx, seg in enumerate(segments):
            seg_upper = seg.upper()
            # Skip channel markers
            if seg_upper in cls.STOP_SEGMENTS:
                continue
            # Skip pure numbers or long references/UTRs
            if seg.isdigit() or re.match(r'^[A-Z]{4}[0-9A-Z]{7,}$', seg_upper) or re.match(r'^\d{6,}$', seg):
                continue
            # Skip standard IFSC codes
            if re.match(r'^[A-Z]{4}0[0-9A-Z]{6}$', seg_upper):
                continue
            # Extract from VPA if present
            if '@' in seg:
                vpa_match = re.search(r'([^/@\s]{3,30})@[a-zA-Z0-9]+', seg)
                if vpa_match and not vpa_match.group(1).isdigit():
                    cand = cls.clean_extracted_party(vpa_match.group(1))
                    if cand:
                        candidates.append((cand, 82.0, idx))
                continue
            # General party candidate
            if re.search(r'[A-Za-z]{2,}', seg):
                clean_seg = cls.clean_extracted_party(seg)
                if clean_seg and clean_seg.upper() not in cls.STOP_SEGMENTS:
                    candidates.append((clean_seg, 90.0, idx))

        if candidates:
            # Pick highest confidence / earliest valid party token
            candidates.sort(key=lambda x: (-x[1], x[2]))
            return (candidates[0][0], candidates[0][1])

        return (None, 0.0)

    @classmethod
    def extract_with_rule(
        cls,
        narration: str,
        rule_pattern: str,
        match_type: str = "regex",
        party_position: Optional[int] = None
    ) -> Optional[str]:
        """
        Executes a specific user-defined or discovered pattern rule on the narration.
        """
        if not narration:
            return None

        if match_type != "token_position" and not rule_pattern:
            return None

        if rule_pattern and len(rule_pattern) > 250:
            return None

        text = NarrationNormalizationService.normalize_text(narration)

        if match_type == "regex":
            try:
                m = re.search(rule_pattern, text, re.I)
                if m:
                    group_dict = m.groupdict()
                    if "party" in group_dict and group_dict["party"]:
                        return cls.clean_extracted_party(group_dict["party"])
                    if m.groups():
                        return cls.clean_extracted_party(m.group(1))
                    return cls.clean_extracted_party(m.group(0))
            except re.error:
                return None
        elif match_type == "token_position" and party_position is not None:
            tokens = NarrationNormalizationService.tokenize(text)
            if 0 <= party_position < len(tokens):
                return cls.clean_extracted_party(tokens[party_position]["clean"])

        return None


# =====================================================================
# 4. PATTERN DISCOVERY & GROUPING ENGINE
# =====================================================================
class PatternDiscoveryEngine:
    """
    Groups recurring statement narrations by structural syntax.
    Identifies fixed vs variable tokens, generates structural fingerprints,
    and proposes reusable pattern templates with party candidate positions.
    """

    def __init__(self, db):
        self.db = db

    def generate_fingerprint(self, narration: str) -> Tuple[str, str, Dict[str, Any]]:
        """
        Generates a normalized structural fingerprint replacing dynamic elements with tokens.
        Returns (signature_key, human_template, extracted_components).
        """
        norm = NarrationNormalizationService.normalize_text(narration)
        channel, _ = TransactionClassifierService.classify_channel(norm)
        tokens = re.split(r'([/ \-_:@]+)', norm)

        sig_parts = []
        party_cand, _ = RegexPositionalExtractor.extract_party(norm)
        ref_cand = NarrationNormalizationService.extract_reference_number(norm)

        for t in tokens:
            if t.isdigit():
                sig_parts.append("<NUM>")
            elif re.match(r'^[A-Z]{4}H\d+', t, re.I) or re.match(r'^[A-Z]{4}R\d+', t, re.I):
                sig_parts.append("<UTR>")
            elif re.match(r'^[A-Za-z0-9._-]+@[a-zA-Z0-9]+$', t):
                sig_parts.append("<VPA>")
            elif t.upper() in ["UPI", "NEFT", "RTGS", "IMPS", "CLG", "CTS", "CHQ", "INFT", "ATM", "TRANSFER"]:
                sig_parts.append(t.upper())
            else:
                sig_parts.append(t)

        fingerprint = "".join(sig_parts[:12])
        template = f"{channel} / {{Reference}} / {party_cand or '{Party}'}"

        return (f"{channel}|{fingerprint}", template, {
            "channel": channel,
            "party": party_cand,
            "reference": ref_cand,
            "fingerprint": fingerprint
        })

    @staticmethod
    def derive_bank_code(bank_ledger: str) -> str:
        if not bank_ledger:
            return "BANK"
        bl = bank_ledger.upper()
        for code in ["ICICI", "HDFC", "KOTAK", "SBI", "AXIS", "PNB", "BOB", "BOI", "CANARA", "UNION", "YES", "INDUSIND", "IDFC", "FEDERAL"]:
            if code in bl:
                return code
        words = re.findall(r'[A-Za-z0-9]+', bl)
        if words:
            for w in words:
                if w.upper() not in ["BANK", "ACCOUNT", "AC", "DR", "CR", "LIMITED", "LTD", "PVT", "CURRENT"]:
                    return w[:6].upper()
            return words[0][:6].upper()
        return "BANK"

    @classmethod
    def generate_regex_for_structure(cls, parts: List[str], party_pos: int, sep: str = '/') -> Tuple[str, Dict[str, str]]:
        """
        Generates validated regular expression with unique named capture groups
        corresponding to discovered narration segments using the detected separator.
        """
        rgx_tokens = []
        used_names = set()
        group_labels = {}

        def get_group_name(base: str, label: str) -> str:
            if base not in used_names:
                used_names.add(base)
                group_labels[base] = label
                return base
            idx = 2
            while f"{base}_{idx}" in used_names:
                idx += 1
            name = f"{base}_{idx}"
            used_names.add(name)
            group_labels[name] = f"{label} ({idx})"
            return name

        sep_neg = r'\s+' if sep == ' ' else f'[^{re.escape(sep)}]+'

        for idx, p in enumerate(parts):
            if idx == party_pos or p == '{Party}':
                gname = get_group_name("party", "Extracted Party Name")
                rgx_tokens.append(f'(?P<{gname}>{sep_neg})')
            elif p in ['{Ref}', '{TxnId}']:
                gname = get_group_name("txn_id", "Transaction ID / Reference")
                rgx_tokens.append(f'(?P<{gname}>[A-Za-z0-9_-]+)')
            elif p == '{UTR}':
                gname = get_group_name("utr", "Unique Transaction Reference")
                rgx_tokens.append(f'(?P<{gname}>[A-Z]{{4}}[A-Z0-9]+)')
            elif p == '{VPA}':
                gname = get_group_name("vpa", "Virtual Payment Address")
                rgx_tokens.append(f'(?P<{gname}>{sep_neg})')
            elif p == '{IFSC}':
                gname = get_group_name("ifsc", "Bank IFSC Code")
                rgx_tokens.append(f'(?P<{gname}>[A-Z]{{4}}[A-Z0-9]+)')
            elif p == '{Remittance}':
                gname = get_group_name("remittance", "Remittance Detail")
                rgx_tokens.append(f'(?P<{gname}>{sep_neg})')
            elif p == '{BankCode}':
                gname = get_group_name("bank", "Clearing Bank Identifier")
                rgx_tokens.append(f'(?P<{gname}>[A-Z]{{3,4}})')
            else:
                tok = re.escape(p)
                rgx_tokens.append(tok)

        delim = r'\s+' if sep == ' ' else re.escape(sep)
        pattern_str = r'^' + delim.join(rgx_tokens) + r'$' if len(parts) > 1 else r'^' + rgx_tokens[0] + r'$'
        return pattern_str, group_labels

    @classmethod
    def match_token_against_masters(
        cls,
        token: str,
        company_masters: Optional[List[Dict[str, Any]]] = None,
        known_aliases: Optional[Dict[str, str]] = None,
        bank_ledger: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Dynamically compares a narration token against Company Master Ledgers and customer party aliases.
        Returns match dict if found with high confidence (>=85%), else None.
        """
        if not token or not company_masters:
            return None
        t_clean = token.strip()
        t_lower = t_clean.lower()
        if len(t_clean) < 2 or not any(c.isalpha() for c in t_clean):
            return None

        # Filter out bank transaction channel tokens, general stop words,
        # AND all Indian bank abbreviations/IFSC codes that appear in CLG narrations as beneficiary bank codes
        stop_words = {
            # Transaction channel/type markers
            "BANK", "NEFT", "RTGS", "UPI", "IMPS", "CLG", "CTS", "CHQ", "CHEQUE",
            "TRANSFER", "PAYMENT", "RECEIVED", "TRF", "INFT", "INF", "IFT", "PAID",
            "LTD", "PVT", "PVTLTD", "LIMITED", "PRIVATE", "CR", "DR", "TXN", "REF",
            "RRN", "MOB", "NA", "NIL", "NULL", "BY", "TO", "FOR", "SLB", "SLBL", "SLBN",
            "INR", "SUCCESS", "SETTLEMENT", "CHARGES", "GST", "TAX", "INT", "INTEREST", "FEES",
            # Indian bank IFSC prefixes / common bank abbreviations
            # These appear in CLG/NEFT/RTGS narrations as beneficiary bank codes, NOT party ledger names
            "HDFC", "ICIC", "ICICI", "SBIN", "SBI", "AXIS", "KKBK", "KOTAK",
            "PUNB", "PNB", "BARB", "BOB", "CNRB", "CANARA", "UBIN", "UNION",
            "IDFB", "IDFC", "IDFCFIRST", "YESB", "YESBANK",
            "IDB", "IDBI", "UCO", "CBI", "IOB", "OBC", "UTIB", "FDRL",
            "FEDERAL", "DENA", "VIJAYA", "TMBL", "KARB", "KVB", "KVBL",
            "RBL", "RBLB", "CITI", "CITIBANK", "SCB", "HSBC", "DBS",
            "BANDHAN", "BDBL", "FINO", "PAYTM", "AIRTEL", "JSFB", "JANA",
            "NKGSB", "SARASWAT", "APGV", "ANDB", "ALLA", "ALLAHABAD",
            "SIBL", "CSB", "LAKSHMI", "LVB", "DCBL", "DCB", "UJVN",
            "IBKL", "INDUSIND", "INDB", "PMC", "MAHB", "MAHABANK"
        }
        if t_clean.upper() in stop_words:
            return None

        # Filter out bank ledger itself so we never match the source bank account as party
        if bank_ledger:
            bl_clean = re.sub(r'[^a-z0-9]', '', bank_ledger.lower())
            t_alnum_chk = re.sub(r'[^a-z0-9]', '', t_lower)
            if t_alnum_chk and (t_alnum_chk in bl_clean or bl_clean in t_alnum_chk):
                if len(t_alnum_chk) >= 4 and len(bl_clean) >= 4:
                    return None

        # 0. Check previously approved customer party aliases
        if known_aliases and t_lower in known_aliases:
            return {
                "ledger": known_aliases[t_lower],
                "score": 100.0,
                "matchType": "alias_cache"
            }

        t_alnum = re.sub(r'[^a-z0-9]', '', t_lower)
        if len(t_alnum) < 3:
            return None

        # 1. Exact match against master ledgers
        for m in company_masters:
            m_name = (m.get("ledgerName") or m.get("name") or "").strip()
            if not m_name:
                continue
            if m_name.lower() == t_lower:
                return {"ledger": m_name, "score": 100.0, "matchType": "exact"}

            # Check aliases
            aliases = m.get("alias") or m.get("alternateName") or ""
            if isinstance(aliases, str) and aliases:
                for a in [x.strip().lower() for x in aliases.split(",") if x.strip()]:
                    if a == t_lower:
                        return {"ledger": m_name, "score": 98.0, "matchType": "alias"}
            elif isinstance(aliases, list):
                for a in aliases:
                    if str(a).strip().lower() == t_lower:
                        return {"ledger": m_name, "score": 98.0, "matchType": "alias"}

        # 2. Alphanumeric match (ignoring spaces and punctuation)
        if len(t_alnum) >= 4:
            for m in company_masters:
                m_name = (m.get("ledgerName") or m.get("name") or "").strip()
                if not m_name:
                    continue
                m_alnum = re.sub(r'[^a-z0-9]', '', m_name.lower())
                if m_alnum == t_alnum:
                    return {"ledger": m_name, "score": 96.0, "matchType": "alnum"}

                # Prefix / Substring match (e.g. truncated party name like "AMRAPUR MEDICAL AGENCIE" vs "AMRAPUR MEDICAL AGENCIES GUNA")
                if len(t_alnum) >= 6 and len(m_alnum) >= 6:
                    if m_alnum.startswith(t_alnum) or t_alnum.startswith(m_alnum):
                        return {"ledger": m_name, "score": 92.0, "matchType": "prefix"}
                    if t_alnum in m_alnum or m_alnum in t_alnum:
                        return {"ledger": m_name, "score": 88.0, "matchType": "substring"}

        return None

    @classmethod
    def analyze_narration_tokens(
        cls,
        norm: str,
        company_masters: Optional[List[Dict[str, Any]]] = None,
        known_aliases: Optional[Dict[str, str]] = None,
        bank_ledger: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dynamically detects separator, parses zero-based tokens,
        and assigns roles (CHANNEL, TXN_ID, PARTY, VPA, IFSC, BANK_CODE, REMITTANCE)
        prioritizing direct matches against Company Master Party Ledgers first.
        """
        cand_seps = ['/', '-', ':', '|', ';']
        sep_counts = {s: norm.count(s) for s in cand_seps}
        best_sep = max(cand_seps, key=lambda s: sep_counts[s])

        if sep_counts[best_sep] >= 2:
            sep = best_sep
        elif sep_counts['/'] >= 1:
            sep = '/'
        elif sep_counts['-'] >= 1:
            sep = '-'
        elif ' ' in norm:
            sep = ' '
        else:
            sep = '/'

        if sep == ' ':
            raw_tokens = [t.strip() for t in re.split(r'\s+', norm) if t.strip()]
        else:
            raw_tokens = [t.strip() for t in norm.split(sep) if t.strip()]

        if not raw_tokens:
            return {
                "sep": sep, "raw_tokens": [], "skeleton_parts": [], "channel": "OTHER",
                "txn_id_pos": -1, "txn_id_regex": None, "party_pos": -1, "party_val": None,
                "master_match": None, "other_fields": [], "tokens_meta": []
            }

        channel, _ = TransactionClassifierService.classify_channel(norm)
        roles = [None] * len(raw_tokens)

        # 1. Classify CHANNEL tokens
        for idx, t in enumerate(raw_tokens):
            tu = t.upper()
            if tu in ["UPI", "NEFT", "RTGS", "IMPS", "MMT", "CLG", "CTS", "CHQ", "CHEQUE", "INFT", "INF", "TRF", "TRANSFER", "POS", "ATM", "ACH", "NACH", "ECS"]:
                roles[idx] = "CHANNEL"

        # 2. Classify VPA tokens (@ handle)
        for idx, t in enumerate(raw_tokens):
            if roles[idx] is None and '@' in t:
                roles[idx] = "VPA"

        # 3. Classify IFSC tokens
        for idx, t in enumerate(raw_tokens):
            if roles[idx] is None and (re.match(r'^[A-Z]{4}0[A-Z0-9]{6}$', t.upper()) or re.match(r'^[A-Z]{4}\s+[A-Z0-9]{6}$', t.upper())):
                roles[idx] = "IFSC"

        # 4. Classify Bank Clearing Codes (e.g., HDF, ICIC, SBIN, UTIB)
        for idx, t in enumerate(raw_tokens):
            if roles[idx] is None and re.match(r'^[A-Z]{3,4}$', t.upper()) and t.upper() in ["HDF", "ICIC", "SBIN", "UTIB", "KKBK", "PUNB", "BARB", "YESB", "IDFB", "AXIS", "SBI", "PNB"]:
                roles[idx] = "BANK_CODE"

        # 5. Classify Transaction ID / UTR / Reference
        txn_id_pos = -1
        txn_id_regex = None
        # 5a. 12-digit numeric RRN (UPI standard)
        for idx, t in enumerate(raw_tokens):
            if roles[idx] is None and re.match(r'^\d{12}$', t):
                roles[idx] = "TXN_ID"
                txn_id_pos = idx
                txn_id_regex = r"\d{12}"
                break
        # 5b. Alphanumeric UTR (NEFT/RTGS standard)
        if txn_id_pos == -1:
            for idx, t in enumerate(raw_tokens):
                if roles[idx] is None and re.match(r'^[A-Z]{4}[0-9A-Z]{7,18}$', t.upper()):
                    roles[idx] = "TXN_ID"
                    txn_id_pos = idx
                    txn_id_regex = r"[A-Z]{4}[0-9A-Z]+"
                    break
        # 5c. General numeric reference (6-18 digits)
        if txn_id_pos == -1:
            for idx, t in enumerate(raw_tokens):
                if roles[idx] is None and re.match(r'^\d{6,18}$', t):
                    roles[idx] = "TXN_ID"
                    txn_id_pos = idx
                    txn_id_regex = r"\d+"
                    break
        # 5d. Alphanumeric reference code / UTR (e.g. 0807i29998629781, POD119344552, N223260456922004, CIB207697194)
        if txn_id_pos == -1:
            for idx, t in enumerate(raw_tokens):
                t_strip = t.strip()
                digit_cnt = sum(c.isdigit() for c in t_strip)
                letter_cnt = sum(c.isalpha() for c in t_strip)
                if roles[idx] is None and ' ' not in t_strip and len(t_strip) >= 6:
                    if (digit_cnt >= 4) or (digit_cnt >= 2 and letter_cnt >= 1 and len(t_strip) >= 8):
                        if re.match(r'^[A-Za-z0-9_-]+$', t_strip):
                            roles[idx] = "TXN_ID"
                            txn_id_pos = idx
                            txn_id_regex = r"[A-Za-z0-9_-]+"
                            break

        # 6. Classify Party Candidate - MASTER DATA MATCHING FIRST (Reverse-Index Discovery)
        stop_words = {
            "BANK", "NEFT", "RTGS", "UPI", "IMPS", "CLG", "CTS", "CHQ", "CHEQUE",
            "TRANSFER", "PAYMENT", "RECEIVED", "TRF", "INFT", "INF", "IFT", "PAID",
            "LTD", "PVT", "PVTLTD", "LIMITED", "PRIVATE", "CR", "DR", "TXN", "REF",
            "RRN", "MOB", "NA", "NIL", "NULL", "BY", "TO", "FOR", "SLB", "SLBL", "SLBN",
            "INR", "SUCCESS", "SETTLEMENT", "CHARGES", "GST", "TAX", "INT", "INTEREST", "FEES"
        }

        master_match = None
        if company_masters:
            for idx, t in enumerate(raw_tokens):
                if roles[idx] in ["CHANNEL", "TXN_ID", "IFSC", "BANK_CODE"]:
                    continue
                match_res = cls.match_token_against_masters(
                    t, company_masters=company_masters, known_aliases=known_aliases, bank_ledger=bank_ledger
                )
                if match_res:
                    master_match = {
                        "pos": idx,
                        "token": t.strip(),
                        "ledger": match_res["ledger"],
                        "score": match_res["score"],
                        "matchType": match_res["matchType"]
                    }
                    roles[idx] = "PARTY"
                    break

        party_pos = -1 if master_match is None else master_match["pos"]
        party_val = None if master_match is None else master_match["token"]

        if master_match is None:
            # Fallback heuristic scoring if no direct master match found in this narration
            candidate_parties = []
            for idx, t in enumerate(raw_tokens):
                if roles[idx] is None:
                    t_strip = t.strip()
                    digit_cnt = sum(c.isdigit() for c in t_strip)
                    letter_cnt = sum(c.isalpha() for c in t_strip)
                    has_letters = letter_cnt > 0
                    is_stop = t_strip.upper() in stop_words
                    is_ref = (' ' not in t_strip) and (digit_cnt >= 4 or (digit_cnt > 0 and digit_cnt >= letter_cnt and len(t_strip) >= 6))
                    if has_letters and not is_stop and not is_ref and len(t_strip) >= 2:
                        score = (50 if ' ' in t_strip else 0) + letter_cnt - (digit_cnt * 5)
                        candidate_parties.append((idx, t_strip, score))

            if candidate_parties:
                if channel == "UPI" and txn_id_pos >= 0:
                    after_txn = [c for c in candidate_parties if c[0] > txn_id_pos]
                    if after_txn:
                        after_txn.sort(key=lambda x: (x[2], -x[0]), reverse=True)
                        party_pos, party_val, _ = after_txn[0]
                    else:
                        candidate_parties.sort(key=lambda x: (x[2], -x[0]), reverse=True)
                        party_pos, party_val, _ = candidate_parties[0]
                    roles[party_pos] = "PARTY"
                else:
                    candidate_parties.sort(key=lambda x: (x[2], -x[0]), reverse=True)
                    party_pos, party_val, _ = candidate_parties[0]
                    roles[party_pos] = "PARTY"

        # 7. Unclassified tokens -> ACC_NO, DATE, NUMBER, or REMITTANCE
        for idx, t in enumerate(raw_tokens):
            if roles[idx] is None:
                if re.search(r'\d{1,2}[./-]\d{1,2}[./-]\d{2,4}', t):
                    roles[idx] = "DATE"
                elif re.match(r'^\d{9,}$', t) or (re.match(r'^\d{4,}[A-Za-z0-9]+$', t) and sum(c.isdigit() for c in t) >= 8):
                    roles[idx] = "ACC_NO"
                elif re.match(r'^\d+$', t):
                    roles[idx] = "NUMBER"
                elif any(c.isalpha() for c in t):
                    roles[idx] = "REMITTANCE"
                else:
                    roles[idx] = "REMITTANCE"

        # 8. Assemble skeleton & tokens metadata
        skeleton_parts = []
        tokens_meta = []
        other_fields = []

        for idx, t in enumerate(raw_tokens):
            r = roles[idx]
            if r == "CHANNEL":
                skel_item = t.upper()
                meta_type = "CHANNEL"
                meta_role = "Transaction Channel"
            elif r == "TXN_ID":
                skel_item = "{UTR}" if channel in ["NEFT", "RTGS"] else "{TxnId}"
                meta_type = "TXN_ID"
                meta_role = "Transaction ID / Reference"
            elif r == "PARTY":
                skel_item = "{Party}"
                meta_type = "PARTY"
                meta_role = "Party / Ledger Candidate"
            elif r == "VPA":
                skel_item = "{VPA}"
                meta_type = "VPA"
                meta_role = "Virtual Payment Address"
                other_fields.append({"token": idx, "label": "VPA", "type": "VPA"})
            elif r == "IFSC":
                skel_item = "{IFSC}"
                meta_type = "IFSC"
                meta_role = "Bank IFSC Code"
                other_fields.append({"token": idx, "label": "IFSC", "type": "IFSC"})
            elif r == "BANK_CODE":
                skel_item = "{BankCode}"
                meta_type = "BANK_CODE"
                meta_role = "Bank Identifier"
                other_fields.append({"token": idx, "label": "Bank Code", "type": "BANK_CODE"})
            elif r == "ACC_NO":
                skel_item = "{AccNo}"
                meta_type = "ACC_NO"
                meta_role = "Account / Clearing Number"
                other_fields.append({"token": idx, "label": "Account No", "type": "ACC_NO"})
            elif r == "DATE":
                skel_item = "{Date}"
                meta_type = "DATE"
                meta_role = "Transaction Date"
                other_fields.append({"token": idx, "label": "Date", "type": "DATE"})
            elif r == "NUMBER":
                skel_item = "{Number}"
                meta_type = "NUMBER"
                meta_role = "Numeric Value"
                other_fields.append({"token": idx, "label": "Number", "type": "NUMBER"})
            elif r == "REMITTANCE":
                skel_item = "{Remittance}"
                meta_type = "REMITTANCE"
                meta_role = "Remittance / Remark"
                other_fields.append({"token": idx, "label": "Remittance", "type": "REMITTANCE"})
            else:
                skel_item = "{Remittance}"
                meta_type = "REMITTANCE"
                meta_role = "Remittance / Remark"

            skeleton_parts.append(skel_item)
            tokens_meta.append({
                "index": idx,
                "name": skel_item,
                "type": meta_type,
                "role": meta_role,
                "isParty": (idx == party_pos),
                "isTxnId": (idx == txn_id_pos),
                "sampleValue": t
            })

        return {
            "sep": sep,
            "raw_tokens": raw_tokens,
            "skeleton_parts": skeleton_parts,
            "channel": channel,
            "txn_id_pos": txn_id_pos,
            "txn_id_regex": txn_id_regex,
            "party_pos": party_pos,
            "party_val": party_val,
            "other_fields": other_fields,
            "tokens_meta": tokens_meta
        }

    def discover_patterns_from_transactions(
        self,
        batch_items: List[Dict[str, Any]],
        bank_ledger: str,
        company_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Clusters transactions hierarchically:
        1. Classifies into common taxonomy transaction types (UPI, NEFT, RTGS, IMPS, CLG, CHEQUE, etc.)
           with exact counting of transactions per type.
        2. Within each transaction type, identifies distinct narration structures (Pattern A, Pattern B, Pattern C...)
           with exact matching transaction counts.
        3. For Pattern A, applies LLM AI-powered pattern mapping to extract separator, tokens, and party position.
        4. Re-extracts party values dynamically across all matching transactions.
        5. Zero hardcoding and zero fake demo data.
        """
        if not batch_items:
            return []

        resolution_svc = PartyLedgerResolutionService(self.db)
        company_masters = resolution_svc.get_company_master_ledgers(company_id)
        voucher_svc = VoucherClassifierService(self.db)
        bank_code = self.derive_bank_code(bank_ledger)

        # Load known customer party aliases
        known_aliases = {}
        try:
            alias_q = {"companyId": company_id} if company_id else {}
            for a in self.db["bank_party_aliases"].find(alias_q):
                p_name = (a.get("partyName") or "").strip().lower()
                r_ledger = (a.get("resolvedLedger") or "").strip()
                if p_name and r_ledger:
                    known_aliases[p_name] = r_ledger
        except Exception:
            pass

        # 1. Group transactions by transaction type using master reverse matching
        txns_by_type = defaultdict(list)
        for it in batch_items:
            narr = it.get("narration") or ""
            if not narr:
                continue
            norm = NarrationNormalizationService.normalize_text(narr)
            analysis = self.analyze_narration_tokens(
                norm,
                company_masters=company_masters,
                known_aliases=known_aliases,
                bank_ledger=bank_ledger
            )
            txn_type = analysis.get("channel") or "OTHER_TRANSFER"
            txns_by_type[txn_type].append({
                "item": it,
                "narration": narr,
                "norm": norm,
                "analysis": analysis
            })

        discovered = []

        # 2. Iterate each transaction type sorted by transaction volume descending
        for txn_type, type_matched in sorted(txns_by_type.items(), key=lambda x: len(x[1]), reverse=True):
            type_total_count = len(type_matched)

            # Reverse Master-Index Discovery: Check which token index matched master ledgers most frequently
            master_pos_hits = Counter()
            for m in type_matched:
                mm = m["analysis"].get("master_match")
                if mm and mm.get("pos") is not None and mm["pos"] >= 0:
                    master_pos_hits[mm["pos"]] += 1

            common_master_pos = None
            master_hit_count = 0
            if master_pos_hits:
                common_master_pos, master_hit_count = master_pos_hits.most_common(1)[0]

            # If master data proved a common party position for this channel, align transactions of this channel
            if common_master_pos is not None:
                for m in type_matched:
                    if not m["analysis"].get("master_match"):
                        raw_toks = m["analysis"].get("raw_tokens") or []
                        if 0 <= common_master_pos < len(raw_toks):
                            cand_tok = raw_toks[common_master_pos].strip()
                            if len(cand_tok) >= 2 and cand_tok.upper() not in NarrationNormalizationService.STOP_WORDS:
                                m["analysis"]["party_pos"] = common_master_pos
                                m["analysis"]["party_val"] = cand_tok

            # Sub-cluster into distinct patterns strictly by party position (e.g. Party at Pos [2] vs Pos [3])
            type_patterns = defaultdict(list)
            for m in type_matched:
                analysis = m["analysis"]
                party_pos_m = analysis.get("party_pos", -1)
                pattern_key = party_pos_m
                type_patterns[pattern_key].append(m)

            # Sort patterns by frequency descending
            sorted_patterns = sorted(type_patterns.items(), key=lambda x: len(x[1]), reverse=True)

            for p_idx, (party_pos_key, matched) in enumerate(sorted_patterns):
                pat_letter = chr(65 + p_idx) if p_idx < 26 else f"P{p_idx + 1}"
                is_pattern_a = (p_idx == 0)

                first_analysis = matched[0]["analysis"]
                sep = first_analysis.get("sep", "/")
                skel_parts = tuple(first_analysis["skeleton_parts"])
                skel = f" {sep} ".join(skel_parts)
                txn_id_pos = first_analysis.get("txn_id_pos", -1)
                party_pos = party_pos_key if party_pos_key >= 0 else first_analysis.get("party_pos", -1)
                vpa_pos = -1
                tokens_meta = first_analysis.get("tokens_meta") or []
                ai_analyzed = False
                ai_reasoning = None

                # Check if an approved rule exists in bank_mapping_rules for this bank & pattern/type
                saved_rule = None
                try:
                    clean_bl = (bank_ledger or "").strip()
                    bl_reg = re.compile(f"^{re.escape(clean_bl)}$", re.I)
                    rule_q = {
                        "status": "active",
                        "$or": [{"bankLedger": bl_reg}, {"bank_ledger": bl_reg}]
                    }
                    cursor = self.db["bank_mapping_rules"].find(rule_q).sort("createdAt", -1)
                    for r in cursor:
                        r_type = (r.get("transactionType") or r.get("txnType") or "").upper()
                        r_pat = r.get("structuralPattern") or r.get("pattern") or ""
                        if r_pat == skel or (r_type and r_type == txn_type.upper()):
                            saved_rule = r
                            break
                except Exception as ex:
                    logger.warning(f"Error checking saved bank_mapping_rules: {ex}")

                if saved_rule:
                    if saved_rule.get("partyPosition") is not None and int(saved_rule["partyPosition"]) >= 0:
                        party_pos = int(saved_rule["partyPosition"])
                    if saved_rule.get("txnIdPosition") is not None and int(saved_rule["txnIdPosition"]) >= 0:
                        txn_id_pos = int(saved_rule["txnIdPosition"])
                    ai_analyzed = True
                    ai_reasoning = f"Reused approved bank rule: '{saved_rule.get('name') or 'Saved Rule'}' (Party Index [{party_pos}])."
                elif common_master_pos is not None and party_pos == common_master_pos:
                    ai_analyzed = True
                    ai_reasoning = f"Deterministic pattern discovered via master ledger reverse matching: Party verified at Token Index [{party_pos}] across {master_hit_count} transaction(s). (Zero LLM needed)"
                elif is_pattern_a and party_pos < 0:
                    # ONLY fallback to LLM if no master ledger could be matched to any token across the cluster!
                    sample_narrs = [m["narration"] for m in matched[:5]]
                    llm_res = analyze_pattern_a_with_llm(sample_narrs, bank_ledger=bank_ledger, channel=txn_type)
                    if llm_res:
                        ai_analyzed = True
                        ai_reasoning = llm_res.get("reasoning") or "LLM AI verified narration token structure and party candidate index."
                        sep = llm_res.get("separator") or sep
                        if "txnIdPosition" in llm_res and llm_res["txnIdPosition"] is not None:
                            txn_id_pos = int(llm_res["txnIdPosition"])
                        if "partyPosition" in llm_res and llm_res["partyPosition"] is not None:
                            party_pos = int(llm_res["partyPosition"])
                        if "vpaPosition" in llm_res and llm_res["vpaPosition"] is not None:
                            vpa_pos = int(llm_res["vpaPosition"])
                        if llm_res.get("skeleton"):
                            skel = llm_res["skeleton"]
                        if llm_res.get("tokens"):
                            tokens_meta = llm_res["tokens"]
                    else:
                        ai_analyzed = False
                        ai_reasoning = "Deterministic structural token analysis."

                regex_rule, group_labels = self.generate_regex_for_structure(list(skel_parts), party_pos, sep=sep)

                # Test validation rate against matched items
                valid_count = 0
                for m in matched:
                    try:
                        if re.search(regex_rule, m["norm"], re.I):
                            valid_count += 1
                    except Exception:
                        pass
                pct = round((valid_count / len(matched)) * 100) if matched else 100
                val_status = f"Validated ({valid_count}/{len(matched)})" if pct >= 90 else f"Partial ({pct}%)"

                # Re-extract distinct parties across all matching transactions in this pattern
                distinct_parties = {}
                for m in matched:
                    norm_txt = m["norm"]
                    if sep == ' ':
                        tokens_here = [t.strip() for t in re.split(r'\s+', norm_txt) if t.strip()]
                    else:
                        tokens_here = [t.strip() for t in norm_txt.split(sep) if t.strip()]

                    party_val = None
                    if party_pos >= 0 and party_pos < len(tokens_here):
                        cand = tokens_here[party_pos].strip()
                        if len(cand) >= 2 and cand.upper() not in NarrationNormalizationService.STOP_WORDS:
                            party_val = cand

                    if not party_val:
                        party_val = m["analysis"].get("party_val") or "Unspecified Party"

                    # Check if master_match exists on this item
                    m_master = m["analysis"].get("master_match")
                    if m_master and m_master.get("ledger"):
                        resolved_ledger = m_master["ledger"]
                        conf_val = float(m_master.get("score", 98.0))
                        is_amb = False
                    else:
                        res = resolution_svc.resolve_party_ledger(
                            party_val,
                            m["narration"],
                            company_id=company_id,
                            company_masters=company_masters
                        )
                        resolved_ledger = res.get("resolvedLedger") or "Unmapped"
                        conf_val = float(res.get("confidence", 0.0))
                        is_amb = res.get("isAmbiguous", False)

                    m["extracted_party"] = party_val
                    m["mapped_ledger"] = resolved_ledger
                    m["party_confidence"] = conf_val
                    norm_txt = m["norm"]
                    if sep == ' ':
                        tokens_here = [t.strip() for t in re.split(r'\s+', norm_txt) if t.strip()]
                    else:
                        tokens_here = [t.strip() for t in norm_txt.split(sep) if t.strip()]

                    party_val = None
                    if party_pos >= 0 and party_pos < len(tokens_here):
                        cand = tokens_here[party_pos].strip()
                        if len(cand) >= 2 and cand.upper() not in NarrationNormalizationService.STOP_WORDS:
                            party_val = cand

                    if not party_val:
                        party_val = m["analysis"].get("party_val") or "Unspecified Party"

                    it_obj = m["item"]
                    tx_info = {
                        "id": str(it_obj.get("item_id") or it_obj.get("_id") or ""),
                        "date": it_obj.get("voucherDate") or it_obj.get("date") or "",
                        "amount": it_obj.get("amount") or it_obj.get("debit", 0) or it_obj.get("credit", 0),
                        "reference": it_obj.get("referenceNumber") or it_obj.get("instNumber") or "—",
                        "narration": m["narration"]
                    }

                    if party_val not in distinct_parties:
                        res = resolution_svc.resolve_party_ledger(
                            party_val,
                            m["narration"],
                            company_id=company_id,
                            company_masters=company_masters
                        )
                        distinct_parties[party_val] = {
                            "party": party_val,
                            "count": 1,
                            "mappedLedger": res.get("resolvedLedger") or "Unmapped",
                            "confidence": res.get("confidence", 0),
                            "isAmbiguous": res.get("isAmbiguous", False),
                            "sampleTransactions": [tx_info]
                        }
                    else:
                        distinct_parties[party_val]["count"] += 1
                        if len(distinct_parties[party_val]["sampleTransactions"]) < 10:
                            distinct_parties[party_val]["sampleTransactions"].append(tx_info)

                parties_list = sorted(distinct_parties.values(), key=lambda p: p["count"], reverse=True)
                if len(parties_list) == 1:
                    disp_party = parties_list[0]["party"]
                    disp_ledger = parties_list[0]["mappedLedger"]
                    avg_conf = parties_list[0]["confidence"]
                elif len(parties_list) > 1:
                    disp_party = f"{len(parties_list)} Parties ({', '.join(p['party'] for p in parties_list[:2])}...)"
                    disp_ledger = f"{len(parties_list)} Distinct Ledgers"
                    avg_conf = round(sum(p["confidence"] for p in parties_list) / len(parties_list), 1)
                else:
                    disp_party = "—"
                    disp_ledger = "Unmapped"
                    avg_conf = 70.0

                first_it = matched[0]["item"]
                is_credit = first_it.get("credit", 0) > 0
                voucher_res = voucher_svc.classify_voucher(
                    channel=txn_type,
                    is_credit=is_credit,
                    party_name=parties_list[0]["party"] if parties_list else None,
                    narration=matched[0]["narration"],
                    company_id=company_id
                )

                txn_id_regex = first_analysis.get("txn_id_regex") or r"[A-Za-z0-9_-]+"
                txn_id_rule_str = f"Token [{txn_id_pos}]" if txn_id_pos >= 0 else "Not identified"
                party_rule_str = f"Token [{party_pos}]" if party_pos >= 0 else "Not identified"
                other_fields_list = first_analysis.get("other_fields") or []
                other_fields_str = ", ".join(f"Token [{f['token']}]: {f['label']}" for f in other_fields_list) if other_fields_list else "—"

                pattern_id = f"PAT-{bank_code}-{txn_type}-{pat_letter}"

                pattern_doc = {
                    "id": f"pat_{bank_code.lower()}_{txn_type.lower()}_{pat_letter.lower()}",
                    "_id": f"pat_{bank_code.lower()}_{txn_type.lower()}_{pat_letter.lower()}",
                    "patternId": pattern_id,
                    "patternName": f"Pattern {pat_letter}",
                    "transactionType": txn_type,
                    "txnType": txn_type,
                    "channel": txn_type,
                    "typeTotalCount": type_total_count,
                    "pattern": skel,
                    "candidatePattern": skel,
                    "template": skel,
                    "templateFormat": skel,
                    "separator": sep,
                    "bankLedger": bank_ledger,
                    "companyId": company_id,
                    "matchingCount": len(matched),
                    "frequency": len(matched),
                    "txnIdPosition": txn_id_pos,
                    "txnIdRule": txn_id_rule_str,
                    "partyPosition": party_pos,
                    "partyRule": party_rule_str,
                    "partyField": party_rule_str,
                    "vpaPosition": vpa_pos,
                    "otherFields": other_fields_list,
                    "otherFieldsDisplay": other_fields_str,
                    "distinctPartiesCount": len(distinct_parties),
                    "distinctParties": parties_list,
                    "extractedParty": disp_party,
                    "suggestedParty": disp_party,
                    "suggestedLedger": disp_ledger,
                    "mappedLedger": disp_ledger,
                    "confidence": avg_conf,
                    "validationStatus": val_status,
                    "validationPercent": pct,
                    "regexRule": regex_rule,
                    "regexCaptureGroups": group_labels,
                    "tokens": tokens_meta,
                    "isPatternA": is_pattern_a,
                    "isAiAnalyzed": ai_analyzed,
                    "aiReasoning": ai_reasoning,
                    "source": "AI Discovered",
                    "status": "active",
                    "reviewStatus": "needs_review",
                    "sampleNarrations": [m["narration"] for m in matched[:5] if m.get("narration")],
                    "normalizedSampleNarrations": [m["norm"] for m in matched[:3] if m.get("norm")],
                    "voucherType": voucher_res.get("voucherType", "Receipt" if is_credit else "Payment"),
                    "voucherReasoning": voucher_res.get("reasoning", ""),
                    "transactions": [
                        {
                            "id": str(m["item"].get("item_id") or m["item"].get("_id") or ""),
                            "date": m["item"].get("voucherDate") or m["item"].get("date") or "",
                            "amount": m["item"].get("amount") or m["item"].get("debit", 0) or m["item"].get("credit", 0),
                            "reference": m["item"].get("referenceNumber") or m["item"].get("instNumber") or "—",
                            "narration": m["narration"]
                        }
                        for m in matched[:50]
                    ],
                    "created_at": datetime.utcnow()
                }
                discovered.append(pattern_doc)

        return discovered

    def cluster_and_discover(
        self,
        batch_items: List[Dict[str, Any]],
        bank_ledger: str,
        company_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Legacy compatible wrapper that clusters transactions and writes suggestions to DB.
        """
        discovered = self.discover_patterns_from_transactions(batch_items, bank_ledger, company_id)
        saved = []
        for s in discovered:
            try:
                s_to_save = dict(s)
                s_to_save.pop("_id", None)
                res = self.db["bank_pattern_suggestions"].insert_one(s_to_save)
                s["_id"] = str(res.inserted_id)
                saved.append(s)
            except Exception as e:
                logger.warning(f"Error saving suggestion: {e}")
                saved.append(s)
        return saved


# Backward compatibility alias
AIPatternDiscoveryService = PatternDiscoveryEngine
PatternRuleDiscoveryEngine = PatternDiscoveryEngine


# =====================================================================
# 5. PARTY-LEDGER RESOLUTION SERVICE
# =====================================================================
class PartyLedgerResolutionService:
    """
    Resolves extracted party candidate text against actual company master ledgers.
    Strict 6-Stage Resolution Hierarchy:
      1. Exact normalized ledger name match (100%)
      2. Previously approved party mapping in `bank_party_aliases` (98%)
      3. Verified ledger aliases and alternate names (95%)
      4. Fuzzy matching & token overlap with candidate comparison (60-85%)
      5. Heuristic & rule matches (70%)
      6. Unresolved / Manual Review (0%)
    Never silently selects an ambiguous ledger.
    """

    def __init__(self, db):
        self.db = db
        try:
            self.history_matcher = VoucherHistoryMatcher(db)
        except Exception:
            self.history_matcher = None

    def get_company_master_ledgers(self, company_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Queries the active company master ledgers dynamically."""
        query = {}
        if company_id and company_id != "default":
            query["$or"] = [{"company_id": company_id}, {"companyId": company_id}]
            # Support ObjectId companyId as well
            if len(str(company_id)) == 24:
                try:
                    query["$or"].append({"companyId": ObjectId(company_id)})
                except Exception:
                    pass

        ledgers = []
        seen = set()

        def extract_ledger(doc):
            name = doc.get("ledgerName") or doc.get("name")
            if name and name not in seen:
                seen.add(name)
                aliases = doc.get("alias") or doc.get("alternateName") or ""
                if not aliases and doc.get("nameAliases"):
                    aliases = ", ".join(doc["nameAliases"]) if isinstance(doc["nameAliases"], list) else str(doc["nameAliases"])
                ledgers.append({
                    "id": str(doc.get("_id", "")),
                    "name": name,
                    "group": doc.get("groupName") or doc.get("parentGroup") or doc.get("group", ""),
                    "gstin": doc.get("gstin") or "",
                    "alias": aliases
                })

        try:
            # Query ledgers collection
            cursor = self.db["ledgers"].find(query) if query else self.db["ledgers"].find({})
            for doc in cursor:
                extract_ledger(doc)

            # If over-filtered, load all ledgers from the tenant database
            if not ledgers and query:
                for doc in self.db["ledgers"].find({}):
                    extract_ledger(doc)

            if not ledgers:
                for doc in self.db["ledgers_entry"].find({}):
                    extract_ledger(doc)
        except Exception as e:
            logger.warning(f"Error fetching company ledgers for resolution: {e}")

        return ledgers

    def resolve_party_ledger(
        self,
        party_text: Optional[str],
        narration: str,
        company_id: Optional[str] = None,
        company_masters: Optional[List[Dict[str, Any]]] = None,
        ref_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Resolves party text and narration against company ledgers.
        Returns:
            resolvedLedger: str | None
            resolvedLedgerId: str | None
            confidence: float
            matchMethod: "exact" | "alias" | "token" | "heuristic" | "none"
            isAmbiguous: bool
            candidates: List[str]
        """
        if company_masters is None:
            company_masters = self.get_company_master_ledgers(company_id)

        if not company_masters:
            return {
                "resolvedLedger": None,
                "resolvedLedgerId": None,
                "confidence": 0.0,
                "matchMethod": "none",
                "isAmbiguous": False,
                "candidates": [],
                "unmappedReason": "Company ledger master is empty or not synchronized from Tally"
            }

        target_text = (party_text or "").strip()
        target_lower = target_text.lower()
        narration_lower = narration.lower()

        # Reject pure numeric references, phone numbers, or account codes (e.g. "76345426")
        if not target_text or not any(c.isalpha() for c in target_text) or len(target_text) < 2:
            return {
                "resolvedLedger": None,
                "resolvedLedgerId": None,
                "confidence": 0.0,
                "matchMethod": "none",
                "isAmbiguous": False,
                "candidates": [],
                "unmappedReason": "Party candidate is numeric or invalid reference"
            }

        # Reject narration remark phrases that are not parties (e.g. "pay clear as on", "charges")
        STOP_PHRASES = {
            "pay clear as on", "pay clear", "clear as on", "clear", "pay", "as on",
            "self", "own", "internal", "transfer", "trf", "inft", "inf", "charges",
            "tax", "gst", "sms", "fee", "fees", "interest", "slb", "slbl", "slbn"
        }
        if target_lower in STOP_PHRASES:
            return {
                "resolvedLedger": None,
                "resolvedLedgerId": None,
                "confidence": 0.0,
                "matchMethod": "none",
                "isAmbiguous": False,
                "candidates": [],
                "unmappedReason": f"'{target_text}' is a narration remark phrase, not a party candidate"
            }

        # Step 1: Exact Normalized Ledger Name Match
        if target_lower:
            exact_matches = [m for m in company_masters if m.get("name", "").strip().lower() == target_lower]
            if len(exact_matches) == 1:
                matched = exact_matches[0]
                return {
                    "resolvedLedger": matched["name"],
                    "resolvedLedgerId": matched.get("id"),
                    "confidence": 100.0,
                    "matchMethod": "exact",
                    "isAmbiguous": False,
                    "candidates": [matched["name"]],
                    "unmappedReason": None
                }
            elif len(exact_matches) > 1:
                cand_names = [m["name"] for m in exact_matches]
                return {
                    "resolvedLedger": None,
                    "resolvedLedgerId": None,
                    "confidence": 75.0,
                    "matchMethod": "exact",
                    "isAmbiguous": True,
                    "candidates": cand_names,
                    "unmappedReason": f"Ambiguous exact matches found in Tally master: {', '.join(cand_names[:3])}"
                }

        # Step 1b: Alphanumeric Normalized Match (e.g. HIMANSHUROADLINES == HIMANSHU ROADLINES, SGNCO == SGN & CO.)
        target_alnum = re.sub(r'[^A-Za-z0-9]', '', re.sub(r'\b(and|co|corp|corporation)\b', '', target_lower))
        if len(target_alnum) >= 4:
            alnum_matches = []
            for m in company_masters:
                m_alnum = re.sub(r'[^A-Za-z0-9]', '', re.sub(r'\b(and|co|corp|corporation)\b', '', m.get("name", "").lower()))
                if m_alnum == target_alnum:
                    alnum_matches.append(m)
            if len(alnum_matches) == 1:
                matched = alnum_matches[0]
                return {
                    "resolvedLedger": matched["name"],
                    "resolvedLedgerId": matched.get("id"),
                    "confidence": 99.0,
                    "matchMethod": "alnum_exact",
                    "isAmbiguous": False,
                    "candidates": [matched["name"]],
                    "unmappedReason": None
                }

        # Step 1c: Truncated Prefix / Substring Match (e.g. SUDHIR ROAD TRANSPORT CORPORATION vs SUDHIR ROAD TRANSPORT CORPORAT)
        raw_target_alnum = re.sub(r'[^A-Za-z0-9]', '', target_lower)
        if len(raw_target_alnum) >= 8:
            prefix_matches = []
            for m in company_masters:
                m_raw_alnum = re.sub(r'[^A-Za-z0-9]', '', m.get("name", "").lower())
                if len(m_raw_alnum) >= 8:
                    if raw_target_alnum.startswith(m_raw_alnum) or m_raw_alnum.startswith(raw_target_alnum):
                        prefix_matches.append(m)
            if len(prefix_matches) == 1:
                matched = prefix_matches[0]
                return {
                    "resolvedLedger": matched["name"],
                    "resolvedLedgerId": matched.get("id"),
                    "confidence": 95.0,
                    "matchMethod": "prefix_exact",
                    "isAmbiguous": False,
                    "candidates": [matched["name"]],
                    "unmappedReason": None
                }

        # Step 1d: Separator-Stripped Word Set Match
        # Handles bank-truncated names like "SHREE AVANTI MEDICAL AGPS" vs "SHREE AVANTI MEDICAL AGENCIES"
        # Splits on separators (space, dash, underscore, ampersand, slash) and compares word sets
        STOP_WORDS_SET = {
            'ltd', 'pvt', 'limited', 'private', 'transport', 'transports', 'roadways',
            'roadlines', 'pharmaceuticals', 'pharma', 'medical', 'medicos', 'enterprises',
            'agencies', 'agency', 'traders', 'corporation', 'corporat', 'co', 'and', 'the',
            'services', 'service', 'solution', 'solutions', 'logistics', 'healthcare',
            'store', 'stores', 'supplier', 'suppliers', 'dealer', 'dealers', 'mart',
            'centre', 'center', 'house', 'india', 'indore', 'bhopal', 'mumbai', 'delhi',
        }
        if target_lower and len(target_lower) >= 4:
            # Extract significant words from target (skip stop words and short words)
            tgt_words = [w for w in re.findall(r'[a-z]{3,}', target_lower) if w not in STOP_WORDS_SET]
            if len(tgt_words) >= 1:
                sep_scored = []
                for m in company_masters:
                    m_words = [w for w in re.findall(r'[a-z]{3,}', m.get("name", "").lower()) if w not in STOP_WORDS_SET]
                    if not m_words:
                        continue
                    # Count how many target brand words appear in ledger name
                    matching_words = [w for w in tgt_words if any(w in mw or mw in w for mw in m_words)]
                    if not matching_words:
                        continue
                    # Score: fraction of target brand words matched, weighted by coverage
                    match_fraction = len(matching_words) / len(tgt_words)
                    coverage = len(matching_words) / max(len(m_words), 1)
                    combined = (match_fraction * 0.6) + (coverage * 0.4)
                    # Only consider if all target words matched (or single word match with short target)
                    if len(tgt_words) == 1 and matching_words:
                        sep_scored.append((combined, m))
                    elif match_fraction >= 1.0:
                        sep_scored.append((combined, m))
                    elif match_fraction >= 0.75 and len(tgt_words) >= 2:
                        sep_scored.append((combined * 0.9, m))

                if len(sep_scored) == 1:
                    # Unique match across entire master — auto-select at high confidence
                    best_score, best_m = sep_scored[0]
                    return {
                        "resolvedLedger": best_m["name"],
                        "resolvedLedgerId": best_m.get("id"),
                        "confidence": round(min(98.0, max(88.0, best_score * 100 + 10)), 1),
                        "matchMethod": "word_set_unique",
                        "isAmbiguous": False,
                        "candidates": [best_m["name"]],
                        "unmappedReason": None
                    }
                elif len(sep_scored) > 1:
                    sep_scored.sort(key=lambda x: x[0], reverse=True)
                    best_score, best_m = sep_scored[0]
                    # If top match is significantly better than second, auto-select
                    if best_score - sep_scored[1][0] >= 0.20 and best_score >= 0.75:
                        return {
                            "resolvedLedger": best_m["name"],
                            "resolvedLedgerId": best_m.get("id"),
                            "confidence": round(min(95.0, max(82.0, best_score * 100)), 1),
                            "matchMethod": "word_set_dominant",
                            "isAmbiguous": False,
                            "candidates": [m["name"] for _, m in sep_scored[:5]],
                            "unmappedReason": None
                        }

        # Step 1e: Unique Single Master Ledger Substring Match
        # If exactly one Tally ledger name contains the entire extracted party text as a substring
        if target_lower and len(target_lower) >= 5:
            substring_matches = [
                m for m in company_masters
                if target_lower in m.get("name", "").lower() or m.get("name", "").lower() in target_lower
            ]
            if len(substring_matches) == 1:
                matched = substring_matches[0]
                return {
                    "resolvedLedger": matched["name"],
                    "resolvedLedgerId": matched.get("id"),
                    "confidence": 94.0,
                    "matchMethod": "substring_unique",
                    "isAmbiguous": False,
                    "candidates": [matched["name"]],
                    "unmappedReason": None
                }

        # Step 2: Customer Verified Party Alias in DB (Learned from previous user approvals)
        if target_lower and company_id:
            try:
                # Lookup by partyName (new format from approve flow) OR legacy alias field
                alias_doc = self.db["bank_party_aliases"].find_one({
                    "$and": [
                        {"$or": [{"companyId": company_id}, {"company_id": company_id}]},
                        {"$or": [
                            {"partyName": {"$regex": f"^{re.escape(target_text)}$", "$options": "i"}},
                            {"alias": target_lower}
                        ]}
                    ]
                })
                if alias_doc:
                    resolved_name = alias_doc.get("resolvedLedger") or alias_doc.get("ledgerName")
                    if resolved_name:
                        return {
                            "resolvedLedger": resolved_name,
                            "resolvedLedgerId": str(alias_doc.get("ledgerId", "")),
                            "confidence": alias_doc.get("confidence", 98.0),
                            "matchMethod": "alias_db",
                            "isAmbiguous": False,
                            "candidates": [resolved_name],
                            "unmappedReason": None
                        }
            except Exception as e:
                logger.warning(f"Error querying bank_party_aliases: {e}")

        # Step 2b: Cross-reference Tenant Historical Confirmed Vouchers (15,000+ entries)
        if self.history_matcher:
            try:
                hist_match = self.history_matcher.match_from_history(
                    narration=narration,
                    ref_number=ref_number,
                    extracted_party=target_text,
                    company_id=company_id
                )
                if hist_match and hist_match.get("resolvedLedger"):
                    hist_l_name = hist_match["resolvedLedger"]
                    # Ensure candidate text has actual word overlap with historical ledger
                    target_words = {w for w in re.findall(r'[a-zA-Z]{3,}', target_lower) if w not in STOP_PHRASES}
                    hist_words = {w for w in re.findall(r'[a-zA-Z]{3,}', hist_l_name.lower()) if w not in STOP_PHRASES}
                    if target_words and not (target_words & hist_words):
                        # No word overlap between candidate and historical ledger — do not falsely map
                        matched_m = None
                    else:
                        matched_m = next(
                            (m for m in company_masters if m.get("name", "").strip().lower() == hist_l_name.strip().lower()),
                            None
                        )
                    if matched_m:
                        return {
                            "resolvedLedger": matched_m["name"],
                            "resolvedLedgerId": matched_m.get("id"),
                            "confidence": hist_match.get("confidence", 99.0),
                            "matchMethod": hist_match.get("matchMethod", "history_voucher_ref"),
                            "isAmbiguous": False,
                            "candidates": [matched_m["name"]],
                            "unmappedReason": None
                        }
            except Exception as e:
                logger.debug(f"Error checking voucher history matcher: {e}")

        # Step 3: Ledger Master Aliases & Alternate Names
        if target_lower:
            alias_matches = []
            for m in company_masters:
                alt = (m.get("alias") or "").strip().lower()
                if alt and (alt == target_lower or target_lower in alt):
                    alias_matches.append(m)

            if len(alias_matches) == 1:
                matched = alias_matches[0]
                return {
                    "resolvedLedger": matched["name"],
                    "resolvedLedgerId": matched.get("id"),
                    "confidence": 95.0,
                    "matchMethod": "alias",
                    "isAmbiguous": False,
                    "candidates": [matched["name"]],
                    "unmappedReason": None
                }
            elif len(alias_matches) > 1:
                cand_names = [m["name"] for m in alias_matches]
                return {
                    "resolvedLedger": None,
                    "resolvedLedgerId": None,
                    "confidence": 70.0,
                    "matchMethod": "alias",
                    "isAmbiguous": True,
                    "candidates": cand_names,
                    "unmappedReason": f"Ambiguous alias matches in Tally master: {', '.join(cand_names[:3])}"
                }

        # Step 4: Core Brand & Token Overlap Matching
        GENERIC_BUSINESS_WORDS = {
            'INDORE', 'BHOPAL', 'THANE', 'GWALIOR', 'SATNA', 'JABALPUR', 'MUMBAI', 'DELHI',
            'LTD', 'PVT', 'LIMITED', 'PRIVATE', 'TRANSPORT', 'TRANSPORTS', 'ROADWAYS',
            'ROADLINES', 'PHARMACEUTICALS', 'PHARMA', 'MEDICAL', 'MEDICOS', 'ENTERPRISES',
            'AGENCIES', 'AGENCY', 'TRADERS', 'CORPORATION', 'CORPORAT', 'CO', 'AND', 'RENT',
            'SERVICES', 'SERVICE', 'SOLUTION', 'SOLUTIONS', 'LOGISTICS', 'HEALTHCARE',
            'SELF', 'OWN', 'INTERNAL', 'BREAKAGE', 'EXPENSE', 'EXPENSES', 'WASTE'
        }

        # Step 4b: Check Heuristics Early for Explicit Transaction Channels (Interest, Charges, Cash)
        # Heuristic keyword patterns mapped to candidate ledger name keywords to search in Tally master.
        # NO hardcoded ledger names are returned — only resolves if actual ledger found in Tally master.
        heuristics = [
            (r'\b(chg|charge|charges|fee|proc\s+fee|sms\s+chg|min\s+bal|service\s+tax|gst)\b', "bank charges"),
            (r'\b(int|interest|int\.pd|int\.rec)\b|/int(?:/|$)', "interest"),
            (r'\b(atm|cash|wdl|withdrawal)\b', "cash"),
            (r'\b(sal|salary|wages)\b', "salary"),
        ]
        is_internal_self = bool(re.search(r'\b(self|own\s+acc|internal)\b', target_lower or narration_lower))
        if is_internal_self or re.search(r'\b(int|interest)\b|/int(?:/|$)', narration_lower):
            for pattern, keyword in heuristics:
                if re.search(pattern, narration_lower):
                    # Only resolve if the ledger actually exists in the company Tally master
                    matched_m = next((m for m in company_masters if keyword in m["name"].lower()), None)
                    if matched_m:
                        return {
                            "resolvedLedger": matched_m["name"],
                            "resolvedLedgerId": matched_m.get("id"),
                            "confidence": 85.0,
                            "matchMethod": "heuristic",
                            "isAmbiguous": False,
                            "candidates": [matched_m["name"]],
                            "unmappedReason": None
                        }
                    # Ledger not found in Tally master — do NOT inject hardcoded name, fall through to manual review

        target_words = [w for w in re.findall(r'[A-Za-z]{3,}', target_lower or narration_lower)]
        target_brand = [w for w in target_words if w.upper() not in GENERIC_BUSINESS_WORDS]

        scored_candidates = []
        for m in company_masters:
            m_name = m.get("name", "").strip()
            m_words = [w for w in re.findall(r'[A-Za-z]{3,}', m_name.lower())]
            m_brand = [w for w in m_words if w.upper() not in GENERIC_BUSINESS_WORDS]

            if target_brand and m_brand:
                brand_intersect = set(target_brand).intersection(set(m_brand))
                if brand_intersect:
                    coverage = len(brand_intersect) / len(target_brand)
                    all_intersect = set(target_words).intersection(set(m_words))
                    word_score = len(all_intersect) / max(len(target_words), len(m_words))
                    total_score = coverage * 0.7 + word_score * 0.3
                    if total_score >= 0.45 or len(brand_intersect) >= 2:
                        scored_candidates.append((total_score, len(brand_intersect), m))
            elif target_words:
                all_intersect = set(target_words).intersection(set(m_words))
                if len(all_intersect) >= 2:
                    word_score = len(all_intersect) / max(len(target_words), len(m_words))
                    if word_score >= 0.5:
                        scored_candidates.append((word_score, 0, m))

        if scored_candidates:
            scored_candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
            best_score, brand_cnt, best_master = scored_candidates[0]
            candidate_names = [c[2]["name"] for c in scored_candidates[:5]]

            # Check for ambiguity among candidates with similar high score
            top_ties = [c for c in scored_candidates if c[0] >= best_score * 0.95]
            if len(top_ties) > 1 and (best_score < 0.98 or (len(scored_candidates) > 1 and abs(scored_candidates[0][0] - scored_candidates[1][0]) < 0.05)):
                return {
                    "resolvedLedger": None,
                    "resolvedLedgerId": None,
                    "confidence": 60.0,
                    "matchMethod": "brand_match",
                    "isAmbiguous": True,
                    "candidates": candidate_names,
                    "unmappedReason": f"Ambiguous matches in Tally master: {', '.join(candidate_names[:3])}"
                }

            return {
                "resolvedLedger": best_master["name"],
                "resolvedLedgerId": best_master.get("id"),
                "confidence": round(min(95.0, max(75.0, best_score * 100)), 1),
                "matchMethod": "brand_match",
                "isAmbiguous": False,
                "candidates": candidate_names,
                "unmappedReason": None
            }

        # Step 4c: Jaro-Winkler String Similarity (handles OCR typos, singular/plural, e.g. AMRAPUR MEDICAL AGENCIE vs AMRAPUR MEDICAL AGENCIES)
        if target_lower and len(target_lower) >= 4:
            jw_candidates = []
            for m in company_masters:
                m_low = m.get("name", "").strip().lower()
                score_raw = jaro_winkler_similarity(target_lower, m_low)
                m_alnum_val = re.sub(r'[^a-z0-9]', '', m_low)
                t_alnum_val = re.sub(r'[^a-z0-9]', '', target_lower)
                score_alnum = jaro_winkler_similarity(t_alnum_val, m_alnum_val) if t_alnum_val and m_alnum_val else 0.0
                best_jw = max(score_raw, score_alnum)

                if best_jw >= 0.88 and abs(len(t_alnum_val) - len(m_alnum_val)) <= 5:
                    jw_candidates.append((best_jw, m))

            if jw_candidates:
                jw_candidates.sort(key=lambda x: x[0], reverse=True)
                top_jw, top_master = jw_candidates[0]
                if top_jw >= 0.92:
                    if len(jw_candidates) == 1 or (top_jw - jw_candidates[1][0] >= 0.04):
                        return {
                            "resolvedLedger": top_master["name"],
                            "resolvedLedgerId": top_master.get("id"),
                            "confidence": round(min(96.0, max(85.0, top_jw * 100)), 1),
                            "matchMethod": "jaro_winkler",
                            "isAmbiguous": False,
                            "candidates": [c[1]["name"] for c in jw_candidates[:5]],
                            "unmappedReason": None
                        }

        # Step 5: Heuristic Ledger Classifications (Bank Charges, Interest, Cash)
        # Only resolves if the matched ledger keyword actually exists in Tally master — no hardcoded fallback names.
        for pattern, keyword in heuristics:
            if re.search(pattern, narration_lower):
                matched_m = next((m for m in company_masters if keyword in m["name"].lower()), None)
                if matched_m:
                    return {
                        "resolvedLedger": matched_m["name"],
                        "resolvedLedgerId": matched_m.get("id"),
                        "confidence": 85.0,
                        "matchMethod": "heuristic",
                        "isAmbiguous": False,
                        "candidates": [matched_m["name"]],
                        "unmappedReason": None
                    }
                # Ledger not in Tally master — fall through to unresolved

        unmapped_reason = f"Extracted party '{target_text}' not found in Tally ledger master or aliases" if target_text else "No party entity could be identified from bank narration structure"
        return {
            "resolvedLedger": None,
            "resolvedLedgerId": None,
            "confidence": 0.0,
            "matchMethod": "none",
            "isAmbiguous": False,
            "candidates": [],
            "unmappedReason": unmapped_reason
        }


# Backward compatibility alias
PartyLedgerResolver = PartyLedgerResolutionService


# =====================================================================
# 6. VOUCHER CLASSIFICATION SERVICE
# =====================================================================
class VoucherClassifierService:
    """
    Classifies accounting voucher types (Payment, Receipt, Contra, Journal)
    strictly based on verified accounting rules and own-account verification.
    """

    def __init__(self, db):
        self.db = db

    def is_own_account_transfer(
        self,
        counterparty_text: Optional[str],
        company_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Verifies if the counterparty corresponds to another bank account or cash ledger
        belonging to this company/tenant.
        """
        if not counterparty_text:
            return (False, None)

        target = counterparty_text.strip().lower()
        query: Dict[str, Any] = {}
        if company_id and company_id != "default":
            query["$or"] = [{"company_id": company_id}, {"companyId": company_id}]

        try:
            # Check bank accounts
            for acc in self.db["bank_accounts"].find(query):
                acc_name = (acc.get("accountName") or acc.get("bankLedger") or acc.get("bankName") or "").lower()
                acc_no = str(acc.get("accountNumber") or "")
                if target in acc_name or (len(acc_no) >= 4 and acc_no in target):
                    return (True, acc.get("bankLedger") or acc.get("accountName"))

            # Check ledgers under Bank Accounts or Cash-in-hand group
            for led in self.db["ledgers"].find(query):
                group = (led.get("groupName") or led.get("group") or "").lower()
                name = (led.get("ledgerName") or led.get("name") or "").lower()
                if "bank" in group or "cash" in group:
                    if target == name or target in name:
                        return (True, led.get("ledgerName") or led.get("name"))
        except Exception as e:
            logger.warning(f"Error checking own-account transfers: {e}")

        return (False, None)

    def classify_voucher(
        self,
        channel: str,
        is_credit: bool,
        party_name: Optional[str],
        narration: str,
        company_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Determines appropriate Tally voucher type.
        Returns {
            "voucherType": "Payment" | "Receipt" | "Contra" | "Journal",
            "confidence": float,
            "requiresReview": bool,
            "reasoning": str
        }
        """
        n_clean = NarrationNormalizationService.normalize_text(narration)

        # 1. CONTRA CHECK (Strict Verification Required)
        has_self_cue = bool(re.search(r'\b(SELF|INTERNAL\s+TRF|INTRA\s+TRF|OWN\s+ACC)\b', n_clean, re.I))
        is_own_acc, own_acc_ledger = self.is_own_account_transfer(party_name, company_id)

        if is_own_acc:
            return {
                "voucherType": "Contra",
                "confidence": 95.0,
                "requiresReview": False,
                "reasoning": f"Contra verified: Counterparty '{own_acc_ledger}' is a verified own bank/cash account."
            }

        if has_self_cue and not is_own_acc:
            suggested = "Receipt" if is_credit else "Payment"
            return {
                "voucherType": suggested,
                "confidence": 60.0,
                "requiresReview": True,
                "reasoning": f"Narration contains 'SELF' cue, but counterparty '{party_name}' is not verified as an internal account. Defaulted to {suggested} pending accountant review."
            }

        # 2. BANK CHARGES
        if channel == "BANK_CHARGES" or re.search(r'\b(CHG|CHARGES|FEE|PROC\s+FEE|SMS\s+CHG|GST)\b', n_clean, re.I):
            return {
                "voucherType": "Payment",
                "confidence": 92.0,
                "requiresReview": False,
                "reasoning": "Bank service charges or fees debited by bank -> Payment."
            }

        # 3. INTEREST
        if channel == "INTEREST" or re.search(r'\b(INTEREST|INT\.PD|INT\.REC)\b', n_clean, re.I):
            suggested = "Receipt" if is_credit else "Payment"
            return {
                "voucherType": suggested,
                "confidence": 92.0,
                "requiresReview": False,
                "reasoning": f"Bank interest {'received' if is_credit else 'paid'} -> {suggested}."
            }

        # 4. STANDARD FLOW: Receipt for credit, Payment for debit
        suggested = "Receipt" if is_credit else "Payment"
        return {
            "voucherType": suggested,
            "confidence": 90.0,
            "requiresReview": False,
            "reasoning": f"Transaction direction is {'Credit' if is_credit else 'Debit'} with party '{party_name or 'Unknown'}' -> {suggested}."
        }


# =====================================================================
# 7. RULES-BASED MATCHING SERVICE
# =====================================================================
class RulesBasedMatchingService:
    """
    Evaluates transactions against deterministic pattern mapping rules.
    Prioritizes Customer-Specific > Bank-Specific > System rules.
    Supports contains, startswith, exact, tokens, regex.
    """

    def __init__(self, db):
        self.db = db

    def get_applicable_rules(
        self,
        bank_ledger: str,
        company_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieves active rules in priority order."""
        query: Dict[str, Any] = {"status": {"$ne": "disabled"}}
        scope_queries = []

        if company_id and company_id != "default":
            scope_queries.append({
                "$or": [{"companyId": company_id}, {"company_id": company_id}],
                "scope": {"$in": ["customer_specific", "customer", None]}
            })

        if bank_ledger:
            scope_queries.append({"bankLedger": bank_ledger, "scope": {"$in": ["bank_specific", "bank", None]}})

        scope_queries.append({"scope": "system"})

        if scope_queries:
            query["$or"] = scope_queries

        rules = list(self.db["bank_mapping_rules"].find(query))

        def rule_priority(r: Dict[str, Any]) -> Tuple[int, int, int]:
            scope = (r.get("scope") or "").lower()
            scope_tier = 3 if scope in ["customer_specific", "customer"] else 2 if scope in ["bank_specific", "bank"] else 1
            mtype = (r.get("matchType") or "contains").lower()
            type_tier = 3 if mtype == "exact" else 2 if mtype == "startswith" else 1
            pattern_len = len(r.get("pattern") or "")
            return (scope_tier, type_tier, pattern_len)

        rules.sort(key=rule_priority, reverse=True)
        return rules

    def match_transaction(
        self,
        narration: str,
        amount: float,
        is_credit: bool,
        applicable_rules: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Evaluates narration against applicable rules."""
        if not narration or not applicable_rules:
            return None

        n_clean = NarrationNormalizationService.normalize_text(narration)
        n_lower = n_clean.lower()

        matched_rules = []

        for rule in applicable_rules:
            pattern = (rule.get("pattern") or "").strip()
            if not pattern:
                continue

            # Direction constraint
            direction_constraint = (rule.get("direction") or "any").lower()
            if direction_constraint in ["debit", "payment"] and is_credit:
                continue
            if direction_constraint in ["credit", "receipt"] and not is_credit:
                continue

            # Exclude keywords
            exclude_keywords = rule.get("excludeKeywords") or rule.get("excludePatterns") or []
            if isinstance(exclude_keywords, str):
                exclude_keywords = [k.strip() for k in exclude_keywords.split(",") if k.strip()]
            if any(k.lower() in n_lower for k in exclude_keywords):
                continue

            mtype = (rule.get("matchType") or "contains").lower()
            matched = False

            if mtype == "exact":
                matched = (pattern.lower() == n_lower)
            elif mtype == "startswith":
                matched = n_lower.startswith(pattern.lower())
            elif mtype == "regex":
                try:
                    if len(pattern) <= 250:
                        matched = bool(re.search(pattern, n_clean, re.I))
                except re.error:
                    matched = False
            elif mtype == "tokens":
                rule_tokens = set(pattern.lower().split())
                n_tokens = set(n_lower.split())
                matched = rule_tokens.issubset(n_tokens)
            else:  # contains
                if "," in pattern:
                    sub_parts = [p.strip().lower() for p in pattern.split(",") if p.strip()]
                    matched = all(sp in n_lower for sp in sub_parts)
                else:
                    matched = (pattern.lower() in n_lower)

            if matched:
                matched_rules.append(rule)
                scope = (rule.get("scope") or "").lower()
                if mtype == "exact" or scope in ["customer_specific", "customer"]:
                    break

        if not matched_rules:
            return None

        primary_rule = matched_rules[0]
        distinct_ledgers = set(r.get("partyLedger") for r in matched_rules if r.get("partyLedger"))
        has_conflict = len(distinct_ledgers) > 1

        voucher_override = primary_rule.get("voucherType") or "Auto"
        suggested_voucher = voucher_override if voucher_override in ["Payment", "Receipt", "Contra"] else ("Receipt" if is_credit else "Payment")

        return {
            "ruleId": str(primary_rule.get("_id", "")),
            "ruleName": primary_rule.get("name") or primary_rule.get("pattern"),
            "scope": primary_rule.get("scope") or "bank_specific",
            "matchedPattern": primary_rule.get("pattern"),
            "matchType": primary_rule.get("matchType") or "contains",
            "partyLedger": primary_rule.get("partyLedger"),
            "partyLedgerId": primary_rule.get("partyLedgerId"),
            "voucherType": suggested_voucher,
            "confidence": 100 if not has_conflict else 70,
            "hasConflict": has_conflict,
            "conflictingLedgers": list(distinct_ledgers) if has_conflict else [],
            "reasoning": f"Matched rule '{primary_rule.get('pattern')}' ({primary_rule.get('matchType', 'contains')}) -> '{primary_rule.get('partyLedger')}'"
        }


# =====================================================================
# 8. PATTERN LEARNING & AUDIT SERVICE
# =====================================================================
class PatternLearningService:
    """
    Records accountant approvals, updates customer-specific party aliases,
    and maintains audit logs of user modifications.
    """

    def __init__(self, db):
        self.db = db

    def record_feedback(
        self,
        transaction_id: str,
        narration: str,
        bank_ledger: str,
        corrected_ledger: str,
        corrected_voucher_type: Optional[str] = None,
        previous_prediction: Optional[Dict[str, Any]] = None,
        company_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Saves user confirmation and updates company party alias.
        """
        feedback_doc = {
            "transactionId": transaction_id,
            "narration": narration,
            "bankLedger": bank_ledger,
            "correctedLedger": corrected_ledger,
            "correctedVoucherType": corrected_voucher_type,
            "previousPrediction": previous_prediction or {},
            "companyId": company_id,
            "userId": user_id,
            "created_at": datetime.utcnow()
        }

        try:
            self.db["bank_pattern_feedback"].insert_one(feedback_doc)
        except Exception as e:
            logger.warning(f"Error writing to bank_pattern_feedback: {e}")

        # Learn customer-specific party alias
        party_cand, _ = RegexPositionalExtractor.extract_party(narration)
        if party_cand and len(party_cand.strip()) >= 3 and company_id:
            alias_key = party_cand.strip().lower()
            try:
                self.db["bank_party_aliases"].update_one(
                    {"companyId": company_id, "alias": alias_key},
                    {
                        "$set": {
                            "companyId": company_id,
                            "alias": alias_key,
                            "partyCandidate": party_cand.strip(),
                            "ledgerName": corrected_ledger,
                            "updated_at": datetime.utcnow()
                        },
                        "$inc": {"verificationCount": 1}
                    },
                    upsert=True
                )
                logger.info(f"Learned alias '{alias_key}' -> '{corrected_ledger}' for company {company_id}")
            except Exception as e:
                logger.warning(f"Error updating bank_party_aliases: {e}")

        return {"success": True, "message": "Feedback recorded and customer alias learned."}


# Backward compatibility alias
PatternFeedbackService = PatternLearningService
