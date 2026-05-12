import {
  LayoutDashboard,
  Settings2,
  ReceiptText,
  BarChart3,
  ShoppingCart,
  Wallet,
  Landmark,
  ShieldCheck,
  FolderOpen,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  History,
  Archive,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const menuItems = [
  { key: 'Dashboard', icon: LayoutDashboard, children: ['User Data'] },
  { key: 'Manage', icon: Settings2, children: ['Manage Company', 'Manage Business User', 'Allocate Accountant'] },
  { key: 'Invoice', icon: ReceiptText, children: ['Invoice Inbox'] },
  { key: 'Sales', icon: BarChart3, children: ['Sales Order', 'Sales Invoice', 'Credit Note (Sales Return)'] },
  { key: 'Purchase/Expense', icon: ShoppingCart, children: ['Purchase Order', 'Purchase Invoice', 'Debit Note (Purchase Return)'] },
  { key: 'Fund Flow', icon: Wallet, children: ['Cash Payment', 'Bank Payment', 'Contra'] },
  { key: 'Bank', icon: Landmark, children: ['Manage Bank', 'Manage Rule', 'Inbox'] },
  { key: 'Review', icon: History, children: ['Sales Review', 'Purchase Review', 'Fund Flow Review', 'Bank Review'] },
  { key: 'Archive', icon: Archive, children: ['Sales Archive', 'Purchase Archive', 'Fund Flow Archive', 'Bank Archive'] },
  { key: 'Role Management', icon: ShieldCheck, children: ['Manage Roles', 'Manage User Permission'] },
  { key: 'My Documents', icon: FolderOpen },
  { key: 'Master Data', icon: Boxes, children: ['Party Ledger', 'Stock Ledger'] },
]

function SidebarItem({ item, activeItem, onItemClick, collapsed, openMenu, setOpenMenu }) {
  const { key, icon: Icon, children } = item
  const hasChildren = !!children
  const isOpen = openMenu === key
  const isActive = activeItem === key || (children && children.includes(activeItem))

  const handleClick = () => {
    if (hasChildren) {
      setOpenMenu(isOpen ? null : key)
      if (!isOpen) onItemClick(children[0])
    } else {
      onItemClick(key)
    }
  }

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.985 }}
        type="button"
        onClick={handleClick}
        className="group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors"
        style={{
          color: isActive ? 'var(--app-heading)' : 'var(--app-text)',
          backgroundColor: isActive ? 'var(--app-control-hover)' : 'transparent',
          fontWeight: isActive ? 600 : 500,
        }}
      >
        {isActive && (
          <motion.span
            layoutId="sidebar-active-indicator"
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
            style={{ background: 'var(--app-accent-gradient)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}

        <span
          className="flex h-7 w-7 items-center justify-center rounded-md shrink-0 transition-colors"
          style={{
            backgroundColor: isActive ? 'var(--app-accent-soft)' : 'transparent',
            color: isActive ? 'var(--app-accent)' : 'var(--app-muted)',
          }}
        >
          <Icon size={15} strokeWidth={isActive ? 2.4 : 2} />
        </span>

        {!collapsed && (
          <>
            <span className="truncate flex-1">{key}</span>
            {hasChildren && (
              <motion.span
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: 0.18 }}
                style={{ color: 'var(--app-muted)' }}
              >
                <ChevronRight size={13} />
              </motion.span>
            )}
          </>
        )}
      </motion.button>

      <AnimatePresence initial={false}>
        {hasChildren && isOpen && !collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="ml-[26px] mt-1 mb-1 space-y-0.5 border-l pl-2.5"
              style={{ borderColor: 'var(--app-border)' }}
            >
              {children.map((child) => {
                const childActive = activeItem === child
                return (
                  <button
                    type="button"
                    key={child}
                    onClick={() => onItemClick(child)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] transition-all hover:translate-x-0.5"
                    style={{
                      color: childActive ? 'var(--app-accent)' : 'var(--app-text)',
                      backgroundColor: childActive ? 'var(--app-accent-soft)' : 'transparent',
                      fontWeight: childActive ? 600 : 500,
                    }}
                  >
                    <span
                      className="h-1 w-1 rounded-full transition-all"
                      style={{
                        background: childActive ? 'var(--app-accent-gradient)' : 'var(--app-muted)',
                        opacity: childActive ? 1 : 0.5,
                        transform: childActive ? 'scale(1.6)' : 'scale(1)',
                      }}
                    />
                    <span className="truncate">{child}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Sidebar({ activeItem, onItemClick, collapsed, onToggle }) {
  const renderItems = useMemo(() => menuItems, [])
  const [openMenu, setOpenMenu] = useState(null)

  useEffect(() => {
    const activeParent = renderItems.find(
      (item) => item.children && item.children.includes(activeItem),
    )
    if (activeParent) setOpenMenu(activeParent.key)
  }, [activeItem, renderItems])

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="border-r flex flex-col h-full shrink-0 relative"
      style={{
        borderColor: 'var(--app-border)',
        backgroundColor: 'var(--app-sidebar-bg)',
      }}
    >
      {/* Header / collapse */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b"
        style={{ borderColor: 'var(--app-border)' }}
      >
        {!collapsed && (
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--app-muted)' }}
          >
            Workspace
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md border focus-ring transition-colors hover:bg-[var(--app-control-hover)]"
          style={{
            borderColor: 'var(--app-border)',
            color: 'var(--app-text)',
            backgroundColor: 'var(--app-control-bg)',
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto themed-scrollbar px-2 py-3 space-y-0.5">
        {renderItems.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            activeItem={activeItem}
            onItemClick={onItemClick}
            collapsed={collapsed}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
          />
        ))}
      </nav>

      {/* Footer card */}
      {!collapsed && (
        <div className="p-3">
          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: 'var(--app-border)',
              background:
                'linear-gradient(135deg, var(--app-accent-soft) 0%, transparent 100%)',
            }}
          >
            <div
              className="text-[11px] font-semibold mb-0.5"
              style={{ color: 'var(--app-heading)' }}
            >
              Need help?
            </div>
            <div
              className="text-[10.5px] leading-snug mb-2"
              style={{ color: 'var(--app-text)' }}
            >
              Ask our AI assistant or talk to a real accountant.
            </div>
            <button
              type="button"
              className="w-full rounded-md py-1.5 text-[11px] font-semibold text-white shadow-sm"
              style={{ background: 'var(--app-accent-gradient)' }}
            >
              Open Assistant
            </button>
          </div>
        </div>
      )}
    </motion.aside>
  )
}

export default Sidebar
