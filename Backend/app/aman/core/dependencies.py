"""FastAPI dependencies for the aman package: tenant DB, auth, FY parsing.

Tenant isolation reuses the shared, read-only resolver in ``app.db`` (header
``x-company-id``). Application isolation (aman vs anjalee) is enforced by
``require_aman_subscription`` checking the JWT ``app`` claim.
"""
from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, Request, status

from app.db import get_db as _shared_get_db  # read-only shared tenant resolver
from app.aman.config import aman_settings
from app.aman.core.security import decode_token, TokenError
from app.aman.services.financial_year import current_fy, is_valid_fy


# ─────────────────────────────── Tenant ───────────────────────────────
def get_db(request: Request):
    """Return the tenant-scoped Mongo database (shared resolver)."""
    return _shared_get_db(request)


def get_tenant_key(
    x_company_id: Optional[str] = Header(default=None, alias="x-company-id"),
    x_company: Optional[str] = Header(default=None, alias="x-company"),
) -> str:
    """A stable string identifying the tenant, for cache keys."""
    return (x_company_id or x_company or "default").strip()


# ─────────────────────────────── Auth ───────────────────────────────
def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """Decode the Bearer JWT into a claims dict.

    In ``AUTH_MODE=dev`` a missing token is tolerated and a synthetic aman user
    is returned so the frontend can be integrated incrementally. In ``prod`` a
    valid token is mandatory.
    """
    token = _extract_bearer(authorization)
    if not token:
        if aman_settings.AUTH_MODE == "dev":
            return {
                "sub": "dev-user",
                "email": "dev@aman.local",
                "app": "aman",
                "subscriptionTier": "pro",
                "modules": ["*"],
                "companies": ["*"],
            }
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Authentication required")
    try:
        return decode_token(token)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


def require_aman_subscription(user: dict = Depends(get_current_user)) -> dict:
    """Gate /api/v3: the token must belong to the aman product with an active sub.

    This is what isolates the two products in one codebase — an anjalee token
    (``app != 'aman'``) cannot reach any /api/v3 endpoint.
    """
    if user.get("app") != "aman":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="This token is not authorized for the LiveTally (aman) application")
    if user.get("subscriptionActive") is False:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED,
                            detail="Subscription inactive or expired")
    return user


def require_module(module: str):
    """Finer-grained, tier-based feature gate (optional per route)."""
    def _checker(user: dict = Depends(require_aman_subscription)) -> dict:
        modules = user.get("modules") or []
        if "*" in modules or module in modules:
            return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Module '{module}' not included in your subscription")
    return _checker


# ─────────────────────────────── Financial Year ───────────────────────────────
def get_fy(fy: Optional[str] = Query(default=None,
                                     description="Financial year, e.g. 2025-2026")) -> str:
    if not fy:
        return current_fy()
    if not is_valid_fy(fy):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"Invalid financial year '{fy}'. Expected 'YYYY-YYYY'.")
    return fy
