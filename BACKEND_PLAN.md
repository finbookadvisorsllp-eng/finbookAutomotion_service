# Backend Development Workflow & Architecture Plan

**Project:** Finbook Advisors — multi-tenant accounting / bookkeeping automation platform
**Frontend (existing):** React 19 + Vite + Tailwind v4 + React Router v7 + React Query + Zustand + Zod + Axios
**Backend stack (this plan):** Python 3.12 + FastAPI + MongoDB + Beanie ODM
**Author / role:** Senior full-stack architect
**Status:** Architecture & workflow — implementation will follow module by module
**Date:** 2026-05-11

> ⚠️ **Note on “Mongose”:** Mongoose is a Node.js ODM. There is no direct equivalent for Python. The two real choices are:
> - **Beanie** (recommended) — async ODM built on Motor + Pydantic v2; the closest spiritual match to Mongoose, modern, fully typed, native FastAPI fit.
> - **MongoEngine** — older, synchronous, document-class style.
>
> This plan uses **Beanie**.

---

## Table of Contents

1. [Feature analysis](#1-feature-analysis)
2. [Required backend modules](#2-required-backend-modules)
3. [API planning](#3-api-planning)
4. [Database schema design](#4-database-schema-design)
5. [Recommended database choice](#5-recommended-database-choice)
6. [Recommended folder structure](#6-recommended-folder-structure)
7. [Authentication strategy](#7-authentication-strategy)
8. [Authorization strategy](#8-authorization-strategy)
9. [Validation strategy](#9-validation-strategy)
10. [Recommended tech stack](#10-recommended-tech-stack)
11. [Production-level architecture](#11-production-level-architecture)
12. [Module-by-module implementation order](#12-module-by-module-implementation-order)
13. [Security recommendations](#13-security-recommendations)
14. [Scalability recommendations](#14-scalability-recommendations)
15. [Performance optimizations](#15-performance-optimizations)
16. [Missing frontend issues that may cause backend problems](#16-missing-frontend-issues-that-may-cause-backend-problems)
17. [API response structure](#17-api-response-structure)
18. [Error handling strategy](#18-error-handling-strategy)
19. [Best practices](#19-best-practices)
20. [Conversation log](#20-conversation-log)

---

## 1. Feature analysis

Derived directly from the existing frontend (`src/components/*`, `src/routes/routePaths.js`, panels examined: `VoucherEntryEngine`, `CreateSales`, `CreateInvoice`, `PettyCashPanel`, `SalesPanel`, `PurchasePanel`).

### 1.1 Domain identification

This is a **multi-tenant Indian-style cloud accounting / ERP** with:

- **Double-entry bookkeeping** — vouchers with debit/credit lines, ledgers
- **GST-aware invoicing** — CGST / SGST / IGST, HSN/SAC codes, GSTIN-based registrations
- **Inventory tracking** (Purchase Invoice With/Without Inventory variants)
- **Document automation** — Upload / Scan / Camera capture of invoices → extract fields → auto-create vouchers
- **AI-assisted entry** — `Bot` mode in `VoucherEntryEngine`
- **Multi-tenancy** — every user works under one of N companies (Navbar `selectedCompany` switcher already exists)
- **Role-based access** — `RolePanel` + `Manage User Permission` page
- **Master data** — Party Ledger, Stock Ledger, Bank list, Rules
- **Workflow lifecycle** for every voucher type — Inbox → Review → Archive
- **Petty Cash / Fund Flow** — cash payments, bank payments, contra entries

### 1.2 Inferred entities (from forms & tables)

| Entity | Source in FE | Notes |
|---|---|---|
| **User** | `Login`, `useAppStore.user` | email, name, role, companies they can access |
| **Company (Tenant)** | `CompaniesPanel`, `AddCompanyModal`, Navbar switcher | GSTIN, addresses, fiscal year |
| **BusinessOwner / Accountant** | `EntityPanel` (two modes) | belongs to one or many companies |
| **Role** | `RolePanel` mode=Manage Roles | role name + permission set |
| **Permission** | `RolePanel` mode=Manage User Permission | user × role × company |
| **Party / Ledger** | `MasterDataPanel` mode=Party Ledger, `Party GSTIN`, `Party Ledger` fields | ledgers tree: Sales, Purchase, Bank, Cash, Party (Sundry Debtors / Creditors), TDS, TCS, Freight, etc. |
| **StockItem** | `MasterDataPanel` mode=Stock Ledger, `Stock Item` dropdowns | with HSN, unit, GST rate, stock group |
| **StockGroup / HSNClassification / Unit** | sub-master | |
| **VoucherType** | `VoucherEntryEngine voucherType` prop: `sales / purchase / fund_flow / cash_payment / bank_payment / contra / receipt / payment / credit_note / debit_note / quotation` | |
| **Voucher** (the heart) | every Create*.jsx + VoucherEntryEngine | header + line items + tax breakdown + narration + attachments |
| **VoucherLine / ItemRow** | `CreateInvoice.productRows`, sales line tables | per-line stock item, qty, rate, disc, amount, HSN, GST split |
| **TaxLine** | `CGST / SGST / IGST / TDS / TCS` rows | |
| **Quotation** | `QuotationInbox`, `CreateQuotation` | pre-invoice document |
| **Invoice** | `InvoiceInbox`, `CreateInvoice` | special voucher type — externally issued |
| **BankAccount** | `BankPanel` mode=Manage Bank | linked to a Ledger |
| **BankRule** | `BankPanel` mode=Manage Rule | auto-categorization rules for bank txns |
| **BankTransaction** | `BankPanel` mode=Inbox/Review/Archive | imported statements |
| **PettyCashEntry** | `PettyCashPanel` Inbox | cash payment / bank payment / contra |
| **Document / Attachment** | `MyDocumentsPanel`, `Upload` & `Scan` modes in VoucherEntryEngine | uploaded invoices, OCR'd PDFs |
| **OCRJob** | `Scan / Upload` modes | async background job extracting fields from an uploaded doc |
| **AIBotConversation** | `Bot` mode in VoucherEntryEngine | LLM-assisted voucher creation chat |
| **AuditLog** | implied by review/archive workflow | who edited what, when |

### 1.3 Lifecycle / workflow

Each voucher passes through:

```
Draft → Inbox → Review → Posted (Archive)
                 ↓
              Rejected → Inbox (returned)
```

This implies a `status` field on every voucher and an `AuditLog` collection.

### 1.4 Cross-cutting concerns

- **Tenant scope** — every domain document carries `company_id`; every query filters by it.
- **Fiscal year & period** — vouchers live in a period; reports aggregate across periods.
- **Numbering series** — `Voucher Number Series` dropdown implies auto-increment per series per company.
- **GSTIN registration per state** — companies have multiple GST registrations.

---

## 2. Required backend modules

Mapped to top-level FastAPI routers. Each module = one folder under `app/modules/`.

| # | Module | Responsibility | FE pages it serves |
|---|---|---|---|
| 1 | **auth** | login, logout, refresh token, password reset, current user | `Login`, `useAppStore.setAuth` |
| 2 | **users** | CRUD users, business owners, accountants, assignment | `EntityPanel`, `Manage Business User`, `Allocate Accountant` |
| 3 | **companies** | tenant CRUD, GST registrations, fiscal year setup | `CompaniesPanel`, `AddCompanyModal` |
| 4 | **roles** | role CRUD + permission matrix | `RolePanel` |
| 5 | **master_data** | parties (ledgers), stock items, units, HSN, stock groups, GST classifications | `MasterDataPanel`, all dropdowns in voucher forms |
| 6 | **vouchers** | unified voucher engine for all types (sales, purchase, credit/debit note, payment, receipt, contra, fund-flow, journal) with workflow state machine | `SalesPanel`, `PurchasePanel`, `PettyCashPanel`, all `Create*` |
| 7 | **invoices** | thin wrapper on vouchers for "Invoice" type + external numbering, PDF, email | `InvoiceInbox`, `CreateInvoice` |
| 8 | **quotations** | thin wrapper for quotations + "convert to invoice" | `QuotationInbox`, `CreateQuotation` |
| 9 | **banking** | bank accounts, bank rules, bank transaction inbox, reconciliation | `BankPanel` (all 5 modes) |
| 10 | **documents** | upload, list, link to voucher, generate signed URL | `MyDocumentsPanel`, attachment modals |
| 11 | **ocr** | submit scanned doc → extract fields → return draft voucher | `Scan` & `Upload` & `Camera` modes |
| 12 | **ai_bot** | streaming LLM chat scoped to a company's data (RAG over ledger) | `Bot` mode |
| 13 | **reports** | aggregations: P&L, balance sheet, GST returns, party ledger statement, stock ledger | implied by `DashboardTable`, `Party Ledger`, `Stock Ledger` |
| 14 | **audit** | append-only audit log + retrieval | implied by Review/Archive workflow |
| 15 | **notifications** | email + in-app + websocket events | implied (subscription expiry banner, voucher approval) |
| 16 | **admin** | super-admin endpoints: tenant onboarding, usage metrics, subscriptions | implied (subscription message in Navbar) |

### 2.1 Internal libraries (not routers)

- `app/core/security` — JWT, password hashing, dependencies
- `app/core/tenant` — tenant resolution from `X-Company` header
- `app/core/permissions` — RBAC check decorators / dependencies
- `app/core/numbering` — voucher number generator (atomic counter per series)
- `app/core/money` — `Decimal` helpers, GST calculation
- `app/core/db` — Mongo connection, indexes, transactions
- `app/core/exceptions` — domain exceptions + handlers
- `app/core/logging` — structlog setup

---

## 3. API planning

REST + JSON. All endpoints under `/api/v1`. Every authenticated request requires `Authorization: Bearer <jwt>` and `X-Company: <company_id>` (already sent by the frontend axios client).

### 3.1 Conventions

- Plural resource nouns: `/invoices`, `/vouchers`.
- Sub-resources for compositions: `/companies/{id}/gst-registrations`.
- Filtering via query params: `?status=draft&from=2026-04-01&to=2026-04-30&q=acme`.
- Pagination: `?page=1&limit=50` — response includes `total`, `page`, `limit`.
- Sorting: `?sort=-createdAt` (Stripe-style; `-` = desc).
- Action endpoints (workflow): `POST /vouchers/{id}/post`, `POST /vouchers/{id}/reject`, `POST /vouchers/{id}/duplicate`.

### 3.2 Full endpoint map (v1)

#### auth
```
POST   /auth/login                  { email, password } → { token, refreshToken, user }
POST   /auth/refresh                { refreshToken }    → { token }
POST   /auth/logout
GET    /auth/me                                          → { user, companies, permissions }
POST   /auth/forgot-password        { email }
POST   /auth/reset-password         { token, newPassword }
POST   /auth/change-password        { oldPassword, newPassword }
```

#### users
```
GET    /users                       ?role=&q=&page=
POST   /users
GET    /users/{id}
PATCH  /users/{id}
DELETE /users/{id}                  (soft delete)
POST   /users/{id}/companies        { companyIds, role }      # allocate accountant
DELETE /users/{id}/companies/{cid}
```

#### companies (tenant)
```
GET    /companies                   (only those the user can access)
POST   /companies
GET    /companies/{id}
PATCH  /companies/{id}
DELETE /companies/{id}              (soft delete; super-admin only)
GET    /companies/{id}/gst-registrations
POST   /companies/{id}/gst-registrations
PATCH  /companies/{id}/gst-registrations/{regId}
```

#### roles & permissions
```
GET    /roles
POST   /roles
PATCH  /roles/{id}
DELETE /roles/{id}
GET    /roles/{id}/permissions
PUT    /roles/{id}/permissions     { permissionKeys: [...] }
GET    /permissions                 (catalog of all known permission keys)
GET    /users/{id}/permissions      (effective)
```

#### master data
```
GET    /ledgers                    ?group=Sundry+Debtors&q=
POST   /ledgers
GET    /ledgers/{id}
PATCH  /ledgers/{id}
DELETE /ledgers/{id}
GET    /ledger-groups               (Sales, Purchase, Bank, Cash, ...)

GET    /stock-items
POST   /stock-items
GET    /stock-items/{id}
PATCH  /stock-items/{id}
DELETE /stock-items/{id}

GET    /units
GET    /hsn-codes                  ?q=
GET    /stock-groups
GET    /tax-rates
```

#### vouchers (unified — covers Sales / Purchase / Credit / Debit / Payment / Receipt / Contra / FundFlow / Journal / Quotation / Invoice)
```
GET    /vouchers                   ?type=sales&status=draft&period=2026-Q1&q=&page=
POST   /vouchers
GET    /vouchers/{id}
PATCH  /vouchers/{id}               (draft only)
DELETE /vouchers/{id}               (draft only)
POST   /vouchers/{id}/submit        → status=in_review
POST   /vouchers/{id}/post          → status=posted (writes to ledger)
POST   /vouchers/{id}/reject        { reason } → status=rejected
POST   /vouchers/{id}/duplicate
POST   /vouchers/{id}/attachments   (multipart)
DELETE /vouchers/{id}/attachments/{attId}
GET    /vouchers/{id}/pdf           → application/pdf
POST   /vouchers/{id}/email         { to, subject, body }
GET    /vouchers/{id}/audit-log
```

Resource sub-types are exposed as filters, not separate endpoints — keeps the API surface tight and the workflow logic centralized.

#### invoices (thin alias of vouchers type=invoice + customer-facing fields)
```
GET    /invoices                   ?status=&customer=&period=
POST   /invoices                                          # like /vouchers but auto-sets type
GET    /invoices/{id}
POST   /invoices/{id}/send-email
GET    /invoices/{id}/public/{token}                       # public read-only link
```

#### quotations
```
GET    /quotations
POST   /quotations
POST   /quotations/{id}/convert-to-invoice → returns new invoice id
```

#### banking
```
GET    /bank-accounts
POST   /bank-accounts
GET    /bank-accounts/{id}
PATCH  /bank-accounts/{id}
DELETE /bank-accounts/{id}

GET    /bank-rules
POST   /bank-rules
PATCH  /bank-rules/{id}
DELETE /bank-rules/{id}

GET    /bank-transactions          ?status=inbox|review|archive&account=
POST   /bank-transactions/import   (multipart CSV/MT940/OFX)
POST   /bank-transactions/{id}/match    { voucherId }
POST   /bank-transactions/{id}/categorize { ledgerId }
POST   /bank-transactions/{id}/archive
```

#### documents
```
GET    /documents                   ?linkedTo=voucher:{id}
POST   /documents                   (multipart) → { id, signedUrl }
GET    /documents/{id}              → metadata + signed URL
DELETE /documents/{id}
POST   /documents/{id}/link         { entity: 'voucher', id: '...' }
```

#### ocr
```
POST   /ocr/jobs                    { documentId } → { jobId, status }
GET    /ocr/jobs/{id}               → { status, extracted: { invoiceNo, date, party, lines: [...] } }
POST   /ocr/jobs/{id}/accept        → creates a draft voucher
```

#### ai bot
```
POST   /ai/conversations            → { conversationId }
POST   /ai/conversations/{id}/messages    (stream: text/event-stream)
GET    /ai/conversations/{id}/messages
```

#### reports
```
GET    /reports/party-ledger        ?partyId=&from=&to=
GET    /reports/stock-ledger        ?stockItemId=&from=&to=
GET    /reports/trial-balance       ?asOf=
GET    /reports/profit-loss         ?from=&to=
GET    /reports/balance-sheet       ?asOf=
GET    /reports/gstr-1              ?period=2026-04
GET    /reports/gstr-3b             ?period=2026-04
GET    /reports/dashboard           ?period=                # summary KPIs for DashboardTable
```

#### audit
```
GET    /audit-logs                  ?entity=voucher:{id}&user=&from=&to=
```

---

## 4. Database schema design

Mongo + Beanie. Each section gives the collection name, key fields, indexes, and embedding decisions.

### 4.1 Multi-tenancy strategy

**Shared database, shared collections, `company_id` field on every document, enforced by a Beanie pre-find hook + dependency that injects the tenant.** Cheaper than per-tenant DBs at low scale, with a documented escape hatch to per-tenant DBs once any tenant exceeds ~50M docs.

### 4.2 Collections

#### `users`
```py
class User(Document):
    email: EmailStr                       # unique
    password_hash: str
    name: str
    role: Literal["super_admin", "owner", "accountant", "viewer"]
    company_ids: list[PydanticObjectId]   # which tenants they can access
    is_active: bool = True
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "users"
        indexes = [
            IndexModel("email", unique=True),
            "company_ids",
        ]
```

#### `companies`
```py
class GstRegistration(BaseModel):
    state: str
    gstin: str
    registered_address: str
    is_primary: bool = False

class Company(Document):
    name: str
    legal_name: str | None
    pan: str | None
    gst_registrations: list[GstRegistration] = []
    base_currency: str = "INR"
    fiscal_year_start_month: int = 4       # April for India
    address: dict | None
    logo_url: str | None
    subscription_expires_at: datetime | None
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "companies"
        indexes = ["name"]
```

#### `roles`
```py
class Role(Document):
    company_id: PydanticObjectId
    name: str                              # "Accountant", "Reviewer", "Admin"
    permission_keys: list[str]             # e.g. "voucher:create", "voucher:post"
    is_system: bool = False                # built-ins can't be deleted
    created_at: datetime

    class Settings:
        name = "roles"
        indexes = [IndexModel([("company_id", 1), ("name", 1)], unique=True)]
```

#### `user_company_roles` (many-to-many)
```py
class UserCompanyRole(Document):
    user_id: PydanticObjectId
    company_id: PydanticObjectId
    role_id: PydanticObjectId
    granted_at: datetime
    granted_by: PydanticObjectId

    class Settings:
        name = "user_company_roles"
        indexes = [
            IndexModel([("user_id", 1), ("company_id", 1)], unique=True),
            "company_id",
        ]
```

#### `ledgers` (Chart of Accounts)
```py
class Ledger(Document):
    company_id: PydanticObjectId
    name: str
    group: str                             # "Sundry Debtors", "Sales", "Bank", "Cash", "Duties & Taxes"
    parent_id: PydanticObjectId | None
    opening_balance: Decimal128 = Decimal128("0")
    party_details: dict | None             # GSTIN, address, contact (for party ledgers only)
    is_system: bool = False
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "ledgers"
        indexes = [
            IndexModel([("company_id", 1), ("name", 1)], unique=True),
            IndexModel([("company_id", 1), ("group", 1)]),
        ]
```

#### `stock_items`
```py
class StockItem(Document):
    company_id: PydanticObjectId
    name: str
    stock_group: str | None
    unit: str                              # "Nos", "Kg", "Box"
    hsn_code: str | None
    gst_rate: Decimal128 | None
    opening_qty: Decimal128 = Decimal128("0")
    opening_value: Decimal128 = Decimal128("0")
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "stock_items"
        indexes = [IndexModel([("company_id", 1), ("name", 1)], unique=True)]
```

#### `voucher_number_series`
```py
class VoucherNumberSeries(Document):
    company_id: PydanticObjectId
    voucher_type: str                      # "sales" | "purchase" | ...
    name: str                              # "Default", "Manual", "Branch-MP"
    prefix: str = ""
    next_number: int = 1
    width: int = 4
    fiscal_year: str                       # "2025-26"

    class Settings:
        name = "voucher_number_series"
        indexes = [
            IndexModel([("company_id", 1), ("voucher_type", 1), ("name", 1), ("fiscal_year", 1)], unique=True)
        ]
```

#### `vouchers` (the core)
```py
class VoucherLine(BaseModel):
    line_no: int
    item_type: Literal["stock", "ledger"]
    stock_item_id: PydanticObjectId | None
    ledger_id: PydanticObjectId            # always present (sales/purchase/expense ledger)
    description: str | None
    hsn_code: str | None
    qty: Decimal128 | None
    unit: str | None
    rate: Decimal128 | None
    discount_pct: Decimal128 | None
    taxable_value: Decimal128
    gst_rate: Decimal128 | None
    cgst: Decimal128 = Decimal128("0")
    sgst: Decimal128 = Decimal128("0")
    igst: Decimal128 = Decimal128("0")
    cess: Decimal128 = Decimal128("0")
    amount: Decimal128                     # qty * rate * (1 - disc%) + taxes (computed server-side)

class TaxAdjustment(BaseModel):
    type: Literal["tds", "tcs", "freight", "round_off", "discount"]
    ledger_id: PydanticObjectId
    rate: Decimal128 | None
    amount: Decimal128

class JournalEntry(BaseModel):
    ledger_id: PydanticObjectId
    debit: Decimal128 = Decimal128("0")
    credit: Decimal128 = Decimal128("0")

class Attachment(BaseModel):
    document_id: PydanticObjectId
    filename: str

class Voucher(Document):
    company_id: PydanticObjectId
    voucher_type: Literal["sales", "purchase", "credit_note", "debit_note",
                          "payment", "receipt", "contra", "journal",
                          "fund_flow", "quotation", "invoice"]
    status: Literal["draft", "in_review", "posted", "rejected"]
    voucher_no: str | None                 # set on submit/post
    voucher_series: str | None
    voucher_date: date
    invoice_no: str | None                 # external invoice ref
    invoice_date: date | None
    fiscal_year: str
    period: str                            # "2026-04"

    party_ledger_id: PydanticObjectId | None
    party_gstin: str | None
    consignee_ledger_id: PydanticObjectId | None
    gst_registration_state: str | None

    lines: list[VoucherLine] = []
    adjustments: list[TaxAdjustment] = []
    journal: list[JournalEntry] = []       # generated on post — the double-entry

    sub_total: Decimal128 = Decimal128("0")
    total_tax: Decimal128 = Decimal128("0")
    total_amount: Decimal128 = Decimal128("0")
    narration: str | None
    attachments: list[Attachment] = []
    tags: list[str] = []

    created_by: PydanticObjectId
    submitted_at: datetime | None
    submitted_by: PydanticObjectId | None
    posted_at: datetime | None
    posted_by: PydanticObjectId | None
    rejected_at: datetime | None
    rejected_by: PydanticObjectId | None
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime

    class Settings:
        name = "vouchers"
        indexes = [
            IndexModel([("company_id", 1), ("voucher_type", 1), ("status", 1), ("voucher_date", -1)]),
            IndexModel([("company_id", 1), ("voucher_no", 1)], unique=True, partialFilterExpression={"voucher_no": {"$type": "string"}}),
            IndexModel([("company_id", 1), ("party_ledger_id", 1)]),
            IndexModel([("company_id", 1), ("period", 1)]),
            "tags",
        ]
```

**Why embed lines/adjustments/journal:** they are always read together with the voucher, never independently. Embedding eliminates the join.
**Why NOT embed everywhere:** see the separate `ledger_postings` denormalization below.

#### `ledger_postings` (denormalized journal — read-optimized for ledger reports)
```py
class LedgerPosting(Document):
    company_id: PydanticObjectId
    ledger_id: PydanticObjectId
    voucher_id: PydanticObjectId
    voucher_type: str
    voucher_no: str
    voucher_date: date
    period: str
    debit: Decimal128
    credit: Decimal128
    narration: str | None
    party_ledger_id: PydanticObjectId | None
    created_at: datetime

    class Settings:
        name = "ledger_postings"
        indexes = [
            IndexModel([("company_id", 1), ("ledger_id", 1), ("voucher_date", -1)]),
            IndexModel([("company_id", 1), ("period", 1)]),
            "voucher_id",
        ]
```

Generated atomically in a Mongo transaction whenever a voucher is posted. Drives party-ledger statements, trial balance, P&L. **This is the trick for making MongoDB usable for accounting** — the canonical source is the voucher, but a flat journal-line collection is what reports query.

#### `bank_accounts`
```py
class BankAccount(Document):
    company_id: PydanticObjectId
    name: str
    bank_name: str
    account_number_masked: str             # store last 4 only in plain; full encrypted
    account_number_enc: bytes | None
    ifsc: str | None
    ledger_id: PydanticObjectId
    opening_balance: Decimal128 = Decimal128("0")
    created_at: datetime

    class Settings:
        name = "bank_accounts"
        indexes = [IndexModel([("company_id", 1), ("name", 1)], unique=True)]
```

#### `bank_rules`
```py
class BankRule(Document):
    company_id: PydanticObjectId
    name: str
    match: dict                            # {"description_contains": "UPI", "amount_range": [100, 5000]}
    action: dict                           # {"set_ledger_id": "...", "set_party_ledger_id": "..."}
    priority: int = 100
    is_active: bool = True
    created_at: datetime

    class Settings:
        name = "bank_rules"
        indexes = [IndexModel([("company_id", 1), ("priority", 1)])]
```

#### `bank_transactions`
```py
class BankTransaction(Document):
    company_id: PydanticObjectId
    bank_account_id: PydanticObjectId
    txn_date: date
    description: str
    reference: str | None
    debit: Decimal128 = Decimal128("0")
    credit: Decimal128 = Decimal128("0")
    balance_after: Decimal128 | None
    status: Literal["inbox", "categorized", "matched", "archived"]
    matched_voucher_id: PydanticObjectId | None
    suggested_ledger_id: PydanticObjectId | None
    raw: dict                              # original row from import
    imported_at: datetime
    imported_by: PydanticObjectId

    class Settings:
        name = "bank_transactions"
        indexes = [
            IndexModel([("company_id", 1), ("bank_account_id", 1), ("txn_date", -1)]),
            IndexModel([("company_id", 1), ("status", 1)]),
        ]
```

#### `documents`
```py
class Document_(Document):                  # renamed to avoid clash with Beanie's Document base
    company_id: PydanticObjectId
    filename: str
    mime_type: str
    size_bytes: int
    storage_key: str                       # S3 / MinIO key
    uploaded_by: PydanticObjectId
    linked_to: list[dict] = []             # [{entity: "voucher", id: "..."}]
    is_ocr_processed: bool = False
    created_at: datetime
    deleted_at: datetime | None

    class Settings:
        name = "documents"
        indexes = [
            IndexModel([("company_id", 1), ("created_at", -1)]),
            "linked_to",
        ]
```

#### `ocr_jobs`
```py
class OcrJob(Document):
    company_id: PydanticObjectId
    document_id: PydanticObjectId
    status: Literal["queued", "processing", "succeeded", "failed"]
    provider: str                          # "textract" | "tesseract" | "document_ai"
    extracted: dict | None                 # {invoice_no, date, party, lines: [...]}
    error: str | None
    created_at: datetime
    completed_at: datetime | None

    class Settings:
        name = "ocr_jobs"
        indexes = [IndexModel([("company_id", 1), ("status", 1), ("created_at", -1)])]
```

#### `ai_conversations` & `ai_messages`
```py
class AIConversation(Document):
    company_id: PydanticObjectId
    user_id: PydanticObjectId
    title: str | None
    created_at: datetime

class AIMessage(Document):
    conversation_id: PydanticObjectId
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    tool_calls: list[dict] | None
    created_at: datetime

    class Settings:
        indexes = [IndexModel([("conversation_id", 1), ("created_at", 1)])]
```

#### `audit_logs` (append-only)
```py
class AuditLog(Document):
    company_id: PydanticObjectId
    entity: str                            # "voucher"
    entity_id: PydanticObjectId
    action: Literal["create", "update", "submit", "post", "reject", "delete"]
    actor_id: PydanticObjectId
    diff: dict | None                      # {field: {from, to}}
    ip: str | None
    user_agent: str | None
    occurred_at: datetime

    class Settings:
        name = "audit_logs"
        indexes = [
            IndexModel([("company_id", 1), ("entity", 1), ("entity_id", 1), ("occurred_at", -1)]),
        ]
```

### 4.3 Indexes — summary

- Every `company_id` field is indexed (always queried).
- Compound indexes match the read patterns of the FE panel filters.
- Unique indexes on `users.email`, `(company_id, voucher_no)`, ledger/stock-item names within a company.
- A single TTL index on `ocr_jobs.completed_at` (e.g. 30 days) prunes finished jobs.

### 4.4 Money & precision

- **Always `Decimal128`**, never `float`. Beanie/PyMongo map `bson.Decimal128`. In Python, convert to `decimal.Decimal` before any math.
- Round once at the very end (`ROUND_HALF_UP`, 2 places for INR).
- Tests must cover `0.1 + 0.2`, large totals, and negative roundings.

---

## 5. Recommended database choice

**You picked MongoDB. Here is the honest analysis and how to make it production-grade for accounting.**

### 5.1 MongoDB — pros & cons for THIS product

| Pro | Con |
|---|---|
| Flexible schema fits voucher-shape variance (sales line vs ledger line vs adjustment) | No native multi-table foreign keys |
| JSON-native, no ORM/DTO drift with FastAPI + Pydantic | Multi-document transactions exist but are slower & limited to one replica set |
| Easy to embed line items → one query loads a voucher | Aggregation pipelines are powerful but verbose for financial reports |
| Horizontal scaling via sharding is built-in | Operational ops (backups, PITR) require Atlas or careful self-hosting |
| Atlas managed cloud is mature | Reporting / BI tools prefer SQL |

### 5.2 The accounting concern — addressed

The classic argument **"never use MongoDB for accounting"** rests on lack of ACID. Modern MongoDB has fixed this:

- **Multi-document transactions** (4.0+) work on a replica set and across shards (4.2+).
- We will wrap every **voucher post** (which writes the voucher status, the `ledger_postings`, and the audit log) inside a session-bound transaction.

```py
async with await client.start_session() as session:
    async with session.start_transaction():
        await voucher.save(session=session)
        await LedgerPosting.insert_many(postings, session=session)
        await AuditLog.insert_one(log, session=session)
```

This gives the same all-or-nothing guarantees a relational DB would. **It is the single most important pattern in this codebase.** Code review must reject any voucher-state-changing endpoint that does not use a transaction.

### 5.3 Verdict

✅ **Acceptable** for this product, **provided**:

1. Every state-changing operation uses a session + transaction.
2. `Decimal128` is used for all money.
3. Reports query `ledger_postings`, not aggregated voucher.lines (denormalization is the perf trick).
4. A daily snapshot of trial balance is stored to detect silent drift.
5. PITR backups are enabled (Atlas continuous backup or `mongodump` + oplog tailing).

> If at some future point the company faces audit/regulatory pushback ("show me ANSI-SQL transaction guarantees on a real RDBMS"), **migrating to PostgreSQL is straightforward** because Beanie's Pydantic models map 1:1 to SQLAlchemy + Pydantic. Do not let that fear paralyze you; build now, migrate only if needed.

---

## 6. Recommended folder structure

```
server/                                  # backend root (sibling of frontend src/)
├── pyproject.toml
├── README.md
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml                   # mongo + redis + minio + api
├── alembic-equivalent/                  # not needed; Mongo doesn't have migrations.
│                                        # use app/db/migrations/ for index + seed scripts.
├── scripts/
│   ├── seed_dev.py
│   ├── create_indexes.py
│   └── reindex.py
├── tests/
│   ├── conftest.py
│   ├── factories.py
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── app/
    ├── __init__.py
    ├── main.py                          # FastAPI app + middleware + router includes
    ├── config.py                        # pydantic-settings Settings()
    │
    ├── core/                            # cross-cutting; never imports from modules/
    │   ├── db.py                        # Mongo client + init_beanie
    │   ├── security.py                  # JWT, password hashing
    │   ├── permissions.py               # RBAC dependency
    │   ├── tenant.py                    # X-Company resolution
    │   ├── deps.py                      # get_current_user, get_current_company
    │   ├── numbering.py                 # voucher number atomic counter
    │   ├── money.py                     # Decimal helpers, GST splitter
    │   ├── pagination.py
    │   ├── exceptions.py
    │   ├── error_handlers.py
    │   ├── logging.py
    │   ├── response.py                  # success/error envelope helpers
    │   └── events.py                    # internal event bus (publish on post, reject…)
    │
    ├── modules/                         # one folder per business domain
    │   ├── auth/
    │   │   ├── routes.py
    │   │   ├── schemas.py               # Pydantic request/response
    │   │   ├── service.py               # business logic, no FastAPI imports
    │   │   ├── models.py                # Beanie documents (if module-owned)
    │   │   └── __init__.py
    │   ├── users/...
    │   ├── companies/...
    │   ├── roles/...
    │   ├── master_data/
    │   │   ├── ledgers/...
    │   │   └── stock_items/...
    │   ├── vouchers/
    │   │   ├── routes.py
    │   │   ├── schemas.py
    │   │   ├── service.py
    │   │   ├── workflow.py              # state machine: draft→submit→post→reject
    │   │   ├── posting.py               # generates ledger_postings from voucher
    │   │   ├── models.py
    │   │   └── tests/
    │   ├── invoices/
    │   ├── quotations/
    │   ├── banking/
    │   ├── documents/
    │   ├── ocr/
    │   │   ├── routes.py
    │   │   ├── tasks.py                 # Celery tasks
    │   │   └── providers/
    │   │       ├── tesseract.py
    │   │       └── textract.py
    │   ├── ai_bot/
    │   ├── reports/
    │   │   ├── routes.py
    │   │   └── aggregations.py
    │   ├── audit/
    │   ├── notifications/
    │   └── admin/
    │
    ├── workers/                         # background workers (Celery)
    │   ├── celery_app.py
    │   ├── beat_schedule.py
    │   └── tasks.py
    │
    ├── integrations/                    # outbound: email, S3, LLM, GSTN
    │   ├── s3.py
    │   ├── email.py
    │   ├── llm.py
    │   └── gstn.py
    │
    ├── db/
    │   ├── migrations/                  # ordered index + seed scripts
    │   │   ├── 0001_init.py
    │   │   └── 0002_add_period_index.py
    │   └── runner.py
    │
    └── middleware/
        ├── request_id.py
        ├── tenant.py
        └── timing.py
```

### 6.1 Hard rule — dependency direction

```
routes/  ──▶  service/  ──▶  models/  ──▶  core/
        ⬑─────  schemas/  ⬉─────────────────
```

- `routes/` may import from `service/`, `schemas/`, `core/deps`.
- `service/` may import from `models/`, `core/`. Never imports FastAPI.
- `models/` may import only from `core/`. No service logic.
- `core/` may import from nothing but standard libs + Pydantic + Beanie.

This is what keeps the code testable forever.

---

## 7. Authentication strategy

### 7.1 Mechanism

- **JWT access + refresh** (already plumbed in FE — `useAppStore.token`, axios `Authorization` header, 401 → /login flow).
- **Access token TTL:** 15 minutes.
- **Refresh token TTL:** 7 days, rotating (issue a new one on every use, invalidate the old).
- **Refresh tokens are stored** in a `refresh_tokens` collection with `user_id`, `token_hash`, `expires_at`, `revoked_at`, `replaced_by`. Compromise detection: if the same refresh token is presented twice → revoke entire family.
- **Password hashing:** Argon2id via `passlib[argon2]`. Bcrypt acceptable.
- **Algorithm:** RS256 (asymmetric) so workers can verify without holding the signing key; HS256 acceptable for a single API.

### 7.2 Endpoints

Already covered in §3 (`/auth/login`, `/auth/refresh`, `/auth/me`, etc.).

### 7.3 FastAPI dependency

```py
async def get_current_user(authorization: str = Header(...)) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    payload = verify_jwt(token)
    user = await User.get(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(401, "Inactive user")
    return user
```

### 7.4 Forgot / reset password

- `/auth/forgot-password` → enqueues an email with a single-use token (`password_reset_tokens` collection, TTL 1 hour, hashed).
- `/auth/reset-password` consumes the token, sets new password, revokes all refresh tokens.

### 7.5 MFA (future)

Reserve a `mfa_secret` field on `users`. Integrate `pyotp` when needed; add `mfa_required` flag per role.

---

## 8. Authorization strategy

### 8.1 Model — **RBAC scoped per tenant**

- Permissions are static keys: `voucher:create`, `voucher:post`, `voucher:reject`, `ledger:write`, `report:gst`, `bank:reconcile`, etc.
- **Roles** group permission keys (`Accountant`, `Reviewer`, `Owner`, `Viewer`).
- **A user × company → role** binding lives in `user_company_roles`. Same user can be Owner in Company A and Viewer in Company B.

### 8.2 Permission catalog (initial)

```
auth:*                — handled by being logged in
company:read, company:write, company:delete
user:read, user:write, user:invite
role:read, role:write
ledger:read, ledger:write, ledger:delete
stock:read, stock:write, stock:delete
voucher:read, voucher:create, voucher:edit_draft, voucher:submit, voucher:post,
voucher:reject, voucher:delete_draft
bank:read, bank:rule_write, bank:reconcile, bank:import
document:read, document:upload, document:delete
ocr:run
ai:chat
report:financial, report:gst, report:audit
audit:read
admin:*               — super admin only
```

### 8.3 Enforcement

```py
def require(*perms: str):
    async def dep(user: User = Depends(get_current_user),
                  company: Company = Depends(get_current_company)) -> User:
        effective = await effective_permissions(user.id, company.id)
        if not set(perms).issubset(effective):
            raise HTTPException(403, "Forbidden")
        return user
    return dep

@router.post("/vouchers/{id}/post")
async def post_voucher(id: str, user=Depends(require("voucher:post"))):
    ...
```

`effective_permissions` is cached in Redis per (`user_id`, `company_id`) for 60s.

### 8.4 Object-level checks

A user with `voucher:read` must still belong to that voucher's company. Enforced by the `get_current_company` dependency + `company_id` filter in every Beanie query (a base service method).

---

## 9. Validation strategy

Layered — **same schema enforced at three boundaries**.

| Layer | Tool | Catches |
|---|---|---|
| Frontend form | Zod (already in place — `frontEndStruc.md` plan) | Most user mistakes before they hit the network |
| API request | Pydantic v2 schemas in `module/schemas.py` | Wrong type / missing field / format |
| Persistence | Beanie / Mongo schema validators (`$jsonSchema`) + business invariants in `service.py` | Drift over time / direct DB writes |

### 9.1 Pydantic schema conventions

```py
class VoucherLineIn(BaseModel):
    line_no: int = Field(..., ge=1)
    item_type: Literal["stock", "ledger"]
    stock_item_id: PydanticObjectId | None = None
    ledger_id: PydanticObjectId
    description: str | None = Field(None, max_length=500)
    hsn_code: str | None = Field(None, pattern=r"^\d{4,8}$")
    qty: Decimal | None = Field(None, ge=0)
    rate: Decimal | None = Field(None, ge=0)
    discount_pct: Decimal | None = Field(None, ge=0, le=100)
    gst_rate: Decimal | None = Field(None, ge=0, le=28)

    @model_validator(mode="after")
    def check_stock_consistency(self):
        if self.item_type == "stock" and not self.stock_item_id:
            raise ValueError("stock_item_id required when item_type='stock'")
        return self
```

### 9.2 Business invariants (enforced in `service.py`, never in route)

- Voucher debits must equal credits on `post`.
- GST split: same-state → CGST+SGST; inter-state → IGST.
- Ledger `posting_date` must fall within the voucher's fiscal year.
- Quantity required for stock items; never for pure ledger lines.
- A voucher cannot reference a soft-deleted ledger.

### 9.3 Money & date

- All money fields are `Decimal` in Pydantic (`pydantic.Decimal`) with quantize on output.
- Dates: ISO-8601 strings in JSON, `datetime.date` in Pydantic, `bson.datetime` in Mongo (date-only stored as midnight UTC).

---

## 10. Recommended tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | **Python 3.12** | Modern typing, performance |
| Framework | **FastAPI** | Async, auto-OpenAPI for FE codegen, Pydantic native |
| ASGI | **Uvicorn** behind **Gunicorn** workers | Standard production |
| ODM | **Beanie** | Pydantic v2 native, async, modern; closest to Mongoose DX |
| DB | **MongoDB 7** (Atlas in prod) | Per requirement; replica set required for transactions |
| Cache / queue | **Redis 7** | Sessions, rate limits, Celery broker |
| Background jobs | **Celery 5** | OCR pipeline, bulk imports, PDF, email, scheduled reports |
| File storage | **AWS S3** (MinIO in dev) | Invoices, generated PDFs |
| Search (future) | **Mongo Atlas Search** or **Meilisearch** | Voucher / party lookup at scale |
| Email | **Resend** / **SES** / **Postmark** | Transactional |
| PDF | **WeasyPrint** | Invoice PDF generation |
| OCR | **AWS Textract** (cloud) + **Tesseract** (offline fallback) | Invoice line extraction |
| LLM | **Anthropic Claude** / **OpenAI** + **pgvector via VOY/Qdrant** (since Mongo) — use **MongoDB Atlas Vector Search** | AI bot RAG over user's own data |
| Auth | **python-jose** + **passlib[argon2]** | JWT + hashing |
| Validation | **Pydantic v2** | Already chosen |
| HTTP client | **httpx** (async) | Outbound calls to OCR/LLM |
| Logging | **structlog** (JSON) | Audit-ready |
| Tracing | **OpenTelemetry → Honeycomb / Tempo** | Production observability |
| Errors | **Sentry** | Crash reporting |
| Tests | **pytest + pytest-asyncio + factory_boy + httpx.AsyncClient** | |
| Lint / format | **ruff + mypy** | One tool replaces 5 |
| Dep mgmt | **Poetry** or **uv** | Lockfile + reproducibility |
| Container | **Docker** multi-stage | |
| IaC | **Terraform** | |
| Deploy | **AWS ECS Fargate** or **Render** | Backend; **Atlas** for DB; **CloudFront + S3** for FE |
| CI/CD | **GitHub Actions** | Lint → typecheck → test → build → deploy |
| Secrets | **AWS Secrets Manager** / **Doppler** | Never in env files in prod |

---

## 11. Production-level architecture

### 11.1 Component view

```
                     ┌────────────────────────────────────────────┐
                     │           CloudFront + S3 (FE)             │
                     └────────────────────┬───────────────────────┘
                                          │ HTTPS
                                          ▼
                     ┌────────────────────────────────────────────┐
                     │           ALB / API Gateway                │
                     └────────────────────┬───────────────────────┘
                                          │
                ┌─────────────────────────┴─────────────────────────┐
                │                                                   │
                ▼                                                   ▼
   ┌────────────────────────┐                       ┌────────────────────────┐
   │ FastAPI (ECS Fargate)  │  ◄──── Redis ────►    │  Celery workers        │
   │ - auth/route/service   │      (broker +        │ - OCR pipeline         │
   │ - serves /api/v1       │       cache)          │ - PDF & email          │
   └──────────┬─────────────┘                       │ - report aggregations  │
              │                                     └──────────┬─────────────┘
              │                                                │
              ▼                                                ▼
   ┌────────────────────────┐                       ┌────────────────────────┐
   │   MongoDB Atlas        │ ◄────────────────────►│  S3 / MinIO            │
   │   (replica set,        │                       │  invoices, PDFs        │
   │    multi-AZ, PITR)     │                       └────────────────────────┘
   └────────────────────────┘
              │
              ▼ outbound
   ┌────────────────────────┐  ┌──────────────────┐  ┌──────────────┐
   │ AWS Textract / OCR     │  │ Anthropic/OpenAI │  │ GSTN APIs    │
   └────────────────────────┘  └──────────────────┘  └──────────────┘
```

### 11.2 Request lifecycle

```
FE → axios → ALB → FastAPI middleware
  request_id   →   tenant resolver   →   auth dep   →   permission dep
  →   route handler   →   service (Beanie + Mongo session)
  →   service may publish event (e.g. "voucher.posted")
  →   event bus (in-process or Redis pub/sub) → workers
  →   response envelope → middleware → ALB → FE
  →   Sentry + structlog capture along the way
```

### 11.3 Environments

- **dev** — Docker compose: api, mongo, redis, minio. `.env.local`.
- **staging** — mirrors prod schema, real Atlas cluster, anonymized data dump.
- **production** — Atlas M30+, multi-AZ, daily snapshots, PITR, alerts wired to PagerDuty/Slack.

### 11.4 Deployment

- Trunk-based, feature flags via simple `companies.feature_flags` doc or Unleash.
- Blue/green or canary via ECS task sets.
- DB index changes via versioned migration scripts (`app/db/migrations/00xx_*.py`), applied automatically on container start (idempotent).

---

## 12. Module-by-module implementation order

Each step is a self-contained deliverable: routes + schemas + service + tests + docs + frontend wiring.

### Phase 1 — Foundation (must finish before any feature)
1. **Project skeleton** — FastAPI app, settings, logging, error handlers, request ID middleware, Docker compose
2. **DB core** — Beanie init, Mongo client, transaction helper, base Document with `company_id` + soft-delete mixin
3. **Auth** — register/login/refresh/me, password hashing, JWT, refresh-rotation, tests
4. **Tenant middleware** — `X-Company` resolution + `get_current_company` dep
5. **Roles & permissions** — model, dependency, catalog endpoint

### Phase 2 — Master data (everything else depends on this)
6. **Companies** — CRUD + GST registrations + super-admin gate
7. **Users** — CRUD + invite + company allocation (`Allocate Accountant`)
8. **Ledgers** — chart of accounts CRUD + group taxonomy + party-ledger flag
9. **Stock items** — CRUD + HSN catalog + opening balances
10. **Voucher numbering series** — atomic generator

### Phase 3 — Core accounting (the actual product)
11. **Vouchers — base** — create draft, list, get, edit-draft, delete-draft (sales/purchase/journal types)
12. **Voucher workflow** — submit, post (with **transaction** generating `ledger_postings` + `audit_log`), reject
13. **Vouchers — remaining types** — credit_note, debit_note, payment, receipt, contra, fund_flow
14. **Invoices** — alias module + numbering + email + PDF
15. **Quotations** — CRUD + convert-to-invoice

### Phase 4 — Documents & automation
16. **Documents** — upload to S3, signed URLs, link to entities
17. **OCR pipeline** — submit job, Celery worker, Textract integration, draft-voucher seed
18. **Bank module** — accounts, rules, transaction import (CSV), match/categorize/archive

### Phase 5 — Intelligence & reporting
19. **Reports — party / stock ledger** — read from `ledger_postings`
20. **Reports — trial balance / P&L / balance sheet** — server-side aggregation
21. **Reports — GSTR-1 / GSTR-3B** — government filing format
22. **AI bot** — conversation + streaming chat + Atlas vector index for RAG

### Phase 6 — Cross-cutting
23. **Audit log** — list endpoint + entity timeline
24. **Notifications** — email events (voucher posted, subscription renewal)
25. **Admin** — usage metrics, tenant onboarding
26. **Hardening** — rate limits, security headers, full OWASP pass
27. **Observability** — OpenTelemetry, Sentry, dashboards
28. **Documentation** — README, runbook, on-call rotation, API contracts

> Each item produces a deployable backend tag, and the FE's existing `companies/{api,schema,hooks}.js` pattern is copied for each — meaning each backend module unlocks one feature in the UI immediately.

---

## 13. Security recommendations

| Concern | Implementation |
|---|---|
| Transport | HTTPS only, HSTS, redirect HTTP → HTTPS at LB |
| Headers | CSP, X-Frame-Options=DENY, X-Content-Type-Options=nosniff, Referrer-Policy=strict-origin-when-cross-origin via middleware |
| Auth tokens | Short-lived access JWT, rotating refresh, family revocation on reuse |
| Passwords | Argon2id, min 12 chars, breach-list check on signup (haveibeenpwned k-anon API) |
| Rate limiting | Redis token bucket: 10/min on login, 60/min on writes, 300/min on reads |
| Input | Pydantic on every body / query / path; reject extra fields by default (`model_config = ConfigDict(extra="forbid")`) |
| Mongo injection | All queries through Beanie (parameterized). Never accept raw `$where`/JSON filter from the client |
| File uploads | Server-side MIME sniffing, max size cap (25 MB), virus scan (ClamAV) for OCR uploads, store under random keys |
| S3 | Buckets private, presigned URLs (15-min expiry), no `s3:PutObjectAcl` from app |
| PII / sensitive | PAN/GSTIN/bank account numbers — application-layer encryption (`cryptography.Fernet` with KMS key) for the full value, store last 4 plain |
| Secrets | AWS Secrets Manager / Doppler. Never commit. CI uses OIDC, not long-lived keys |
| Audit log | Append-only, hash-chained optional; immutable bucket policy if exported to S3 |
| Sessions | Stateless JWT; refresh-token revocation table; "log out of all devices" endpoint |
| CSRF | Not needed (no cookie auth). If we ever add cookie sessions: SameSite=Lax + double-submit |
| Logging hygiene | Mask Authorization headers, password fields, OTPs from logs (structlog processor) |
| Dependency hygiene | `pip-audit` in CI, weekly Dependabot |
| Pen testing | Annual VAPT once first paying customer onboarded |
| Compliance | India DPDP Act 2023: data export endpoint, deletion endpoint, consent flags |

---

## 14. Scalability recommendations

| Dimension | Plan |
|---|---|
| Stateless API | All app state in Mongo/Redis/S3 — workers fully horizontally scalable |
| Mongo scaling | Start single replica set; shard on `company_id` once any tenant exceeds 10M docs |
| Read replicas | Reports can read from secondaries with `read_preference=secondaryPreferred` |
| Hot tenant isolation | Reserved capacity for top-tier subscribers, dedicated replica set if needed |
| Background jobs | Celery autoscaling on queue depth; separate queues per priority (`ocr`, `email`, `reports`) |
| Caching | Redis for: permission lookups (60s), master-data dropdowns (5 min), report snapshots (24 h) |
| WebSocket scaling | Redis pub/sub backplane if we add real-time updates |
| File CDN | S3 + CloudFront for invoice PDFs; signed URLs |
| FE bundle | Already lazy-loaded; HTTP/2 push not needed |
| API gateway | Gradual move to API Gateway + Lambda for spiky endpoints (PDF render, OCR submission) |

---

## 15. Performance optimizations

| Area | Technique |
|---|---|
| Mongo reads | Compound indexes match WHERE+SORT; cover queries with projection |
| Mongo writes | `bulk_write` for line items, `update_one` over `replace_one` for partial updates |
| N+1 hazard | Embed line items in `vouchers`; for lookups use `$lookup` once, not per-row |
| Money pipeline | Pre-compute totals on save; do not recompute on every list view |
| Reports | Pre-aggregate trial balance nightly into `report_snapshots` |
| Pagination | Keyset (`createdAt`+`_id`) for infinite scrolls; offset only for admin UI |
| Serialization | Pydantic v2 (rust core) is ~5× faster than v1; keep schemas tight |
| Logging | Async logger sink so structlog never blocks request thread |
| Connection pool | `motor` default 100; raise/lower based on load test |
| Hot endpoints | Profile with `py-spy` and add `lru_cache` only where measured |

---

## 16. Missing frontend issues that may cause backend problems

Found during the FE analysis. Each one is a small change that prevents a big backend retrofit later.

| # | Issue | Why it matters | Recommended FE change |
|---|---|---|---|
| 1 | `selectedCompany` is sent as a **company name string** in `X-Company` header (see `lib/axios.js`) | Names can change; ID is permanent | Store `{id, name}` in `useAppStore`. Send `id` in header, render `name` |
| 2 | `useAppStore.companies` is **hard-coded** to 4 demo names | UI will list wrong companies once API is live | Replace with `useCompanies()` (React Query) on app mount |
| 3 | Voucher forms (`CreateSales`, `CreateInvoice`, `CreatePurchase`) use **uncontrolled inputs** in many places | Cannot submit reliably; values lost on re-render | Move to `react-hook-form` (already on the FE plan) |
| 4 | `PurchaseInvoiceWithInventory` / `PurchaseInvoiceWithoutInventory` are **duplicated** | Two FE codepaths → two backend payload shapes | Merge to one component + `withInventory: boolean` field |
| 5 | Line-item totals (`amount = qty*rate*(1-disc/100)`) computed in FE only | Tax filings will diverge if rounding differs | Always recompute server-side on save; FE values are advisory |
| 6 | No **idempotency keys** on POST `/vouchers` | Double-click → two vouchers | Send `Idempotency-Key: <uuid>` header; backend dedupes for 24 h |
| 7 | No **optimistic concurrency** version field | Two users editing same draft will overwrite | Backend returns `version`; FE sends `If-Match: <version>` on PATCH |
| 8 | Search/filter inputs are not **debounced** | Hammered backend search | Add `useDebouncedValue(query, 300)` in panel components |
| 9 | Pagination size **not standardized** | Some lists may demand thousands | Always send `?page=&limit=` (cap server-side at 200) |
| 10 | `Bot` mode UI sends free-text → backend has to act on it | Risk of confused state ("create invoice for ?") | Define a tool-calling protocol: FE renders structured tool cards from the streamed JSON |
| 11 | `Camera`/`Scan` modes record images but **no file-type / size guard** | Server can be DoS-uploaded | Validate ≤10 MB, `image/*` or `application/pdf` |
| 12 | No **error-state UI** for any panel | Backend errors will silently 500 → blank screen | Wrap each panel in `react-error-boundary` per route (lightweight on top of global `ErrorBoundary`) |
| 13 | Money fields are typed as `Number` in FE (e.g. `parseFloat(value)`) | Floating-point in INR amounts | Switch to `decimal.js`; serialize as string in JSON, deserialize as Decimal in backend |
| 14 | No **fiscal-year selector** despite India fiscal year being non-calendar | Backend needs to know which year to query | Add fiscal year to `useAppStore`; send as `?fy=2025-26` |
| 15 | `MyDocumentsPanel` lets users see all docs | Without server-side `company_id` filter it would leak across tenants | Already mitigated server-side via tenant header — confirm test |

Address #1, #5, #6, #7 **before** wiring the first voucher POST. They are 30-minute changes now, multi-day rewrites later.

---

## 17. API response structure

**Single envelope for everything.** Keeps FE deserialization uniform.

### 17.1 Success — single resource

```json
{
  "data": { "id": "...", "name": "..." },
  "meta": { "requestId": "req_01HX..." }
}
```

### 17.2 Success — list

```json
{
  "data": [ {...}, {...} ],
  "meta": {
    "requestId": "req_01HX...",
    "page": 1,
    "limit": 50,
    "total": 1234,
    "totalPages": 25,
    "hasNext": true
  }
}
```

### 17.3 Success — empty / 204

For deletes: 204 No Content.

### 17.4 Error

```json
{
  "error": {
    "code": "VOUCHER_DEBIT_CREDIT_MISMATCH",
    "message": "Voucher debits (1200.00) do not equal credits (1000.00).",
    "details": { "debit": "1200.00", "credit": "1000.00" },
    "requestId": "req_01HX..."
  }
}
```

`code` is a stable machine-readable string (FE switches on it). `message` is human-readable. `details` is optional and structured.

### 17.5 Validation errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid.",
    "details": {
      "fields": {
        "lines.0.qty": "must be >= 0",
        "voucher_date": "must be in current fiscal year"
      }
    },
    "requestId": "..."
  }
}
```

FE maps `details.fields` straight into `react-hook-form` field errors.

### 17.6 HTTP status conventions

| Status | Meaning |
|---|---|
| 200 | OK with body |
| 201 | Created (single resource) |
| 204 | OK, no body |
| 400 | Bad request — malformed |
| 401 | Unauthorized — missing/invalid token |
| 403 | Forbidden — permission denied |
| 404 | Not found — or hidden by tenant scope |
| 409 | Conflict — version mismatch / unique constraint / state machine |
| 422 | Validation failed |
| 429 | Rate limited (with `Retry-After`) |
| 500 | Unexpected — Sentry captured |

---

## 18. Error handling strategy

### 18.1 Exception hierarchy

```py
class AppError(Exception):
    code: str = "INTERNAL_ERROR"
    status_code: int = 500
    message: str = "Something went wrong."
    details: dict | None = None

class NotFoundError(AppError):       code, status_code = "NOT_FOUND", 404
class ForbiddenError(AppError):      code, status_code = "FORBIDDEN", 403
class ConflictError(AppError):       code, status_code = "CONFLICT", 409
class ValidationError(AppError):     code, status_code = "VALIDATION_ERROR", 422
class StateError(AppError):          code, status_code = "INVALID_STATE", 409   # workflow transitions
class IdempotencyConflict(AppError): code, status_code = "IDEMPOTENCY_CONFLICT", 409
```

Domain exceptions inherit and specialize: `VoucherNotBalancedError`, `LedgerLockedError`, etc.

### 18.2 Global handlers

```py
@app.exception_handler(AppError)
async def app_err(req, exc):
    log.error("app_error", code=exc.code, request_id=req.state.req_id)
    return JSONResponse(status_code=exc.status_code, content={
        "error": {
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
            "requestId": req.state.req_id,
        }
    })

@app.exception_handler(RequestValidationError)
async def validation_err(req, exc): ...   # convert Pydantic errors to fields map

@app.exception_handler(Exception)
async def fallback(req, exc):
    sentry_sdk.capture_exception(exc)
    log.exception("unhandled", request_id=req.state.req_id)
    return JSONResponse(500, content={"error": {...}})
```

### 18.3 Service-layer rules

- **Service raises domain exceptions** (`VoucherNotBalancedError`); routes never construct `HTTPException` directly.
- **Never swallow exceptions** without logging.
- Every transaction is wrapped in try/except that aborts on failure — never `commit()` partial state.

### 18.4 Frontend integration

```js
// Already prepared by axios interceptor + Sonner
api.interceptors.response.use(undefined, (err) => {
  const { code, message } = err.response?.data?.error ?? {}
  if (code === "VALIDATION_ERROR") return Promise.reject(err) // RHF will pick up details
  toast.error(message ?? "Request failed")
  return Promise.reject(err)
})
```

### 18.5 Request IDs

Every request gets one (`req_<ulid>`), echoed in response header `X-Request-ID`, in every log line, and in error payloads. Customer support copies it from the toast → you find the trace in 10 seconds.

---

## 19. Best practices

### 19.1 Code

- **No business logic in routes.** Route → schema validation → service call → schema-wrapped response. Routes are 5–15 lines.
- **Service signatures take Pydantic DTOs**, not raw dicts. Type-checked by mypy.
- **Beanie models are not exposed** to the API — always pass through a response schema.
- **Avoid global state** beyond the singleton DB client and settings.
- **No `print()`.** Use `structlog`.
- **No `time.sleep` in request path.** Async all the way down.

### 19.2 Data

- **Money: Decimal128 everywhere.**
- **Dates: UTC in DB, render in client TZ.**
- **Strings: ObjectIds as 24-hex strings on the wire.**
- **Enums: Python `Literal[...]` + Mongo $jsonSchema enum.**

### 19.3 Testing

- **Unit:** service functions, money math, GST splitter — pure functions, no DB.
- **Integration:** route + service + Mongo (testcontainers or `mongomock_motor`).
- **E2E:** full FE+BE flow with Playwright (already in FE roadmap).
- **Coverage gate:** 80% on `service/` and `core/`; 50% overall is fine.
- **One test per public service method.**
- **Snapshot tests for GST + double-entry math.** Bugs there are unforgivable.

### 19.4 Git / process

- Trunk-based, short-lived branches.
- Conventional commits (already used in repo).
- One PR per module phase from §12. Every PR closes the loop with both the BE module and the FE feature wired up.
- Each PR ships: code + tests + an updated piece of `BACKEND_PLAN.md` if architecture changes.

### 19.5 Operations

- **Runbook** per module: alerts, common errors, recovery steps.
- **Daily backup verification** (restore to a scratch cluster).
- **On-call rotation** with PagerDuty once paying customers exist.
- **Status page** (statuspage.io) once external users exist.

### 19.6 Documentation

- README per module folder explaining intent, endpoints, data model.
- Public API docs served at `/docs` (Swagger) and `/redoc`.
- This file (`BACKEND_PLAN.md`) is the **source of truth** for architecture — updated on every significant decision.

---

## 20. Conversation log

This section preserves the dialogue that produced this plan, for future reviewers.

### Round 1 — Initial request (user)
> "I already have a React frontend project completed. Your task is to act like a senior full-stack architect. Analyze my frontend project structure, pages, components, forms, state management, and UI flow. Then create a complete backend development workflow for me. … Do NOT generate the entire backend immediately. First deeply analyze the frontend and create the complete professional workflow and architecture plan. After that, we will implement modules one-by-one. Tech preference: React frontend, Python + FastAPI, MongoDB, Mongose, Production-level best practices."

### Round 1 — Architect response (assistant)
- Corrected the tech stack note: **Mongoose is Node.js. The Python equivalent is Beanie (recommended) or MongoEngine.**
- Performed a deep frontend analysis from existing files (`VoucherEntryEngine`, `CreateSales`, `CreateInvoice`, `PettyCashPanel`, `SalesPanel`, `PurchasePanel`, `routePaths.js`, `useAppStore`, `lib/axios.js`).
- Identified the product as a multi-tenant Indian-style accounting / ERP with double-entry, GST, inventory, OCR, AI-assisted entry, role-based access, workflow (Inbox → Review → Posted/Archive).
- Produced this 19-section workflow.

### Decisions locked
- **DB:** MongoDB 7 + Beanie ODM, transactions used for every voucher state change, `ledger_postings` denormalization for reports.
- **Auth:** JWT access (15 min) + rotating refresh (7 days), Argon2id, RS256.
- **Authz:** RBAC per tenant via `user_company_roles`, permission keys.
- **Validation:** Pydantic v2 + business invariants in service + Mongo $jsonSchema (defense in depth).
- **API:** REST, `/api/v1`, single envelope, code-stable error contract.
- **Folder structure:** `app/core` + `app/modules/<domain>` with strict dependency direction.
- **First implementation phase:** project skeleton → DB core → auth → tenant → roles.

### Open questions — RESOLVED (defaults accepted by user)

| # | Decision |
|---|---|
| 1 | **INR + English only** in v1 |
| 2 | **MongoDB Atlas M10** (Mumbai region, replica set, PITR enabled). M0 free tier for dev. |
| 3 | **GSTN integration → v2.** v1 generates GSTR-1 / GSTR-3B JSON locally; user uploads to portal manually. |
| 4 | **AWS Textract** in prod, **Tesseract** in dev (offline docker-compose). |
| 5 | **Anthropic Claude (`claude-sonnet-4-6`)** for the AI bot — streaming + tool calls. |
| 6 | **AWS ECS Fargate** in `ap-south-1` (Mumbai) for data residency / DPDP Act. |
| 7 | **Subscription billing → v2.** v1 uses a manual `subscription_expires_at` field set by admin. Stripe deferred until first 10 paying tenants. |

These choices defer four heavy integrations (GSTN, Stripe, cloud-OCR setup, multi-currency) to v2, making v1 ship faster without changing the module list.

### Next step
On your green-light, I'll begin **Phase 1, Step 1: project skeleton** — FastAPI app + settings + logging + error handlers + Docker compose. One PR, ~150 lines, fully runnable `make dev`. Then we move down §12 one item at a time.
