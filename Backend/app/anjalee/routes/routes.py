from datetime import datetime
from fastapi import APIRouter

from . import auth
from . import companies
from . import sales
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

# Module Routes
api_router.include_router(auth.router)
api_router.include_router(companies.router)
api_router.include_router(sales.router)
api_router.include_router(purchase.router)
api_router.include_router(fundflow.router)