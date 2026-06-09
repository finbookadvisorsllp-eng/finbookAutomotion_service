# LiveTally Backend — Implementation Report (`aman` project)

**Stack:** Python · FastAPI · PyMongo · Pydantic v2 · pure-stdlib JWT/PBKDF2/cache
**API prefix:** `/api/v3` (Anjalee `/api/v2` untouched)
**Code location:** `Backend/app/aman/` (only shared edit: one router-include block in `app/main.py`)
**Verified against live MongoDB:** tenant `sf_tenant_6a182ee36efd32db3c490a6c` (Friends Grafix) — 382 vouchers, 466 ledgers, 38 groups, 158 stock items. Data lives in **FY 2025-2026**.

---

## 1. Status: completed vs pending

### ✅ Completed (built + verified end-to-end)
| Area | Files | Verified |
|---|---|---|
| Foundation (serializers, JWT, PBKDF2, TTL cache, deps, FY util, models) | `core/*`, `models/common.py`, `services/financial_year.py`, `config.py` | imports + unit tests |
| Accounting core (`dr_cr`, opening/closing, group rollup, opening-stock) | `services/accounting.py`, `repositories/*` | **15/15 unit tests pass** |
| Trial Balance (+group/ledger/voucher drilldown) | `services/trial_balance_service.py`, `routes/reports_tb.py` | **TB ties out: Dr=Cr=24,770,378.43, diff 0.00** |
| Profit & Loss (+ledger & stock drilldowns) | `services/pl_service.py`, `routes/reports_pl.py` | revenue/gross/net computed live |
| Balance Sheet | `services/balance_sheet_service.py`, `routes/reports_bs.py` | **BS ties out: assets=liabilities=12,761,417.25, diff 0.00** |
| Sales register + Order/Credit/Delivery (Pattern B) | `services/transactions_service.py`, `routes/sales.py` | 145 sales rows; FG-01 detail exact |
| Purchase register + Order/Debit/Receipt | `routes/purchase.py` | 63 purchase rows |
| Customers/Vendors/Receivables/Payables/Credit-limit/Bills | `services/parties_service.py`, `routes/parties.py`, `routes/outstanding.py` | 122 customers, aging buckets |
| Cash & Bank (dashboard, ledger statement, running balance, cash-flow) | `services/cashbank_service.py`, `routes/cashbank.py`, `routes/reports_cashflow.py` | 4 accounts, balances |
| Inventory (summary, valuation WAC, fast/slow, alerts, item ledger) | `services/inventory_service.py`, `routes/inventory.py` | 158 items, valuation 2,350,740.89 |
| GST (summary, GSTR-1, GSTR-3B, rate-breakdown, HSN) | `services/gst_service.py`, `routes/reports_gst.py` | output 547,912 / ITC 231,404 / net 316,508 |
| Dashboard/Analytics/Alerts/Notifications | `services/dashboard_service.py`, `routes/{dashboard,analytics,alerts}.py` | KPIs vs prior FY |
| Day Book / Accounting registers (Journal/Payment/Receipt/Contra) | `routes/daybook.py`, `routes/accounting.py` | 381 vouchers |
| Setup (license, master-stats, company info) | `routes/setup.py` | live counts |
| Auth (JWT login/refresh/me) + subscription gate | `routes/auth.py`, `core/security.py`, `core/dependencies.py` | token issued & validated |
| Routing + wiring | `routes/routes.py`, `app/main.py` | **83 `/api/v3` routes, app boots** |
| Frontend API layer | `livetally/src/api/{client,index}.js`, `hooks/useApi.js`, `.env` | `npm run build` ✓ |
| Frontend pages converted to dynamic | `Login`, `DateContext`, `TrialBalance`, `SalesRegister`, `Customers` | build ✓ |

### ⏳ Pending (frontend page wiring only — backend APIs already exist for all)
Remaining LiveTally pages still import `src/data/*.js`. Each is a mechanical swap to the
documented pattern (Section 6); the backing endpoint already exists and is tested:
`Dashboard`, `ProfitLoss` (+8 drill levels), `BalanceSheet`, `CashFlow`, `GSTReports`,
`DayBook`, `OutstandingReports`, `Vendors`, `Receivables`, `Payables`, `CreditLimit`,
`BillsDue`, `PurchaseRegister`, `SalesOrder`, `CreditNote`, `DeliveryNote`,
`PurchaseOrder`, `DebitNote`, `ReceiptNote`, `PurchaseTrends`, `SalesAnalysis`,
`Inventory` (+Slow/Fast/Valuation/Alerts/Performance), `CashBankModule`, `Analytics`,
`Alerts`, `Notifications`, `TallySetup`.

> Note: backend dev-mode auth (`AMAN_AUTH_MODE=dev`) accepts any credentials and tolerates
> missing tokens, so unconverted pages keep working while you migrate page-by-page.

---

## 2. Key accounting findings (verified on live data — important for correctness)

1. **Dr/Cr sign rule (universal):** the **sign of `amount`** is authoritative — `amount < 0` = Debit, `amount > 0` = Credit. **All 381 vouchers balance** under this rule; only 348 balance under Tally's `isDeemedPositive` flag (it disagrees on ~6% of lines, e.g. negative round-offs). The same rule applies to `ledgers.balances.openingBalance` (its `type` field is unreliable — always "DEBIT"). Implemented in `accounting.dr_cr`, `ledger_repo.opening_balance`, and the Mongo movement pipeline.
2. **Opening stock injection:** stock value lives in `stockItems.inventory.openingStock.value` (not as a ledger), summing to a 6,839,263.71 debit. Injecting it as a Current-Asset `Stock-in-Hand` debit makes the **Trial Balance tie out exactly**.
3. **Balance Sheet algebra (proven & verified):** `Assets(excl stock) + ClosingStock = Liabilities + Capital + NetProfit`. Closing stock uses Weighted-Average-Cost (matches `stockGroups.valuationMethod = "Avg. Price"`); the brought-forward `Profit & Loss A/c` ledger (group classification `None`) is routed to equity so BS diff = 0.00.

---

## 3. Architecture (separation & multi-tenancy)

- **Tenant isolation:** reuses shared read-only `app/db.py::get_db` (header `x-company-id` → `sf_tenant_<id>`). No change to shared resolver.
- **App isolation:** `/api/v3` is gated by `require_aman_subscription`, which asserts the JWT `app == "aman"` claim — an Anjalee token (`app:"anjalee"`) is rejected with 403. Auth (`app/aman/core/security.py`) is pure-stdlib HS256 + PBKDF2 → **zero new dependencies**, so shared `requirements.txt` is untouched.
- **Layering:** `routes → services → repositories → Mongo`. Routes hold no accounting math; services hold no HTTP; repositories hold no business rules.
- **Caching:** in-process TTL cache (`core/cache.py`, default 600s) keyed by `(tenant, report, fy, params)`; swap for Redis when scaling (same API).
- **Merge-conflict safety:** all new code under `app/aman/`; the only shared edit is a clearly-delimited 4-line include block appended after Anjalee's in `app/main.py`.

---

## 4. API catalogue (83 routes, all `/api/v3`)

All accept header `x-company-id` and (where relevant) `?fy=YYYY-YYYY`. Lists accept `?page=&limit=&search=`.

**Auth** `POST /auth/login` · `POST /auth/refresh` · `GET /auth/me`
**Company/Setup** `GET /companies` · `/companies/current` · `/companies/current/financial-years` · `/companies/current/master-data` · `/setup/license` · `/setup/master-stats` · `/setup/company-info`
**Dashboard** `/dashboard/overview` · `/kpis` · `/monthly-trend` · `/expense-breakdown` · `/recent-vouchers` · `/top-customers` · `/top-vendors` · `/top-items`
**Analytics/Alerts** `/analytics/overview` · `/analytics/revenue-trends` · `/analytics/expense-trends` · `/alerts` · `/notifications`
**Reports** `/reports/trial-balance` (+`/group/{id}/ledgers`, `/ledger/{id}/vouchers`) · `/reports/profit-loss` (+`/ledger/{id}/vouchers`, `/stock/items`, `/stock-item/{item}/ledger`) · `/reports/balance-sheet` · `/reports/cash-flow` · `/reports/daybook` · `/reports/outstanding/{receivables,payables}` · `/reports/voucher/{ident:path}` · `/reports/gst/{summary,gstr1,gstr3b,rate-breakdown,hsn-summary}`
**Sales** `/sales` · `/sales/stats` · `/sales/analysis` · `/sales/order(+/month/{m})` · `/sales/credit-note(+/month/{m})` · `/sales/delivery-note(+/month/{m})` · `/sales/{ident:path}`
**Purchase** `/purchase` · `/purchase/stats` · `/purchase/trends` · `/purchase/order(+/month/{m})` · `/purchase/debit-note(+/month/{m})` · `/purchase/receipt-note(+/month/{m})` · `/purchase/{ident:path}`
**Parties** `/parties/customers` · `/parties/vendors` · `/parties/receivables` · `/parties/payables` · `/parties/credit-limit` · `/parties/bills-due` · `/parties/{type}/{id}`
**Cash&Bank** `/cash-bank/dashboard` · `/cash-bank/ledger/{id}` · `/cash-bank/voucher/{ident:path}`
**Inventory** `/inventory` · `/inventory/{slow,fast,valuation,alerts}` · `/inventory/item/{name}/performance`
**Accounting** `/accounting/{journal,payment,receipt,contra}` · `/accounting/voucher/{ident:path}`

> Voucher-detail routes use a `:path` converter because Tally voucher numbers contain `/` (e.g. `FG-145/2025-26`). ObjectId also works.

---

## 5. Database mappings (collection → report)

| Collection | Used for |
|---|---|
| `vouchers` (`ledgerEntries[]`, `inventoryEntries[]`, `dates.date`, `totals`, `gstDetails`) | every movement-based figure: TB/PL/BS movements, registers, drilldowns, cash-bank, GST, inventory movement |
| `ledgers` (`groupName`, `groupPath`, `balances.openingBalance`, `partyDetails`) | opening balances, group mapping, customers/vendors, cash/bank accounts |
| `groups` (`nature.classification`, `affectsGrossProfit/NetProfit`, `parentGroupName`) | TB rollup, P&L bucketing, BS asset/liability split |
| `stockItems` (`inventory.openingStock`, `gstSettings`, `hsnSacDetails`) | inventory summary/valuation, opening/closing stock, HSN |
| `voucherTypes` | master-data, register filtering |
| `companies`, `tallyLicenseInfo`, `masterStats` | setup/company info |

---

## 6. Frontend mappings & conversion pattern

Infrastructure delivered: `src/api/client.js` (envelope unwrap + auth/tenant headers + fy param),
`src/api/index.js` (one function per endpoint), `src/hooks/useApi.js`, `src/context/DateContext.jsx`
(loads FY list, exposes `{fy, years, selectFy}`), `.env`.

**Pattern to convert any remaining page** (3 already done as reference — `TrialBalance`, `SalesRegister`, `Customers`):
```jsx
import { useDateRange } from '../context/DateContext'
import { useApi } from '../hooks/useApi'
import { getXxx } from '../api'

const { fy } = useDateRange()
const { data, loading, error } = useApi(() => getXxx(fy), [fy], { skip: !fy })
// replace `mockXxx` usages with `data` (same shape); add loading/error states
```

**Page → API function:**
| Page | API fn |
|---|---|
| Dashboard | `getDashboard(fy)` |
| ProfitLoss | `getProfitLoss(fy)` + `getPlLedgerVouchers` + `getPlStockItems` + `getVoucher` |
| BalanceSheet | `getBalanceSheet(fy)` |
| CashFlow | `getCashFlow(fy)` |
| GSTReports | `getGstSummary/Gstr1/Gstr3b/GstRateBreakdown/GstHsnSummary(fy)` |
| DayBook | `getDayBook(fy, date)` |
| OutstandingReports/Receivables/Payables | `getReceivables(fy)` / `getPayables(fy)` |
| Vendors | `getVendors(fy)` |
| CreditLimit | `getCreditLimit(fy)` · BillsDue `getBillsDue(fy)` |
| PurchaseRegister | `getPurchaseRegister(fy)` · stats `getPurchaseStats` |
| Sales/Purchase Order, Credit/Debit/Delivery/Receipt Note | `getSalesOrders`/`getCreditNotes`/`getDeliveryNotes`/`getPurchaseOrders`/`getDebitNotes`/`getReceiptNotes` + `*Month(m,fy)` for L2 + `getVoucher(id)` for L3 |
| SalesAnalysis / PurchaseTrends | `getSalesAnalysis(fy)` / `getPurchaseTrends(fy)` |
| Inventory + sub-pages | `getInventory`/`getSlowMoving`/`getFastMoving`/`getStockValuation`/`getStockAlerts(fy)` |
| CashBankModule | `getCashBankDashboard(fy)` → `getCashBankLedger(id,fy)` → `getVoucher(id)` |
| Analytics | `getAnalytics(fy)` · Alerts `getAlerts(fy)` · Notifications `getNotifications(fy)` |
| TallySetup | `getLicense()` / `getMasterStats()` / `getCompanyInfo()` |

---

## 7. How to run

```bash
# Backend
cd Backend
./venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
#  → Swagger at http://127.0.0.1:8000/docs ; health at /api/v3/health
#  → unit tests:  ./venv/Scripts/python -m app.aman.tests.test_accounting

# Frontend
cd livetally
npm run dev        # expects VITE_API_BASE_URL=http://127.0.0.1:8000/api/v3 (.env)
```
Env knobs: `AMAN_AUTH_MODE` (dev|prod), `AMAN_JWT_SECRET`, `AMAN_CACHE_TTL`, `AMAN_CACHE_ENABLED`.

---

## 8. Testing checklist

- [x] `dr_cr` / `net_balance` / FY utils / serializers — **15/15 unit tests pass**
- [x] Trial Balance ties out (Dr = Cr, diff 0.00) on live data
- [x] Balance Sheet ties out (assets = liabilities, diff 0.00)
- [x] P&L computes revenue/gross/net from groups.nature
- [x] Drill chain: TB group → ledger → voucher list → voucher detail (slash voucher numbers)
- [x] Known voucher FG-01/2025-26 detail exact (CGST/SGST 1477.98, grand 27589, HSN 481910)
- [x] Sales/Purchase registers, Customers/Vendors, Cash&Bank, Inventory, GST, Dashboard endpoints return data
- [x] Auth login issues JWT; `/auth/me` validates; `app` claim gate works
- [x] App boots with 83 `/api/v3` routes; Anjalee `/api/v2` untouched
- [x] `npm run build` succeeds with converted pages
- [ ] Convert remaining frontend pages (Section 1 pending list) — pattern in Section 6
- [ ] Harden auth to `prod` mode (bcrypt-style PBKDF2 users in `salesforecasting_system`)
- [ ] Confirm bill-wise allocations for exact (vs approximate) receivables aging
- [ ] Create Mongo indexes in production (see `backenddocument.md` §12)

---

## 9. Known limitations / data caveats

1. **Receivables/Payables aging is approximate** — `ledgerEntries.billAllocations` are empty in the source, so aging uses last-transaction age; responses carry `meta.dataCompleteness = "approximate"`.
2. **Order/Note documents are empty in the demo tenant** — the data has no `Sales Order`, `Credit Note`, `Debit Note`, `Purchase Order`, `Receipt Note` vouchers (only 5 `Delivery Challan`). Endpoints work and return `total: 0` correctly; they will populate for tenants that have such vouchers.
3. **Reorder levels / credit limits** are not in the source masters → stock alerts use a `closing ≤ 0` heuristic and credit-limit utilization is null unless a `creditLimit` field exists.
4. **Default FY** from the server clock is `2026-2027` (today 2026-06-08) which has no data; the frontend `DateContext` defaults to the latest FY returned by `/companies/current/financial-years` (`2025-2026`) instead.
