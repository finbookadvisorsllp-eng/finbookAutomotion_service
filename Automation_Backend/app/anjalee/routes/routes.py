from datetime import datetime
from fastapi import APIRouter

from . import auth
from . import companies
from . import sales
from . import purchase
from . import fundflow

api_router = APIRouter(prefix="/api")


# Health Check Routes
@api_router.get("/health")
async def health():
    return {
        "success": True,
        "message": "Finbook FastAPI Service Running",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


# Module Routes
api_router.include_router(auth.router)
api_router.include_router(companies.router)
api_router.include_router(sales.router)
api_router.include_router(purchase.router)
api_router.include_router(fundflow.router)