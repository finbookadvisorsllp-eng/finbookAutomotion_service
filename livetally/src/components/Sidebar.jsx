import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BarChart2, Bell, Mail, TrendingUp, Scale, Droplet, FileText,
  BookOpen, Calendar, Landmark, AlertTriangle, ReceiptText, LineChart, Users,
  HandCoins, Clock, ShoppingCart, Factory, ClipboardList, Package, Snail, Rocket,
  CircleDollarSign, FileEdit, CreditCard, Search, PieChart, Target, Telescope,
  UsersRound, ShieldCheck, PlugZap, FolderKanban, HeadphonesIcon, ChevronDown
} from 'lucide-react'

const navGroups = [
  {
    id: 'overview', label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, badge: null },
      { id: 'alerts', label: 'Alerts', path: '/alerts', icon: Bell, badge: 5 },
      { id: 'notif', label: 'Notifications', path: '/notif', icon: Mail, badge: 2 },
    ],
  },
  {
    id: 'reports', label: 'Reports & Analytics',
    items: [
      { id: 'pl', label: 'Profit & Loss', path: '/reports/pl', icon: TrendingUp },
      { id: 'bs', label: 'Balance Sheet', path: '/reports/bs', icon: Scale },
      { id: 'cf', label: 'Cash Flow', path: '/reports/cf', icon: Droplet },
      { id: 'tb', label: 'Trial Balance', path: '/reports/tb', icon: FileText },
      { id: 'ledger', label: 'Ledger Reports', path: '/reports/ledger', icon: BookOpen },
      { id: 'daybook', label: 'Day Book', path: '/reports/daybook', icon: Calendar },
      { id: 'outstanding', label: 'Outstanding Reports', path: '/reports/outstanding', icon: AlertTriangle },
      { id: 'profitab', label: 'Profitability', path: '/analytics', icon: PieChart },
    ],
  },
  {
    id: 'sales', label: 'Sales & Customers',
    items: [
      { id: 'sales-reg', label: 'Sales Register', path: '/sales', icon: ReceiptText },
      { id: 'cust-aging', label: 'Customer Aging', path: '/sales/aging', icon: Clock },
    ],
  },
  {
    id: 'purchase', label: 'Purchase & Vendors',
    items: [
      { id: 'purch-reg', label: 'Purchase Register', path: '/purchase', icon: ShoppingCart },
      { id: 'vend-aging', label: 'Vendor Aging', path: '/purchase/aging', icon: Clock },
    ],
  },
  {
    id: 'inventory', label: 'Inventory',
    items: [
      { id: 'stock', label: 'Stock Summary', path: '/inventory', icon: Package },
      { id: 'slow', label: 'Slow Moving Items', path: '/inventory/slow', icon: Snail },
      { id: 'fast', label: 'Fast Moving Items', path: '/inventory/fast', icon: Rocket },
      { id: 'stock-val', label: 'Stock Valuation', path: '/inventory/value', icon: CircleDollarSign },
      { id: 'stock-alrt', label: 'Stock Alerts', path: '/inventory/alerts', icon: AlertTriangle, badge: 2 },
      { id: 'item-perf', label: 'Item Performance', path: '/inventory/performance', icon: BarChart2 },
    ],
  },
  {
    id: 'accounting', label: 'Accounting',
    items: [
      { id: 'journal', label: 'Journal Entries', path: '/accounting/journal', icon: FileEdit },
      { id: 'payment', label: 'Payment Voucher', path: '/accounting/payment', icon: CreditCard },
      { id: 'receipt', label: 'Receipt Voucher', path: '/accounting/receipt', icon: ReceiptText },
      { id: 'ledger-s', label: 'Ledger Search', path: '/accounting/ledger', icon: Search },
    ],
  },

  {
    id: 'admin', label: 'Administration',
    items: [
      { id: 'clients', label: 'Clients', path: '/admin', icon: UsersRound },
      { id: 'users', label: 'Users & Roles', path: '/admin/users', icon: ShieldCheck },
      { id: 'tally-sync', label: 'Tally Sync Setup', path: '/setup', icon: PlugZap },
      { id: 'audit', label: 'Audit Logs', path: '/admin/audit', icon: FolderKanban },
      { id: 'billing', label: 'Billing', path: '/admin/billing', icon: CreditCard },
      { id: 'support', label: 'Support', path: '/admin/support', icon: HeadphonesIcon },
    ],
  },
]

export default function Sidebar({ collapsed, setCollapsed, mobileOpen }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState(['overview', 'reports', 'sales'])

  const toggleGroup = (id) => {
    setOpenGroups(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 border-b border-white/10 shrink-0" style={{ height: 'var(--header-height)' }}>
        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-white text-sm shadow-lg"
          style={{ background: 'linear-gradient(135deg,#3b82f6,#0ea5e9)', boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}>
          TV
        </div>
        <div className="sidebar-logo-text overflow-hidden">
          <span className="block text-base font-bold text-white whitespace-nowrap leading-tight">TallyView</span>
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">by FinBook</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1">
        {navGroups.map((group) => {
          const isOpen = openGroups.includes(group.id)
          return (
            <div key={group.id} className="mb-2">
              {/* Group Header */}
              <button
                onClick={() => !collapsed && toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors hover:bg-white/5 cursor-pointer mt-1"
              >
                <span className="nav-group-label text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                  {group.label}
                </span>
                <ChevronDown size={14} className={`nav-group-chevron text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Items */}
              <div className={`overflow-hidden transition-all duration-300 ${isOpen || collapsed ? 'max-h-[800px]' : 'max-h-0'}`}>
                {group.items.map((item) => {
                  const active = isActive(item.path)
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.path)}
                      className={`relative w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-all duration-200 group mt-1
                        ${active
                          ? 'bg-blue-500/20 text-white'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                        }`}
                    >
                      {active && <div className="nav-active-bar" />}
                      <span className="shrink-0 flex items-center justify-center text-current">
                        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                      </span>
                      <span className={`nav-item-label text-[13px] whitespace-nowrap flex-1 truncate ${active ? 'font-semibold' : 'font-medium'}`}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="nav-item-badge shrink-0 bg-blue-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center leading-none shadow-md">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/10" />

      {/* Footer */}
      <div className="p-4">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
            SE
          </div>
          <div className="sidebar-user-info overflow-hidden">
            <p className="text-sm font-semibold text-white whitespace-nowrap truncate">Sharma Enterprises</p>
            <p className="text-xs text-slate-400 whitespace-nowrap truncate">Business Owner</p>
          </div>
        </div>
      </div>
    </div>
  )
}
