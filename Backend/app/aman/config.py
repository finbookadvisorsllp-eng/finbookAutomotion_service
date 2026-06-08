"""Aman-specific settings.

Reads from the same ``.env`` already loaded by ``app.config`` (which calls
``load_dotenv``). We import that module so the environment is populated, then
layer Aman-only knobs on top without modifying the shared Settings class.
"""
import os

# Importing the shared settings ensures .env is loaded exactly once.
from app.config import settings as shared_settings


class AmanSettings:
    # ─── Identity ───
    APP_NAME: str = "aman"
    API_PREFIX: str = "/api/v3"

    # ─── Mongo (reuse shared client/uri) ───
    DEFAULT_DB_NAME: str = shared_settings.DEFAULT_DB_NAME

    # ─── Auth ───
    # In production set AMAN_JWT_SECRET in the environment.
    JWT_SECRET: str = os.getenv("AMAN_JWT_SECRET", "aman-dev-secret-change-me")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("AMAN_JWT_EXPIRE_MINUTES", "720"))  # 12h
    JWT_REFRESH_EXPIRE_MINUTES: int = int(os.getenv("AMAN_JWT_REFRESH_EXPIRE_MINUTES", str(60 * 24 * 7)))
    # "dev"  -> accept any credentials (returns an aman-scoped token, for local integration)
    # "prod" -> validate against the users collection with hashed passwords
    AUTH_MODE: str = os.getenv("AMAN_AUTH_MODE", "dev")

    # Where global users / subscriptions live (not per-tenant).
    AUTH_DB_NAME: str = os.getenv("AMAN_AUTH_DB", "salesforecasting_system")
    USERS_COLLECTION: str = os.getenv("AMAN_USERS_COLLECTION", "users")

    # ─── Caching ───
    CACHE_ENABLED: bool = os.getenv("AMAN_CACHE_ENABLED", "1") == "1"
    CACHE_TTL_SECONDS: int = int(os.getenv("AMAN_CACHE_TTL", "600"))  # 10 min

    # ─── Accounting / GST ───
    GST_RATE_SLABS = [5, 12, 18, 28]
    # Group classification buckets (from groups.nature.classification).
    CLASS_ASSETS = "ASSETS"
    CLASS_LIABILITIES = "LIABILITIES"
    CLASS_INCOME = "INCOME"
    CLASS_EXPENSE = "EXPENSE"


aman_settings = AmanSettings()
