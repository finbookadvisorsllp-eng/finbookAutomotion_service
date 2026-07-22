"""
app/core/dependencies.py
========================
FastAPI dependencies for authentication and authorization.
Provides helpers for user verification, app gating, and session context.
"""
from typing import Optional
from fastapi import Depends, Header, HTTPException, status

from app.core.security import decode_token, TokenError
from app.core.models import SessionContext

def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """Decode Bearer JWT from headers and return raw claims."""
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing token.",
        )
    try:
        claims = decode_token(token)
        return claims
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(exc)}",
        )


def require_authenticated(claims: dict = Depends(get_current_user)) -> SessionContext:
    """Ensure the user is authenticated and return a structured SessionContext."""
    # Build SessionContext from claims
    return SessionContext(
        user_id=claims.get("sub"),
        email=claims.get("email"),
        name=claims.get("name"),
        role=claims.get("role", "viewer"),
        org_id=claims.get("orgId"),
        org_db_name=claims.get("orgDbName"),
        org_name=claims.get("orgName"),
        permissions=claims.get("permissions", []),
        apps=claims.get("apps", []),
        raw_claims=claims,
    )


def require_app(app_name: str):
    """Dependency factory checking that a specific application is authorized in the user claims."""
    def _app_check(context: SessionContext = Depends(require_authenticated)) -> SessionContext:
        if app_name not in context.apps:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. User is not authorized for application '{app_name}'",
            )
        return context
    return _app_check
