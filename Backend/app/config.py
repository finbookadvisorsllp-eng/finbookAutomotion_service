"""Centralised backend configuration.

Every deployment-specific / sensitive value (Mongo connection, company IDs,
tenant database naming) is loaded from environment variables via a git-ignored
``.env`` file. Nothing company-specific is hardcoded in source — see
``.env.example`` for the full list of supported variables.
"""
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Base directory of the project (…/Backend)
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from Backend/.env (git-ignored).
load_dotenv(dotenv_path=BASE_DIR / ".env")


def _clean(value: str | None) -> str:
    return (value or "").strip()


def build_tenant_db_name(company_id: str | None, prefix: str) -> str:
    """``6a182ee…`` -> ``sf_tenant_6a182ee…`` (idempotent if already prefixed)."""
    cid = _clean(company_id)
    if not cid:
        return ""
    return cid if cid.startswith(prefix) else f"{prefix}{cid}"


class Settings:
    # ─── Mongo ───
    MONGO_URI: str = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI") or "mongodb://localhost:27017"

    # ─── Multi-tenant naming ───
    # Each company lives in its own database named ``<prefix><company_id>``.
    TENANT_DB_PREFIX: str = os.getenv("TENANT_DB_PREFIX", "sf_tenant_")

    # Company served when a request carries no ``x-company-id`` header.
    # NEVER hardcode a real id here — supply it through the (git-ignored) .env.
    DEFAULT_COMPANY_ID: str = _clean(os.getenv("DEFAULT_COMPANY_ID"))

    # Optional explicit override of the default database name; otherwise it is
    # derived from DEFAULT_COMPANY_ID. Empty when neither is configured, in which
    # case every request must identify its tenant via the ``x-company-id`` header.
    DEFAULT_DB_NAME: str = _clean(os.getenv("DEFAULT_DB_NAME")) or build_tenant_db_name(
        DEFAULT_COMPANY_ID, TENANT_DB_PREFIX
    )

    # Optional allow-list of company ids this deployment may serve
    # (comma-separated). Empty => allow any tenant database that exists
    # (dynamic multi-tenant, convenient for local development).
    COMPANY_IDS: list[str] = [c.strip() for c in _clean(os.getenv("COMPANY_IDS")).split(",") if c.strip()]

    def tenant_db_name(self, company_id: str | None) -> str:
        return build_tenant_db_name(company_id, self.TENANT_DB_PREFIX)

    @property
    def company_aliases(self) -> dict:
        """Optional ``{"Friendly Name": "company_id"}`` JSON map used only to warm
        the tenant resolver cache so a human name resolves without a DB scan."""
        raw = _clean(os.getenv("COMPANY_ALIASES"))
        if not raw:
            return {}
        try:
            data = json.loads(raw)
            return {str(k).strip(): str(v).strip() for k, v in data.items()} if isinstance(data, dict) else {}
        except (ValueError, TypeError):
            return {}

    def tenant_seed(self) -> dict:
        """Warm-start ``{reference: db_name}`` entries derived purely from config
        (default company, allow-listed ids, and human aliases). Never hardcoded."""
        seed: dict = {}
        if self.DEFAULT_COMPANY_ID:
            seed[self.DEFAULT_COMPANY_ID] = self.tenant_db_name(self.DEFAULT_COMPANY_ID)
        for cid in self.COMPANY_IDS:
            seed[cid] = self.tenant_db_name(cid)
        for alias, cid in self.company_aliases.items():
            seed[alias] = self.tenant_db_name(cid)
        return {k: v for k, v in seed.items() if k and v}

    
    # Default Database Name to fetch data locally
    DEFAULT_DB_NAME: str = "finbook_23aafff9731l1z7"

    # Shared IAM Authentication settings
    IAM_DB_NAME: str = os.getenv("IAM_DB_NAME") or "iam"
    JWT_SECRET: str = os.getenv("JWT_SECRET") or "finbook-shared-secret-key-39281a8b3d0"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES") or "60")
    JWT_REFRESH_EXPIRE_MINUTES: int = int(os.getenv("JWT_REFRESH_EXPIRE_MINUTES") or "10080")

    # AI LLM settings
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY")
    NVIDIA_BASE_URL: str = os.getenv("NVIDIA_BASE_URL") or "https://integrate.api.nvidia.com/v1"
    LLM_MODEL: str = os.getenv("LLM_MODEL") or "meta/llama-3.1-70b-instruct"
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY")

settings = Settings()


