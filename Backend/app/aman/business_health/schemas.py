"""Request body models for the Business Health write endpoints.

Responses are plain dicts wrapped in the standard envelope (fast, no model
validation), matching the rest of the aman package.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SimulateRequest(BaseModel):
    fy: Optional[str] = None
    # Any subset of pillar driver inputs, e.g. {"receivablesTotal": 800000,
    # "cashBank": 1300000, "netMargin": 13.0}. Non-numeric values are ignored.
    overrides: dict = Field(default_factory=dict)


class ActRequest(BaseModel):
    note: Optional[str] = None


class SnoozeRequest(BaseModel):
    days: Optional[int] = Field(default=None, ge=1, le=365)
    until: Optional[datetime] = None


class DismissRequest(BaseModel):
    reason: Optional[str] = None
