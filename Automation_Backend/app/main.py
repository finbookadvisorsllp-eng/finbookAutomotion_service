from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from app.routes import auth, companies, sales, purchase, fundflow
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

# ─── Router Mounts ───
# Mount routes under /api prefix to match frontend expectation
app.include_router(auth.router, prefix="/api")
app.include_router(companies.router, prefix="/api")
app.include_router(sales.router, prefix="/api")
app.include_router(purchase.router, prefix="/api")
app.include_router(fundflow.router, prefix="/api")
