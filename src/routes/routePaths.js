// Single source of truth for sidebar-label <-> URL-path mapping.
// Sidebar emits string labels (legacy). The dashboard layout uses these maps
// to translate clicks into navigate() calls and to derive the active label
// from the current URL for sidebar highlighting.

export const LOGIN_PATH = '/login'

export const LABEL_TO_PATH = {
  'User Data': '/',

  // Manage
  'Manage Company': '/companies',
  'Manage Business User': '/users/business',
  'Allocate Accountant': '/users/accountants',

  // Invoice
  'Invoice Inbox': '/invoices',
  'Create Invoice': '/invoices/new',

  // Sales
  'Sales Inbox': '/sales/inbox',
  'Sales Review': '/sales/review',
  'Sales Archive': '/sales/archive',
  'Create Sales': '/sales/new',
  'Sales Order': '/sales/orders',
  'Sales Invoice': '/sales/invoices',
  'Credit Note (Sales Return)': '/sales/credit-notes',

  // Purchase
  'Purchase Inbox': '/purchase/inbox',
  'Purchase Review': '/purchase/review',
  'Purchase Archive': '/purchase/archive',
  'Purchase Order': '/purchase/orders',
  'Purchase Invoice': '/purchase/invoices',
  'Debit Note (Purchase Return)': '/purchase/debit-notes',

  // Fund flow
  'Cash Payment': '/fund-flow/cash-payment',
  'Bank Payment': '/fund-flow/bank-payment',
  'Contra': '/fund-flow/contra',
  'Fund Flow Review': '/fund-flow/review',
  'Fund Flow Archive': '/fund-flow/archive',

  // Bank
  'Manage Bank': '/bank/manage',
  'Manage Rule': '/bank/rules',
  'Inbox': '/bank/inbox',
  'Bank Review': '/bank/review',
  'Bank Archive': '/bank/archive',

  // Roles
  'Manage Roles': '/roles',
  'Manage User Permission': '/roles/permissions',

  // Documents
  'My Documents': '/documents',

  // Master data
  'Party Ledger': '/master/party-ledger',
  'Stock Ledger': '/master/stock-ledger',
}

export const PATH_TO_LABEL = Object.fromEntries(
  Object.entries(LABEL_TO_PATH).map(([label, path]) => [path, label])
)
