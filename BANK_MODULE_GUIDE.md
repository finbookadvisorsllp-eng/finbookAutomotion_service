# Bank Module — Complete Implementation Guide

> Project: Phase2 Accounting Automation
> Module: **Bank** (Sidebar → Landmark icon)
> Sub-tabs: `Manage Bank` · `Manage Rule` · `Inbox` · `Review` · `Archive`
> Backend: Node.js + Express + Mongoose (MongoDB) — `d:/phase2/server`
> Frontend: React + Vite + Tailwind — `d:/phase2/python_service`

---

## 1. Bank module kya karta hai? (Purpose)

Ye module ek **bank statement automation engine** hai. Workflow simple hai:

1. User apna **bank account** add karta hai (Manage Bank).
2. User **bank statement** (PDF/Excel/CSV) upload karta hai.
3. System statement parse karke har line ko **Inbox** me daalta hai (uncategorized).
4. User pehle se **Rules** banata hai (Manage Rule) — e.g. "agar description me 'Zomato' hai aur amount > 0 → Party Ledger = 'Zomato Ltd', Replaced Type = 'Expense'".
5. System Inbox ki har transaction par rules apply karke auto-categorize karta hai.
6. Categorized transactions **Review** me jate hain → accountant approve karta hai.
7. Approved transactions **Archive** me chali jati hain aur Tally/ledger me posted ho jati hain.

Reference industry pattern: Zoho Books "Transaction Rules" + QuickBooks "Bank Rules" + DocuClipper-style PDF statement parsing.

---

## 2. Existing Frontend (jo already bana hai)

File: [python_service/src/components/banking/BankPanel.jsx](python_service/src/components/banking/BankPanel.jsx)

Sidebar entry (line 26): `{ key: 'Bank', icon: Landmark, children: ['Manage Bank', 'Manage Rule', 'Inbox'] }`
Plus `Bank Review` (Review section) and `Bank Archive` (Archive section).

Sub-tabs already wired hain — modals bhi bani hain (AddBank, UploadStatement, AddRule, BulkUpload). **Sirf dummy data hai** — backend abhi banana hai.

---

## 3. Pancho Tabs ke Fields — Detail

### 3.1 Manage Bank (Bank Account Master)

| Field | Type | Required | Notes |
|---|---|---|---|
| `bankName` | String (enum/dropdown) | ✅ | HDFC, ICICI, SBI, Axis, Kotak, PNB, HSBC, Yes, DBS, Standard Chartered |
| `accountName` | String | ✅ | Account holder name (e.g. "Aman", "Friends Grafix") |
| `accountNumber` | String | ✅ | Unique per company, mask in UI (last 4 visible) |
| `bankLedger` | String / Ref to Ledger | ✅ | Linked Tally/internal ledger name (e.g. "HDFC BANK 50200040438661") |
| `ifscCode` | String | ⚪ | Validate format `^[A-Z]{4}0[A-Z0-9]{6}$` |
| `branchName` | String | ⚪ | |
| `accountType` | Enum | ⚪ | `current` / `savings` / `od` / `cc` / `loan` |
| `currency` | String | ⚪ | Default `INR` |
| `openingBalance` | Number | ⚪ | Date-wise opening |
| `openingDate` | Date | ⚪ | |
| `isActive` | Boolean | ⚪ | Soft delete flag |
| `companyId` | String (tenant) | ✅ | Multi-tenant scope |
| `createdBy` / `updatedBy` | String | auto | |
| `createdAt` / `updatedAt` | Date | auto | timestamps |

**Actions row me jo icons hain:** Upload statement, Edit, Refresh/Sync feed, Delete.

---

### 3.2 Manage Rule (Bank Rule Engine)

Rule = **Condition Field** + **Action Field**.

#### Condition Field (matching criteria)

| Field | Type | Match Operators |
|---|---|---|
| `bankAccountId` | Ref → ManageBank | `equals` |
| `dateFrom` / `dateTo` | Date range | `between` (optional) |
| `descriptionPattern` | String | `contains`, `starts_with`, `ends_with`, `equals`, `regex` |
| `paymentMode` | Enum | NEFT / RTGS / IMPS / UPI / Cheque / Cash / Card |
| `transactionType` | Enum | Payment / Receipt / Contra |
| `amountMin` / `amountMax` | Number | `between` |
| `referenceNumber` | String | `contains` |

#### Action Field (what to do on match)

| Field | Type | Required |
|---|---|---|
| `replacedType` | Enum | ✅ — Sales / Purchase / Expense / Salary / Rent / Tax / Insurance / Income |
| `partyLedger` | String / Ref → Ledger | ✅ |
| `voucherType` | Enum (cash_payment / bank_payment / contra) | ✅ |
| `costCenter` | String | ⚪ |
| `narrationTemplate` | String | ⚪ — supports `{{description}}`, `{{amount}}` placeholders |
| `priority` | Number | ⚪ — order of execution (1 = highest) |
| `isActive` | Boolean | ⚪ | |

**Important logic:** Rules priority-order me chalti hain. First match wins. Agar koi rule match nahi hua → transaction Inbox me "uncategorized" rehti hai.

---

### 3.3 Inbox (Raw Imported Transactions)

Ye `BankStatementTransaction` collection se aati hai, status = `inbox`.

| Field | Type | Notes |
|---|---|---|
| `txnId` | ObjectId | PK |
| `bankAccountId` | Ref | Linked Manage Bank |
| `statementUploadId` | Ref | Upload batch reference |
| `valueDate` / `txnDate` | Date | |
| `description` | String | Raw bank narration |
| `referenceNumber` | String | UTR / Cheque No / UPI ref |
| `debit` | Number | Money out |
| `credit` | Number | Money in |
| `amount` | Number | Computed = credit − debit |
| `txnType` | Enum | Payment / Receipt / Contra (auto-detected) |
| `paymentMode` | Enum | Auto-detect from description (UPI/NEFT/RTGS/IMPS) |
| `runningBalance` | Number | From statement |
| `rawHash` | String (sha256) | Dedup — same txn na repeat ho |
| `status` | Enum | `inbox` / `auto_matched` / `review` / `approved` / `archived` / `ignored` |
| `matchedRuleId` | Ref / null | Rule jisne match kiya |
| `partyLedger` | String / null | After categorize |
| `replacedType` | String / null | After categorize |
| `confidence` | Number 0–1 | AI/Rule confidence score |
| `companyId` | String | Tenant |
| `createdAt` | Date | |

**Filters needed:** description text, amount range, date range, type, party ledger, "Selected/Not Selected Ledger" toggle.

---

### 3.4 Review

Same schema as Inbox row, but `status = 'review'`. Yahan accountant **approve / reject / edit** karta hai.

Extra fields:
- `reviewedBy`, `reviewedAt`
- `reviewNote` (text)
- `linkedVoucherId` (after approval → FundFlowTransaction me voucher ban jata hai)

---

### 3.5 Archive

`status = 'archived'`. Read-only. Voucher already post ho chuka hai (link to `FundFlowTransaction`).

Display: Date, Description, Amount, Type, Party Ledger, Status (Approved), linked Voucher #.

---

## 4. Database Schema (Mongoose) — Banane ke liye

Folder: `d:/phase2/server/src/models/`

### 4.1 `BankAccount.model.js` (new)

```js
import mongoose from 'mongoose';

const BankAccountSchema = new mongoose.Schema({
  bankName:       { type: String, required: true, trim: true },
  accountName:    { type: String, required: true, trim: true },
  accountNumber:  { type: String, required: true, trim: true },
  bankLedger:     { type: String, required: true, trim: true },
  ifscCode:       { type: String, trim: true, uppercase: true },
  branchName:     { type: String, trim: true },
  accountType:    { type: String, enum: ['current','savings','od','cc','loan'], default: 'current' },
  currency:       { type: String, default: 'INR' },
  openingBalance: { type: Number, default: 0 },
  openingDate:    { type: Date },
  isActive:       { type: Boolean, default: true },
  companyId:      { type: String, required: true, index: true },
  createdBy:      { type: String },
  updatedBy:      { type: String },
}, { timestamps: true, collection: 'bank_accounts' });

BankAccountSchema.index({ companyId: 1, accountNumber: 1 }, { unique: true });

export default mongoose.model('BankAccount', BankAccountSchema);
```

### 4.2 `BankRule.model.js` (new)

```js
import mongoose from 'mongoose';

const BankRuleSchema = new mongoose.Schema({
  ruleName:        { type: String, trim: true },
  bankAccountId:   { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount' },

  // Conditions
  conditions: {
    dateFrom:           { type: Date },
    dateTo:             { type: Date },
    descriptionMatch:   { type: String, enum: ['contains','starts_with','ends_with','equals','regex'], default: 'contains' },
    descriptionValue:   { type: String, trim: true },
    paymentMode:        { type: String, trim: true },
    transactionType:    { type: String, enum: ['Payment','Receipt','Contra','Journal','Transfer'] },
    amountMin:          { type: Number },
    amountMax:          { type: Number },
    referenceNumber:    { type: String, trim: true },
  },

  // Actions
  actions: {
    replacedType:     { type: String, required: true },
    partyLedger:      { type: String, required: true },
    voucherType:      { type: String, enum: ['cash_payment','bank_payment','contra'] },
    costCenter:       { type: String },
    narrationTemplate:{ type: String },
  },

  priority:  { type: Number, default: 100 },
  isActive:  { type: Boolean, default: true },
  companyId: { type: String, required: true, index: true },
  createdBy: { type: String },
  matchCount:{ type: Number, default: 0 }, // analytics — kitni baar fire hui
}, { timestamps: true, collection: 'bank_rules' });

BankRuleSchema.index({ companyId: 1, isActive: 1, priority: 1 });

export default mongoose.model('BankRule', BankRuleSchema);
```

### 4.3 `BankStatementTransaction.model.js` (new) — Inbox/Review/Archive sab isi me

```js
import mongoose from 'mongoose';

const BankStatementTransactionSchema = new mongoose.Schema({
  bankAccountId:     { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', required: true, index: true },
  statementUploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankStatementUpload' },

  txnDate:        { type: Date, required: true, index: true },
  valueDate:      { type: Date },
  description:    { type: String, trim: true },
  referenceNumber:{ type: String, trim: true },

  debit:          { type: Number, default: 0 },
  credit:         { type: Number, default: 0 },
  amount:         { type: Number, default: 0 }, // credit - debit
  runningBalance: { type: Number },

  txnType:        { type: String, enum: ['Payment','Receipt','Contra','Journal','Transfer'] },
  paymentMode:    { type: String }, // auto detect

  // Dedup
  rawHash:        { type: String, index: true },

  // Categorization
  status: {
    type: String,
    enum: ['inbox','auto_matched','review','approved','archived','ignored','rejected'],
    default: 'inbox',
    index: true,
  },
  matchedRuleId:  { type: mongoose.Schema.Types.ObjectId, ref: 'BankRule' },
  partyLedger:    { type: String },
  replacedType:   { type: String },
  confidence:     { type: Number, default: 0 },

  // Review
  reviewedBy:     { type: String },
  reviewedAt:     { type: Date },
  reviewNote:     { type: String },

  // Post-approval link
  linkedVoucherId:{ type: mongoose.Schema.Types.ObjectId, ref: 'FundFlowTransaction' },

  companyId:      { type: String, required: true, index: true },
}, { timestamps: true, collection: 'bank_statement_transactions' });

BankStatementTransactionSchema.index({ companyId: 1, bankAccountId: 1, status: 1 });
BankStatementTransactionSchema.index({ rawHash: 1, bankAccountId: 1 }, { unique: true });

export default mongoose.model('BankStatementTransaction', BankStatementTransactionSchema);
```

### 4.4 `BankStatementUpload.model.js` (new) — har upload ka batch record

```js
import mongoose from 'mongoose';

const BankStatementUploadSchema = new mongoose.Schema({
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', required: true },
  fileName:      { type: String },
  cloudinaryUrl: { type: String },
  fileFormat:    { type: String, enum: ['pdf','xlsx','xls','csv','ofx'] },
  dateFrom:      { type: Date },
  dateTo:        { type: Date },
  totalRows:     { type: Number, default: 0 },
  parsedRows:    { type: Number, default: 0 },
  failedRows:    { type: Number, default: 0 },
  duplicateRows: { type: Number, default: 0 },
  status:        { type: String, enum: ['queued','parsing','parsed','failed'], default: 'queued' },
  errorLog:      [{ row: Number, error: String }],
  companyId:     { type: String, required: true, index: true },
  uploadedBy:    { type: String },
}, { timestamps: true, collection: 'bank_statement_uploads' });

export default mongoose.model('BankStatementUpload', BankStatementUploadSchema);
```

---

## 5. Backend Routes (Express)

Folder: `d:/phase2/server/src/routes/` (similar to existing `fundflow.routes.js`)

### `bank.routes.js`

```
# Bank Accounts
GET    /api/bank/accounts                  → list
POST   /api/bank/accounts                  → create
PUT    /api/bank/accounts/:id              → update
DELETE /api/bank/accounts/:id              → soft delete

# Bank Rules
GET    /api/bank/rules                     → list (sorted by priority)
POST   /api/bank/rules                     → create
PUT    /api/bank/rules/:id                 → update
DELETE /api/bank/rules/:id
POST   /api/bank/rules/bulk-upload         → Excel bulk import
POST   /api/bank/rules/:id/test            → dry-run on inbox

# Statement Upload + Parsing
POST   /api/bank/statements/upload         → multipart, returns uploadId
GET    /api/bank/statements/uploads/:id    → poll status
POST   /api/bank/statements/:id/reparse

# Transactions (Inbox / Review / Archive)
GET    /api/bank/transactions?status=inbox&bankAccountId=&from=&to=&q=
GET    /api/bank/transactions/:id
PATCH  /api/bank/transactions/:id          → categorize manually (set partyLedger etc.)
POST   /api/bank/transactions/:id/approve  → moves to review/approved + creates voucher
POST   /api/bank/transactions/:id/reject
POST   /api/bank/transactions/bulk-approve
POST   /api/bank/transactions/bulk-categorize
POST   /api/bank/transactions/run-rules    → re-run rule engine on inbox
```

### Controller folder layout

```
server/src/
├── models/
│   ├── BankAccount.model.js
│   ├── BankRule.model.js
│   ├── BankStatementTransaction.model.js
│   └── BankStatementUpload.model.js
├── controllers/
│   └── bank.controller.js
├── services/
│   ├── bankStatementParser.service.js   ← PDF/Excel/CSV parsing
│   ├── bankRuleEngine.service.js        ← rule matching logic
│   └── bankReconciliation.service.js
├── jobs/
│   └── parseStatementJob.js             ← async parsing (BullMQ / setImmediate)
└── routes/
    └── bank.routes.js
```

---

## 6. Statement Parsing (Critical Piece)

Python service folder me ye logical fit hai (project ka naam `python_service` hai — implies PDF parsing here). Suggested approach:

| File Type | Library |
|---|---|
| **PDF** | `pdfplumber` (Python) OR `pdf-parse` + `tabula` for tables |
| **Excel (.xlsx/.xls)** | `xlsx` (SheetJS) or `exceljs` |
| **CSV** | `papaparse` or `csv-parse` |
| **OFX/QIF** | `node-ofx-parser` |

**Pipeline:**
1. Upload → Cloudinary store → `BankStatementUpload` record `status=queued`
2. Worker picks job → parses rows → normalize columns to `{date, description, debit, credit, refNo, balance}`
3. For each row → compute `rawHash = sha256(bankAccountId + txnDate + amount + description)` — dedup
4. Auto-detect `paymentMode` via regex (e.g. `/UPI|NEFT|RTGS|IMPS|ATM|CHQ/i`)
5. Insert into `BankStatementTransaction` with `status='inbox'`
6. Trigger rule engine

**Headers must be present** (already shown in UI). Build a column-mapping screen for unknown bank formats.

---

## 7. Rule Engine Logic (Core)

```js
// services/bankRuleEngine.service.js (pseudocode)
async function runRulesOnInbox(companyId, bankAccountId) {
  const rules = await BankRule.find({ companyId, isActive: true })
                              .sort({ priority: 1 });
  const txns = await BankStatementTransaction.find({
    companyId, bankAccountId, status: 'inbox'
  });

  for (const txn of txns) {
    for (const rule of rules) {
      if (matches(txn, rule.conditions)) {
        txn.status        = 'auto_matched';
        txn.matchedRuleId = rule._id;
        txn.partyLedger   = rule.actions.partyLedger;
        txn.replacedType  = rule.actions.replacedType;
        txn.confidence    = 1.0;
        await txn.save();
        await BankRule.updateOne({ _id: rule._id }, { $inc: { matchCount: 1 } });
        break; // first match wins
      }
    }
  }
}

function matches(txn, c) {
  if (c.amountMin != null && txn.amount < c.amountMin) return false;
  if (c.amountMax != null && txn.amount > c.amountMax) return false;
  if (c.transactionType && txn.txnType !== c.transactionType) return false;
  if (c.paymentMode && txn.paymentMode !== c.paymentMode) return false;
  if (c.dateFrom && txn.txnDate < c.dateFrom) return false;
  if (c.dateTo && txn.txnDate > c.dateTo) return false;
  if (c.descriptionValue) {
    const d = (txn.description||'').toLowerCase();
    const v = c.descriptionValue.toLowerCase();
    switch (c.descriptionMatch) {
      case 'equals':      if (d !== v) return false; break;
      case 'starts_with': if (!d.startsWith(v)) return false; break;
      case 'ends_with':   if (!d.endsWith(v)) return false; break;
      case 'regex':       if (!new RegExp(c.descriptionValue,'i').test(d)) return false; break;
      default:            if (!d.includes(v)) return false;
    }
  }
  return true;
}
```

**AI Enhancement (Phase 2):** Agar koi rule match nahi hua, embedding-based similarity se past approved transactions ke saath compare karke "suggested party ledger" provide karo (confidence score). Zoho Books bhi yahi karta hai.

---

## 8. Approval Flow

```
Inbox  ──(rule match)──►  Auto-Matched  ──(user submits)──►  Review
                                 │
                                 └──(no match, manual)──────►  Review

Review ──(approve)──►  Approved + creates FundFlowTransaction (voucher)
       ──(reject)───►  Rejected
       ──(edit)────►  Review (updated)

Approved ──(period close)──►  Archive (read-only)
```

Approval pe **`FundFlowTransaction`** (existing model) me ek voucher banao — `voucherType` mapping:
- credit (Receipt) → `bank_payment` reverse / or a Receipt voucher
- debit (Payment) → `bank_payment`
- internal transfer → `contra`

`linkedVoucherId` set karke audit trail maintain ho.

---

## 9. Frontend ↔ Backend Wiring (TODO)

Currently [BankPanel.jsx](python_service/src/components/banking/BankPanel.jsx) me sab hardcoded data hai (`MANAGE_BANK_DATA`, `BANK_RULE_DATA`, `INBOX_DATA`, etc.).

**Steps:**

1. **API service file banao:** `python_service/src/services/bankService.js`
   ```js
   import axios from 'axios';
   const API = '/api/bank';
   export const listAccounts = () => axios.get(`${API}/accounts`);
   export const createAccount = (data) => axios.post(`${API}/accounts`, data);
   export const listRules = () => axios.get(`${API}/rules`);
   export const createRule = (data) => axios.post(`${API}/rules`, data);
   export const uploadStatement = (file, bankAccountId, dateRange) => { /* FormData */ };
   export const listTransactions = (params) => axios.get(`${API}/transactions`, { params });
   export const approveTransaction = (id) => axios.post(`${API}/transactions/${id}/approve`);
   // ...
   ```

2. **Zustand store banao:** `python_service/src/stores/bankStore.js` — already `stores/` folder hai.

3. **BankPanel.jsx refactor:** dummy arrays hata ke `useEffect(() => fetchX(), [])` lagao.

4. **Loading + error states** add karo har table ke liye.

---

## 10. Indexes & Performance

```js
// Most-queried compound indexes
BankStatementTransactionSchema.index({ companyId: 1, bankAccountId: 1, status: 1, txnDate: -1 });
BankStatementTransactionSchema.index({ description: 'text' });
BankRuleSchema.index({ companyId: 1, isActive: 1, priority: 1 });
```

Statements lakhon rows ho sakti hain → **pagination mandatory** (cursor-based on `txnDate + _id`).

---

## 11. Security & Multi-tenancy

- Every query **must** filter by `companyId` from JWT.
- Mask `accountNumber` in list APIs (return last 4 only).
- Audit log: who categorized, who approved (already pattern hai `FundFlowActivityLogSchema` me — same use karo).
- Statement files Cloudinary me `private` flag se store karo.

---

## 12. Build Order — Step by Step

| Step | Task | Where |
|---|---|---|
| 1 | Create 4 Mongoose models | `server/src/models/` |
| 2 | Create `bank.controller.js` with CRUD | `server/src/controllers/` |
| 3 | Create `bank.routes.js`, mount in `app.js` | `server/src/routes/` |
| 4 | Build statement parser service (start with CSV) | `server/src/services/bankStatementParser.service.js` |
| 5 | Build rule engine service | `server/src/services/bankRuleEngine.service.js` |
| 6 | Create `bankService.js` (frontend API) | `python_service/src/services/` |
| 7 | Wire `BankPanel.jsx` Manage Bank tab to real API | frontend |
| 8 | Wire Manage Rule tab | frontend |
| 9 | Implement statement upload + parsing flow | full stack |
| 10 | Wire Inbox tab + "Run Rules" button | frontend |
| 11 | Wire Review tab + approve/reject | frontend |
| 12 | Wire Archive tab (read-only) | frontend |
| 13 | Add bulk upload for rules (Excel template) | full stack |
| 14 | (Phase 2) AI suggestion for un-matched txns | python_service |

---

## 13. Industry References (best practices verified)

- **Zoho Books Transaction Rules:** rule name + condition group (Payee/Description/Reference + operator: is / contains / starts_with / is_empty) + action (categorize as account + payee). Rules can apply across multiple banks. AI suggests rules from past behavior.
- **QuickBooks Bank Rules:** priority order, first-match-wins, "auto-add to register" toggle.
- **DocuClipper / Ramp:** AI-powered PDF statement parsing with column auto-detection.
- **Modern best practice (2026):** direct bank-feed API (Plaid / Account Aggregator in India) > manual CSV. Plan for AA integration as Phase 3.

Sources:
- [Zoho Books Transaction Rules](https://www.zoho.com/us/books/help/banking/transaction-rule.html)
- [Zoho Books Auto-categorization](https://www.zoho.com/us/books/kb/banking/auto-categorization-of-transactions.html)
- [Zoho Books Bank Rules API](https://www.zoho.com/books/api/v3/bank-rules/)
- [Smarter banking — Zoho AI reconciliation](https://www.zoho.com/blog/books/banking-enhancements.html)
- [Automated Bank Reconciliation — Ramp](https://ramp.com/blog/automated-bank-reconciliation)
- [Bank Reconciliation Guide — DocuClipper](https://www.docuclipper.com/blog/bank-statement-reconciliation-guide/)
- [Complete Guide to Bank Reconciliation 2026 — Optimus](https://optimus.tech/blog/complete-guide-bank-reconciliation-2026)
- [Bank Reconciliation Best Practices — Numeric](https://www.numeric.io/blog/bank-reconciliation)

---

## 14. Quick Summary (TL;DR)

- **4 collections** banani hain: `BankAccount`, `BankRule`, `BankStatementTransaction`, `BankStatementUpload`.
- **Inbox / Review / Archive** alag tables nahi — same collection me `status` field.
- **Rule engine** priority-ordered, first-match-wins (Zoho/QuickBooks pattern).
- **Approval** triggers voucher creation in existing `FundFlowTransaction` model.
- **Dedup** via `rawHash` so same statement upload twice na duplicate ho.
- **Multi-tenant** — har query me `companyId` lock.
- **Statement parsing** ko async job me daalo (large PDFs 30min lag sakta hai — already UI me warn karta hai).
