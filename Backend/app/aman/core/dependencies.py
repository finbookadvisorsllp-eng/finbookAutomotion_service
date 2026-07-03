"""FastAPI dependencies for the aman package: tenant DB, auth, FY parsing.

Tenant isolation reuses the shared, read-only resolver in ``app.db`` (header
``x-company-id``). Application isolation (aman vs anjalee) is enforced by
``require_aman_subscription`` checking the JWT ``app`` claim.
"""
import threading
import time
from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, Request, status

from app.db import get_db as _shared_get_db  # read-only shared tenant resolver
from app.aman.config import aman_settings
from app.aman.core.security import decode_token, TokenError
from app.aman.services.financial_year import current_fy, is_valid_fy


# ─────────────────────────────── Tenant ───────────────────────────────
# Every company's data lives in its own ``sf_tenant_<id>`` database. The id is
# whatever the company switcher sends as ``x-company-id`` (the suffix of the db
# name — a Mongo ObjectId for some tenants, a slug like ``natraj321`` for others).
#
# The shared ``resolve_db_name`` only rebuilds ``sf_tenant_<id>`` when the id is a
# 24-char hex ObjectId; any other suffix silently falls back to the DEFAULT db, so
# those companies appear in the switcher but load the wrong data. We resolve it
# generically here instead: if ``sf_tenant_<id>`` is an existing database, use it.
# This makes a newly synced company switch correctly the moment its database
# exists — no code change, no ObjectId requirement, no restart.
_TENANT_RESOLVE_TTL = 60.0          # seconds; bounds how stale a mapping can be
_tenant_resolve_cache: dict[str, tuple[float, str]] = {}
_tenant_resolve_lock = threading.Lock()
_PLACEHOLDERS = {"", "undefined", "null", "default", "none"}


def _candidate_tenant_db(ref: str) -> Optional[str]:
    """``natraj321`` -> ``sf_tenant_natraj321`` (idempotent if already prefixed).

    Uses the tenant db prefix from the central config so the naming convention is
    defined in exactly one place (``app.config``)."""
    from app.config import settings
    ref = (ref or "").strip()
    if not ref or ref.lower() in _PLACEHOLDERS:
        return None
    return settings.tenant_db_name(ref)


def _tenant_db_exists(client, name: str) -> bool:
    """True if ``name`` is a real, populated tenant database (one cheap command)."""
    try:
        cols = client[name].list_collection_names()
    except Exception:
        return False
    return "companies" in cols or "vouchers" in cols


def resolve_tenant_db_name(company_ref: Optional[str]) -> str:
    """Resolve a company reference to its Mongo database name, dynamically.

    Order: (1) short-TTL cache, (2) ``sf_tenant_<ref>`` if that database exists,
    (3) the shared resolver (ObjectId / org slug / company name / default). Any
    company synced as its own ``sf_tenant_*`` database is therefore reachable
    automatically — the switcher and the data agree."""
    from app.db import resolve_db_name, client
    ref = (company_ref or "").strip()
    if not ref or ref.lower() in _PLACEHOLDERS:
        return resolve_db_name(ref)

    now = time.time()
    hit = _tenant_resolve_cache.get(ref)
    if hit and hit[0] > now:
        return hit[1]

    candidate = _candidate_tenant_db(ref)
    if candidate and _tenant_db_exists(client, candidate):
        db_name = candidate
    else:
        # Backward-compatible: ObjectId ids, org slugs/names, and the default.
        db_name = resolve_db_name(ref)

    with _tenant_resolve_lock:
        _tenant_resolve_cache[ref] = (now + _TENANT_RESOLVE_TTL, db_name)
    return db_name


def get_db(request: Request, companyId: Optional[str] = Query(None)):
    """Return the tenant-scoped Mongo database for the requested company."""
    company_header = companyId or request.headers.get("x-company-id") or request.headers.get("x-company")
    from app.db import client
    db_name = resolve_tenant_db_name(company_header)
    db = client[db_name]
    # Self-heal: if this tenant's sync omitted the reserved voucher parent class
    # (voucherTypeOrigName), backfill it from the voucherTypes master so the
    # standard classification works. Runs once per tenant/process, in the
    # background, and is a no-op for normally-synced tenants.
    if db_name not in _origin_healed:
        _origin_healed.add(db_name)
        threading.Thread(target=_heal_voucher_origin, args=(db, db_name), daemon=True).start()
    # Ensure the report indexes exist for this tenant (once per process, in the
    # background). Idempotent and safe for normally-indexed tenants.
    if aman_settings.ENSURE_INDEXES and db_name not in _indexes_ensured:
        _indexes_ensured.add(db_name)
        threading.Thread(target=_ensure_indexes_bg, args=(db,), daemon=True).start()
    return db


_origin_healed: set[str] = set()
_indexes_ensured: set[str] = set()


def _heal_voucher_origin(db, db_name: str) -> None:
    try:
        from app.aman.services.tenant_normalize import ensure_voucher_origin
        ensure_voucher_origin(db, db_name)
    except Exception:
        pass


def _ensure_indexes_bg(db) -> None:
    try:
        from app.aman.core.indexes import ensure_indexes
        ensure_indexes(db)
    except Exception:
        pass



def get_tenant_key(
    request: Request,
    x_company_id: Optional[str] = Header(default=None, alias="x-company-id"),
    x_company: Optional[str] = Header(default=None, alias="x-company"),
) -> str:
    """A stable string identifying the tenant, for cache keys."""
    company_id = request.query_params.get("companyId")
    return (x_company_id or x_company or company_id or "default").strip()


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
