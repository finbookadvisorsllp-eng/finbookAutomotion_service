"""
app/core/iam_db.py
==================
Shared IAM database connection wrapper.

Reuses the MongoClient and AsyncIOMotorClient defined in `app/db` to avoid duplicate
connection pools, pointing them directly at the centralized `iam` database.
"""
from fastapi import Request
from app.db import client, async_client
from app.config import settings

def get_iam_db():
    """Synchronous PyMongo database helper for iam database."""
    return client[settings.IAM_DB_NAME]


async def get_async_iam_db():
    """Asynchronous Motor database helper for iam database."""
    return async_client[settings.IAM_DB_NAME]


# FastAPI Dependency injection helpers
def get_iam_db_dep() -> get_iam_db:
    return get_iam_db()


async def get_async_iam_db_dep() -> get_async_iam_db:
    return await get_async_iam_db()
