import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import logoUrl from '../assets/logo.png'
import {
  LayoutDashboard, BarChart2, Bell, Mail, TrendingUp, Scale, Droplet, FileText,
  BookOpen, Calendar, AlertTriangle, ReceiptText, Clock, ShoppingCart, Package,
  Snail, Rocket, CircleDollarSign, FileEdit, CreditCard, Search, PieChart,
  UsersRound, ShieldCheck, PlugZap, FolderKanban, HeadphonesIcon, ChevronDown, Landmark,
  ClipboardList, FileMinus, Truck, ClipboardCheck, FilePlus, Inbox
} from 'lucide-react'

const navGroups = [
  {
    id: 'overview', label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard, badge: null },
      { id: 'alerts-notif', label: 'Alerts & Notifications', path: '/alerts', icon: Bell, badge: 7 },
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
      { id: 'outstanding', label: 'Outstanding', path: '/reports/outstanding', icon: AlertTriangle },
      { id: 'profitab', label: 'Profitability', path: '/analytics', icon: PieChart },
    ],
  },
  {
    id: 'sales', label: 'Sales',
    items: [
      { id: 'sales-reg', label: 'Sales Register', path: '/sales', icon: ReceiptText },
      { id: 'cust-aging', label: 'Customer Aging', path: '/sales/aging', icon: Clock },
      { id: 'sales-order', label: 'Sales Order', path: '/sales/order', icon: ClipboardList },
      { id: 'credit-note', label: 'Credit Note', path: '/sales/credit-note', icon: FileMinus },
      { id: 'delivery-note', label: 'Delivery Note', path: '/sales/delivery-note', icon: Truck },
    ],
  },
  {
    id: 'purchase', label: 'Purchase',
    items: [
      { id: 'purch-reg', label: 'Purchase Register', path: '/purchase', icon: ShoppingCart },
      { id: 'vend-aging', label: 'Vendor Aging', path: '/purchase/aging', icon: Clock },
      { id: 'purchase-order', label: 'Purchase Order', path: '/purchase/order', icon: ClipboardCheck },
      { id: 'debit-note', label: 'Debit Note', path: '/purchase/debit-note', icon: FilePlus },
      { id: 'receipt-note', label: 'Receipt Note', path: '/purchase/receipt-note', icon: Inbox },
    ],
  },
  {
    id: 'cash-bank', label: 'Cash & Bank',
    items: [
      { id: 'cb-dashboard', label: 'Dashboard', path: '/cash-bank', icon: Landmark }
    ],
  },
  {
    id: 'inventory', label: 'Inventory',
    items: [
      { id: 'stock', label: 'Stock Summary', path: '/inventory', icon: Package },
      { id: 'slow', label: 'Slow Moving', path: '/inventory/slow', icon: Snail },
      { id: 'fast', label: 'Fast Moving', path: '/inventory/fast', icon: Rocket },
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
      { id: 'tally-sync', label: 'Tally Sync', path: '/setup', icon: PlugZap },
      { id: 'audit', label: 'Audit Logs', path: '/admin/audit', icon: FolderKanban },
      { id: 'billing', label: 'Billing', path: '/admin/billing', icon: CreditCard },
      { id: 'support', label: 'Support', path: '/admin/support', icon: HeadphonesIcon },
    ],
  },
]

// ── Color palette — responsive to theme ──
const C = {
  font: 'var(--font-sidebar)',

  logoTitle: 'var(--theme-text-main)',
  logoSub: 'var(--theme-accent)',
  logoBorder: 'var(--color-sidebar-border)',

  label: 'var(--color-sidebar-text-label)',
  labelChevron: 'var(--theme-accent)',

  itemText: 'var(--color-sidebar-text-muted)',
  itemIcon: 'var(--theme-accent)',
  itemHoverBg: 'var(--color-sidebar-hover)',

  activeBg: 'var(--color-sidebar-active-bg)',
  activeText: 'var(--color-sidebar-active-text)',
  activeIcon: 'var(--color-sidebar-active-text)',
  activeShadow: '0 2px 12px var(--color-sidebar-active-bg)',

  badgeBg: 'var(--theme-accent)',
  badgeText: 'var(--theme-bg)',

  footerBorder: 'var(--color-sidebar-border)',
  footerName: 'var(--theme-text-main)',
  footerRole: 'var(--theme-accent)',
  footerHover: 'var(--color-sidebar-hover)',

  divider: 'var(--color-sidebar-border)',
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState(['overview', 'reports', 'sales'])

  const toggleGroup = (id) =>
    setOpenGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>

      {/* ── Logo Header ── */}
      <div
        className="flex items-center gap-1 px-4 shrink-0 border-b-1 border-slate-300"
        style={{ height: 'var(--header-height)' }}
      >
        <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" /> <span className='font-bold text-gray-500 text-lg'>Tally Vision</span>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2.5 scrollbar-hide">
        {navGroups.map((group) => {
          const isOpen = openGroups.includes(group.id)
          return (
            <div key={group.id} className="mb-0.5">

              {/* ── Section Label ── */}
              <button
                onClick={() => !collapsed && toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-2 py-1 rounded-lg cursor-pointer mt-3 first:mt-1 transition-colors duration-150"
                style={{ background: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = C.itemHoverBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span
                  className="nav-group-label whitespace-nowrap"
                  style={{
                    fontFamily: C.font,
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: C.label,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                  }}
                >
                  {group.label}
                </span>
                <ChevronDown
                  size={11}
                  className={`nav-group-chevron transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  style={{ color: C.labelChevron }}
                />
              </button>

              {/* ── Nav Items ── */}
              <div className={`overflow-hidden transition-all duration-200 ${isOpen || collapsed ? 'max-h-[700px]' : 'max-h-0'}`}>
                {group.items.map((item) => {
                  const active = isActive(item.path)
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      title={collapsed ? item.label : undefined}
                      onClick={() => navigate(item.path)}
                      className="relative w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-xl text-left mt-[3px] transition-all duration-150"
                      style={active ? {
                        background: C.activeBg,
                        boxShadow: C.activeShadow,
                      } : {}}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.itemHoverBg }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* Active left pill */}
                      {active && <div className="nav-active-bar" />}

                      {/* Icon */}
                      <span
                        className="shrink-0 flex items-center justify-center"
                        style={{ width: 17, height: 17, color: active ? C.activeIcon : C.itemIcon }}
                      >
                        <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                      </span>

                      {/* Label */}
                      <span
                        className="nav-item-label whitespace-nowrap flex-1 truncate"
                        style={{
                          fontFamily: C.font,
                          fontSize: 13,
                          fontWeight: active ? 800 : 600,
                          color: active ? C.activeText : C.itemText,
                          letterSpacing: '0.005em',
                        }}
                      >
                        {item.label}
                      </span>

                      {/* Badge */}
                      {item.badge && (
                        <span
                          className="nav-item-badge shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none"
                          style={{
                            fontFamily: C.font,
                            background: C.badgeBg,
                            color: C.badgeText,
                            boxShadow: '0 2px 8px rgba(29,78,216,0.30)',
                          }}
                        >
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

      {/* ── Divider ── */}
      <div className="mx-4 h-px" style={{ background: C.divider }} />

      {/* ── Footer / User Card ── */}
      <div className="p-3">
        <div
          className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
          style={{ background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = C.footerHover}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] text-white shrink-0"
            style={{
              fontFamily: C.font,
              fontWeight: 900,
              background: 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)',
              boxShadow: '0 3px 10px rgba(182,255,0,0.35)',
            }}
          >
            SE
          </div>

          {/* User info */}
          <div className="sidebar-user-info overflow-hidden">
            <p
              className="whitespace-nowrap truncate leading-tight"
              style={{ fontFamily: C.font, fontSize: 13, fontWeight: 800, color: C.footerName }}
            >
              Sharma Enterprises
            </p>
            <p
              className="whitespace-nowrap truncate"
              style={{ fontFamily: C.font, fontSize: 10.5, fontWeight: 600, color: C.footerRole }}
            >
              Business Owner
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
