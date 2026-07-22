from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from enum import Enum
from app.anjalee.models.ai_models import AiVoucherDraft

class ValidationStatus(str, Enum):
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    ERROR = "ERROR"
    DUPLICATE = "DUPLICATE"
    NOT_FOUND = "NOT_FOUND"

class ValidatorResult:
    def __init__(
        self,
        status: ValidationStatus = ValidationStatus.SUCCESS,
        errors: Optional[List[str]] = None,
        warnings: Optional[List[str]] = None,
        duplicates: Optional[Dict[str, Any]] = None,
        missing_fields: Optional[Dict[str, Any]] = None,
        master_matches: Optional[Dict[str, Any]] = None
    ):
        self.status = status
        self.errors = errors or []
        self.warnings = warnings or []
        self.duplicates = duplicates or {}
        self.missing_fields = missing_fields or {}
        self.master_matches = master_matches or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value,
            "errors": self.errors,
            "warnings": self.warnings,
            "duplicates": self.duplicates,
            "missing_fields": self.missing_fields,
            "master_matches": self.master_matches
        }

class BaseValidator(ABC):
    @abstractmethod
    async def validate(self, draft: AiVoucherDraft, db: Any) -> ValidatorResult:
        """
        Validates the voucher draft against the database masters and returns a ValidatorResult.
        """
        pass
