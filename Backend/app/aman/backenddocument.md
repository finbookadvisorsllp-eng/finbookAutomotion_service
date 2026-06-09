# LiveTally Backend Implementation Strategy (`aman` project)

**Audience:** Senior Python/FastAPI developer responsible for making the entire LiveTally frontend dynamic.
**Author's lens:** Written from the perspective of a Chartered Accountant who understands how Trial Balance, P&L, Balance Sheet, GST, Ledgers, Sales/Purchase registers, Credit/Debit/Delivery/Receipt Notes and drill-downs are *derived* from a Tally voucher database — combined with production backend architecture.

**Tech stack:** Python · FastAPI · MongoDB (PyMongo) · Pydantic v2
**API namespace for this project:** `/api/v3` (Anjalee owns `/api/v2` — do **not** touch it)
**Code location:** everything we build lives under `Backend/app/aman/`

---

## 0. TL;DR for the implementer

1. The frontend (`livetally/`) is **100% mock-data driven today** — there is not a single `fetch()` / `axios` / `import.meta.env` call in `src/`. Every page imports static objects from `src/data/*.js`. Our job: replace those imports with API calls that return the **same shapes**, backed by MongoDB.
2. The MongoDB database is a **real Tally export** with proper double-entry accounting: `groups`, `ledgers`, `vouchers` (with `ledgerEntries[]` + `inventoryEntries[]`), `stockItems`, `voucherTypes`, `stockGroups`, `godowns`, `companies`. **We never invent numbers — every report is an aggregation over `vouchers` + `ledgers` + `groups`.**
3. Build inside `Backend/app/aman/` only. Reuse the shared, read-only helpers (`app/db.py`, `app/config.py`). The **only** shared file we touch is `app/main.py`, and only to add **one** router-include line (Section 6).
4. Reports are not stored — they are **computed**. The same three primitives power almost every screen:
   - **Group → Ledger → Voucher list → Voucher detail** (Trial Balance, P&L, Balance Sheet, Ledger reports)
   - **Month → Voucher list → Voucher detail** (Sales/Purchase Order, Credit/Debit/Delivery/Receipt Notes)
   - **Account → Transactions → Voucher detail** (Cash & Bank)
5. Everything is filtered by **Financial Year (1 Apr → 31 Mar)** and scoped by **company/tenant** (already handled by `get_db` via the `x-company-id` header).

---

## 1. Frontend analysis — what we must serve

### 1.1 Current state
- React 19 + Vite + React Router v6 + Recharts + Tailwind v4.
- Routing is fully enumerated in `livetally/src/App.jsx`.
- Auth is a local boolean (`isAuthenticated` / `isDemoMode`) in `App.jsx` — no real backend.
- Global state: `src/context/DateContext.jsx` holds `selectedDateRange` (the Financial Year selector). This is the single most important cross-cutting filter — **every report API must accept a FY parameter**.
- Data lives in `src/data/`: `mockData.js`, `trialBalanceData.js`, `plDrillDownData.js`, `transactionsDrillDownData.js`, `cashBankDataV2.js`, etc. These files are the **de-facto API response contracts** — match their shapes exactly so the UI needs minimal changes.

### 1.2 Page → module inventory (from `App.jsx`)

| Route | Page component | Backend module | Primary collection(s) |
|---|---|---|---|
| `/` | Dashboard | dashboard | vouchers, ledgers (aggregates) |
| `/summary` | GenericReport | reports | vouchers |
| `/alerts`, `/notif` | Alerts, Notifications | alerts | vouchers, ledgers (derived) |
| `/reports/pl` | ProfitLoss (+ 8 drill levels) | reports/pl | vouchers, groups, ledgers, stockItems |
| `/reports/bs` | BalanceSheet | reports/bs | groups, ledgers, vouchers |
| `/reports/cf` | CashFlow | reports/cf | vouchers (cash/bank ledgers) |
| `/reports/gst` | GSTReports | reports/gst | vouchers.gstDetails, ledgers (Duties & Taxes) |
| `/reports/tb` | TrialBalance | reports/tb | groups, ledgers, vouchers |
| `/reports/daybook` | DayBook | reports/daybook | vouchers |
| `/reports/outstanding` | OutstandingReports | reports/outstanding | ledgers, vouchers.ledgerEntries.billAllocations |
| `/sales` | SalesRegister | sales | vouchers (voucherTypeName=Sales) |
| `/sales/order` | SalesOrder | sales/order | vouchers (Sales Order) |
| `/sales/credit-note` | CreditNote | sales/credit-note | vouchers (Credit Note) |
| `/sales/delivery-note` | DeliveryNote | sales/delivery-note | vouchers (Delivery Challan/Note) |
| `/sales/analysis` | SalesAnalysis | sales/analysis | vouchers |
| `/sales/customers` | Customers | parties/customers | ledgers (Sundry Debtors) |
| `/sales/receivables` | Receivables | parties/receivables | ledgers + bill allocations |
| `/sales/credit-limit` | CreditLimit | parties/credit-limit | ledgers |
| `/purchase` | PurchaseRegister | purchase | vouchers (Purchase) |
| `/purchase/order` | PurchaseOrder | purchase/order | vouchers (Purchase Order) |
| `/purchase/debit-note` | DebitNote | purchase/debit-note | vouchers (Debit Note) |
| `/purchase/receipt-note` | ReceiptNote | purchase/receipt-note | vouchers (Receipt Note) |
| `/purchase/vendors` | Vendors | parties/vendors | ledgers (Sundry Creditors) |
| `/purchase/payables` | Payables | parties/payables | ledgers + bill allocations |
| `/purchase/bills` | BillsDue | parties/bills | vouchers/bill allocations |
| `/purchase/trends` | PurchaseTrends | purchase/trends | vouchers |
| `/cash-bank` | CashBankModule (Dashboard/Ledger/Voucher) | cashbank | ledgers (Bank/Cash), vouchers |
| `/inventory` + 5 sub | Inventory, Slow/Fast/Valuation/Alerts/Performance | inventory | stockItems, vouchers.inventoryEntries |
| `/accounting/*` | Journal/Payment/Receipt registers | accounting | vouchers |
| `/analytics` | Analytics | analytics | vouchers (aggregates) |
| `/admin/*` | Administration | admin | salesforecasting_system (users/orgs/subscription) |
| `/setup` | TallySetup | setup | companies, masterStats, tallyLicenseInfo |

### 1.3 The three drill-down patterns (this is the heart of the app)

**Pattern A — Account hierarchy (Trial Balance, P&L, Balance Sheet, Ledger):**
`src/data/trialBalanceData.js` and `src/data/plDrillDownData.js` reveal the levels:
```
L1  Group summary           (Indirect Expenses: debit, credit, isExpandable)
L2  Ledger breakdown        (Audit Fees, Bank Charges …: debit, credit, isDrillable)
L3  Voucher list per ledger ({ id, date, type, refNo, amount, partyName })
L4  Voucher detail          (items[], taxes{}, totals{}, narration)  — or journal entries[]
L5  (inventory branch) Stock item → Stock-item ledger → Customer ledger
```

**Pattern B — Monthly transaction drill (Order/Note documents):**
`src/data/transactionsDrillDownData.js` shows a uniform shape reused by `SalesOrder`, `CreditNote`, `DeliveryNote`, `PurchaseOrder`, `DebitNote`, `ReceiptNote`:
```
L1  { total, months:[{id,label,amount}] }
L2  vouchers[monthId] = [{ id, date, name, type, amount, vehicle? }]
L3  voucherDetails[id] = { voucherNo, partyName, date, type, items[], summary[], grossTotal }
```

**Pattern C — Cash & Bank (`src/data/cashBankDataV2.js`):**
```
L1  dashboard[fy] = { summary, cashAccounts[], bankAccounts[], recentTransactions[], allAccounts[] }
L2  ledgers[accountId] = { openingBalance, currentBalance, transactions[ {receipts,payments,running} ], monthly[] }
L3  vouchers[voucherId] = { party{}, details{}, … }
```

> **Design takeaway:** build **one generic drill-down engine** and let each module configure it (which `voucherTypeName`s, which group/ledger filter). Don't write 30 bespoke endpoints with copy-pasted aggregation.

---

## 2. MongoDB data model — the source of truth

Database per tenant: `sf_tenant_<companyId>` (resolved by `app/db.py`). Collections observed in the export (`database/shared/*.json`):

### 2.1 `groups` (38 docs) — the chart-of-accounts skeleton
Key fields:
- `groupName`, `parentGroupName`, `groupPath` (e.g. `"Current Assets > Bank Accounts"`)
- `nature.classification` ∈ `{ASSETS, LIABILITIES, INCOME, EXPENSE, null}`
- `nature.subType` ∈ `{CURRENT_ASSETS, FIXED_ASSETS, CURRENT_LIABILITIES, CAPITAL_ACCOUNT, LONG_TERM_LIABILITIES, DIRECT_EXPENSE, INDIRECT_EXPENSE, DIRECT_INCOME, INDIRECT_INCOME, INVESTMENTS, …}`
- `nature.affectsGrossProfit` (bool), `nature.affectsNetProfit` (bool) ← **these directly drive P&L bucketing**
- `behaviour.isDebitPositive`, `behaviour.isRevenue`

> **CA note:** This is the Tally group tree. `affectsGrossProfit=true` groups (Sales, Purchase, Direct Exp/Inc, opening/closing stock) form the **Trading Account** (Gross Profit). `affectsNetProfit=true` but `affectsGrossProfit=false` (Indirect Exp/Inc) form the **Profit & Loss Account** below GP. Everything with a real `classification` of ASSETS/LIABILITIES belongs on the **Balance Sheet**.

### 2.2 `ledgers` (466 docs) — postable accounts
Key fields:
- `ledgerName`, `groupName`, `groupPath`, `ledgerType`
- `balances.openingBalance = { amount, type: "DEBIT"|"CREDIT", asOfDate }` ← **opening balance for TB/BS**
- `partyDetails = { gstin, panNumber, address[], gstRegistrationType, gstState, contactPerson, phone, email }` ← powers Customers/Vendors
- `flags.isBillWiseOn`, `taxDetails`, `tdsDetails`, `bankDetails`

> Sundry Debtors ledgers = **Customers**; Sundry Creditors = **Vendors**; Bank Accounts + Cash-in-Hand = **Cash & Bank** accounts; Duties & Taxes / GST INPUT / Output = **GST** ledgers.

### 2.3 `vouchers` (382 docs) — the transaction journal (double-entry)
Distinct `voucherTypeName` counts in the export: `Sales 145, Payment 98, Purchase 63, Receipt 62, Delivery Challan 5, Journal 4, Contra 4`.

Critical fields:
- `voucherNumber`, `voucherTypeName`, `partyLedgerName` / `partyName`, `narration`, `reference.reference`
- `dates.date` (the accounting date — **use this for FY filtering**), `dates.effectiveDate`
- `totals = { totalDebit, totalCredit, totalAmount, taxAmount, roundOff, itemCount }`
- `ledgerEntries[] = { ledgerName, amount, isDeemedPositive, billAllocations[], inventoryAllocations[] }`
- `inventoryEntries[] = { stockItemName, rate ("51.00/PCS"), actualQty ("483.00 PCS"), billedQty, amount, batchAllocations[], accountingAllocations[] }`
- `gstDetails = { partyGstin, cmpGstin, gstRegistration, placeOfSupply, stateName, isReverseChargeApplicable, isEligibleForItc, … }`

**Double-entry sign convention (verify on first run against a known voucher):**
In this export, for a Sales voucher the debtor line is `isDeemedPositive: true, amount: -27589` and the income/tax lines are `isDeemedPositive: false, amount: +24633`. So:
- **Debit side** = entries where `isDeemedPositive == true`
- **Credit side** = entries where `isDeemedPositive == false`
- **Magnitude** = `abs(amount)` (the stored sign is Tally's internal deemed-positive sign and is not reliable for display — always bucket by `isDeemedPositive` and take the absolute value).

> Build one helper `dr_cr(entry) -> (debit, credit)` and use it **everywhere**. This single function guarantees the whole reporting stack is internally consistent. Unit-test it against `Priya Enterprises / FG-01/2025-26` (Dr Priya 27589; Cr GST Sales 12% 24633, SGST 1477.98, CGST 1477.98, Round Off 0.04).

### 2.4 Supporting collections
- `stockItems` (158): `itemName`, `inventory.openingStock.{quantity,value,rate}`, `gstSettings`, `hsnSacDetails`, `unit.baseUnit`, `stockGroupName`, `pricing`.
- `stockGroups` (2), `godowns` (2), `voucherTypes` (26), `companies`, `currencies`, `tallyLicenseInfo`, `masterStats` (record counts per master type — useful for `/setup`).

---

## 3. The CA's derivation logic (report-by-report accounting math)

This section defines *what numbers mean* so the developer encodes the right aggregations. All movements come from `vouchers.ledgerEntries` (joined to `ledgers`→`groups`), opening balances from `ledgers.balances.openingBalance`.

### 3.1 Trial Balance (`/reports/tb`)
For the selected FY:
1. **Opening balance** per ledger from `ledgers.balances.openingBalance` (amount, DEBIT/CREDIT).
2. **Period movement** per ledger = sum of `dr_cr(entry)` over all `ledgerEntries` whose `ledgerName == ledger` and voucher `dates.date` ∈ FY.
3. **Closing per ledger** = opening ± movement; net into a single Dr or Cr figure.
4. **Roll up to group** via `ledgers.groupName` → top-level group from `groupPath` root. L1 rows = top-level groups (`isExpandable`), L2 = member ledgers (`isDrillable`).
5. `totalDebit == totalCredit` (must tie out — surface a `difference` field if not).

Shape to emit (matches `trialBalanceData.js`): `{ years[], data: { <fy>: { particulars:[{id,name,debit,credit,isExpandable,children:[{id,name,debit,credit,isDrillable}]}], totalDebit, totalCredit } } }`.

### 3.2 Profit & Loss (`/reports/pl`) — Trading + P&L account
Buckets (use `groups.nature`):
- **Revenue / Direct Income**: `classification=INCOME` (Sales Accounts, Direct Incomes) → credit.
- **Opening Stock** (Dr) and **Closing Stock** (Cr) from `stockItems` valuation at FY start/end (see 3.7).
- **Purchases / Direct Expenses**: `classification=EXPENSE & affectsGrossProfit=true` → debit.
- **Gross Profit** = (Sales + Closing Stock) − (Opening Stock + Purchases + Direct Expenses).
- **Indirect Incomes** (`affectsGrossProfit=false & classification=INCOME`) added; **Indirect Expenses** (`affectsGrossProfit=false & classification=EXPENSE`, includes **Audit Fees**, Bank Charges, Depreciation, Interest) subtracted.
- **Net Profit** = GP + Indirect Income − Indirect Expense.

Emit the `plDrillDownData.js` shape: `years[].particulars[].{name, sign:'+'|'-', amount, ledgers:[{name,debit,credit}]}` plus drill maps `vouchers{}`, `voucherDetails{}`, `stockItems{}`, `stockItemLedger{}`, `stockItemCustomerLedger{}`.

### 3.3 Balance Sheet (`/reports/bs`)
- **Assets** = ledgers under groups `classification=ASSETS` (Fixed Assets, Current Assets incl. Closing Stock, Sundry Debtors, Cash/Bank, Loans & Advances, Investments) — closing debit balances.
- **Liabilities** = `classification=LIABILITIES` (Capital, Reserves, Loans, Sundry Creditors, Duties & Taxes, Provisions) — closing credit balances.
- **Current-period Net Profit** (from 3.2) flows into Capital/Reserves side; carry-forward via `Profit & Loss A/c` ledger.
- Assets total must equal Liabilities total.

### 3.4 GST Reports (`/reports/gst`)
- **Output tax (GSTR-1 basis):** from Sales/Credit-Note vouchers — `gstDetails` + tax ledgers (`CGST Output`, `SGST Output`, `IGST Sales`, `GST Sales 12/18%`). Group by rate slab and by `placeOfSupply` (intra vs inter-state → CGST+SGST vs IGST).
- **Input tax credit (ITC):** from Purchase/Debit-Note vouchers — `GST INPUT` group ledgers; respect `gstDetails.isEligibleForItc`.
- **Net payable (GSTR-3B basis)** = Output − ITC.
- Rate breakdown table = group `inventoryEntries`/tax ledgers by slab (5/12/18/28). HSN summary from `stockItems.hsnSacDetails` + `inventoryEntries`.

### 3.5 Sales / Purchase registers and Order/Note documents
- Filter `vouchers` by `voucherTypeName`:
  - Sales register → `Sales`; Sales Order → `Sales Order`; Credit Note → `Credit Note`; Delivery Note → `Delivery Challan`/`Delivery Note`.
  - Purchase register → `Purchase`; Purchase Order → `Purchase Order`; Debit Note → `Debit Note`; Receipt Note → `Receipt Note`.
- Register row = `{ id:voucherNumber, date, party:partyLedgerName, items:itemCount, taxable, gst, total:totals.totalDebit, status, payMode }`.
  - `taxable` = sum of `inventoryEntries.amount` (or non-tax ledger lines); `gst` = sum of tax-ledger lines; derive `status` from bill allocation settlement (see 3.6) — default `paid/pending/overdue`.
- The Order/Note pages use **Pattern B** (monthly drill) → group by `MMM YY` of `dates.date`.

### 3.6 Receivables / Payables / Outstanding / Bills Due
- **Receivables** = closing debit balances of Sundry Debtors ledgers; **Payables** = closing credit balances of Sundry Creditors.
- **Aging buckets (0–30 / 31–60 / 61–90 / 90+):** from `ledgerEntries.billAllocations` (bill ref + due date) when present. ⚠ In the sample export `billAllocations` is often empty — **fallback:** age by voucher `dates.date` vs report date, and flag data-completeness in the response so the UI can show a notice. Confirm with the data owner whether bill-wise data is populated in the live DB.
- **Bills Due** = open bills (unsettled allocations) sorted by due date.

### 3.7 Inventory (`/inventory` + sub-pages)
- **Opening** from `stockItems.inventory.openingStock.{quantity,value,rate}`.
- **Inward/Outward** from `vouchers.inventoryEntries` (parse `actualQty` like `"483.00 PCS"` → number + unit; `rate` like `"51.00/PCS"`). Purchase/Receipt = IN; Sales/Delivery = OUT.
- **Closing qty** = opening + in − out; **Closing value** = qty × valuation rate (`stockGroups.valuationMethod`/`stockItems.pricing` → default Avg).
- **Fast/Slow moving** = rank by outward qty over the FY; **Stock alerts** = closing qty below reorder (reorder not in export → make configurable / fallback heuristic); **Item performance** = sales value & margin per item.

### 3.8 Cash & Bank (`/cash-bank`)
- Accounts = ledgers in groups `Bank Accounts` + `Cash-in-Hand`.
- Per-account **transactions** = vouchers (`Payment`/`Receipt`/`Contra`) containing a `ledgerEntries` line for that ledger; classify `receipts` vs `payments` via `dr_cr`; compute **running balance** ordered by date.
- Dashboard summary = current balances, today's receipts/payments, pending cheques (from `bankDetails`/instrument fields if available).

### 3.9 Day Book / Journal / Payment / Receipt registers
- Day Book = all vouchers for a date range, newest first, each with net amount + Dr/Cr lines.
- Accounting registers = filter by `voucherTypeName` (`Journal`, `Payment`, `Receipt`).

### 3.10 Dashboard / Analytics / Alerts
- KPIs (Sales, Purchase, Receivables, Payables, Cash & Bank, Net Profit) = roll-ups of the above for current FY vs previous FY (`change`, `trend`, `sparkData` = 12-month series).
- Alerts/Notifications = derived rules (overdue receivables, low stock, GST due dates) computed server-side.

---

## 4. Multi-app, multi-tenant architecture

Two concerns are orthogonal — keep them separate:

1. **Tenant isolation (which company's data):** already solved by `app/db.py::get_db`, which reads `x-company-id` / `x-company` header and returns `client[sf_tenant_<id>]`. **Reuse it as-is.** It is read-only shared infrastructure; importing it creates no merge conflict.
2. **Application isolation (aman vs anjalee):** achieved by **route prefix + folder separation + subscription claim**:
   - Anjalee → `/api/v2` (their folder `app/anjalee/`).
   - Aman → `/api/v3` (our folder `app/aman/`).
   - A JWT/subscription claim `app: "aman"` gates `/api/v3` (Section 9).

> Both apps share one process, one Mongo client, one connection pool, one tenant resolver — but their **business code never imports across the `aman`/`anjalee` boundary**. Shared = only `app/db.py`, `app/config.py`, and the router-include line in `app/main.py`.

### Merge-conflict avoidance rules
- Never edit files under `app/anjalee/`.
- All new files under `app/aman/`. Two devs editing disjoint folders = no conflicts.
- The single shared edit (`app/main.py`) is one append-only line in a clearly delimited block (Section 6). Put the aman include **after** the anjalee include with a banner comment so git 3-way merge resolves cleanly.
- If `requirements.txt` needs new deps (e.g. `python-jose`, `passlib`, `cachetools`), append at the end — never reorder existing lines.

---

## 5. Proposed `aman` folder structure

```
Backend/app/aman/
├── __init__.py
├── backenddocument.md                ← this file
├── routes/
│   ├── __init__.py
│   ├── routes.py                      ← aman_api_router = APIRouter(prefix="/api/v3"); includes all below
│   ├── auth.py                        ← /api/v3/auth/*
│   ├── companies.py                   ← /api/v3/companies/*  (+ master-data, fy list)
│   ├── dashboard.py                   ← /api/v3/dashboard/*
│   ├── reports_tb.py                  ← /api/v3/reports/trial-balance/*
│   ├── reports_pl.py                  ← /api/v3/reports/profit-loss/*
│   ├── reports_bs.py                  ← /api/v3/reports/balance-sheet
│   ├── reports_gst.py                 ← /api/v3/reports/gst/*
│   ├── reports_cashflow.py            ← /api/v3/reports/cash-flow
│   ├── daybook.py                     ← /api/v3/reports/daybook
│   ├── outstanding.py                 ← /api/v3/reports/outstanding/*
│   ├── sales.py                       ← /api/v3/sales/*  (register, order, credit-note, delivery-note, analysis)
│   ├── purchase.py                    ← /api/v3/purchase/* (register, order, debit-note, receipt-note, trends)
│   ├── parties.py                     ← /api/v3/parties/* (customers, vendors, receivables, payables, credit-limit, bills)
│   ├── cashbank.py                    ← /api/v3/cash-bank/*
│   ├── inventory.py                   ← /api/v3/inventory/*
│   ├── accounting.py                  ← /api/v3/accounting/* (journal/payment/receipt)
│   ├── analytics.py                   ← /api/v3/analytics/*
│   ├── alerts.py                      ← /api/v3/alerts, /api/v3/notifications
│   └── setup.py                       ← /api/v3/setup/* (tally license, master stats)
├── services/                         ← all accounting logic lives here (testable, no FastAPI imports)
│   ├── __init__.py
│   ├── accounting.py                  ← dr_cr(), opening_balance(), ledger_closing(), group_rollup()
│   ├── financial_year.py             ← FY parsing + date-range resolution
│   ├── trial_balance_service.py
│   ├── pl_service.py
│   ├── balance_sheet_service.py
│   ├── gst_service.py
│   ├── sales_service.py
│   ├── purchase_service.py
│   ├── parties_service.py
│   ├── cashbank_service.py
│   ├── inventory_service.py
│   ├── drilldown_service.py           ← the generic Group→Ledger→Voucher / Month→Voucher engine
│   └── dashboard_service.py
├── repositories/                     ← thin Mongo access (one place that knows collection names + builds pipelines)
│   ├── __init__.py
│   ├── voucher_repo.py
│   ├── ledger_repo.py
│   ├── group_repo.py
│   └── stock_repo.py
├── models/                           ← Pydantic response/request schemas (the API contracts from Section 1.3)
│   ├── __init__.py
│   ├── common.py                      ← ApiResponse envelope, Pagination, FY models
│   ├── reports.py
│   ├── transactions.py
│   └── parties.py
├── core/
│   ├── __init__.py
│   ├── security.py                    ← JWT create/verify, password hashing
│   ├── dependencies.py               ← require_aman_subscription, get_current_user, get_fy
│   ├── serializers.py                ← serialize_doc (ObjectId/datetime → str), money rounding
│   └── cache.py                       ← TTL cache wrappers + key builders
└── config.py                         ← aman-specific settings (JWT secret, cache TTLs, slab map) reading from .env
```

**Layering rule (enforce in review):** `routes → services → repositories → Mongo`. Routes contain **no** accounting math; services contain **no** FastAPI/HTTP; repositories contain **no** business rules. This is what makes it scalable and refactor-safe.

---

## 6. Wiring into the shared app (the only shared edit)

`app/aman/routes/routes.py`:
```python
from fastapi import APIRouter, Depends
from app.aman.core.dependencies import require_aman_subscription
from . import (auth, companies, dashboard, reports_tb, reports_pl, reports_bs,
               reports_gst, reports_cashflow, daybook, outstanding, sales,
               purchase, parties, cashbank, inventory, accounting, analytics,
               alerts, setup)

# Public (no subscription gate): auth + health. Everything else is gated.
aman_api_router = APIRouter(prefix="/api/v3")
aman_api_router.include_router(auth.router)

protected = APIRouter(dependencies=[Depends(require_aman_subscription)])
for m in (companies, dashboard, reports_tb, reports_pl, reports_bs, reports_gst,
          reports_cashflow, daybook, outstanding, sales, purchase, parties,
          cashbank, inventory, accounting, analytics, alerts, setup):
    protected.include_router(m.router)
aman_api_router.include_router(protected)
```

`app/main.py` — add exactly one delimited block (do not modify anjalee's line):
```python
# ─────────── AMAN (LiveTally) routes — /api/v3 ───────────
from app.aman.routes.routes import aman_api_router
app.include_router(aman_api_router)
# ─────────────────────────────────────────────────────────
```

> CORS, startup cache warm-up, and the Mongo client are already configured in `main.py` — we inherit them. No further shared changes needed.

---

## 7. Response & serialization conventions

Match Anjalee's existing convention so the frontend client is uniform:

```python
# core/serializers.py — every Mongo doc passes through this
def serialize_doc(doc): ...   # _id→str, ObjectId→str, datetime→isoformat

# models/common.py
class ApiResponse(BaseModel):
    success: bool = True
    data: Any | None = None
    pagination: dict | None = None
    meta: dict | None = None     # e.g. {"fy":"2024-2025","dataCompleteness":"partial"}
```

Standard envelope: `{ "success": true, "data": …, "pagination": {…}, "meta": {…} }`. Errors: raise `HTTPException` → global handler returns `{ "success": false, "error": {code,message} }`.

**Money:** round to 2 decimals at the service boundary. **Dates:** return ISO `YYYY-MM-DD` for data, but also provide the display string (`"01 Apr 2025"`) where the mock data uses it, so UI tables render unchanged.

---

## 8. Financial-Year filtering (cross-cutting)

`services/financial_year.py`:
```python
def fy_bounds(fy: str) -> tuple[datetime, datetime]:
    # fy = "2024-2025"  → (2024-04-01 00:00, 2025-03-31 23:59:59)
    start_year = int(fy.split("-")[0])
    return datetime(start_year,4,1), datetime(start_year+1,3,31,23,59,59)
```
- Every report endpoint accepts `?fy=2024-2025` (default = current FY from server clock; for the demo data the relevant FYs are 2023-2024 … 2026-2027).
- `GET /api/v3/companies/current/financial-years` returns the selectable list (derive from min/max `vouchers.dates.date`, or the fixed list the UI shows in `trialBalanceData.years`).
- Filter is always `{"dates.date": {"$gte": start, "$lte": end}}`.
- Opening balances for a non-first FY = prior-FY closing (carry-forward) — compute by chaining, or read `ledgers.balances.openingBalance` for the earliest FY and roll forward. Document the chosen approach in `accounting.py`.

---

## 9. Authentication, authorization & subscription

**Strategy:** stateless JWT (HS256) issued by `/api/v3/auth/login`.

Token claims:
```json
{ "sub":"<userId>", "email":"…", "app":"aman",
  "subscriptionTier":"pro", "modules":["reports","sales","inventory",…],
  "companies":["6a182ee36efd32db3c490a6c", …], "exp":… }
```

Dependencies (`core/dependencies.py`):
- `get_current_user` — decode + validate JWT (Bearer header).
- `require_aman_subscription` — assert `claims.app == "aman"` and subscription active/not expired → **this is what isolates the two products**. Anjalee tokens (`app:"anjalee"`) cannot call `/api/v3`, and vice-versa.
- `require_module("inventory")` — optional finer gate for tier-based feature access.
- `get_fy` — parse/validate `fy` query param.

Where users/subscriptions live: `salesforecasting_system` DB (already used by `db.py` for orgs). Add an `aman_users` / `subscriptions` collection there (or reuse existing org/user collections — confirm with data owner). **Do not** create per-tenant auth; auth is global, data access is per-tenant via header.

> For initial integration you may keep the Anjalee-style dev stub (`auth.py` returns a token for any credentials) behind an `ENV=dev` flag, then harden to real bcrypt + user lookup before production. Gate the switch with `settings.AUTH_MODE`.

---

## 10. Drill-down engine (build once, reuse everywhere)

`services/drilldown_service.py` exposes a small, configurable API consumed by the report/transaction routers:

```python
def group_summary(db, fy, classification=None, affects=None) -> list[GroupRow]      # L1
def ledger_breakdown(db, fy, group_name) -> list[LedgerRow]                          # L2
def voucher_list_for_ledger(db, fy, ledger_name, page, limit) -> list[VoucherRow]    # L3
def voucher_detail(db, voucher_id_or_number) -> VoucherDetail                        # L4

# Pattern B (monthly)
def monthly_summary(db, fy, voucher_type) -> {total, months[]}                       # L1
def voucher_list_for_month(db, fy, voucher_type, month_id) -> [VoucherRow]           # L2
```

Each consumes the shared `dr_cr()` and `voucher_detail()` mapper. The mapper converts a raw voucher into the UI shape:
- if `inventoryEntries` present → `items[]` (`{srNo,name,hsn,qty,unit,rate,grossRate,discount,amount}`) + `taxes{cgst,sgst,igst,roundOff}` + `totals.grandTotal`.
- if purely accounting (Journal/Payment/Receipt) → `entries[]` (`{srNo,partyName,amount,isDr}`) / `bills[]` / `paymentDetails[]` exactly as `plDrillDownData.voucherDetails` shows.

This single mapper guarantees **every** drill-down across TB, P&L, Sales, Purchase, Cash & Bank renders identically.

---

## 11. API catalogue (endpoint → page → pipeline)

> All under `/api/v3`. All accept `x-company-id` header + `?fy=`. List endpoints accept `?page=&limit=&search=&status=`.

**Auth / Company / Setup**
- `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
- `GET /companies` · `GET /companies/current/master-data` (ledgers, stock items, voucher types — mirror Anjalee's version) · `GET /companies/current/financial-years`
- `GET /setup/license` (`tallyLicenseInfo`) · `GET /setup/master-stats` (`masterStats`)

**Dashboard / Analytics / Alerts**
- `GET /dashboard/kpis` → `mockData.kpiData` shape (current vs previous FY)
- `GET /dashboard/monthly-trend` → `monthlyTrend` · `GET /dashboard/expense-breakdown` → `expenseBreakdown`
- `GET /dashboard/recent-vouchers` · `GET /dashboard/top-customers` · `GET /dashboard/top-vendors` · `GET /dashboard/top-items`
- `GET /analytics/*` (budget-vs-actual, revenue/expense trends)
- `GET /alerts` · `GET /notifications`

**Reports**
- `GET /reports/trial-balance` → full TB tree (`trialBalanceData` shape)
- `GET /reports/trial-balance/group/{groupId}/ledgers` · `GET /reports/trial-balance/ledger/{ledgerId}/vouchers` · `GET /reports/voucher/{id}`
- `GET /reports/profit-loss` → `plDrillDownData` shape (years + particulars)
- `GET /reports/profit-loss/ledger/{id}/vouchers` · `/stock/{id}/items` · `/stock-item/{id}/ledger` · `/stock-item/customer/{id}`
- `GET /reports/balance-sheet`
- `GET /reports/gst/summary` · `/gst/gstr1` · `/gst/gstr3b` · `/gst/rate-breakdown` · `/gst/hsn-summary`
- `GET /reports/cash-flow`
- `GET /reports/daybook?date=` 
- `GET /reports/outstanding/receivables` · `/outstanding/payables` (with aging buckets)

**Sales / Purchase (registers + Pattern-B docs)**
- `GET /sales` (register) · `GET /sales/stats` · `GET /sales/{id}`
- `GET /sales/order` · `/sales/order/month/{m}` · `GET /sales/credit-note*` · `GET /sales/delivery-note*` · `GET /sales/analysis`
- `GET /purchase` · `GET /purchase/stats` · `GET /purchase/{id}`
- `GET /purchase/order*` · `GET /purchase/debit-note*` · `GET /purchase/receipt-note*` · `GET /purchase/trends`

**Parties**
- `GET /parties/customers` · `GET /parties/customers/{id}` (ledger + ageing)
- `GET /parties/vendors` · `GET /parties/vendors/{id}`
- `GET /parties/receivables` · `GET /parties/payables` · `GET /parties/credit-limit` · `GET /parties/bills-due`

**Cash & Bank**
- `GET /cash-bank/dashboard` (Pattern C L1) · `GET /cash-bank/ledger/{accountId}` (L2) · `GET /cash-bank/voucher/{id}` (L3)

**Inventory**
- `GET /inventory` (stock summary) · `/inventory/slow` · `/inventory/fast` · `/inventory/valuation` · `/inventory/alerts` · `/inventory/item/{id}/performance`

**Accounting**
- `GET /accounting/journal` · `/accounting/payment` · `/accounting/receipt`

---

## 12. Performance & caching strategy

The reports are read-heavy aggregations over a modest dataset (~400 vouchers in demo, larger in prod). Plan for both.

1. **Indexes (create on startup, idempotent `create_index`):** per tenant DB —
   - `vouchers`: `[("dates.date",1)]`, `[("voucherTypeName",1),("dates.date",1)]`, `[("ledgerEntries.ledgerName",1)]`, `[("voucherNumber",1)]`, `[("partyLedgerName",1)]`.
   - `ledgers`: `[("groupName",1)]`, `[("ledgerName",1)]`.
   - `groups`: `[("nature.classification",1)]`, `[("parentGroupName",1)]`.
   - `stockItems`: `[("stockGroupName",1)]`, `[("itemName",1)]`.
2. **Aggregation in Mongo, not Python:** push grouping/summation into `$match → $unwind ledgerEntries → $group` pipelines. Only loop in Python for the final tree-shaping. (The current Anjalee `sales/stats` loops every doc in Python — do **not** copy that pattern for reports; it won't scale.)
3. **TTL cache for report responses (`core/cache.py`):** key = `(tenant, fy, report, drill-params)`. Reports change only on Tally sync, so a 5–15 min TTL (or until a sync webhook invalidates) is safe. Use `cachetools.TTLCache` in-process for single instance; move to **Redis** when horizontally scaled.
4. **Pagination** on every list (voucher lists, registers, party lists) — default `limit=50`.
5. **Projection:** never return the giant `dates` blob or full nested arrays in list endpoints — project only needed fields. Reserve full docs for detail endpoints.
6. **Pre-warm:** extend the existing `warm_up_tenant_cache` startup hook to also prime the FY list and group tree per active tenant.
7. **Connection pooling:** single shared `MongoClient` (already the case) — never instantiate per request.

---

## 13. Frontend integration plan (making LiveTally dynamic)

Minimal, low-risk migration so the UI keeps working throughout:

1. Add `livetally/.env`: `VITE_API_BASE_URL=http://localhost:8000/api/v3`.
2. Create `src/api/client.js`: a `fetch` wrapper that injects `Authorization: Bearer <token>` and `x-company-id`, and a `?fy=` derived from `DateContext`. Return `res.data` from the envelope.
3. Create `src/api/<module>.js` files whose function names mirror the current data exports (e.g. `getTrialBalance(fy)`, `getProfitLoss(fy)`, `getSalesRegister(params)`).
4. **Swap per page, one at a time:** replace `import { trialBalanceData } from '../data/trialBalanceData'` with a `useEffect` + `useState` that calls `getTrialBalance(fy)`. Because the API returns the **same shape**, the JSX/table code is unchanged. Keep the mock file as a typed fixture for tests until the endpoint is verified.
5. Wire real login in `App.jsx` to `POST /api/v3/auth/login`; store the token; keep "Demo mode" pointing at a seeded demo tenant.
6. Add loading/empty/error states (the mock app has none) — a shared `useApi` hook.

Suggested rollout order (lowest dependency first): Companies/FY list → Dashboard KPIs → Trial Balance → P&L → Balance Sheet → Sales/Purchase registers → Parties → Cash & Bank → Inventory → GST → Analytics/Alerts.

---

## 14. Build phases (roadmap)

1. **Phase 0 — Scaffold & wiring:** create `app/aman/` skeleton, `routes.py`, the single `main.py` include, `serialize_doc`, `ApiResponse`, FY util, indexes. Ship `/api/v3/health` + `/companies` + `/companies/current/financial-years`.
2. **Phase 1 — Accounting core:** `services/accounting.py` (`dr_cr`, opening, closing, group rollup) + unit tests against known vouchers. This de-risks every report.
3. **Phase 2 — Statements:** Trial Balance → P&L → Balance Sheet (+ their drill-downs via the generic engine).
4. **Phase 3 — Registers & parties:** Sales/Purchase (+ Order/Note Pattern B), Customers/Vendors, Receivables/Payables.
5. **Phase 4 — Cash & Bank + Inventory + GST.**
6. **Phase 5 — Dashboard/Analytics/Alerts** (compose from Phases 2–4).
7. **Phase 6 — Auth hardening + subscription gating + caching/Redis + frontend swap completion.**

---

## 15. Open questions for the data owner (resolve before Phase 2/3)

1. **Bill-wise allocations:** are `ledgerEntries.billAllocations` populated in the live DB? Aging accuracy for Receivables/Payables depends on it (Section 3.6). If not, we age by voucher date and label results "approximate".
2. **Sign convention:** confirm the `isDeemedPositive` / `amount`-sign rule on the live data (Section 2.3) — our `dr_cr` test must pass on a real voucher.
3. **Opening balances vs carry-forward:** is `ledgers.balances.openingBalance` the absolute opening for the earliest FY only, or refreshed per FY? Determines whether we chain-forward or read per FY.
4. **Reorder levels / credit limits:** not present in the export — where do they live (per-ledger config? a settings collection?) for Stock Alerts and Credit Limit pages.
5. **Users & subscription source:** confirm collection(s) in `salesforecasting_system` for aman auth + which `companies` a user may access.
6. **Closing stock valuation:** confirm valuation method (Avg vs FIFO) the CA expects for P&L/BS closing stock, since `stockGroups.valuationMethod` shows "Avg. Price".

---

### Appendix A — `dr_cr` reference implementation
```python
def dr_cr(entry: dict) -> tuple[float, float]:
    """Return (debit, credit) magnitude for a voucher ledgerEntry.
    Bucket by Tally's isDeemedPositive; magnitude is abs(amount)."""
    amt = abs(float(entry.get("amount") or 0))
    return (amt, 0.0) if entry.get("isDeemedPositive") else (0.0, amt)
```

### Appendix B — Trial Balance pipeline sketch
```python
pipeline = [
    {"$match": {"dates.date": {"$gte": fy_start, "$lte": fy_end}}},
    {"$unwind": "$ledgerEntries"},
    {"$group": {
        "_id": "$ledgerEntries.ledgerName",
        "debit": {"$sum": {"$cond": ["$ledgerEntries.isDeemedPositive",
                                     {"$abs": "$ledgerEntries.amount"}, 0]}},
        "credit": {"$sum": {"$cond": ["$ledgerEntries.isDeemedPositive",
                                      0, {"$abs": "$ledgerEntries.amount"}]}},
    }},
]
# then: join each ledger to its group (ledgers.groupName), add opening balances,
# roll up to top-level group via groupPath root, shape into particulars[].children[].
```

### Appendix C — Voucher-detail mapper (UI shape)
```python
def map_voucher_detail(v: dict) -> dict:
    items = [{
        "srNo": i+1, "name": ie["stockItemName"],
        "hsn": ie.get("hsn",""),
        "qty": parse_qty(ie.get("actualQty")), "unit": parse_unit(ie.get("actualQty")),
        "rate": parse_rate(ie.get("rate")), "discount": ie.get("discount",0),
        "amount": ie.get("amount",0),
    } for i, ie in enumerate(v.get("inventoryEntries", []))]
    taxes = collect_tax_lines(v.get("ledgerEntries", []))  # CGST/SGST/IGST/roundOff
    return {
        "voucherNo": v.get("voucherNumber"), "date": fmt_date(v["dates"]["date"]),
        "type": v.get("voucherTypeName"), "partyName": v.get("partyLedgerName"),
        "items": items, "taxes": taxes,
        "totals": {"grandTotal": v.get("totals",{}).get("totalDebit",0)},
        "narration": v.get("narration") or "",
    }
```

---

**End of document.** This strategy keeps Aman (`/api/v3`) and Anjalee (`/api/v2`) cleanly separated in one codebase, reuses the existing tenant resolver, derives every figure from the real Tally voucher data (no fabricated numbers), serves the exact shapes the LiveTally UI already expects, and scales via Mongo-side aggregation + TTL caching.
