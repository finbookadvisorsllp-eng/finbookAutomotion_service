import {
  LayoutDashboard,
  Database,
  Settings2,
  FileText,
  ReceiptText,
  BarChart3,
  ShoppingCart,
  Wallet,
  Landmark,
  ShieldCheck,
  FolderOpen,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'

const menuItems = [
  { key: 'Dashboard', icon: LayoutDashboard, children: ['User Data'] },
  { key: 'Manage', icon: Settings2, children: ['Manage Company', 'Manage Business User', 'Allocate Accountant'] },
  { key: 'Quotation', icon: FileText, children: ['Quotation Inbox'] },
  { key: 'Invoice', icon: ReceiptText, children: ['Invoice Inbox'] },
  { key: 'Sales', icon: BarChart3, children: ['Sales Inbox', 'Sales Order', 'Sales Invoice', 'Credit Note (Sales Return)', 'Sales Review', 'Sales Archive'] },
  { key: 'Purchase/Expense', icon: ShoppingCart, children: ['Purchase Inbox', 'Purchase Order', 'Purchase Invoice', 'Debit Note (Purchase Return)', 'Purchase Review', 'Purchase Archive'] },
  { key: 'Fund Flow', icon: Wallet, children: ['Fund Flow Inbox', 'Voucher Entry', 'Fund Flow Review', 'Fund Flow Archive'] },
  { key: 'Bank', icon: Landmark, children: ['Manage Bank', 'Manage Rule', 'Inbox', 'Review', 'Archive'] },
  { key: 'Role Management', icon: ShieldCheck, children: ['Manage Roles', 'Manage User Permission'] },
  { key: 'My Documents', icon: FolderOpen },
  { key: 'Master Data', icon: Boxes, children: ['Party Ledger', 'Stock Ledger'] },
]

const SidebarItem = ({ item, activeItem, onItemClick, collapsed, isDark, openMenu, setOpenMenu }) => {
  const { key, icon: Icon, children } = item
  const hasChildren = !!children
  
  // A menu is considered open if it's explicitly set as the openMenu, 
  // or if its children include the currently active item (to keep it open when navigating)
  const isOpen = openMenu === key || (children && children.includes(activeItem) && openMenu === null) || (children && children.includes(activeItem) && openMenu === key)

  const isActive = activeItem === key || (children && children.includes(activeItem))

  const handleMenuClick = () => {
    if (hasChildren) {
      setOpenMenu(isOpen ? null : key) // Toggle open/close, closing others
    }
    onItemClick(key)
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleMenuClick}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] transition-all duration-300 relative overflow-hidden ${
          isActive
            ? 'font-bold shadow-md scale-[1.02]'
            : 'hover:translate-x-1'
        }`}
        style={{
          color: isActive ? (isDark ? '#fff' : 'var(--app-heading)') : (isDark ? 'rgba(255,255,255,0.6)' : '#71717a'),
          background: isActive 
            ? (isDark ? 'linear-gradient(135deg, rgba(0, 94, 217, 0.4) 0%, rgba(9, 182, 185, 0.1) 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)')
            : 'transparent',
          boxShadow: isActive && isDark ? '0 0 20px -5px rgba(9, 182, 185, 0.3), inset 0 0 0 1px rgba(9, 182, 185, 0.2)' : undefined,
        }}
      >
        {isActive && isDark && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#09B6B9] to-[#005ED9] shadow-[0_0_8px_#09B6B9]"></div>
        )}
        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? (isDark ? '#09B6B9' : 'var(--app-accent)') : (isDark ? 'rgba(255,255,255,0.4)' : '#94949e') }} className="relative z-10" />
        {!collapsed && (
          <>
            <span className="truncate flex-1 relative z-10">{key}</span>
            {hasChildren && (
              <span className={`ml-auto transition-transform duration-300 relative z-10 ${isOpen ? 'rotate-180' : ''}`} style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#94949e' }}>
                <ChevronDown size={14} />
              </span>
            )}
          </>
        )}
      </button>

      {hasChildren && isOpen && !collapsed && (
        <div className="ml-7 mt-1.5 space-y-1 border-l" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
          {children.map((child) => {
            const isChildActive = activeItem === child
            return (
              <button
                type="button"
                key={child}
                onClick={() => { onItemClick(child); setOpenMenu(key); }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[11px] transition-all duration-300 relative group ${isChildActive ? 'font-semibold' : 'hover:translate-x-1'}`}
                style={{
                  color: isChildActive ? (isDark ? '#09B6B9' : 'var(--app-accent)') : (isDark ? 'rgba(255,255,255,0.5)' : '#71717a'),
                  backgroundColor: isChildActive ? (isDark ? 'rgba(9, 182, 185, 0.1)' : 'var(--app-accent-soft)') : 'transparent',
                }}
              >
                {isChildActive && isDark && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-1/2 bg-[#09B6B9] rounded-r-full shadow-[0_0_4px_#09B6B9]"></div>
                )}
                <div className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${isChildActive ? 'scale-125' : 'scale-100 opacity-40 group-hover:opacity-100'}`} style={{ backgroundColor: isChildActive ? (isDark ? '#09B6B9' : 'var(--app-accent)') : (isDark ? 'rgba(255,255,255,0.3)' : '#94949e'), boxShadow: isChildActive && isDark ? '0 0 5px #09B6B9' : undefined }} />
                {child}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Sidebar({ activeItem, onItemClick, collapsed, onToggle, isDark }) {
  const renderItems = useMemo(() => menuItems, [])
  const [openMenu, setOpenMenu] = useState(null)

  // Determine initial open menu based on activeItem
  useEffect(() => {
    const activeParent = renderItems.find(item => item.children && item.children.includes(activeItem));
    if (activeParent) {
      setOpenMenu(activeParent.key);
    }
  }, [activeItem, renderItems]);

  return (
    <aside
      className={`border-r px-3 py-3 transition-all duration-300 flex flex-col h-full shrink-0 relative ${
        collapsed ? 'w-[80px]' : 'w-[260px]'
      }`}
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-sidebar-bg)' }}
    >
      <style>{`
        .sidebar-scrollbar::-webkit-scrollbar { width: 4px; }
        .sidebar-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scrollbar::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}; border-radius: 4px; }
        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover { background: ${isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}; }
      `}</style>
      
      <div className="mb-2 flex items-center justify-end shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all hover:bg-slate-50 dark:hover:bg-white/5"
          style={{
            borderColor: 'var(--app-border)',
            color: isDark ? '#fff' : 'var(--app-heading)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="space-y-0.5 flex-1 overflow-y-auto sidebar-scrollbar pr-1 pb-4">
        {renderItems.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            activeItem={activeItem}
            onItemClick={onItemClick}
            collapsed={collapsed}
            isDark={isDark}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          />
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
