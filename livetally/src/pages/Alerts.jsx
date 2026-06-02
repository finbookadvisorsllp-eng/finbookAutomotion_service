import { useState } from 'react'
import { alerts, notifications } from '../data/mockData'
import { AlertCircle, ArrowRight, Check, CheckCircle2, Circle, Clock, Search, Bell, Mail } from 'lucide-react'

export default function AlertsAndNotifications() {
  const [activeTab, setActiveTab] = useState('Alerts') // 'Alerts' or 'Notifications'
  
  // Alerts State
  const [alertFilter, setAlertFilter] = useState('All')
  const filteredAlerts = alertFilter === 'All' 
    ? alerts 
    : alerts.filter(a => a.type === alertFilter.toLowerCase())

  // Notifications State
  const [notifFilter, setNotifFilter] = useState('All')
  const [notifSearch, setNotifSearch] = useState('')
  const filteredNotifs = notifications.filter(n => {
    if (notifFilter !== 'All') {
      if (notifFilter === 'Unread' && n.read) return false
      if (notifFilter === 'Read' && !n.read) return false
      if (['Alert', 'Sync', 'Gst', 'Stock'].includes(notifFilter) && n.type !== notifFilter.toLowerCase()) return false
    }
    if (notifSearch && !n.message.toLowerCase().includes(notifSearch.toLowerCase())) return false
    return true
  })

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Alerts & Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Stay updated on critical alerts and business activities.</p>
        </div>
        
        {/* Main Tab Switcher */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/50">
          <button 
            onClick={() => setActiveTab('Alerts')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'Alerts' 
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Bell size={16} className={activeTab === 'Alerts' ? 'text-blue-500' : ''} /> 
            Alerts
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'Alerts' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
              {alerts.length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('Notifications')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'Notifications' 
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Mail size={16} className={activeTab === 'Notifications' ? 'text-blue-500' : ''} /> 
            Notifications
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'Notifications' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
              {notifications.filter(n => !n.read).length}
            </span>
          </button>
        </div>
      </div>

      {/* ALERTS TAB */}
      {activeTab === 'Alerts' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            {['All', 'Danger', 'Warning', 'Info', 'Success'].map(f => (
              <button 
                key={f}
                onClick={() => setAlertFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                  alertFilter === f 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center p-12">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-[#B6FF00]/10 text-emerald-500 dark:text-[#B6FF00] flex items-center justify-center mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">All caught up!</h3>
              <p className="text-sm text-slate-500 mt-1">There are no {alertFilter.toLowerCase()} alerts at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAlerts.map(alert => (
                <div key={alert.id} className="glass-card p-5 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-[0_0_15px_rgba(182,255,0,0.15)] transition-all bg-white border border-slate-100">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                      alert.type === 'danger' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' :
                      alert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500' :
                      alert.type === 'info' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-500' :
                      'bg-emerald-50 dark:bg-[#B6FF00]/10 text-emerald-500 dark:text-[#B6FF00]'
                    }`}>
                      {alert.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          alert.type === 'danger' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                          alert.type === 'warning' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                          alert.type === 'info' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                          'bg-emerald-100 dark:bg-[#B6FF00]/20 text-emerald-700 dark:text-[#B6FF00]'
                        }`}>
                          {alert.type}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{alert.text}</h3>
                      <div className="mt-2 text-lg font-black text-slate-900">{alert.value}</div>
                      <p className="text-xs text-slate-500 mt-1">{alert.subtext}</p>
                      
                      <button className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-[#B6FF00] hover:text-blue-700 dark:hover:text-[#90cc00] transition-colors">
                        {alert.action} <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'Notifications' && (
        <div className="animate-fade-in bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
              {['All', 'Unread', 'Read', 'Alert', 'Sync', 'Gst', 'Stock'].map(f => (
                <button 
                  key={f}
                  onClick={() => setNotifFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                    notifFilter === f 
                      ? 'bg-white text-blue-600 border-blue-200 shadow-sm' 
                      : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search notifications..." 
                  value={notifSearch}
                  onChange={(e) => setNotifSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors">
                <Check size={16} /> Mark all as read
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredNotifs.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCircle2 size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-semibold text-slate-500">No notifications found.</p>
              </div>
            ) : (
              filteredNotifs.map(n => (
                <div key={n.id} className={`p-4 flex gap-4 transition-colors hover:bg-slate-50 ${!n.read ? 'bg-blue-50/30' : ''}`}>
                  <div className="pt-1">
                    {n.read ? <Circle size={12} className="text-slate-300" /> : <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <p className={`text-sm ${!n.read ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                        {n.message}
                      </p>
                      <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap flex items-center gap-1">
                        <Clock size={12} /> {n.time}
                      </span>
                    </div>
                    <div className="mt-1.5 flex gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {n.type}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
