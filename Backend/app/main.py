import os
from app.anjalee.routes.routes import api_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from app.db import warm_up_tenant_cache

app = FastAPI(
    title="Finbook Automation Service API",
    description="FastAPI Backend for bookkeeping automation, multi-tenant enabled.",
    version="1.0.0"
)

# Ensure local persistent uploads directory exists
os.makedirs(os.path.join("uploads", "bulk-upload"), exist_ok=True)
os.makedirs(os.path.join("uploads", "documents"), exist_ok=True)
os.makedirs(os.path.join("uploads", "bank_statements"), exist_ok=True)

# Mount /uploads endpoint to serve physical uploaded files persistently
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

from app.anjalee.agents.platform import daily_scheduler

@app.on_event("startup")
def startup_event():
    warm_up_tenant_cache()
    daily_scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    try:
        daily_scheduler.stop()
    except Exception as e:
        pass

# ─── CORS Configuration ───
# Allow access from localhost frontend development servers
# NOTE: allow_origins=["*"] cannot be used with allow_credentials=True (CORS spec restriction).
# Explicitly list dev origins instead.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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

# ─────────────── Shared IAM Auth Router ───────────────
from app.auth.router import router as auth_router
app.include_router(auth_router)

# ─────────────── AMAN (LiveTally) routes — /api/v3 ───────────────

# Owned by the aman project. Do not edit anjalee's include above.
from app.aman.routes.routes import aman_api_router
app.include_router(aman_api_router)
# ─────────────────────────────────────────────────────────────────
# Trigger reload comment 28
