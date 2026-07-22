from typing import List, Dict, Any
from app.anjalee.models.ai_models import AiVoucherDraft
from app.anjalee.validation.base import BaseValidator, ValidatorResult, ValidationStatus

class ValidationEngine:
    def __init__(self, validators: List[BaseValidator]):
        self.validators = validators

    async def validate_draft(self, draft: AiVoucherDraft, db: Any) -> Dict[str, Any]:
        """
        Executes all validators sequentially and merges the validation results into one object.
        """
        merged_errors: List[str] = []
        merged_warnings: List[str] = []
        merged_duplicates: Dict[str, Any] = {}
        merged_missing_fields: Dict[str, Any] = {}
        merged_master_matches: Dict[str, Any] = {}
        
        has_error = False

        for validator in self.validators:
            try:
                res: ValidatorResult = await validator.validate(draft, db)
                
                # Merge lists
                merged_errors.extend(res.errors)
                merged_warnings.extend(res.warnings)
                
                # Merge dicts
                merged_duplicates.update(res.duplicates)
                merged_missing_fields.update(res.missing_fields)
                
                # Merge master_matches nested dicts
                for key, val in res.master_matches.items():
                    if key in merged_master_matches:
                        # Merge lists or update values
                        if isinstance(val, dict) and isinstance(merged_master_matches[key], dict):
                            merged_master_matches[key].update(val)
                        else:
                            merged_master_matches[key] = val
                    else:
                        merged_master_matches[key] = val

                # If any validator results in ERROR, NOT_FOUND, or DUPLICATE state, mark the validation failed
                if res.status in [ValidationStatus.ERROR, ValidationStatus.DUPLICATE, ValidationStatus.NOT_FOUND]:
                    has_error = True
            except Exception as e:
                # Fallback to prevent one bad validator from crashing the engine
                import logging
                logging.getLogger(__name__).error(f"Validator {validator.__class__.__name__} failed: {str(e)}", exc_info=True)
                merged_errors.append(f"Internal validation error in {validator.__class__.__name__}: {str(e)}")
                has_error = True

        # Validation is successful only if there are no errors in the list
        success = not has_error and len(merged_errors) == 0

        return {
            "success": success,
            "errors": merged_errors,
            "warnings": merged_warnings,
            "duplicates": merged_duplicates,
            "missing_fields": merged_missing_fields,
            "master_matches": merged_master_matches
        }
