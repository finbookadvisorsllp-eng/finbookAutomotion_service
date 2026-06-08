"""Mongo document serialization + money/date helpers.

Every document returned to the API must pass through ``serialize_doc`` so that
``ObjectId`` and ``datetime`` become JSON-safe primitives. Keep this the single
source of truth for serialization across the whole aman package.
"""
from datetime import datetime, date
from typing import Any

from bson import ObjectId

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def serialize_value(v: Any) -> Any:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, list):
        return [serialize_value(i) for i in v]
    if isinstance(v, dict):
        return {k: serialize_value(val) for k, val in v.items()}
    return v


def serialize_doc(doc: dict | None) -> dict | None:
    """Recursively serialize a Mongo document to JSON-safe primitives."""
    if not doc:
        return doc
    return {k: serialize_value(v) for k, v in doc.items()}


def serialize_docs(docs) -> list:
    return [serialize_doc(d) for d in docs]


def money(value: Any) -> float:
    """Round any numeric-ish value to 2 decimals (accounting standard)."""
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def fmt_date(value: Any) -> str:
    """Display format used across the LiveTally UI, e.g. '01 Apr 2025'."""
    if value is None:
        return ""
    if isinstance(value, str):
        # Already a string date; try to normalise common ISO forms.
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if isinstance(value, (datetime, date)):
        return f"{value.day:02d} {_MONTHS[value.month - 1]} {value.year}"
    return str(value)


def iso_date(value: Any) -> str | None:
    """ISO YYYY-MM-DD for machine-readable date fields."""
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    return str(value)


def month_key(value: Any) -> str:
    """'MMM YY' bucket key used by the monthly drill-down (Pattern B)."""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if isinstance(value, (datetime, date)):
        return f"{_MONTHS[value.month - 1]} {str(value.year)[2:]}"
    return ""


def parse_qty(qty_str: Any) -> float:
    """'483.00 PCS' -> 483.0 ; handles numbers and None."""
    if qty_str is None:
        return 0.0
    if isinstance(qty_str, (int, float)):
        return float(qty_str)
    try:
        return float(str(qty_str).strip().split(" ")[0].replace(",", ""))
    except (ValueError, IndexError):
        return 0.0


def parse_unit(qty_str: Any) -> str:
    """'483.00 PCS' -> 'PCS'."""
    if not isinstance(qty_str, str):
        return ""
    parts = qty_str.strip().split(" ", 1)
    return parts[1].strip() if len(parts) > 1 else ""


def parse_rate(rate_str: Any) -> float:
    """'51.00/PCS' -> 51.0 ; handles numbers and None."""
    if rate_str is None:
        return 0.0
    if isinstance(rate_str, (int, float)):
        return float(rate_str)
    try:
        return float(str(rate_str).strip().split("/")[0].replace(",", ""))
    except (ValueError, IndexError):
        return 0.0
