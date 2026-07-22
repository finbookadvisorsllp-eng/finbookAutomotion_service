import { Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../stores/useAppStore'

/**
 * Route protection gate.
 * 1. Unauthenticated users (no token) → /login
 * 2. Authenticated but no workspace selected (no orgId) → /org-select
 * 3. Authenticated and scoped to organization → allow render
 */
const PATH_TO_MODULE_ID = {
  '/sales/inbox': 'salesInbox',
  '/sales/review': 'salesInbox',
  '/sales/archive': 'salesInbox',
  '/sales/orders': 'salesOrder',
  '/sales/invoices': 'salesInvoice',
  '/sales/credit-notes': 'salesReturn',
  '/sales/new': 'manualVoucher',
  '/purchase/inbox': 'purchaseInbox',
  '/purchase/review': 'purchaseInbox',
  '/purchase/archive': 'purchaseInbox',
  '/purchase/orders': 'purchaseOrder',
  '/purchase/invoices': 'purchaseInvoice',
  '/purchase/debit-notes': 'debitNote',
  '/fund-flow/cash-payment': 'payment',
  '/fund-flow/bank-payment': 'receipt',
  '/fund-flow/contra': 'contra',
  '/bank/manage': 'manageBank',
  '/bank/rules': 'manageBank',
  '/bank/inbox': 'manageBank',
  '/master/ledger': 'ledgerMaster',
  '/master/items': 'itemMaster',
  '/admin/companies': 'companies',
  '/admin/clients': 'clients',
  '/admin/users-roles': 'usersRoles',
}

export default function ProtectedRoute({ children }) {
  const token = useAppStore((s) => s.token)
  const orgId = useAppStore((s) => s.orgId)
  const role = useAppStore((s) => s.role)
  const permissions = useAppStore((s) => s.permissions) || useAppStore((s) => s.user?.permissions)
  const logout = useAppStore((s) => s.logout)
  const location = useLocation()

  if (!token || token === 'dev-stub-token') {
    if (token === 'dev-stub-token') {
      setTimeout(() => logout(), 0)
    }
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!orgId) {
    return <Navigate to="/org-select" replace state={{ from: location }} />
  }

  // Check module level view permission for non-admin users
  const lowerRole = (role || '').toLowerCase()
  const isSuperAdmin = lowerRole === 'admin' || lowerRole === 'administrator' || lowerRole === 'superadmin'

  if (!isSuperAdmin && permissions && typeof permissions === 'object' && !Array.isArray(permissions)) {
    const matchedModId = PATH_TO_MODULE_ID[location.pathname]
    if (matchedModId) {
      const modObj = permissions[matchedModId]
      if (modObj !== undefined) {
        const canView = typeof modObj === 'boolean' ? modObj : Boolean(modObj.view)
        if (!canView) {
          return <Navigate to="/dashboard" replace />
        }
      }
    }
  }

  return children
}

