import { useState } from 'react'
import { Menu, Bell, Download, Plug, Calendar, ChevronDown, CheckCircle2, Building2, Plus } from 'lucide-react'
import { company, notifications } from '../data/mockData'

export default function Header({ collapsed, onToggleSidebar }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.read).length

  const syncTimeAgo = () => {
    const now = new Date()
    const sync = new Date(company.lastSync)
    const diffH = Math.round((now - sync) / 36e5)
    if (diffH < 1) return 'Just now'
    if (diffH === 1) return '1h ago'
    return `${diffH}h ago`
  }

  return (
    <header className={`app-header flex items-center gap-3 lg:gap-4 px-4 lg:px-6 ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Toggle */}
      <button
        onClick={onToggleSidebar}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 transition-all shrink-0 active:scale-95"
        title="Toggle sidebar"
      >
        <Menu size={18} strokeWidth={2.5} />
      </button>

      {/* Company Switcher */}
      <div className="relative">
        <button
          onClick={() => setCompanyOpen(!companyOpen)}
          className="flex items-center gap-2 px-2.5 py-1.5 border border-slate-200/80 bg-white rounded-lg hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm transition-all max-w-[160px] sm:max-w-[220px]"
        >
          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-sm"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
            SE
          </div>
          <span className="text-xs font-semibold text-slate-700 truncate hidden sm:block">{company.shortName}</span>
          <span className="text-xs font-semibold text-slate-700 truncate sm:hidden">SE</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
        {companyOpen && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 py-2 animate-fade-in">
            {company.companies.map(c => (
              <button key={c.id} onClick={() => setCompanyOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-colors text-left group">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                  style={{ background: c.color }}>
                  {c.name[0]}
                </div>
                <span className="text-[13px] text-slate-700 font-semibold group-hover:text-blue-600 transition-colors">{c.name}</span>
              </button>
            ))}
            <div className="border-t border-slate-100 mx-3 my-2" />
            <button className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-blue-600 font-semibold hover:bg-blue-50/50 text-left transition-colors">
              <Plus size={16} /> Add Company
            </button>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Controls Row */}
      <div className="flex items-center gap-3 lg:gap-5">
        {/* FY Selector */}
        <button className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-slate-200/80 bg-white rounded-lg text-[13px] font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50 transition-all hover:shadow-sm">
          <Calendar size={14} className="text-blue-500" /> FY {company.financialYear}
        </button>

        {/* Sync Badge */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-all">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-semibold text-emerald-700 hidden lg:inline">Synced · {syncTimeAgo()}</span>
        </div>

        {/* Quick Actions */}
        <button className="hidden lg:flex items-center gap-2 px-3 py-1.5 border border-slate-200/80 bg-white rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-all hover:shadow-sm">
          <Download size={14} /> Export
        </button>

        <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all"
          style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
          <Plug size={14} /> <span className="hidden lg:inline">Connect Tally</span>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-8 h-8 flex items-center justify-center border border-slate-200/80 bg-white rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all hover:shadow-sm active:scale-95"
          >
            <Bell size={16} strokeWidth={2.5} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white px-1 shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 animate-fade-in overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <span className="text-sm font-bold text-slate-800">Notifications</span>
                <button className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold bg-blue-50 px-2 py-1 rounded-md transition-colors">Mark all read</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {!n.read ? (
                          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]" />
                        ) : (
                          <CheckCircle2 size={12} className="text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${!n.read ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'} leading-relaxed`}>{n.message}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-1">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 text-center bg-slate-50/50 border-t border-slate-50">
                <button className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors">View all notifications</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
