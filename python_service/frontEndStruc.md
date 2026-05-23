# Frontend Structure Review & Reorganization Plan

**Stack:** Vite + React 19 + Tailwind v4 — **JavaScript only (no TypeScript)**
**Scope:** Reorganize the existing files. **No new files, no new dependencies.**
**Date:** 2026-05-11

---

## 1. Current Structure

```
src/
├── main.jsx
├── App.jsx
├── App.css
├── index.css
├── assets/
│   ├── hero.png
│   ├── react.svg
│   └── vite.svg
└── AutomationUI/
    └── components/
        └── dashboard/                ← 33 files dumped here
            ├── AddCompanyModal.jsx
            ├── BankPanel.jsx
            ├── CompaniesPanel.jsx
            ├── CreateFundFlow.jsx
            ├── CreateInvoice.jsx
            ├── CreatePurchase.jsx
            ├── CreateQuotation.jsx
            ├── CreateSales.jsx
            ├── CreditNote.jsx
            ├── Dashboard.jsx
            ├── DashboardTable.jsx
            ├── DebitNote.jsx
            ├── EntityPanel.jsx
            ├── FundFlowVoucher.jsx
            ├── InvoiceInbox.jsx
            ├── MasterDataPanel.jsx
            ├── MyDocumentsPanel.jsx
            ├── Navbar.jsx
            ├── PaymentVoucher.jsx
            ├── PettyCashPanel.jsx
            ├── PurchaseInvoice.jsx
            ├── PurchaseInvoiceWithInventory.jsx
            ├── PurchaseInvoiceWithoutInventory.jsx
            ├── PurchaseOrder.jsx
            ├── PurchasePanel.jsx
            ├── QuotationInbox.jsx
            ├── ReceiptVoucher.jsx
            ├── RolePanel.jsx
            ├── SalesInvoice.jsx
            ├── SalesOrder.jsx
            ├── SalesPanel.jsx
            ├── Sidebar.jsx
            ├── VoucherEntryEngine.jsx
            └── index.js
```

---

## 2. Problems with the Current Layout

1. 33 unrelated components in a single flat folder.
2. Pointless triple nesting `AutomationUI/components/dashboard/` with no siblings — only path noise.
3. Layout files (`Sidebar`, `Navbar`), a generic table (`DashboardTable`), and business features (`CreditNote`, `SalesInvoice`, etc.) are all peers — they should not live together.
4. The `index.js` barrel exports only 13 of 33 components — half-done.

---

## 3. Target Structure (reorganization of existing files only)

Pattern: group by **business domain** (sales, purchase, vouchers, etc.) — layout components live separately.

```
src/
├── main.jsx
├── App.jsx
├── App.css
├── index.css
├── assets/
│   ├── hero.png
│   ├── react.svg
│   └── vite.svg
└── components/
    ├── layout/
    │   ├── Sidebar.jsx
    │   └── Navbar.jsx
    │
    ├── dashboard/
    │   ├── Dashboard.jsx
    │   └── DashboardTable.jsx
    │
    ├── companies/
    │   ├── CompaniesPanel.jsx
    │   └── AddCompanyModal.jsx
    │
    ├── entities/
    │   └── EntityPanel.jsx
    │
    ├── roles/
    │   └── RolePanel.jsx
    │
    ├── master-data/
    │   └── MasterDataPanel.jsx
    │
    ├── documents/
    │   └── MyDocumentsPanel.jsx
    │
    ├── sales/
    │   ├── SalesPanel.jsx
    │   ├── SalesOrder.jsx
    │   ├── SalesInvoice.jsx
    │   ├── CreateSales.jsx
    │   └── CreditNote.jsx
    │
    ├── purchase/
    │   ├── PurchasePanel.jsx
    │   ├── PurchaseOrder.jsx
    │   ├── PurchaseInvoice.jsx
    │   ├── PurchaseInvoiceWithInventory.jsx
    │   ├── PurchaseInvoiceWithoutInventory.jsx
    │   ├── CreatePurchase.jsx
    │   └── DebitNote.jsx
    │
    ├── quotations/
    │   ├── QuotationInbox.jsx
    │   └── CreateQuotation.jsx
    │
    ├── invoicing/
    │   ├── InvoiceInbox.jsx
    │   └── CreateInvoice.jsx
    │
    ├── vouchers/
    │   ├── VoucherEntryEngine.jsx
    │   ├── PaymentVoucher.jsx
    │   ├── ReceiptVoucher.jsx
    │   ├── FundFlowVoucher.jsx
    │   └── CreateFundFlow.jsx
    │
    ├── banking/
    │   └── BankPanel.jsx
    │
    └── petty-cash/
        └── PettyCashPanel.jsx
```

`AutomationUI/` is deleted entirely (it added no value — single child all the way down).
No new files. No new folders beyond the ones needed to hold the existing files.

---

## 4. File-by-File Move Map

| Current path | New path |
|---|---|
| `src/AutomationUI/components/dashboard/Sidebar.jsx` | `src/components/layout/Sidebar.jsx` |
| `src/AutomationUI/components/dashboard/Navbar.jsx` | `src/components/layout/Navbar.jsx` |
| `.../Dashboard.jsx` | `src/components/dashboard/Dashboard.jsx` |
| `.../DashboardTable.jsx` | `src/components/dashboard/DashboardTable.jsx` |
| `.../CompaniesPanel.jsx` | `src/components/companies/CompaniesPanel.jsx` |
| `.../AddCompanyModal.jsx` | `src/components/companies/AddCompanyModal.jsx` |
| `.../EntityPanel.jsx` | `src/components/entities/EntityPanel.jsx` |
| `.../RolePanel.jsx` | `src/components/roles/RolePanel.jsx` |
| `.../MasterDataPanel.jsx` | `src/components/master-data/MasterDataPanel.jsx` |
| `.../MyDocumentsPanel.jsx` | `src/components/documents/MyDocumentsPanel.jsx` |
| `.../SalesPanel.jsx` | `src/components/sales/SalesPanel.jsx` |
| `.../SalesOrder.jsx` | `src/components/sales/SalesOrder.jsx` |
| `.../SalesInvoice.jsx` | `src/components/sales/SalesInvoice.jsx` |
| `.../CreateSales.jsx` | `src/components/sales/CreateSales.jsx` |
| `.../CreditNote.jsx` | `src/components/sales/CreditNote.jsx` |
| `.../PurchasePanel.jsx` | `src/components/purchase/PurchasePanel.jsx` |
| `.../PurchaseOrder.jsx` | `src/components/purchase/PurchaseOrder.jsx` |
| `.../PurchaseInvoice.jsx` | `src/components/purchase/PurchaseInvoice.jsx` |
| `.../PurchaseInvoiceWithInventory.jsx` | `src/components/purchase/PurchaseInvoiceWithInventory.jsx` |
| `.../PurchaseInvoiceWithoutInventory.jsx` | `src/components/purchase/PurchaseInvoiceWithoutInventory.jsx` |
| `.../CreatePurchase.jsx` | `src/components/purchase/CreatePurchase.jsx` |
| `.../DebitNote.jsx` | `src/components/purchase/DebitNote.jsx` |
| `.../QuotationInbox.jsx` | `src/components/quotations/QuotationInbox.jsx` |
| `.../CreateQuotation.jsx` | `src/components/quotations/CreateQuotation.jsx` |
| `.../InvoiceInbox.jsx` | `src/components/invoicing/InvoiceInbox.jsx` |
| `.../CreateInvoice.jsx` | `src/components/invoicing/CreateInvoice.jsx` |
| `.../VoucherEntryEngine.jsx` | `src/components/vouchers/VoucherEntryEngine.jsx` |
| `.../PaymentVoucher.jsx` | `src/components/vouchers/PaymentVoucher.jsx` |
| `.../ReceiptVoucher.jsx` | `src/components/vouchers/ReceiptVoucher.jsx` |
| `.../FundFlowVoucher.jsx` | `src/components/vouchers/FundFlowVoucher.jsx` |
| `.../CreateFundFlow.jsx` | `src/components/vouchers/CreateFundFlow.jsx` |
| `.../BankPanel.jsx` | `src/components/banking/BankPanel.jsx` |
| `.../PettyCashPanel.jsx` | `src/components/petty-cash/PettyCashPanel.jsx` |
| `.../index.js` | **delete** (half-finished barrel — not worth keeping; or rewrite later if needed) |

After moving, delete the empty `src/AutomationUI/` tree.

---

## 5. Import Updates Needed

### 5.1 `src/App.jsx`
```diff
- import { Dashboard } from './AutomationUI/components/dashboard'
+ import Dashboard from './components/dashboard/Dashboard'
```

### 5.2 `VoucherEntryEngine.jsx`
Currently imports siblings — those siblings are now in a different folder (`sales/`, `purchase/`, `vouchers/`):
```diff
- import CreateSales from './CreateSales';
- import CreatePurchase from './CreatePurchase';
- import CreateFundFlow from './CreateFundFlow';
+ import CreateSales from '../sales/CreateSales';
+ import CreatePurchase from '../purchase/CreatePurchase';
+ import CreateFundFlow from './CreateFundFlow';
```

### 5.3 Anywhere else that imports from `./AutomationUI/components/dashboard` or `./` siblings
Run a project-wide find/replace once the files are in place. Vite will throw clear errors for any missed import.

---

## 6. Suggested Order of Operations

1. Create the new folders under `src/components/`.
2. Move files into their new homes (one domain at a time so it's easy to revert).
3. Fix imports — start with `App.jsx`, then `VoucherEntryEngine.jsx`, then run `npm run dev` and fix whatever Vite complains about.
4. Delete the now-empty `src/AutomationUI/` folder.
5. Decide on `index.js` later — only worth re-introducing once the structure is stable, and only if it's complete.

---

## 7. Notes on Tech Stack

- **No TypeScript** — staying on plain JavaScript + JSX as required.
- The current dependencies (`react`, `react-dom`, `lucide-react`, `motion`, Tailwind v4, Vite) are kept as-is.
- No new packages are introduced in this reorganization.
- When backend work begins, decisions about routing, HTTP client, and state management can be made then — this document deliberately does not add those now.

That's it. Move the files, fix the imports, delete the wrapper folder. Nothing else changes.
