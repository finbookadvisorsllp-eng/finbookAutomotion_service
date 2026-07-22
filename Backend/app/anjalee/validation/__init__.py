from app.anjalee.validation.base import BaseValidator, ValidatorResult, ValidationStatus
from app.anjalee.validation.engine import ValidationEngine
from app.anjalee.validation.validators import (
    VoucherTypeValidator,
    PartyValidator,
    ItemValidator,
    LedgerValidator,
    BankValidator,
    GstValidator,
    UnitValidator,
    QuantityValidator,
    RateValidator,
    StockValidator,
    OutstandingBillValidator,
    DuplicateVoucherValidator,
    MandatoryFieldValidator
)

# Easily configurable default validators list
# You can append new validators to this list to extend the validation engine without changing engine.py
DEFAULT_VALIDATORS = [
    VoucherTypeValidator(),
    MandatoryFieldValidator(),
    PartyValidator(),
    BankValidator(),
    ItemValidator(),
    LedgerValidator(),
    GstValidator(),
    UnitValidator(),
    QuantityValidator(),
    RateValidator(),
    StockValidator(),
    OutstandingBillValidator(),
    DuplicateVoucherValidator()
]

# Factory method to get the default engine instance
def get_validation_engine() -> ValidationEngine:
    return ValidationEngine(DEFAULT_VALIDATORS)
