# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Three sibling projects, each with its own tooling — this is **not** a monorepo with a shared package manager.

| Directory | Stack | Purpose |
|---|---|---|
| `Backend/` | FastAPI + PyMongo/Motor | Single API server hosting **both** products under different prefixes |
| `livetally/` | React 19 + Vite 8 + TanStack Query + Tailwind 4 | "aman" product — LiveTally financial reports UI, talks to `/api/v3` |
| `python_service/` | React 19 + Vite 8 + Zustand + Axios | "anjalee" product — Finbook.ai accounting-automation UI, talks to `/api/v2` |
| `Jsondata/` | — | Sample/reference data dumps |

The two frontends are unrelated apps served on different domains in production; they only share a backend host.

## Common commands

### Backend (`Backend/`)
```powershell
# activate venv (Windows)
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# dev server (reload on save) — health at http://127.0.0.1:8000/health
uvicorn app.main:app --reload

# run a single test / all accounting tests
python -m pytest app/aman/tests/test_accounting.py
python -m pytest app/aman/tests/test_accounting.py::test_dr_cr_debit_side
# tests also run standalone without pytest:
python -m app.aman.tests.test_accounting
```

### Frontends (`livetally/` and `python_service/`)
Both use the same script names — run them from their own directory:
```powershell
npm install
npm run dev       # Vite dev server with HMR
npm run build
npm run lint
npm run preview
```

## Big-picture architecture

### Two products in one FastAPI process

`Backend/app/main.py` mounts two independent routers:

- **anjalee** (`app.anjalee.routes.routes.api_router`) → `/api/v2/*` — owned by the anjalee project, powers `python_service/` frontend (accounting automation: sales/purchase/fundflow inbox→review→archive).
- **aman** (`app.aman.routes.routes.aman_api_router`) → `/api/v3/*` — owned by the aman project, powers `livetally/` frontend (financial reports, dashboards, AI CFO). This is the actively-developed surface — most new work is here.

Isolation between them is enforced at runtime by `require_aman_subscription` (in `app/aman/core/dependencies.py`), which checks the JWT `app` claim: an anjalee-issued token cannot reach any `/api/v3` route. **Do not cross-import** between `app.anjalee.*` and `app.aman.*`.

Within `/api/v3` there are two router tiers: public (`auth`, `/health`) and protected (everything else, subscription-gated in bulk in `routes.py`). The AI CFO lives in its own package `app.aman.ai_cfo` but is included on the protected router.

### Multi-tenant Mongo

Each company has its own database named `<TENANT_DB_PREFIX><company_id>` (default prefix `sf_tenant_`). The frontend sends `x-company-id` (any string — Mongo ObjectId, slug, or company name). Resolution rules:

- **Shared resolver** in `app/db.py` — used by anjalee routes. Rebuilds `sf_tenant_<id>` only for 24-char hex ObjectIds; other refs fall back to org lookup, then name scan, then `DEFAULT_DB_NAME`. Warms cache from `salesforecasting_system.organizations` at startup.
- **aman resolver** in `app/aman/core/dependencies.py` — wraps the shared one and adds a generic `sf_tenant_<any-id>` existence check with a 60-second TTL cache, so non-ObjectId ids (`natraj321`, etc.) resolve without hardcoding. Prefer this via `Depends(get_db)` inside `app.aman.*`.
- Tenant seed data (default company, alias map) comes from env vars only — **never hardcode a company id in source**. See `app/config.py` and `.env` (git-ignored; there is no committed `.env.example`).

Two background self-heal / setup steps run once per tenant DB per process:
1. **Voucher-origin backfill** (`services/tenant_normalize.ensure_voucher_origin`) — fills missing `voucherTypeOrigName` from the tenant's own `voucherTypes` master. Vital: every report classifies vouchers by the Tally reserved parent class `voucherTypeOrigName`, never by the company-specific `voucherTypeName`.
2. **Index creation** (`core/indexes.ensure_indexes`) — lazy; disable with `AMAN_ENSURE_INDEXES=false`.

### Reporting engine (`app/aman/services/`)

All reports derive from a single set of primitives in `services/accounting.py`. Golden rules for accounting math:
- **The sign of `ledgerEntry.amount` is the authoritative Dr/Cr indicator** (`amount < 0` → Debit, `amount > 0` → Credit). `isDeemedPositive` is Tally metadata and is wrong on ~6% of lines — **do not use it for math**.
- The same convention applies to ledger opening balances.
- Group hierarchy comes from `groups.parentGroupName` / `groups.groupPath` — never hardcoded.
- Financial statements are FY-scoped. FY strings are `"YYYY-YYYY"` (Indian FY: 1 Apr → 31 Mar). Utilities are in `services/financial_year.py`.

Services layer talks to Mongo via thin repositories in `app/aman/repositories/`. Routes are thin — they call services and wrap the result in the standard envelope.

### Response envelope

Every `/api/v3` (and most `/api/v2`) response is `{success, data, pagination?, meta?}`. Build via `app.aman.models.common.ok(...)` and `paginate(total, page, limit)`. The frontend `apiGet` unwraps `data` automatically; use `apiGetFull` when you need `pagination`/`meta`.

### Two-layer caching

- **Backend**: in-process TTL cache in `app/aman/core/cache.py`. Wrap expensive builders with `cached_report(tenant, report, builder, **params)`. Toggle globally with `AMAN_CACHE_ENABLED`; TTL via `AMAN_CACHE_TTL` (default 600s).
- **Frontend (LiveTally)**: TanStack Query in `livetally/src/queryClient.js` with per-report presets in `CACHE_TIMES` (`master`, `statement`, `dashboard`, `drilldown`). Prefer these over hand-rolled `useEffect` fetches.

### AI CFO (`app/aman/ai_cfo/`)

Standalone package with its own router, service, repository, providers, and rules engine — kept isolated so it can evolve without touching the reports layer. Uses OpenAI via stdlib (no `openai` sdk dep) with graceful-degrade fallback to local grounded answers. Streams via SSE from `POST /api/v3/ai-cfo/chat/stream`; the frontend consumes it with `apiStream` in `livetally/src/api/client.js`.

## Frontend architecture (LiveTally / `livetally/`)

- Entry `main.jsx` wraps `<App/>` in `QueryClientProvider`. `App.jsx` gates on a local `isAuthenticated`/`isDemoMode` state, then mounts `BrowserRouter` + `DateProvider`. Every page is `React.lazy`-imported so route chunks download on demand — keep this pattern when adding pages.
- **Financial year is global**: `DateProvider` (`context/DateContext.jsx`) fetches the FY list once via TanStack Query and exposes `{fy, years, selectFy}`. Read it with `useDateRange()` — do not fetch FYs per page.
- **API client** (`src/api/client.js`) auto-injects `x-company-id` (from `localStorage.aman_company_id`) and `Authorization: Bearer <aman_token>`, unwraps the envelope, and supports SSE (`apiStream`) and binary export (`apiDownload`). Add new endpoint helpers to `src/api/index.js`, not inline in components.
- Runtime config comes from Vite env vars in `src/config.js` (`VITE_API_BASE_URL`, `VITE_DEFAULT_COMPANY_ID`) — no hardcoded URLs or company ids.

## Frontend architecture (Finbook.ai / `python_service/`)

- Uses `createBrowserRouter` in `src/routes/index.jsx` with a central label→path map in `src/routes/routePaths.js` (the sidebar still emits string labels for legacy reasons).
- Global state via Zustand stores in `src/stores/` (`useAppStore` for auth+company, plus per-domain stores). Axios client in `src/lib/apiClient.js` attaches JWT + `X-Company-Id` and force-redirects to `/login` on 401.
- Env vars validated with Zod at startup in `src/config/env.js` — fail-fast on misconfigured `.env`.

## Conventions & gotchas

- **Never hardcode a company id or company name in source.** Everything company-specific is env-var-driven or resolved dynamically.
- **Classify vouchers by `voucherTypeOrigName`**, not `voucherTypeName`. If a tenant has null origins, the self-heal will backfill from the `voucherTypes` master on first request.
- Sales Register classification differs across tenants — derive amounts from `ledgerEntries` (see the classification services in `sales_register_service.py` / `purchase_register_service.py`).
- The Command Center dashboard **consumes report services** — don't re-aggregate via voucher `type_totals`. Follow the pattern in `dashboard_service.py`.
- Cash & Bank drill-down (`cashbank_drilldown_service.py`) is the reference architecture for new drill-downs — copy its shape rather than inventing a new one.
- Trial Balance does Tally-style group-level Dr/Cr netting; only bill-wise party groups show both sides.
- `livetally/` still has a few pages using bare `useEffect` fetches — the migration to TanStack Query is partial. New pages must use `useQuery`.


NOTE: Do not edit in the folders: python_service and in app/anjalee