"""Authentication routes (/api/v3/auth).

Issues aman-scoped JWTs. In ``AUTH_MODE=dev`` any credentials are accepted (for
local frontend integration). In ``prod`` credentials are validated against the
global users collection with PBKDF2-hashed passwords.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import client
from app.aman.config import aman_settings
from app.aman.core.security import (
    create_access_token, create_refresh_token, verify_password, decode_token, TokenError)
from app.aman.core.dependencies import get_current_user
from app.aman.models.common import LoginRequest, ok

router = APIRouter(prefix="/auth", tags=["aman:auth"])


def _build_claims(user: dict) -> dict:
    return {
        "sub": str(user.get("_id") or user.get("email") or "user"),
        "email": user.get("email"),
        "name": user.get("name") or (user.get("email", "").split("@")[0].title()),
        "app": "aman",
        "subscriptionTier": user.get("subscriptionTier", "pro"),
        "subscriptionActive": user.get("subscriptionActive", True),
        "modules": user.get("modules", ["*"]),
        "companies": user.get("companies", ["*"]),
    }


@router.post("/login")
async def login(payload: LoginRequest):
    if aman_settings.AUTH_MODE == "dev":
        user = {"email": payload.email,
                "name": payload.email.split("@")[0].title(),
                "subscriptionTier": "pro", "modules": ["*"], "companies": ["*"]}
    else:
        doc = client[aman_settings.AUTH_DB_NAME][aman_settings.USERS_COLLECTION].find_one(
            {"email": payload.email, "app": "aman"})
        if not doc or not verify_password(payload.password, doc.get("passwordHash", "")):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid credentials")
        user = doc

    claims = _build_claims(user)
    token = create_access_token(claims)
    refresh = create_refresh_token({"sub": claims["sub"], "app": "aman"})
    return ok({"token": token, "refreshToken": refresh,
               "user": {k: claims[k] for k in ("email", "name", "subscriptionTier", "modules")}})


@router.post("/refresh")
async def refresh_token(payload: dict):
    token = payload.get("refreshToken") or payload.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="refreshToken required")
    try:
        claims = decode_token(token)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    if claims.get("type") != "refresh":
        raise HTTPException(status_code=400, detail="Not a refresh token")
    new_access = create_access_token({"sub": claims["sub"], "app": "aman",
                                      "subscriptionTier": "pro", "modules": ["*"], "companies": ["*"]})
    return ok({"token": new_access})


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return ok({k: user.get(k) for k in ("sub", "email", "name", "app",
                                        "subscriptionTier", "modules", "companies")})
