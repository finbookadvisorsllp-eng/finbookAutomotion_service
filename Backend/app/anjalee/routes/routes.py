from datetime import datetime
from fastapi import APIRouter

from . import auth
from . import companies
from . import purchase
from . import fundflow

# Router with strict v2 prefix (api/v2) as per requirement
api_router = APIRouter(prefix="/api/v2")

# Health Check Route
@api_router.get("/health")
async def health():
    return {
        "success": True,
        "message": "Finbook FastAPI Service Running (Anjalee v2 API Module)",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0"
    }

# Module Routes (Public)
api_router.include_router(auth.router)
from . import agent_platform
api_router.include_router(agent_platform.router)

# Protected business routers
from fastapi import Depends
from app.core.dependencies import require_authenticated

protected_router = APIRouter(dependencies=[Depends(require_authenticated)])

protected_router.include_router(companies.router)
protected_router.include_router(purchase.router)
protected_router.include_router(fundflow.router)

# Change by Anjalee: Register new Sales Voucher router
from . import sales
protected_router.include_router(sales.router)

from . import bulk_upload
protected_router.include_router(bulk_upload.router)

# AI Chat router
from . import ai_chat
protected_router.include_router(ai_chat.router)

# Voucher router
from . import voucher
protected_router.include_router(voucher.router)

# Ledgers Entry router
from . import ledgers
api_router.include_router(ledgers.router)

# Master Entry router (stockitems_entry, units_entry, stockgroups_entry, stockcategories_entry, groups_entry, costcenters_entry)
from . import masters
api_router.include_router(masters.router)

api_router.include_router(protected_router)


