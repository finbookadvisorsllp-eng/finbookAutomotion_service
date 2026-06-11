from app.anjalee.routes.routes import api_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from app.db import warm_up_tenant_cache

app = FastAPI(
    title="Finbook Automation Service API",
    description="FastAPI Backend for bookkeeping automation, multi-tenant enabled.",
    version="1.0.0"
)

@app.on_event("startup")
def startup_event():
    warm_up_tenant_cache()

# ─── CORS Configuration ───
# Allow access from localhost frontend development servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev simplicity, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Health Check ───
@app.get("/health")
@app.get("/api/health")
async def health():
    return {
        "success": True,
        "message": "Finbook FastAPI Service Running",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }


app.include_router(api_router)

# ─────────────── AMAN (LiveTally) routes — /api/v3 ───────────────
# Owned by the aman project. Do not edit anjalee's include above.
from app.aman.routes.routes import aman_api_router
app.include_router(aman_api_router)
# ─────────────────────────────────────────────────────────────────
# Trigger reload comment 3
