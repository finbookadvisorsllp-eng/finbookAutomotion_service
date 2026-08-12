import { lazy } from 'react'
import { createBrowserRouter, useNavigate, useOutletContext, Navigate, useLocation } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import { useAppStore } from '../stores/useAppStore'

// Layout is eager (always needed). Every panel below is lazy — each becomes its
// own JS chunk, so the initial bundle stays small no matter how many features grow.
import Dashboard from '../components/dashboard/Dashboard'

import Login from '../components/auth/Login'
import OrgSelect from '../components/auth/OrgSelect'
import Landing from '../components/auth/Landing'

const DashboardTable = lazy(() => import('../components/dashboard/DashboardTable'))
const CompaniesPanel = lazy(() => import('../components/companies/CompaniesPanel'))
const EntityPanel = lazy(() => import('../components/entities/EntityPanel'))
const SalesPanel = lazy(() => import('../components/sales/SalesPanel'))
const CreateSales = lazy(() => import('../components/sales/CreateSales'))
const VoucherEntryEngine = lazy(() => import('../components/vouchers/VoucherEntryEngine'))
const ManualEntryPanel = lazy(() => import('../components/vouchers/ManualEntryPanel'))
const SalesOrder = lazy(() => import('../components/sales/SalesOrder'))
const SalesInvoice = lazy(() => import('../components/sales/SalesInvoice'))
const CreditNote = lazy(() => import('../components/sales/CreditNote'))
const PurchasePanel = lazy(() => import('../components/purchase/PurchasePanel'))
const PurchaseOrder = lazy(() => import('../components/purchase/PurchaseOrder'))
const PurchaseInvoice = lazy(() => import('../components/purchase/PurchaseInvoice'))
const DebitNote = lazy(() => import('../components/purchase/DebitNote'))
const PettyCashPanel = lazy(() => import('../components/petty-cash/PettyCashPanel'))
const BankPanel = lazy(() => import('../components/banking/BankPanel'))
const RolePanel = lazy(() => import('../components/roles/RolePanel'))
const MyDocumentsPanel = lazy(() => import('../components/documents/MyDocumentsPanel'))
const MasterDataPanel = lazy(() => import('../components/master-data/MasterDataPanel'))

// New Bulk Upload and Automation Panels
const BulkUploadPanel = lazy(() => import('../components/bulk-upload/BulkUploadPanel'))
const AiProcessingCenter = lazy(() => import('../components/automation/AiProcessingCenter'))
const ApprovalCenter = lazy(() => import('../components/automation/ApprovalCenter'))
const TextToEntry = lazy(() => import('../components/automation/TextToEntry'))
const TallyConnectorPanel = lazy(() => import('../components/tally/TallyConnectorPanel'))
const DocumentArchivePanel = lazy(() => import('../components/documents/DocumentArchivePanel'))
const ClientManagementPanel = lazy(() => import('../components/companies/ClientManagementPanel'))
const ConfigurationPanel = lazy(() => import('../components/companies/ConfigurationPanel'))
const AIReportPage = lazy(() => import('../components/reports/AIReportPage'))

// Each route element reads isDark from the layout's Outlet context and gets a
// navigate fn for onBack / onAdd callbacks. Panels themselves stay unchanged.
const useDashCtx = () => {
  const { isDark } = useOutletContext()
  const navigate = useNavigate()
  return { isDark, navigate }
}

const UserDataRoute = () => { const { isDark } = useDashCtx(); return <DashboardTable isDark={isDark} /> }
const CompaniesRoute = () => <CompaniesPanel />
const BusinessUsersRoute = () => <ClientManagementPanel />
const AccountantsRoute = () => <EntityPanel title="Accountants" nameColumn="Accountant Name" emptyText="No Account Data Found." />

const SalesInboxRoute = () => { const { isDark, navigate } = useDashCtx(); return <SalesPanel mode="Inbox" isDark={isDark} onAdd={() => navigate('/sales/new')} /> }
const SalesReviewRoute = () => { const { isDark } = useDashCtx(); return <SalesPanel mode="Review" isDark={isDark} /> }
const SalesArchiveRoute = () => { const { isDark } = useDashCtx(); return <SalesPanel mode="Archive" isDark={isDark} /> }
const CreateSalesRoute = () => { const { isDark } = useDashCtx(); return <ManualEntryPanel isDark={isDark} /> }
const SalesOrderRoute = () => { const { isDark } = useDashCtx(); return <SalesOrder isDark={isDark} /> }
const SalesInvoiceRoute = () => { const { isDark } = useDashCtx(); return <SalesInvoice isDark={isDark} /> }
const CreditNoteRoute = () => { const { isDark } = useDashCtx(); return <CreditNote isDark={isDark} /> }

const PurchaseInboxRoute = () => { const { isDark } = useDashCtx(); return <PurchasePanel mode="Inbox" isDark={isDark} /> }
const PurchaseReviewRoute = () => { const { isDark } = useDashCtx(); return <PurchasePanel mode="Review" isDark={isDark} /> }
const PurchaseArchiveRoute = () => { const { isDark } = useDashCtx(); return <PurchasePanel mode="Archive" isDark={isDark} /> }
const PurchaseOrderRoute = () => { const { isDark } = useDashCtx(); return <PurchaseOrder isDark={isDark} /> }
const PurchaseInvoiceRoute = () => { const { isDark } = useDashCtx(); return <PurchaseInvoice isDark={isDark} /> }
const DebitNoteRoute = () => { const { isDark } = useDashCtx(); return <DebitNote isDark={isDark} /> }

const CashPaymentRoute = () => { const { isDark } = useDashCtx(); return <PettyCashPanel mode="Inbox" isDark={isDark} voucherType="cash_payment" title="Payment" /> }
const BankPaymentRoute = () => { const { isDark } = useDashCtx(); return <PettyCashPanel mode="Inbox" isDark={isDark} voucherType="bank_payment" title="Receipt" /> }
const ContraRoute = () => { const { isDark } = useDashCtx(); return <PettyCashPanel mode="Inbox" isDark={isDark} voucherType="contra" title="Contra" /> }
const FundFlowReviewRoute = () => { const { isDark } = useDashCtx(); return <PettyCashPanel mode="Review" isDark={isDark} /> }
const FundFlowArchiveRoute = () => { const { isDark } = useDashCtx(); return <PettyCashPanel mode="Archive" isDark={isDark} /> }

const ManageBankRoute = () => { const { isDark } = useDashCtx(); return <BankPanel mode="Manage Bank" isDark={isDark} /> }
const ManageRuleRoute = () => { const { isDark } = useDashCtx(); return <BankPanel mode="Manage Rule" isDark={isDark} /> }
const BankInboxRoute = () => { const { isDark } = useDashCtx(); return <BankPanel mode="Inbox" isDark={isDark} /> }
const BankReviewRoute = () => { const { isDark } = useDashCtx(); return <BankPanel mode="Review" isDark={isDark} /> }
const BankArchiveRoute = () => { const { isDark } = useDashCtx(); return <BankPanel mode="Archive" isDark={isDark} /> }

const ManageRolesRoute = () => { const { isDark } = useDashCtx(); return <RolePanel mode="Manage Roles" isDark={isDark} /> }
const ManagePermissionsRoute = () => { const { isDark } = useDashCtx(); return <RolePanel mode="Manage User Permission" isDark={isDark} /> }
const ConfigurationRoute = () => { const { isDark } = useDashCtx(); return <ConfigurationPanel /> }

const MyDocumentsRoute = () => { const { isDark } = useDashCtx(); return <MyDocumentsPanel isDark={isDark} /> }

const PartyLedgerRoute = () => { const { isDark } = useDashCtx(); return <MasterDataPanel mode="Party Ledger" isDark={isDark} /> }
const StockLedgerRoute = () => { const { isDark } = useDashCtx(); return <MasterDataPanel mode="Stock Ledger" isDark={isDark} /> }

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/org-select', element: <OrgSelect /> },
  {
    path: '/home',
    element: (
      <ProtectedRoute>
        <Landing />
      </ProtectedRoute>
    ),
  },
  {
    path: '/landing',
    element: <Navigate to="/home" replace />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'dashboard', element: <UserDataRoute /> },

      { path: 'companies', element: <CompaniesRoute /> },
      { path: 'users/business', element: <BusinessUsersRoute /> },
      { path: 'users/accountants', element: <AccountantsRoute /> },

      // Bulk Upload
      { path: 'bulk-upload', element: <BulkUploadPanel /> },

      // Automation
      { path: 'automation/ai-processing', element: <AiProcessingCenter /> },
      { path: 'automation/approval-center', element: <ApprovalCenter /> },
      { path: 'automation/text-to-entry', element: <TextToEntry /> },

      // AI Reports
      { path: 'reports/ai-report', element: <AIReportPage /> },

      // Tally Integration
      { path: 'tally/connector', element: <TallyConnectorPanel /> },

      // Documents
      { path: 'documents/archive', element: <DocumentArchivePanel /> },

      // Administration
      { path: 'admin/companies', element: <CompaniesRoute /> },
      { path: 'admin/clients', element: <BusinessUsersRoute /> },
      { path: 'admin/users-roles', element: <ManageRolesRoute /> },

      // Settings
      { path: 'settings/configuration', element: <ConfigurationRoute /> },

      { path: 'sales/inbox', element: <SalesInboxRoute /> },
      { path: 'sales/review', element: <SalesReviewRoute /> },
      { path: 'sales/archive', element: <SalesArchiveRoute /> },
      { path: 'sales/new', element: <CreateSalesRoute /> },
      { path: 'sales/orders', element: <SalesOrderRoute /> },
      { path: 'sales/invoices', element: <SalesInvoiceRoute /> },
      { path: 'sales/credit-notes', element: <CreditNoteRoute /> },

      { path: 'purchase/inbox', element: <PurchaseInboxRoute /> },
      { path: 'purchase/review', element: <PurchaseReviewRoute /> },
      { path: 'purchase/archive', element: <PurchaseArchiveRoute /> },
      { path: 'purchase/orders', element: <PurchaseOrderRoute /> },
      { path: 'purchase/invoices', element: <PurchaseInvoiceRoute /> },
      { path: 'purchase/debit-notes', element: <DebitNoteRoute /> },

      { path: 'fund-flow/cash-payment', element: <CashPaymentRoute /> },
      { path: 'fund-flow/bank-payment', element: <BankPaymentRoute /> },
      { path: 'fund-flow/contra', element: <ContraRoute /> },
      { path: 'fund-flow/review', element: <FundFlowReviewRoute /> },
      { path: 'fund-flow/archive', element: <FundFlowArchiveRoute /> },

      { path: 'bank/manage', element: <ManageBankRoute /> },
      { path: 'bank/rules', element: <ManageRuleRoute /> },
      { path: 'bank/inbox', element: <BankInboxRoute /> },
      { path: 'bank/review', element: <BankReviewRoute /> },
      { path: 'bank/archive', element: <BankArchiveRoute /> },

      { path: 'roles', element: <ManageRolesRoute /> },
      { path: 'roles/permissions', element: <ManagePermissionsRoute /> },

      { path: 'documents', element: <MyDocumentsRoute /> },

      { path: 'master/party-ledger', element: <PartyLedgerRoute /> },
      { path: 'master/stock-ledger', element: <StockLedgerRoute /> },

      { path: '*', element: <UserDataRoute /> },
    ],
  },
])
