import re
from typing import Optional

GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")

def validate_gstin(gstin: Optional[str]) -> bool:
    """
    Validates if a GSTIN matches the standard Indian GSTIN format.
    """
    if not gstin:
        return True  # GSTIN is optional in many cases
    return bool(GSTIN_REGEX.match(gstin.strip().upper()))
