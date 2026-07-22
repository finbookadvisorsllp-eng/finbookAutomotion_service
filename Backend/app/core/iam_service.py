"""
app/core/iam_service.py
=======================
Service helper functions to query the central IAM database.
Uses async Motor client.
"""
from typing import List, Optional
from bson import ObjectId
from app.core.iam_db import get_async_iam_db
from datetime import datetime

async def get_user_by_email(email: str) -> Optional[dict]:
    """Find a user record in iam.users collection by email."""
    db = await get_async_iam_db()
    user = await db["users"].find_one({"email": email.strip().lower()})
    if user:
        user["_id"] = str(user["_id"])
    return user


async def get_user_by_id(user_id: str) -> Optional[dict]:
    """Find a user record in iam.users collection by _id."""
    db = await get_async_iam_db()
    try:
        query_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        user = await db["users"].find_one({"_id": query_id})
        if user:
            user["_id"] = str(user["_id"])
        return user
    except Exception:
        return None


async def get_organization_by_id(org_id: str) -> Optional[dict]:
    """Find an organization record by ID."""
    db = await get_async_iam_db()
    try:
        query_id = ObjectId(org_id) if ObjectId.is_valid(org_id) else org_id
        org = await db["organizations"].find_one({"_id": query_id})
        if org:
            org["_id"] = str(org["_id"])
        return org
    except Exception:
        return None


async def get_organizations_by_ids(org_ids: List[str]) -> List[dict]:
    """Load multiple organization records for a list of organization IDs."""
    db = await get_async_iam_db()
    object_ids = []
    for oid in org_ids:
        if ObjectId.is_valid(oid):
            object_ids.append(ObjectId(oid))
        else:
            object_ids.append(oid)

    cursor = db["organizations"].find({"_id": {"$in": object_ids}})
    orgs = []
    async for org in cursor:
        org["_id"] = str(org["_id"])
        orgs.append(org)
    return orgs


async def update_user_last_login(user_id: str) -> bool:
    """Update lastLoginAt timestamp for a user."""
    db = await get_async_iam_db()
    try:
        query_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
        result = await db["users"].update_one(
            {"_id": query_id},
            {"$set": {"lastLoginAt": datetime.utcnow()}}
        )
        return result.modified_count > 0
    except Exception:
        return False
