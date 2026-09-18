# Finbook Automation Service & LiveTally Platform

An enterprise-grade financial accounting, report automation, Tally integration, and AI CFO engine powered by FastAPI, MongoDB, React 19, and Vite.

---

## Table of Contents
1. [System Overview & Architecture](#system-overview--architecture)
2. [Project Folder & File Structure](#project-folder--file-structure)
   - [Root Level Documents](#root-level-documents)
   - [Backend Service (`/Backend`)](#backend-service-backend)
     - [Core & Shared Modules (`/app/core`, `/app/auth`, `/app/db.py`)](#core--shared-modules)
     - [Aman Product Domain (`/app/aman`)](#aman-product-domain-appaman)
     - [Anjalee Product Domain (`/app/anjalee`)](#anjalee-product-domain-appanjalee)
   - [LiveTally Frontend (`/livetally`)](#livetally-frontend-livetally)
   - [Finbook Automation Frontend (`/python_service`)](#finbook-automation-frontend-python_service)
3. [End-to-End System Workflows & Data Flows](#end-to-end-system-workflows--data-flows)
   - [Multi-Tenant Database Resolution](#1-multi-tenant-database-resolution)
   - [Authentication & Token Validation Flow](#2-authentication--token-validation-flow)
   - [Accounting Engine & Tally Math Rules](#3-accounting-engine--tally-math-rules)
   - [AI CFO & Business Health Intelligence Flow](#4-ai-cfo--business-health-intelligence-flow)
   - [Document Processing & Bulk Upload Workflow](#5-document-processing--bulk-upload-workflow)
4. [How to Run (Commands Guide)](#how-to-run-commands-guide)
   - [Backend Execution](#backend-execution)
   - [LiveTally Frontend Execution](#livetally-frontend-execution)
   - [Finbook Automation Frontend Execution](#finbook-automation-frontend-execution)
   - [Running Tests](#running-tests)
5. [Configuration, Environment Variables, IDs & Secrets](#configuration-environment-variables-ids--secrets)

---

## System Overview & Architecture

**Finbook Automation Service** is a dual-product monorepo setup housing two independent user-facing products served by a unified FastAPI backend engine:

1. **Aman Product ("LiveTally")** (`/livetally` UI & `/api/v3/*` Backend):
   - Executive dashboard, real-time financial statements (Balance Sheet, Profit & Loss, Trial Balance, Daybook, Cashflow, Outstanding), drill-down analytics, and AI CFO advisor.
2. **Anjalee Product ("Finbook.ai")** (`/python_service` UI & `/api/v2/*` Backend):
   - Automated accounting inbox, document OCR extraction, excel bulk voucher upload, master mapping engine, and Tally XML synchronization.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND APPLICATIONS                                  │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│   LiveTally (`/livetally`)               │   Finbook Automation (`/python_service`)    │
│   React 19 + Vite 8 + TanStack Query     │   React 19 + Vite 8 + Zustand + Axios       │
└────────────────────┬─────────────────────┴──────────────────────┬──────────────────────┘
                     │ HTTP / REST / SSE                          │ HTTP / REST
                     ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FASTAPI BACKEND (`/Backend`)                              │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│   `/api/v3/*` Router (Aman / LiveTally)  │   `/api/v2/*` Router (Anjalee / Finbook.ai) │
├──────────────────────────────────────────┴─────────────────────────────────────────────┤
│   Shared Core: Security (JWT), Multi-Tenant DB Resolver (`app/db.py`), IAM DB          │
└──────────────────────────────────────────┬─────────────────────────────────────────────┤
                                           │ PyMongo / Motor
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MONGODB CLUSTER                                      │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│   IAM Database (`iam`)                   │   Tenant DBs (`sf_tenant_<company_id>`)     │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## Project Folder & File Structure

### Root Level Documents
- [`CLAUDE.md`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/CLAUDE.md): Architecture overview and guidelines for developer agents.
- [`AI_CFO_AND_BUSINESS_HEALTH.md`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/AI_CFO_AND_BUSINESS_HEALTH.md): Comprehensive documentation on the AI CFO agent and Business Health score metrics.
- [`AI_CFO_AND_BUSINESS_HEALTH_WALKTHROUGH.md`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/AI_CFO_AND_BUSINESS_HEALTH_WALKTHROUGH.md): Flow walkthrough for AI CFO insights and SSE streams.
- [`CFO_REASONING_MODEL.md`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/CFO_REASONING_MODEL.md): Financial reasoning algorithms and decision tree rules.
- [`PRODUCTION_RISKS.md`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/PRODUCTION_RISKS.md) & [`REMEDIATION_REPORT.md`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/REMEDIATION_REPORT.md): Audit reports on deployment risk mitigations.
- [`STRESS_SCENARIOS.md`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/STRESS_SCENARIOS.md): Stress testing scenarios for large Tally databases.

---

### Backend Service (`/Backend`)

#### Core & Shared Modules
- [`Backend/.env`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/Backend/.env): Environment secrets, DB URI, JWT keys, and AI keys.
- [`Backend/requirements.txt`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/Backend/requirements.txt): Python dependencies (FastAPI, PyMongo, Motor, PyJWT, OpenPyXL, etc.).
- [`Backend/app/main.py`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/Backend/app/main.py): FastAPI entrypoint initializing middleware, CORS, background scheduler, and mounting `/api/v2` and `/api/v3` routes.
- [`Backend/app/config.py`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/Backend/app/config.py): System configuration loader parsing environment variables.
- [`Backend/app/db.py`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/Backend/app/db.py): Core database connection pool manager and tenant database resolver.
- [`Backend/app/auth/router.py`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/Backend/app/auth/router.py): Authentication endpoints for login, signup, token refresh, and credentials verification.
- [`Backend/app/core/security.py`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/Backend/app/core/security.py): JWT token creation, decoding, password hashing, and claim verification.
- [`Backend/app/core/dependencies.py`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/Backend/app/core/dependencies.py): FastAPI dependency injection for current user authentication and request context.

---

#### Aman Product Domain (`/app/aman`)
Powers the **LiveTally** financial reporting UI (`/api/v3/*`).

* **Routes (`app/aman/routes/`)**:
  - `routes.py`: Main router aggregator applying `require_aman_subscription` protection.
  - `accounting.py`: General ledger ledger entries and accounts master API.
  - `alerts.py`: Critical operational alerts and notifications.
  - `analytics.py`: Financial ratio calculations and analytics insights.
  - `auth.py`: LiveTally specific authentication checks.
  - `cashbank.py`: Cash and bank balance statement & drill-down endpoints.
  - `companies.py`: Multi-tenant company listing and switching API.
  - `dashboard.py`: Executive command center dashboard counters and metrics.
  - `daybook.py`: Daily accounting register daybook API with filtering and pagination.
  - `export.py`: Excel and PDF report export endpoints.
  - `inventory.py`: Stock items, inventory movement, and stock summary reports.
  - `outstanding.py`: Bill-wise receivables and payables aging analysis.
  - `parties.py`: Customer and vendor master accounts directory.
  - `purchase.py`: Purchase register and vendor invoice breakdown.
  - `reports_bs.py`: Balance Sheet report API.
  - `reports_cashflow.py`: Cash Flow statement API (Direct & Indirect methods).
  - `reports_gst.py`: GST summary and tax reconciliation endpoints.
  - `reports_pl.py`: Profit and Loss statement API.
  - `reports_tb.py`: Trial Balance Netting & Group-level statement API.
  - `sales.py`: Sales register, party-wise sales, and monthly trends.

* **Services (`app/aman/services/`)**:
  - `accounting.py`: Core financial balance math (`amount < 0` = Dr, `amount > 0` = Cr).
  - `balance_sheet_service.py`: Computes assets, liabilities, and equity trees.
  - `pl_service.py`: Computes revenue, direct/indirect expenses, and net profit.
  - `trial_balance_service.py`: Tally-compliant group netting algorithm.
  - `cashbank_drilldown_service.py`: Deep-dive transaction breakdown for bank & cash ledgers.
  - `dashboard_service.py`: High-level metrics aggregator for command center view.
  - `financial_year.py`: Utilities for Indian Financial Year calculation (`1 Apr` → `31 Mar`).
  - `tenant_normalize.py`: Self-healing background service ensuring `voucherTypeOrigName` mapping.

* **AI CFO & Business Health Engine (`app/aman/ai_cfo/` & `app/aman/business_health/`)**:
  - `ai_cfo/service.py`: Natural language Q&A engine over financial data using OpenAI / NVIDIA LLMs.
  - `ai_cfo/context_builder.py`: Extracts financial statements into LLM context prompts.
  - `ai_cfo/rules_engine.py`: Scans ledger anomalies, over-due payments, and working capital risks.
  - `business_health/service.py`: Computes 0-100 business score across 4 pillars (Liquidity, Profitability, Efficiency, Solvency).

---

#### Anjalee Product Domain (`/app/anjalee`)
Powers the **Finbook.ai** accounting automation UI (`/api/v2/*`).

* **Routes (`app/anjalee/routes/`)**:
  - `bulk_upload.py`: Handles Excel/CSV voucher imports with spreadsheet validation.
  - `masters.py`: Manages Tally Masters (Ledgers, Groups, Stock Items, Voucher Types).
  - `voucher.py`: Voucher creation, editing, approval, and status transitions.
  - `sales.py` & `purchase.py`: Inbox transaction handling for sales and purchases.
  - `ai_chat.py`: Intelligent assistant for invoice extraction and query handling.
  - `agent_platform.py`: Endpoint triggers for background automated AI agents.

* **Services (`app/anjalee/services/`)**:
  - `ocr_service.py`: Performs OCR text extraction on uploaded invoices and receipts.
  - `llm_service.py`: Invokes LLM models to parse unformatted document text into structured JSON.
  - `master_mapping_engine.py`: Maps external party names and items to internal Tally masters.
  - `spreadsheet_validator.py`: Validates uploaded Excel files against accounting schema rules.
  - `tally/`: XML payload generator for importing transactions into Tally Prime.

* **Agents (`app/anjalee/agents/`)**:
  - `daily_summary_agent.py`: Generates daily financial summaries for management.
  - `narration_quality_agent.py`: Scans voucher narrations for compliance and quality.
  - `platform.py`: Automated agent execution engine with dev date override support.

---

### LiveTally Frontend (`/livetally`)
- [`livetally/package.json`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/livetally/package.json): React 19, Vite 8, Lucide React, TanStack Query, Tailwind CSS 4.
- [`livetally/src/main.jsx`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/livetally/src/main.jsx): Application bootstrap wrapping the root with `QueryClientProvider`.
- [`livetally/src/App.jsx`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/livetally/src/App.jsx): Main router with lazy-loaded route components and global navigation layout.
- [`livetally/src/api/client.js`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/livetally/src/api/client.js): Axios HTTP client handling JWT injection, tenant header `x-company-id`, SSE streaming (`apiStream`), and binary downloads (`apiDownload`).
- [`livetally/src/context/DateContext.jsx`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/livetally/src/context/DateContext.jsx): Global financial year selector context provider (`useDateRange`).
- [`livetally/src/pages/`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/livetally/src/pages/): Contains UI views for Dashboard, Balance Sheet, Profit & Loss, Trial Balance, Daybook, Outstanding, Inventory, Cash & Bank, and AI CFO Chat.

---

### Finbook Automation Frontend (`/python_service`)
- [`python_service/package.json`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/python_service/package.json): React 19, Vite 8, Zustand, Axios, Lucide React.
- [`python_service/src/routes/index.jsx`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/python_service/src/routes/index.jsx): Application router setup using `createBrowserRouter`.
- [`python_service/src/stores/`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/python_service/src/stores/): Zustand global state management (`useAppStore` for auth & active tenant).
- [`python_service/src/lib/apiClient.js`](file:///c:/Users/anjal/Documents/finbookAutomotion_service/python_service/src/lib/apiClient.js): Axios instance for `/api/v2` endpoints with automatic 401 redirect handling.

---

## End-to-End System Workflows & Data Flows

### 1. Multi-Tenant Database Resolution
Every request sent to the API carries an `x-company-id` header (e.g. `x-company-id: company123`).

```
Client Request (with x-company-id header)
                 │
                 ▼
      app/db.py (get_tenant_db)
                 │
  ┌──────────────┴──────────────┐
  │ Checks sf_tenant_<id> cache  │
  └──────────────┬──────────────┘
                 │
        Does DB exist?
        ├── YES ──> Returns Motor database reference for `sf_tenant_<id>`
        └── NO  ──> Resolves org mapping via `iam.organizations` -> Returns tenant DB
```

### 2. Authentication & Token Validation Flow
1. User logs in via `/api/v3/auth/login` or `/api/v2/auth/login`.
2. Backend checks credentials in `iam.users`.
3. Backend issues a signed JWT containing:
   - `sub`: User ID
   - `email`: User email
   - `app`: Product scope (`"aman"` or `"anjalee"`)
4. Middleware dependency `require_aman_subscription` verifies that requests to `/api/v3/*` contain `app: "aman"`.

### 3. Accounting Engine & Tally Math Rules
- **Dr / Cr Balance Rule**: In the MongoDB `ledgerEntries` collection:
  - `amount < 0`: **Debit (Dr)**
  - `amount > 0`: **Credit (Cr)**
  - Note: `isDeemedPositive` from Tally XML is ignored for mathematical calculations because of ~6% edge-case inaccuracies.
- **Voucher Classification**: Vouchers are strictly classified using `voucherTypeOrigName` (the reserved Tally class like `Sales`, `Purchase`, `Payment`, `Receipt`, `Journal`, `Contra`), never using company-custom `voucherTypeName`.

### 4. AI CFO & Business Health Intelligence Flow
1. User asks a natural language financial question in LiveTally (`/live-cfo`).
2. Client initiates SSE stream to `/api/v3/ai-cfo/chat/stream`.
3. `context_builder.py` extracts recent Balance Sheet, P&L, and Cash Flow metrics for the current company.
4. Prompt is constructed and dispatched to NVIDIA / OpenAI LLM API.
5. Answer fragments stream in real time back to the frontend UI via Server-Sent Events.

### 5. Document Processing & Bulk Upload Workflow
1. User uploads invoice image/PDF or Excel voucher file in Finbook.ai (`python_service`).
2. `ocr_service.py` extracts raw text from PDF/Images.
3. `llm_service.py` parses unstructured text into structured voucher JSON schema.
4. `master_mapping_engine.py` maps party names and items to existing Tally masters in `sf_tenant_<company_id>`.
5. Created voucher enters `Inbox` state -> `Reviewed` state -> XML exported to Tally Prime.

---

## How to Run (Commands Guide)

### Backend Execution

Activate Python Virtual Environment and start Uvicorn server:

```powershell
# Open terminal in project root
cd Backend

# Option A: Recreate venv if project folder was renamed/moved (Fixes "Fatal error in launcher")
Remove-Item -Recurse -Force venv
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install / update dependencies (using python -m pip to bypass broken exe launchers)
python -m pip install -r requirements.txt

# Start Backend Development Server (listening on http://127.0.0.1:8000)
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

---

### LiveTally Frontend Execution

Run the LiveTally financial portal UI:

```powershell
# Navigate to livetally folder
cd livetally

# Install Node modules
npm install

# Start Vite Dev Server (usually on http://localhost:5173)
npm run dev

# Build for Production
npm run build

# Preview Production Build
npm run preview
```

---

### Finbook Automation Frontend Execution

Run the Finbook accounting automation UI:

```powershell
# Navigate to python_service folder
cd python_service

# Install Node modules
npm install

# Start Vite Dev Server
npm run dev

# Build for Production
npm run build
```

---

### Running Tests

Execute backend automated test suites:

```powershell
cd Backend
.\venv\Scripts\Activate.ps1

# Run all accounting tests
python -m pytest app/aman/tests/test_accounting.py

# Run specific test function
python -m pytest app/aman/tests/test_accounting.py::test_dr_cr_debit_side

# Run standalone without pytest runner
python -m app.aman.tests.test_accounting
```

---

## Configuration, Environment Variables, IDs & Secrets

### Backend Environment Variables (`Backend/.env`)

| Variable Name | Sample / Default Value | Purpose |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017/finbook_23aafff9731l1z7` | Connection string to MongoDB cluster |
| `IAM_DB_NAME` | `iam` | Authentication & user credentials database |
| `JWT_SECRET` | `finbook-shared-secret-key-39281a8b3d0` | Secret key used for signing & verifying JWT tokens |
| `NVIDIA_API_KEY` | `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` | API key for NVIDIA Hosted LLMs (Llama-3.1-8b) |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | LLM Base URL endpoint |
| `LLM_MODEL` | `meta/llama-3.1-8b-instruct` | LLM model identifier |
| `OPENROUTER_API_KEY` | `sk-or-v1-4bfd548af...` | Fallback OpenRouter LLM API key |
| `DEV_OVERRIDE_DATE` | `2024-04-15` | Fixed reference date for agent platform testing |
| `DEFAULT_SCHEDULED_TIME` | `17:43` | Schedule time for background AI analysis |
| `RUN_SCHEDULER_ON_STARTUP` | `true` | Enables automatic AI scheduler on startup |

---

### LiveTally Frontend Environment Variables (`livetally/.env`)

```ini
# Base URL for Aman Product backend endpoints
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v3

# Default tenant company ID (Optional fallback)
VITE_DEFAULT_COMPANY_ID=
```

---

### Finbook Automation Environment Variables (`python_service/.env`)

```ini
# Base URL for Anjalee Product backend endpoints
VITE_API_BASE_URL=http://127.0.0.1:5000/api/v2
```

---

### Default Credentials & Database Multi-Tenancy Naming
- **IAM Database**: `iam` (stores user profiles, password hashes, and company memberships).
- **Tenant Database Naming Pattern**: `sf_tenant_<company_id>` (e.g. `sf_tenant_demo`, `sf_tenant_64f1a2b3...`).
- **HTTP Header Authorization**:
  - `Authorization: Bearer <JWT_TOKEN>`
  - `x-company-id: <COMPANY_ID>`
