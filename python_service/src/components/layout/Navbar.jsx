import { useState } from 'react'
import { motion } from 'motion/react'
import {
  Bell, ChevronDown, Menu, Moon, Sun, RefreshCw, HelpCircle,
  CheckCircle2, ArrowLeft, Building2, Calendar,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../../stores/useAppStore'
import Select from '../ui/Select'

// Status pill — semantic only (connected/synced state), not brand color.
function StatusPill({ icon: Icon, label, value }) {
  return (
    <div className="hidden lg:flex items-center gap-2 rounded-xl border px-3 py-1" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}>
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
        <Icon size={11} strokeWidth={2.5} />
      </div>
      <div className="leading-none text-left">
        <div className="text-[9px] font-semibold" style={{ color: 'var(--app-muted)' }}>{label}</div>
        <div className="text-[10px] font-bold text-emerald-500 mt-0.5">{value}</div>
      </div>
    </div>
  )
}

function IconBtn({ icon: Icon, badge, onClick, label }) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--app-control-hover)]"
      style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)', backgroundColor: 'var(--app-control-bg)' }}
    >
      <Icon size={13} />
      {badge != null && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8.5px] font-bold text-white bg-rose-500">{badge}</span>
      )}
    </motion.button>
  )
}

function Navbar({ isDark, onModeToggle, companies, selectedCompany, onCompanyChange, onMobileNavToggle }) {
  const location = useLocation()
  const approvalCenterView = useAppStore((s) => s.approvalCenterView)
  const isApprovalDetail = location.pathname.startsWith('/automation/approval-center') && approvalCenterView === 'detail'

  const [selectedFy, setSelectedFy] = useState(localStorage.getItem('selectedFy') || 'FY 2023-24')
  const handleFyChange = (fy) => {
    localStorage.setItem('selectedFy', fy)
    setSelectedFy(fy)
    window.dispatchEvent(new Event('fy-changed'))
  }

  return (
    <header
      className="flex items-center justify-between gap-4 px-4 border-b shrink-0 flex-wrap sm:flex-nowrap py-2.5"
      style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', minHeight: 56, height: 56 }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileNavToggle}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border shrink-0"
          style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)', backgroundColor: 'var(--app-control-bg)' }}
          aria-label="Open navigation"
        >
          <Menu size={16} />
        </button>

        {isApprovalDetail ? (
          <button
            type="button"
            onClick={() => useAppStore.getState().setApprovalCenterView('list')}
            className="flex items-center gap-1.5 font-extrabold text-[12.5px] transition-all ml-1"
            style={{ color: 'var(--app-accent)' }}
          >
            <ArrowLeft size={14} className="stroke-[2.5]" /> Back to Approval Center
          </button>
        ) : (
          <>
            <Select label="Company" icon={Building2} value={selectedCompany} options={companies} onChange={onCompanyChange} placeholder="Select Company" minWidth={170} searchable />
            <Select label="Financial Year" icon={Calendar} value={selectedFy} options={['FY 2023-24', 'FY 2024-25']} onChange={handleFyChange} minWidth={130} />
          </>
        )}
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-end">
        <StatusPill icon={CheckCircle2} label="Tally Status" value="Connected" />
        <StatusPill icon={RefreshCw} label="Sync Status" value="Synced" />

        <IconBtn icon={isDark ? Sun : Moon} onClick={onModeToggle} label="Toggle theme" />
        <IconBtn icon={Bell} badge={3} label="Notifications" />
        <IconBtn icon={HelpCircle} label="Help" />

        <div className="flex items-center gap-1 cursor-pointer ml-1 select-none">
          <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-[12px] text-white shrink-0" style={{ background: 'var(--app-accent-gradient)' }}>R</div>
          <ChevronDown size={12} className="shrink-0" style={{ color: 'var(--app-muted)' }} />
        </div>
      </div>
    </header>
  )
}

export default Navbar
