import {
  LayoutDashboard,
  FileText,
  Upload,
  BookOpen,
  Package,
  Brain,
  CheckCircle2,
  Plug,
  Archive,
  Building,
  Users,
  UserCheck,
  Settings,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { motion } from 'motion/react'

const menuItems = [
  { key: 'Dashboard', icon: LayoutDashboard },
  { key: 'Manual Entry', icon: FileText },
  { key: 'Bulk Upload', icon: Upload },
  { key: 'AI Processing Center', icon: Brain },
  { key: 'Approval Center', icon: CheckCircle2 },
  { key: 'Ledger Master', icon: BookOpen },
  { key: 'Item Master', icon: Package },
  { key: 'Tally Connector', icon: Plug },
  { key: 'Document Archive', icon: Archive },
  { key: 'Companies', icon: Building },
  { key: 'Clients', icon: Users },
  { key: 'User & Role Management', icon: UserCheck },
  { key: 'Configuration', icon: Settings }
]

function SidebarItem({ item, activeItem, onItemClick, collapsed }) {
  const { key, icon: Icon } = item
  const isActive = activeItem === key

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => onItemClick(key)}
        className="group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--app-control-hover)]"
        style={{
          color: isActive ? 'var(--app-accent)' : 'var(--app-text)',
          backgroundColor: isActive ? 'var(--app-accent-soft)' : 'transparent',
          fontWeight: isActive ? 600 : 500,
        }}
      >
        <span
          className="flex h-5 w-5 items-center justify-center shrink-0"
          style={{
            color: isActive ? 'var(--app-accent)' : 'var(--app-muted)',
          }}
        >
          <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
        </span>

        {!collapsed && (
          <span className="truncate flex-1 text-[13px] tracking-wide transition-colors">
            {key}
          </span>
        )}
      </motion.button>
    </div>
  )
}

function Sidebar({ activeItem, onItemClick, collapsed, onToggle }) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 70 : 240 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col h-full shrink-0 relative overflow-hidden border-r shadow-sm select-none"
      style={{
        borderColor: 'var(--app-border)',
        backgroundColor: 'var(--app-sidebar-bg)',
      }}
    >
      <style>{`
        .sidebar-nav-container::-webkit-scrollbar {
          display: none;
        }
        .sidebar-nav-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Logo Area */}
      <div
        className="flex items-center justify-between px-4 py-3.5 border-b shrink-0"
        style={{ borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Stylized Hexagon/Diamond Icon */}
          <div className="relative h-7 w-7 flex items-center justify-center shrink-0">
            {/* Hexagon SVG shape from mockup */}
            <svg viewBox="0 0 100 100" className="h-full w-full text-blue-600 fill-blue-600">
              <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
            </svg>
            {/* Inner logo symbol (like a white hollow diamond/shield shape) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2.5 w-2.5 border-2 border-white rotate-45 transform"></div>
            </div>
          </div>
          {!collapsed && (
            <span className="text-[16px] font-extrabold tracking-tight leading-tight truncate" style={{ color: 'var(--app-heading)' }}>
              TallyHub
            </span>
          )}
        </div>
      </div>

      {/* Scrollable nav */}
      <nav className="sidebar-nav-container flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.key}
            item={item}
            activeItem={activeItem}
            onItemClick={onItemClick}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Collapse button at the bottom */}
      <div className="p-3 shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="w-full h-9 px-3 rounded-lg flex items-center justify-center gap-2 font-semibold text-[12px] transition-colors"
          style={{
            color: 'var(--app-accent)',
            backgroundColor: 'var(--app-accent-soft)',
            border: 'none'
          }}
        >
          {collapsed ? (
            <ChevronsRight size={14} className="shrink-0 text-[var(--app-accent)]" />
          ) : (
            <>
              <ChevronsLeft size={14} className="shrink-0 text-[var(--app-accent)]" />
              <span className="truncate">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  )
}

export default Sidebar
