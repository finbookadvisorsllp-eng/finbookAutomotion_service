import { useState } from 'react'
import { alerts } from '../data/mockData'
import { AlertCircle, ArrowRight, Filter, Search } from 'lucide-react'

export default function Alerts() {
  const [filter, setFilter] = useState('All')
  
  const filteredAlerts = filter === 'All' 
    ? alerts 
    : alerts.filter(a => a.type === filter.toLowerCase())

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Alerts Center</h1>
          <p className="text-sm text-slate-400 mt-0.5">Critical business alerts and warnings requiring your attention.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {['All', 'Danger', 'Warning', 'Info', 'Success'].map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
              filter === f 
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
          <p className="text-sm text-slate-500 mt-1">There are no {filter.toLowerCase()} alerts at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.map(alert => (
            <div key={alert.id} className="glass-card p-5 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-[0_0_15px_rgba(182,255,0,0.15)] transition-all">
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
  )
}
