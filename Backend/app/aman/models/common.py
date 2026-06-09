"""Shared Pydantic models + the standard API response envelope.

Every endpoint returns ``{success, data, pagination?, meta?}``. Use the helper
constructors so the shape stays consistent across all modules.
"""
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Pagination(BaseModel):
    total: int = 0
    page: int = 1
    limit: int = 50
    pages: int = 0


class ApiResponse(BaseModel):
    success: bool = True
    data: Optional[Any] = None
    pagination: Optional[Pagination] = None
    meta: Optional[dict] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: dict


def ok(data: Any = None, pagination: Optional[dict] = None, meta: Optional[dict] = None) -> dict:
    """Build a success envelope as a plain dict (fast, no model validation)."""
    body: dict[str, Any] = {"success": True, "data": data}
    if pagination is not None:
        body["pagination"] = pagination
    if meta is not None:
        body["meta"] = meta
    return body


def paginate(total: int, page: int, limit: int) -> dict:
    pages = (total + limit - 1) // limit if limit else 0
    return {"total": total, "page": page, "limit": limit, "pages": pages}


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=50, ge=1, le=500)
    search: Optional[str] = None
    sort: Optional[str] = None
    order: str = Field(default="desc")

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.limit

    @property
    def sort_dir(self) -> int:
        return -1 if (self.order or "desc").lower() == "desc" else 1


# ─── Auth payloads ───
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    token: str
    refreshToken: Optional[str] = None
    user: dict
