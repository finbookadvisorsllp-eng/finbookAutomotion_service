import { useState } from 'react'
import { notifications } from '../data/mockData'
import { Check, CheckCircle2, Circle, Clock, Search } from 'lucide-react'

export default function Notifications() {
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  const filteredNotifs = notifications.filter(n => {
    if (filter !== 'All') {
      if (filter === 'Unread' && n.read) return false
      if (filter === 'Read' && !n.read) return false
      if (['Alert', 'Sync', 'Gst', 'Stock'].includes(filter) && n.type !== filter.toLowerCase()) return false
    }
    if (search && !n.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-400 mt-0.5">Stay updated on your business activities.</p>
        </div>
        <button className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5">
          <Check size={16} /> Mark all as read
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            {['All', 'Unread', 'Read', 'Alert', 'Sync', 'Gst', 'Stock'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                  filter === f 
                    ? 'bg-white text-blue-600 border-blue-200 shadow-sm' 
                    : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search notifications..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
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
    </div>
  )
}
