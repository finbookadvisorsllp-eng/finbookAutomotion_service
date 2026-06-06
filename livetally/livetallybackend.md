# LiveTally Backend Implementation Plan
### Python FastAPI + Existing Database → Production-Ready Accounting Platform

> **Architect's Perspective:** This document is the definitive guide for connecting the LiveTally frontend to a FastAPI backend. It is written after a thorough analysis of every page, every data field, every drill-down flow, and every filter in the frontend UI. Follow these phases in order — each phase builds on the previous one and has clear exit criteria before moving forward.

---

## Executive Summary

LiveTally is a multi-level financial reporting platform that reads data from an existing accounting database (Tally-origin). The frontend has **35+ pages** with complex drill-down chains (up to Level 5), global date-range filtering, year-based financial period selection, and real-time KPI cards. All data is currently mocked — the goal is to replace every mock with a live API call without changing the frontend's data shapes.

The backend is **read-heavy** (95% reads, 5% writes). The main challenges are:
1. Aggregation queries are expensive (P&L, Balance Sheet, Aging buckets)
2. Drill-down chains require consistent data across levels
3. Multiple financial years must coexist
4. A single company is shown today but multi-company must not be locked out

---

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | FastAPI 0.111+ | Async, auto OpenAPI docs, Pydantic validation |
| Python | 3.11+ | Performance improvements, better async |
| Database driver | SQLAlchemy 2.0 (async) | Native async, works with any SQL DB |
| Caching | Redis 7 | Sub-millisecond cache for aggregation queries |
| Task queue | Celery + Redis | Background sync jobs from Tally |
| Auth | JWT (python-jose) + bcrypt | Stateless, scalable |
| Validation | Pydantic v2 | Fast, strict schema enforcement |
| Testing | pytest-asyncio + httpx | Async-native testing |
| Server | Uvicorn + Gunicorn | Production ASGI server |
| Migrations | Alembic | Only if adding tables to existing DB |
| Logging | structlog | JSON structured logs for observability |

---

## Project Directory Structure

```
finbook_backend/
├── app/
│   ├── main.py                   # FastAPI app factory, middleware, routers
│   ├── config.py                 # Settings via pydantic-settings
│   ├── database.py               # SQLAlchemy async engine + session factory
│   ├── dependencies.py           # Shared FastAPI dependencies (auth, db, company)
│   │
│   ├── models/                   # SQLAlchemy ORM models (read-only mapping to your DB)
│   │   ├── voucher.py
│   │   ├── ledger.py
│   │   ├── stock_item.py
│   │   ├── company.py
│   │   └── ...
│   │
│   ├── schemas/                  # Pydantic request/response shapes
│   │   ├── dashboard.py
│   │   ├── profit_loss.py
│   │   ├── balance_sheet.py
│   │   ├── sales.py
│   │   ├── purchase.py
│   │   ├── cash_bank.py
│   │   ├── inventory.py
│   │   ├── gst.py
│   │   └── common.py
│   │
│   ├── routers/                  # FastAPI route handlers (thin — delegate to services)
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── profit_loss.py
│   │   ├── balance_sheet.py
│   │   ├── cash_flow.py
│   │   ├── trial_balance.py
│   │   ├── sales.py
│   │   ├── purchase.py
│   │   ├── cash_bank.py
│   │   ├── inventory.py
│   │   ├── gst.py
│   │   ├── analytics.py
│   │   └── outstanding.py
│   │
│   ├── services/                 # Business logic (all aggregation, calculations here)
│   │   ├── dashboard_service.py
│   │   ├── pl_service.py
│   │   ├── bs_service.py
│   │   ├── cash_flow_service.py
│   │   ├── trial_balance_service.py
│   │   ├── sales_service.py
│   │   ├── purchase_service.py
│   │   ├── cash_bank_service.py
│   │   ├── inventory_service.py
│   │   ├── gst_service.py
│   │   ├── aging_service.py
│   │   └── period_service.py     # Financial year / period utility
│   │
│   ├── cache/
│   │   ├── redis_client.py
│   │   └── cache_keys.py         # Centralized cache key constants + TTL config
│   │
│   └── utils/
│       ├── financial_period.py   # FY date range helpers (Apr-Mar)
│       ├── number_format.py      # Lakh/Crore formatting
│       └── exceptions.py
│
├── tests/
│   ├── conftest.py
│   ├── test_dashboard.py
│   ├── test_pl.py
│   └── ...
│
├── .env
├── .env.example
├── requirements.txt
├── docker-compose.yml
└── Makefile
```

---

## Understanding Your Existing Database

Before writing a single line of backend code, you must fully understand your existing database schema. A Tally-originated accounting database typically has these core tables (exact names will vary — audit yours first):

| Concept | Likely Table(s) | Key Fields |
|---|---|---|
| Company | `company`, `mst_company` | guid, name, gstin, pan, financial_year_from |
| Voucher (transaction) | `trn_voucher`, `vouchers` | id, date, voucher_type, voucher_number, party_ledger_id, amount, narration |
| Voucher Entries | `trn_accounting`, `voucher_entries` | voucher_id, ledger_id, amount, is_debit |
| Ledger Master | `mst_ledger`, `ledgers` | id, name, parent_group_id, opening_balance |
| Ledger Group | `mst_group`, `groups` | id, name, parent_id, affects_gross_profit |
| Stock Items | `mst_stock_item`, `stock_items` | id, name, parent_group_id, unit, reorder_level |
| Stock Voucher | `trn_inventory`, `stock_entries` | voucher_id, stock_item_id, qty, rate, amount, is_inward |
| GST Details | `trn_gst`, `gst_details` | voucher_id, taxable_amount, cgst, sgst, igst, tax_rate |

**Action before Phase 1:** Run `SHOW TABLES` (MySQL) or `\dt` (Postgres) and document your exact schema. The queries in this document use abstract names — you must map them to your real tables.

---

---

# PHASE 1: Foundation & Infrastructure
**Duration: 3-4 days | Start Here**

This phase produces nothing visible in the UI but is the most critical phase. Every subsequent phase depends on getting this right.

### 1.1 — Project Bootstrap

```bash
mkdir finbook_backend && cd finbook_backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] aiomysql \
            python-jose[cryptography] passlib[bcrypt] pydantic-settings \
            redis[hiredis] structlog pytest-asyncio httpx alembic
pip freeze > requirements.txt
```

Create `.env`:
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_tally_db
DB_USER=readonly_user
DB_PASSWORD=secret

# Redis
REDIS_URL=redis://localhost:6379/0

# Auth
JWT_SECRET_KEY=generate-with-openssl-rand-hex-32
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480

# App
APP_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
DEFAULT_COMPANY_ID=1
```

### 1.2 — Database Connection

**`app/database.py`**
```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(
    settings.database_url,           # mysql+aiomysql://...
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    echo=settings.db_echo,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

**Critical:** Create a **read-only database user** for the backend. Never use root or admin credentials to access the Tally database. This prevents accidental writes.

```sql
CREATE USER 'livetally_ro'@'%' IDENTIFIED BY 'strong-password';
GRANT SELECT ON your_tally_db.* TO 'livetally_ro'@'%';
FLUSH PRIVILEGES;
```

### 1.3 — Map Your Database Models

Create SQLAlchemy models that **reflect** your existing tables without modification. Use `__table_args__ = {'extend_existing': True}` so Alembic won't try to create/modify these tables.

**`app/models/voucher.py`** (example):
```python
from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Voucher(Base):
    __tablename__ = "trn_voucher"          # ← your actual table name
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    voucher_type = Column(String(50))      # Sales, Purchase, Payment, Receipt, Journal
    voucher_number = Column(String(50))
    party_ledger_id = Column(Integer, ForeignKey("mst_ledger.id"))
    company_id = Column(Integer, ForeignKey("company.id"))
    narration = Column(String(500))
    is_cancelled = Column(Boolean, default=False)

    entries = relationship("VoucherEntry", back_populates="voucher")
    party = relationship("Ledger", foreign_keys=[party_ledger_id])
```

**Do this for every table before writing a single service.** You cannot write correct queries without knowing your data shapes.

### 1.4 — Financial Period Utility

This is used everywhere. Build it once, correctly.

**`app/utils/financial_period.py`**
```python
from datetime import date
from dataclasses import dataclass

FINANCIAL_YEAR_START_MONTH = 4   # April

@dataclass
class FinancialPeriod:
    year_label: str         # "2024-25"
    start_date: date        # 2024-04-01
    end_date: date          # 2025-03-31
    display: str            # "FY 2024-25"

def get_financial_year(year_label: str) -> FinancialPeriod:
    """
    Input: "2024-25" or "2024-2025"
    Returns: FinancialPeriod with Apr 1 to Mar 31
    """
    start_year = int(year_label.split("-")[0])
    end_year = start_year + 1
    return FinancialPeriod(
        year_label=f"{start_year}-{str(end_year)[2:]}",
        start_date=date(start_year, 4, 1),
        end_date=date(end_year, 3, 31),
        display=f"FY {start_year}-{str(end_year)[2:]}",
    )

def get_current_financial_year() -> FinancialPeriod:
    today = date.today()
    start_year = today.year if today.month >= 4 else today.year - 1
    return get_financial_year(f"{start_year}-{str(start_year+1)[2:]}")

def get_available_years(oldest_date: date) -> list[FinancialPeriod]:
    """Returns all financial years from oldest_date to current."""
    current = get_current_financial_year()
    years = []
    start_year = oldest_date.year if oldest_date.month >= 4 else oldest_date.year - 1
    end_year = int(current.year_label.split("-")[0])
    for y in range(start_year, end_year + 1):
        years.append(get_financial_year(f"{y}-{str(y+1)[2:]}"))
    return years
```

### 1.5 — Redis Cache Setup

**`app/cache/redis_client.py`**
```python
import redis.asyncio as aioredis
import json
from typing import Any, Optional
from app.config import settings

_redis: Optional[aioredis.Redis] = None

async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis

async def cache_get(key: str) -> Optional[Any]:
    r = await get_redis()
    value = await r.get(key)
    return json.loads(value) if value else None

async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    r = await get_redis()
    await r.setex(key, ttl, json.dumps(value, default=str))

async def cache_invalidate_pattern(pattern: str) -> None:
    r = await get_redis()
    async for key in r.scan_iter(pattern):
        await r.delete(key)
```

**Cache TTL Strategy:**
| Data Type | TTL | Reason |
|---|---|---|
| Dashboard KPIs | 5 minutes | Changes frequently during business hours |
| P&L / Balance Sheet | 30 minutes | Expensive aggregation, rarely changes mid-day |
| Trial Balance | 30 minutes | Same as above |
| Sales/Purchase lists | 2 minutes | Transactions may come in often |
| Master data (ledgers, stock items) | 60 minutes | Rarely changes |
| Historical year data (closed FY) | 24 hours | Never changes |

### 1.6 — Authentication Foundation

The frontend has a `Login.jsx` — implement JWT auth now so it doesn't block later phases.

**`app/routers/auth.py`**
```python
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.schemas.auth import Token, UserResponse
from app.services.auth_service import authenticate_user, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form.username, form.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "company_id": user.company_id})
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.post("/refresh", response_model=Token)
async def refresh_token(current_user = Depends(get_current_user)):
    token = create_access_token({"sub": str(current_user.id)})
    return {"access_token": token, "token_type": "bearer"}
```

### 1.7 — CORS and App Factory

**`app/main.py`**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, dashboard, profit_loss, balance_sheet  # etc.

def create_app() -> FastAPI:
    app = FastAPI(
        title="LiveTally API",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    # Health check — no auth required
    @app.get("/health")
    async def health():
        return {"status": "ok", "version": "1.0.0"}

    # Register all routers
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(dashboard.router, prefix="/api/v1")
    # ... rest of routers

    return app

app = create_app()
```

### Phase 1 Exit Criteria (Do NOT proceed until all pass)
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] `POST /api/v1/auth/login` with valid credentials returns a JWT token
- [ ] Database connection is live and a raw test query (e.g., `SELECT COUNT(*) FROM vouchers`) returns data
- [ ] Redis connection is live (`await cache_set("test", "ok")` works)
- [ ] Financial period utility correctly returns Apr 1 – Mar 31 for any year input
- [ ] CORS allows requests from `localhost:5173`
- [ ] Application runs without warnings with `uvicorn app.main:app --reload`

---

---

# PHASE 2: Dashboard APIs
**Duration: 2-3 days | Depends on Phase 1**

The dashboard is the most visible page — get this right and stakeholders will immediately see value. It requires the most aggregation queries.

### 2.1 — Dashboard Response Schema

**`app/schemas/dashboard.py`**
```python
from pydantic import BaseModel
from typing import Optional

class KPICard(BaseModel):
    current: float
    previous: float
    change: float           # percentage
    trend: str              # "up" or "down"
    label: str
    sparkData: list[float]  # 6-7 monthly data points for sparkline

class AgingBucket(BaseModel):
    bucket: str             # "0-30 Days"
    amount: float
    count: int
    pct: float

class MonthlyTrend(BaseModel):
    month: str              # "Apr", "May", etc.
    revenue: float
    expense: float
    profit: float

class CashFlowMonth(BaseModel):
    month: str
    inflow: float
    outflow: float
    net: float

class TopCustomer(BaseModel):
    id: int
    name: str
    city: str
    sales: float
    outstanding: float
    lastTxn: str
    status: str

class TopProduct(BaseModel):
    id: int
    name: str
    group: str
    closing: float
    value: float
    margin: Optional[float]
    trend: str

class RecentVoucher(BaseModel):
    id: str
    date: str
    type: str
    party: str
    amount: float
    gst: Optional[float]
    status: str

class DashboardResponse(BaseModel):
    company_name: str
    gstin: str
    last_sync: str
    kpis: dict[str, KPICard]
    monthly_trends: list[MonthlyTrend]
    receivables_aging: list[AgingBucket]
    cash_flow: list[CashFlowMonth]
    top_customers: list[TopCustomer]
    top_products: list[TopProduct]
    recent_vouchers: list[RecentVoucher]
```

### 2.2 — Dashboard Service Queries

**`app/services/dashboard_service.py`** (structure — adapt SQL to your schema):

```python
async def get_sales_kpi(db, company_id, period: FinancialPeriod) -> KPICard:
    """Sum of all Sales voucher entries for current and previous year."""
    # Current year: SUM of credit entries in Sales-type ledgers
    # Previous year: same query with period.start_date - 1 year
    # Change% = (current - previous) / previous * 100
    # SparkData: GROUP BY MONTH for 6 months
    ...

async def get_receivables_kpi(db, company_id) -> KPICard:
    """Outstanding balance of all debtor ledgers."""
    # SUM of opening_balance + all debit entries - all credit entries
    # For ledgers in group "Sundry Debtors"
    ...

async def get_aging_buckets(db, company_id) -> list[AgingBucket]:
    """
    For each outstanding invoice (Sales voucher where amount_due > 0):
    - Calculate (today - invoice_date) in days
    - Bucket into 0-30, 31-60, 61-90, 90+
    - Sum amount per bucket
    """
    ...

async def get_monthly_trends(db, company_id, period: FinancialPeriod) -> list[MonthlyTrend]:
    """
    GROUP BY MONTH, YEAR:
    - Revenue: SUM of Sales ledger credits
    - Expense: SUM of Purchase + Expense ledger debits
    - Profit: Revenue - Expense
    """
    ...
```

### 2.3 — Dashboard Router

**`app/routers/dashboard.py`**
```python
from fastapi import APIRouter, Depends, Query
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import get_dashboard_data
from app.cache.redis_client import cache_get, cache_set
from app.dependencies import get_current_user, get_db

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    year: str = Query(default=None, description="Financial year, e.g. 2024-25"),
    date_range: str = Query(default="year"),
    db = Depends(get_db),
    current_user = Depends(get_current_user),
):
    company_id = current_user.company_id
    cache_key = f"dashboard:{company_id}:{year}:{date_range}"

    cached = await cache_get(cache_key)
    if cached:
        return cached

    data = await get_dashboard_data(db, company_id, year, date_range)
    await cache_set(cache_key, data.model_dump(), ttl=300)
    return data
```

### 2.4 — Frontend Integration Point

Once the endpoint is live, in the frontend create `src/services/dashboardService.js`:

```javascript
import api from './apiClient';

export const getDashboard = async (year, dateRange) => {
  const { data } = await api.get('/dashboard', {
    params: { year, date_range: dateRange }
  });
  return data;
};
```

Then in `Dashboard.jsx`, replace the import of `mockData` with:
```javascript
// BEFORE (remove this)
import { kpiData, monthlyTrends } from '../data/mockData';

// AFTER (add this)
import { getDashboard } from '../services/dashboardService';
const [dashboardData, setDashboardData] = useState(null);
useEffect(() => {
  getDashboard(selectedYear, dateRange).then(setDashboardData);
}, [selectedYear, dateRange]);
```

### Phase 2 Exit Criteria
- [ ] `GET /api/v1/dashboard` returns all 6 KPI cards with real numbers
- [ ] Monthly trends return 12 months of data for the selected financial year
- [ ] Receivables aging buckets add up to 100%
- [ ] Top 5 customers list is populated from real data
- [ ] Top 5 products/stock items are populated from real data
- [ ] 10 recent vouchers are visible
- [ ] Response time < 500ms with cache, < 3s without cache
- [ ] Changing date range filter changes KPI values
- [ ] Dashboard page renders without JS errors after mock replacement

---

---

# PHASE 3: Financial Reports — P&L, Balance Sheet, Trial Balance, Cash Flow
**Duration: 5-7 days | The most complex phase**

These are the core financial statements. They require deep knowledge of your ledger group hierarchy (the "chart of accounts"). Take extra time to understand your database's group hierarchy before writing these queries.

### 3.1 — Understanding the Ledger Group Hierarchy

A Tally accounting database organizes all ledgers into a tree:

```
Primary Groups
├── Capital Account
│   └── Reserves & Surplus
├── Loans (Liability)
├── Fixed Assets
├── Investments
├── Current Assets
│   ├── Sundry Debtors       ← Receivables
│   ├── Cash-in-Hand         ← Cash accounts
│   └── Bank Accounts        ← Bank accounts
├── Current Liabilities
│   └── Sundry Creditors     ← Payables
├── Sales Accounts           ← Revenue
├── Purchase Accounts        ← Cost of Goods
├── Direct Expenses          ← COGS additions
├── Direct Incomes
├── Indirect Expenses        ← Operating expenses
└── Indirect Incomes
```

**Before writing any P&L or Balance Sheet query:**
1. Query your `mst_group` or equivalent table to see the full tree
2. Map each primary group to its financial statement bucket (Asset/Liability/Income/Expense)
3. Identify which groups contribute to "Gross Profit" vs "Net Profit"

```sql
-- Run this to understand your group hierarchy
SELECT g.id, g.name, g.parent_id, p.name as parent_name
FROM mst_group g
LEFT JOIN mst_group p ON g.parent_id = p.id
ORDER BY g.parent_id, g.name;
```

### 3.2 — P&L API Design

The frontend has a 5-level drill-down. Your API must support all levels with consistent data.

**Endpoints:**
```
GET /api/v1/reports/pl/summary?year=2024-25
    → Level 1: Summary (Total Revenue, Gross Profit, Net Profit + particulars list)

GET /api/v1/reports/pl/ledgers?year=2024-25&particular=sales-accounts
    → Level 2: All ledgers under "Sales Accounts" group with debit/credit amounts

GET /api/v1/reports/pl/vouchers?year=2024-25&ledger_id=42
    → Level 3: All vouchers for ledger 42 in the year

GET /api/v1/reports/pl/voucher/{voucher_id}
    → Level 4: Full voucher detail (all entries, party, narration, GST)

GET /api/v1/reports/pl/stock-list?year=2024-25&ledger_id=42
    → Level 3 (Stock): All stock items for a stock/inventory ledger

GET /api/v1/reports/pl/stock-item/{item_id}?year=2024-25
    → Level 4: Stock item movement ledger for the year

GET /api/v1/reports/pl/stock-customer?item_id=10&year=2024-25
    → Level 5: Customer-wise breakdown for a stock item
```

**`app/schemas/profit_loss.py`**
```python
class PLLedger(BaseModel):
    id: int
    name: str
    debit: float
    credit: float

class PLParticular(BaseModel):
    id: str
    name: str
    sign: str           # "+" income, "-" expense
    amount: float
    ledgers: list[PLLedger]

class PLSummary(BaseModel):
    year: str
    total_revenue: float
    gross_profit: float
    net_profit: float
    particulars: list[PLParticular]
    comparison: Optional["PLSummary"] = None    # For compare period

class VoucherEntry(BaseModel):
    ledger_name: str
    debit: float
    credit: float

class VoucherDetail(BaseModel):
    id: str
    number: str
    date: str
    type: str
    party: str
    narration: str
    entries: list[VoucherEntry]
    taxable_amount: Optional[float]
    gst_amount: Optional[float]
    total: float
```

### 3.3 — Balance Sheet API

```
GET /api/v1/reports/bs?date=2025-03-31
    → Full balance sheet as at a date

GET /api/v1/reports/bs?date=2025-03-31&compare_date=2024-03-31
    → Balance sheet with comparison column

GET /api/v1/reports/bs/group/{group_id}?date=2025-03-31
    → Drill-down into a group's ledgers
```

**Balance Sheet calculation logic:**
```python
async def calculate_balance_sheet(db, company_id, as_at_date: date):
    """
    For each ledger, calculate:
    balance = opening_balance + SUM(all debit entries) - SUM(all credit entries)
    
    Where entries are from beginning of company history up to as_at_date.
    
    Then group ledgers by their ultimate parent group (Fixed Assets, Current Assets, etc.)
    """
    ...
```

**Important:** Balance Sheet is cumulative (from company inception), not just for one year. P&L is periodic (within a financial year). Never confuse these.

### 3.4 — Trial Balance API

```
GET /api/v1/reports/trial-balance?year=2024-25
    → All ledgers with opening, debit movement, credit movement, closing balance

GET /api/v1/reports/trial-balance/ledger/{ledger_id}?year=2024-25
    → All vouchers for a ledger in the period (drill-down)
```

**Response schema:**
```python
class TrialBalanceLedger(BaseModel):
    id: int
    name: str
    group_name: str
    opening_debit: float
    opening_credit: float
    period_debit: float
    period_credit: float
    closing_debit: float
    closing_credit: float

class TrialBalanceGroup(BaseModel):
    group_name: str
    ledgers: list[TrialBalanceLedger]
    total_debit: float
    total_credit: float
```

### 3.5 — Cash Flow API

```
GET /api/v1/reports/cash-flow?year=2024-25
    → Monthly cash inflow/outflow/net from Cash-in-Hand + Bank Account ledgers
```

**Cash flow calculation:**
```python
"""
Cash Flow is derived from bank/cash ledger movements:
- Inflow: SUM of debit entries to Cash/Bank ledgers (money coming in)
- Outflow: SUM of credit entries to Cash/Bank ledgers (money going out)
- Group by month

This gives you actual cash movement, not accrual-based.
"""
```

### 3.6 — Compare Period Feature

The P&L page has a "Compare Period" feature. Design this from the start:

```python
@router.get("/reports/pl/summary")
async def get_pl_summary(
    year: str = "2024-25",
    compare_from: Optional[date] = None,
    compare_to: Optional[date] = None,
    db = Depends(get_db),
    current_user = Depends(get_current_user),
):
    primary_period = get_financial_year(year)
    result = await pl_service.get_summary(db, company_id, primary_period)

    if compare_from and compare_to:
        comparison = await pl_service.get_summary_for_range(db, company_id, compare_from, compare_to)
        result.comparison = comparison

    return result
```

### Phase 3 Exit Criteria
- [ ] P&L Summary returns correct Gross Profit and Net Profit (verify manually against Tally)
- [ ] P&L Level 2 (ledger breakdown) numbers match Tally's P&L ledger-wise report
- [ ] P&L Level 3 (voucher list) shows the correct invoices for a given ledger
- [ ] P&L Level 4 (voucher detail) shows all accounting entries
- [ ] Balance Sheet: Total Assets = Total Liabilities + Equity (fundamental identity)
- [ ] Balance Sheet comparison mode returns two columns
- [ ] Trial Balance: Total Debit = Total Credit (must be true — if not, data issue exists)
- [ ] Cash Flow monthly numbers match bank statement reconciliation
- [ ] All reports respond in < 2s with cache, < 10s without
- [ ] Historical year (closed FY) data is cached for 24 hours

---

---

# PHASE 4: Sales & Purchase Modules
**Duration: 3-4 days | Depends on Phase 1**

These are transactional listing pages with filters, pagination, and modals.

### 4.1 — Common Pagination Pattern

All list endpoints must follow this pattern consistently:

```python
class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
```

```python
@router.get("/sales", response_model=PaginatedResponse[SalesInvoice])
async def get_sales(
    year: str = "2024-25",
    page: int = 1,
    page_size: int = 50,
    status: Optional[str] = None,      # "paid", "pending", "overdue"
    search: Optional[str] = None,       # Party name search
    sort_by: str = "date",
    sort_order: str = "desc",
    db = Depends(get_db),
    current_user = Depends(get_current_user),
):
    ...
```

### 4.2 — Sales Register Schema

```python
class SalesInvoice(BaseModel):
    id: str
    date: str
    party: str
    items: int              # Count of stock items in voucher
    taxable: float
    gst: float
    total: float
    status: str             # paid / pending / overdue
    pay_mode: Optional[str]  # NEFT, Cheque, Credit

class SalesKPIs(BaseModel):
    total_sales: float
    gst_collected: float
    collected_amount: float
    total_invoices: int
    pending_invoices: int
    overdue_invoices: int

class SalesListResponse(BaseModel):
    kpis: SalesKPIs
    invoices: PaginatedResponse[SalesInvoice]
```

**Status Calculation Logic:**
```python
def calculate_invoice_status(invoice_date, due_date, amount_paid, total):
    """
    paid: amount_paid >= total
    overdue: amount_paid < total AND today > due_date (or today > invoice_date + 30 if no due date)
    pending: amount_paid < total AND not yet overdue
    """
```

### 4.3 — Sales Endpoints

```
GET /api/v1/sales?year=2024-25&page=1&page_size=50&status=pending
GET /api/v1/sales/{voucher_id}           → Full invoice detail with line items
GET /api/v1/sales/kpis?year=2024-25     → Just the 4 KPI cards

GET /api/v1/purchase?year=2024-25&page=1&page_size=50
GET /api/v1/purchase/{voucher_id}
GET /api/v1/purchase/kpis?year=2024-25
```

### 4.4 — Customers & Vendors

```
GET /api/v1/customers?status=active&search=sharma
    → Customer list with sales, outstanding, last transaction

GET /api/v1/customers/{ledger_id}
    → Customer detail: all invoices, outstanding breakdown, payment history

GET /api/v1/customers/kpis
    → Total customers, total sales, outstanding, overdue count

GET /api/v1/vendors?status=active
GET /api/v1/vendors/{ledger_id}
GET /api/v1/vendors/kpis
```

### 4.5 — Receivables & Payables with Aging

```
GET /api/v1/receivables?year=2024-25
    → Aging buckets + customer-wise outstanding table

GET /api/v1/payables?year=2024-25
    → Aging buckets + vendor-wise payable table
```

**Aging Calculation (implement in `aging_service.py`):**
```python
async def calculate_receivables_aging(db, company_id):
    """
    1. Get all outstanding sales invoices (amount_due > 0)
    2. For each invoice, calculate days_overdue = today - invoice_date (or due_date if set)
    3. Bucket:
       - 0-30 days
       - 31-60 days
       - 61-90 days
       - 90+ days
    4. Sum amount and count invoices per bucket
    5. Calculate percentage of total for each bucket
    """
```

### 4.6 — Outstanding Reports

```
GET /api/v1/outstanding/receivables
    → Ledger-wise outstanding (Sundry Debtors group)

GET /api/v1/outstanding/payables
    → Ledger-wise outstanding (Sundry Creditors group)

GET /api/v1/outstanding/bills-receivable
    → Voucher-wise bills not yet received

GET /api/v1/outstanding/bills-payable
    → Voucher-wise bills not yet paid
```

### Phase 4 Exit Criteria
- [ ] Sales list shows all invoices with correct amounts
- [ ] Pagination works — page 2 shows different records than page 1
- [ ] Status filter correctly separates paid/pending/overdue invoices
- [ ] Invoice detail modal shows all line items
- [ ] Customer list shows correct outstanding amounts
- [ ] Receivables aging buckets match what you'd see in a manual aging report
- [ ] KPI cards match aggregated values from the list

---

---

# PHASE 5: Cash & Bank Module
**Duration: 2-3 days | Depends on Phase 1**

This module has a unique 3-level drill-down within a single page. The frontend already handles the routing via URL params.

### 5.1 — Cash & Bank Endpoints

```
GET /api/v1/cash-bank/summary?year=2024-25
    → Level 1: All cash and bank accounts with opening/closing balances

GET /api/v1/cash-bank/ledger/{ledger_id}?year=2024-25&view=party
    → Level 2 (Party-wise): SUM of transactions grouped by party for this ledger

GET /api/v1/cash-bank/ledger/{ledger_id}?year=2024-25&view=voucher
    → Level 2 (Voucher-wise): All individual vouchers for this ledger

GET /api/v1/cash-bank/ledger/{ledger_id}?year=2024-25&view=monthly
    → Level 2 (Monthly): SUM grouped by month

GET /api/v1/cash-bank/voucher/{voucher_id}
    → Level 3: Full voucher detail
```

### 5.2 — Cash & Bank Schema

```python
class CashBankAccount(BaseModel):
    id: int
    name: str
    type: str           # "cash" or "bank"
    opening: float
    debit: float        # Total debits in period
    credit: float       # Total credits in period
    closing: float

class CashBankSummary(BaseModel):
    year: str
    cash_in_hand: float     # Sum of all Cash-in-Hand ledgers
    bank_balance: float     # Sum of all Bank Account ledgers
    total_balance: float
    accounts: list[CashBankAccount]

class LedgerPartyRow(BaseModel):
    party_name: str
    debit: float
    credit: float
    net: float

class LedgerVoucherRow(BaseModel):
    id: int
    date: str
    type: str
    party: str
    narration: str
    debit: float
    credit: float
    running_balance: float  # Cumulative balance after each entry

class LedgerMonthRow(BaseModel):
    month: str
    debit: float
    credit: float
    closing: float
```

### 5.3 — Identifying Cash & Bank Ledgers

```python
"""
In your database, Cash & Bank ledgers belong to these groups:
- "Cash-in-Hand" → all cash accounts (Main Cash, Petty Cash)
- "Bank Accounts" → all bank accounts (HDFC, SBI, ICICI)

Query your mst_group to find these group IDs, then:
SELECT * FROM mst_ledger WHERE parent_group_id IN (cash_group_id, bank_group_id)
"""
```

### Phase 5 Exit Criteria
- [ ] All cash and bank accounts appear with correct closing balances
- [ ] Clicking an account shows party-wise, voucher-wise, and monthly tabs
- [ ] Running balance column (voucher-wise view) stays consistent
- [ ] Year selector switches between FY correctly
- [ ] Voucher detail shows the correct accounting entries

---

---

# PHASE 6: Inventory Module
**Duration: 2-3 days | Depends on Phase 1**

### 6.1 — Inventory Endpoints

```
GET /api/v1/inventory/summary?year=2024-25
    → All stock items with opening, in, out, closing quantities and value

GET /api/v1/inventory/{item_id}?year=2024-25
    → Individual item: full movement history (voucher-wise)

GET /api/v1/inventory/alerts
    → Items where closing_qty <= reorder_level

GET /api/v1/inventory/slow-moving?year=2024-25
    → Items with low outward movement (less than threshold)

GET /api/v1/inventory/fast-moving?year=2024-25
    → Items with high outward movement
```

### 6.2 — Inventory Schema

```python
class StockItem(BaseModel):
    id: int
    name: str
    group: str
    unit: str
    opening: float
    inward: float
    outward: float
    closing: float
    value: float        # closing_qty * avg_rate
    reorder: float
    status: str         # "ok", "warning", "critical"
    trend: str          # "up", "down", "stable"

class InventoryKPIs(BaseModel):
    total_stock_value: float
    total_items: int
    low_stock_items: int
    critical_items: int
```

**Status Calculation:**
```python
def calculate_stock_status(closing_qty, reorder_level):
    if closing_qty <= 0:
        return "critical"
    elif closing_qty <= reorder_level * 1.5:
        return "warning"
    else:
        return "ok"
```

### Phase 6 Exit Criteria
- [ ] Stock summary shows all items with correct closing quantities
- [ ] Stock value = closing quantity × last purchase rate (or weighted average)
- [ ] Status badges (ok/warning/critical) match the reorder levels
- [ ] Critical stock count in KPI matches the count of critical items in the table
- [ ] Item drill-down shows complete movement history

---

---

# PHASE 7: GST Reports & Analytics
**Duration: 2-3 days | Depends on Phases 3 & 4**

### 7.1 — GST Report Endpoints

```
GET /api/v1/gst/summary?year=2024-25
    → GSTR-1 totals, GSTR-3B totals, ITC summary

GET /api/v1/gst/gstr1?year=2024-25&month=3
    → GSTR-1 detail: all sales invoices grouped by tax rate

GET /api/v1/gst/gstr3b?year=2024-25&month=3
    → GSTR-3B: outward supplies, ITC claims, net tax payable

GET /api/v1/gst/tax-breakdown?year=2024-25
    → Taxable amount by rate (5%, 12%, 18%, 28%)
```

**GST Calculation Logic:**
```python
"""
From your GST detail table (trn_gst):
- Group vouchers by tax_rate
- Sum: taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax
- For ITC: look at purchase vouchers with eligible_for_itc = true
- GSTR-1 filing status: check against a separate filings table (or mark manually)
"""
```

### 7.2 — Analytics Endpoints

```
GET /api/v1/analytics/trends?year=2024-25
    → Monthly revenue, expense, profit trend (used in Analytics page chart)

GET /api/v1/analytics/budget-actual?year=2024-25
    → Budget vs actual by category (requires a budget table)

GET /api/v1/analytics/top-customers?year=2024-25&limit=10
    → Top N customers by sales value with YoY comparison
```

**Note on Budget:** If you don't have a budget table, skip the budget-actual chart for now and return static or derived data. Don't block the entire analytics page on it.

### Phase 7 Exit Criteria
- [ ] GST tax breakdown pie chart shows correct amounts for each tax rate
- [ ] GSTR-1 taxable turnover matches the sum of taxable amounts in Sales Register
- [ ] ITC summary matches purchase vouchers with eligible GST
- [ ] Analytics trends chart matches P&L monthly breakdown

---

---

# PHASE 8: Frontend Integration — Replacing Mock Data
**Duration: 3-4 days | Depends on Phases 2-7**

This phase is about carefully replacing every mock import in the frontend without breaking anything.

### 8.1 — Create the API Client

**`livetally/src/services/apiClient.js`**
```javascript
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 8.2 — Service Files to Create

Create one service file per domain. Each file maps to one set of backend endpoints:

```
src/services/
├── apiClient.js            # Axios instance (shared)
├── authService.js          # Login, logout, token refresh
├── dashboardService.js     # Dashboard KPIs, trends, charts
├── financialService.js     # P&L, Balance Sheet, Cash Flow, Trial Balance
├── salesService.js         # Sales register, invoices, customers, receivables
├── purchaseService.js      # Purchase register, vendors, payables
├── cashBankService.js      # Cash & Bank accounts, ledger detail
├── inventoryService.js     # Stock summary, item detail, alerts
├── gstService.js           # GST reports
└── analyticsService.js     # Trends, budget vs actual
```

### 8.3 — Migration Strategy: Mock → Live

**Do NOT replace all mocks at once.** Follow this order per page:

1. Add the service call in a `useEffect`
2. Keep mock data as the initial state
3. Once API returns data, override the mock
4. Only after confirming data shape matches, remove the mock import
5. Test the page end-to-end before moving to the next page

**Pattern for every page:**
```javascript
// Dashboard.jsx — migration example
import { useState, useEffect } from 'react';
import { getDashboard } from '../services/dashboardService';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getDashboard(selectedYear, dateRange)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [selectedYear, dateRange]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} />;
  // render with real data
};
```

### 8.4 — Add Loading & Error States

Every page needs these three states. Create reusable components:

```jsx
// src/components/LoadingSpinner.jsx
// src/components/ErrorMessage.jsx
// src/components/EmptyState.jsx
```

### 8.5 — Environment Configuration

**`livetally/.env.development`**
```env
VITE_API_URL=http://localhost:8000/api/v1
```

**`livetally/.env.production`**
```env
VITE_API_URL=https://api.yourproductiondomain.com/api/v1
```

### Page Migration Order (do in this sequence)

| Order | Page | Service |
|---|---|---|
| 1 | Dashboard | dashboardService.js |
| 2 | Sales Register | salesService.js |
| 3 | Purchase Register | purchaseService.js |
| 4 | P&L (Level 1 & 2) | financialService.js |
| 5 | Trial Balance | financialService.js |
| 6 | Balance Sheet | financialService.js |
| 7 | Cash & Bank | cashBankService.js |
| 8 | Customers & Receivables | salesService.js |
| 9 | Vendors & Payables | purchaseService.js |
| 10 | Inventory | inventoryService.js |
| 11 | Cash Flow | financialService.js |
| 12 | GST Reports | gstService.js |
| 13 | P&L Drill-downs (Level 3-5) | financialService.js |
| 14 | Analytics | analyticsService.js |

### Phase 8 Exit Criteria
- [ ] No page imports from `mockData.js`, `plDrillDownData.js`, `cashBankData.js` etc.
- [ ] Every page shows a spinner while loading
- [ ] Every page shows an error message if the API fails
- [ ] The date range selector on the dashboard changes the API call parameters
- [ ] The year selector on P&L, Trial Balance, and Cash & Bank works correctly
- [ ] P&L drill-down chain works end-to-end from Level 1 to Level 4
- [ ] Cash & Bank drill-down works end-to-end from Level 1 to Level 3

---

---

# PHASE 9: Production Hardening
**Duration: 3-4 days | Do not skip**

### 9.1 — Query Optimization

Once all features work, identify slow queries:

```python
# Add query timing in development
import time
import structlog

log = structlog.get_logger()

async def timed_query(db, query, *args):
    start = time.perf_counter()
    result = await db.execute(query, *args)
    elapsed = time.perf_counter() - start
    if elapsed > 1.0:
        log.warning("slow_query", elapsed=elapsed, query=str(query))
    return result
```

**Index recommendations** (add to your DB if missing):
```sql
-- Vouchers table — most queried
CREATE INDEX idx_voucher_date ON trn_voucher(date);
CREATE INDEX idx_voucher_company_date ON trn_voucher(company_id, date);
CREATE INDEX idx_voucher_type_date ON trn_voucher(voucher_type, date);
CREATE INDEX idx_voucher_party ON trn_voucher(party_ledger_id);

-- Voucher entries table
CREATE INDEX idx_entry_voucher ON trn_accounting(voucher_id);
CREATE INDEX idx_entry_ledger ON trn_accounting(ledger_id);

-- Inventory
CREATE INDEX idx_inventory_voucher ON trn_inventory(voucher_id);
CREATE INDEX idx_inventory_item ON trn_inventory(stock_item_id);

-- GST details
CREATE INDEX idx_gst_voucher ON trn_gst(voucher_id);
```

### 9.2 — Response Compression

```python
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

### 9.3 — Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.get("/dashboard")
@limiter.limit("30/minute")
async def get_dashboard(request: Request, ...):
    ...
```

### 9.4 — Structured Logging

```python
import structlog

log = structlog.get_logger()

# In every service function
log.info("pl_summary_requested",
         company_id=company_id,
         year=year,
         cache_hit=cache_hit,
         duration_ms=elapsed * 1000)
```

### 9.5 — Docker Setup

**`docker-compose.yml`**
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DB_HOST=db
      - REDIS_URL=redis://cache:6379/0
    depends_on:
      - cache

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

**`Dockerfile`**
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 9.6 — Security Checklist

- [ ] Read-only DB user in production (never admin credentials)
- [ ] JWT secret is at least 32 random bytes (`openssl rand -hex 32`)
- [ ] CORS `allow_origins` is a whitelist — never `["*"]` in production
- [ ] All sensitive config in environment variables — nothing in code
- [ ] SQL queries use parameterized statements — SQLAlchemy handles this automatically
- [ ] Passwords are bcrypt-hashed — minimum work factor 12
- [ ] HTTPS only in production — enforce via nginx or load balancer
- [ ] JWT tokens expire (480 minutes default — adjust to your security policy)
- [ ] No stack traces exposed in API error responses in production

### 9.7 — Performance Targets

| Endpoint | Target (cached) | Target (cold) |
|---|---|---|
| `GET /dashboard` | < 100ms | < 3s |
| `GET /reports/pl/summary` | < 100ms | < 8s |
| `GET /reports/bs` | < 100ms | < 8s |
| `GET /reports/trial-balance` | < 100ms | < 5s |
| `GET /sales` | < 100ms | < 1s |
| `GET /cash-bank/summary` | < 100ms | < 2s |

### Phase 9 Exit Criteria
- [ ] All slow queries (> 1s) have been identified and indexed
- [ ] P&L and Balance Sheet responses are cached with 30-minute TTL
- [ ] Historical year data (closed FY) returns from cache without hitting the DB
- [ ] Application runs in Docker without errors
- [ ] All security checklist items are complete
- [ ] Load test with 10 concurrent users shows no degradation

---

---

## Complete API Reference

Below is the full list of all endpoints this backend must expose. Use this as a checklist.

### Authentication
```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
```

### Company
```
GET    /api/v1/company/info
GET    /api/v1/company/sync-status
```

### Dashboard
```
GET    /api/v1/dashboard?year=&date_range=
GET    /api/v1/dashboard/kpis?year=&date_range=
GET    /api/v1/dashboard/alerts
```

### Financial Reports
```
GET    /api/v1/reports/pl/summary?year=&compare_from=&compare_to=
GET    /api/v1/reports/pl/ledgers?year=&particular=
GET    /api/v1/reports/pl/vouchers?year=&ledger_id=&page=&page_size=
GET    /api/v1/reports/pl/voucher/{voucher_id}
GET    /api/v1/reports/pl/stock-list?year=&ledger_id=
GET    /api/v1/reports/pl/stock-item/{item_id}?year=
GET    /api/v1/reports/pl/stock-customer?item_id=&year=

GET    /api/v1/reports/balance-sheet?date=&compare_date=
GET    /api/v1/reports/balance-sheet/group/{group_id}?date=

GET    /api/v1/reports/trial-balance?year=
GET    /api/v1/reports/trial-balance/ledger/{ledger_id}?year=

GET    /api/v1/reports/cash-flow?year=

GET    /api/v1/reports/day-book?date=&page=&page_size=
GET    /api/v1/reports/outstanding
```

### Sales
```
GET    /api/v1/sales?year=&page=&status=&search=&sort_by=&sort_order=
GET    /api/v1/sales/kpis?year=
GET    /api/v1/sales/{voucher_id}
GET    /api/v1/sales/orders?year=&page=
GET    /api/v1/sales/credit-notes?year=&page=
GET    /api/v1/sales/delivery-notes?year=&page=
GET    /api/v1/customers?status=&search=&page=
GET    /api/v1/customers/kpis
GET    /api/v1/customers/{ledger_id}
GET    /api/v1/receivables?year=
GET    /api/v1/receivables/aging
```

### Purchase
```
GET    /api/v1/purchase?year=&page=&status=&search=
GET    /api/v1/purchase/kpis?year=
GET    /api/v1/purchase/{voucher_id}
GET    /api/v1/purchase/orders?year=&page=
GET    /api/v1/purchase/debit-notes?year=&page=
GET    /api/v1/purchase/receipt-notes?year=&page=
GET    /api/v1/vendors?status=&search=&page=
GET    /api/v1/vendors/kpis
GET    /api/v1/vendors/{ledger_id}
GET    /api/v1/payables?year=
GET    /api/v1/payables/aging
```

### Cash & Bank
```
GET    /api/v1/cash-bank/summary?year=
GET    /api/v1/cash-bank/ledger/{ledger_id}?year=&view=party|voucher|monthly&page=
GET    /api/v1/cash-bank/voucher/{voucher_id}
```

### Inventory
```
GET    /api/v1/inventory?year=&page=&status=&search=
GET    /api/v1/inventory/kpis?year=
GET    /api/v1/inventory/alerts
GET    /api/v1/inventory/slow-moving?year=
GET    /api/v1/inventory/fast-moving?year=
GET    /api/v1/inventory/{item_id}?year=
```

### GST
```
GET    /api/v1/gst/summary?year=
GET    /api/v1/gst/gstr1?year=&month=
GET    /api/v1/gst/gstr3b?year=&month=
GET    /api/v1/gst/tax-breakdown?year=
```

### Analytics
```
GET    /api/v1/analytics/trends?year=
GET    /api/v1/analytics/budget-actual?year=
GET    /api/v1/analytics/sales-analysis?year=
```

---

## Common Architectural Decisions

### Decision 1: Synchronous vs Asynchronous Queries

Use async SQLAlchemy throughout. The accounting database has expensive aggregation queries. With async, FastAPI can serve other requests while one query is running instead of blocking the thread pool.

### Decision 2: Where to Calculate Financial Totals

**Always calculate in the database (SQL), not in Python.**

```python
# WRONG — loads all rows into memory
vouchers = await db.execute(select(Voucher).where(...))
total = sum(v.amount for v in vouchers.all())  # Don't do this

# RIGHT — aggregation in SQL
total = await db.scalar(
    select(func.sum(Voucher.amount)).where(...)
)
```

### Decision 3: Multi-Company Support

Even though the frontend currently shows one company, build multi-company from day one. Every endpoint accepts `company_id` (from the authenticated user's JWT). This means:

1. Every SQL query has a `WHERE company_id = :company_id` clause
2. The JWT payload includes `company_id`
3. Users can belong to one or multiple companies (add a `user_companies` junction table)

Cost: 2 extra hours now. Benefit: avoids a complete rewrite later.

### Decision 4: Consistent Date Handling

All dates are stored as `YYYY-MM-DD` strings in the API (ISO 8601). Never return timestamps for date-only fields. The frontend date pickers expect this format.

Financial years use the label format `"2024-25"` in query parameters (matches what the frontend already uses in URL params and dropdown options).

### Decision 5: Cache Invalidation Strategy

Use time-based TTL (not event-based) for now. When Tally syncs, the cache will naturally expire. For critical dashboards, the TTL is short enough (5 minutes) that stale data is not a problem.

In a future phase, you can add a Celery task that flushes the cache when a sync completes:

```python
@celery.task
def on_tally_sync_complete(company_id):
    asyncio.run(cache_invalidate_pattern(f"*:{company_id}:*"))
```

### Decision 6: Pagination Default

Default `page_size=50` for all list endpoints. The DataTable component in the frontend currently shows all rows — add pagination controls to the DataTable as part of Phase 8 integration. Never return unbounded result sets.

---

## Appendix: Financial Year Reference

| Label | Start | End |
|---|---|---|
| 2022-23 | 2022-04-01 | 2023-03-31 |
| 2023-24 | 2023-04-01 | 2024-03-31 |
| 2024-25 | 2024-04-01 | 2025-03-31 |
| 2025-26 | 2025-04-01 | 2026-03-31 |

---

## Summary: Phase Order & Dependencies

```
Phase 1: Foundation (FastAPI setup, DB connection, auth, Redis)
    ↓
Phase 2: Dashboard APIs (most visible, builds confidence)
    ↓
Phase 3: Financial Reports (P&L, BS, TB, CF) — most complex
    ↓
Phase 4: Sales & Purchase (depends on voucher queries from Phase 3)
    ↓
Phase 5: Cash & Bank (depends on ledger queries from Phase 3)
    ↓
Phase 6: Inventory (independent — can run parallel with Phase 5)
    ↓
Phase 7: GST & Analytics (depends on Phase 3 & 4 being correct)
    ↓
Phase 8: Frontend Integration (replace all mocks — depends on Phases 2-7)
    ↓
Phase 9: Production Hardening (optimization, security, Docker)
```

**Estimated Total Duration: 25-35 working days** depending on database complexity and team size. A solo developer working full-time should target 6-7 weeks. With two developers (one backend, one frontend), 4 weeks is realistic.

---

*Document generated for LiveTally / FinBook Advisors LLP*
*Based on thorough analysis of the frontend codebase as of June 2026*
