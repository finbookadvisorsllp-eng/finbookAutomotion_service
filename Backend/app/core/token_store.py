"""
app/core/token_store.py
=======================
Handles storage, verification, and revocation of refresh tokens in the central database.
Uses Motor async client.
"""
from datetime import datetime
from typing import Optional
from bson import ObjectId

from app.core.iam_db import get_async_iam_db
from app.core.security import hash_token

async def create_refresh_token_record(
    token: str,
    user_id: str,
    org_id: Optional[str],
    expires_at_epoch: int,
    user_agent: Optional[str] = None,
    ip: Optional[str] = None,
) -> bool:
    """Hash and persist a refresh token record."""
    db = await get_async_iam_db()
    hashed = hash_token(token)
    expires_dt = datetime.utcfromtimestamp(expires_at_epoch)

    record = {
        "token": hashed,
        "userId": user_id,
        "orgId": org_id,
        "issuedAt": datetime.utcnow(),
        "expiresAt": expires_dt,
        "revokedAt": None,
        "userAgent": user_agent,
        "ip": ip,
    }
    result = await db["refresh_tokens"].insert_one(record)
    return bool(result.inserted_id)


async def validate_refresh_token(token: str) -> Optional[dict]:
    """Verify that a refresh token is in the DB, not expired, and not revoked."""
    db = await get_async_iam_db()
    hashed = hash_token(token)
    record = await db["refresh_tokens"].find_one({"token": hashed})

    if not record:
        return None

    if record.get("revokedAt") is not None:
        return None

    if record.get("expiresAt") < datetime.utcnow():
        return None

    return record


async def revoke_token(token: str) -> bool:
    """Revoke a specific refresh token."""
    db = await get_async_iam_db()
    hashed = hash_token(token)
    result = await db["refresh_tokens"].update_one(
        {"token": hashed},
        {"$set": {"revokedAt": datetime.utcnow()}}
    )
    return result.modified_count > 0


async def revoke_all_user_tokens(user_id: str) -> bool:
    """Revoke all active refresh tokens for a user (e.g. on password reset)."""
    db = await get_async_iam_db()
    result = await db["refresh_tokens"].update_many(
        {"userId": user_id, "revokedAt": None},
        {"$set": {"revokedAt": datetime.utcnow()}}
    )
    return result.modified_count > 0
