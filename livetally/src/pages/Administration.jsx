import { useState } from 'react'

const clients = [
  { id:1, name:'Sharma Enterprises Pvt Ltd', plan:'Business', users:3, lastSync:'27 May 2025', status:'active', gstin:'27AABCS1429B1Z5' },
  { id:2, name:'Gupta Trading Co.',          plan:'Starter',  users:1, lastSync:'26 May 2025', status:'active', gstin:'27BBBGS4521C1Z3' },
  { id:3, name:'Mehta Industries Ltd',       plan:'Business', users:5, lastSync:'25 May 2025', status:'active', gstin:'27CCCMI7823D1Z8' },
  { id:4, name:'Patel Retail Pvt Ltd',       plan:'Starter',  users:2, lastSync:'20 May 2025', status:'inactive', gstin:'27DDDPR2341E1Z2' },
  { id:5, name:'Joshi Distributors',         plan:'Pro',      users:8, lastSync:'27 May 2025', status:'active', gstin:'27EEEJD9812F1Z6' },
]

const users = [
  { id:1, name:'Rajesh Sharma', email:'rajesh@sharmaent.com', role:'Business Owner', company:'Sharma Enterprises', status:'active', lastLogin:'Today 10:30 AM' },
  { id:2, name:'CA Priya Mehta', email:'priya@rkca.com', role:'Accountant (CA)', company:'All Clients', status:'active', lastLogin:'Today 09:15 AM' },
  { id:3, name:'Sanjay Kumar', email:'sanjay@sharmaent.com', role:'Staff Viewer', company:'Sharma Enterprises', status:'active', lastLogin:'Yesterday' },
  { id:4, name:'Anita Joshi', email:'anita@joshidist.com', role:'Business Owner', company:'Joshi Distributors', status:'active', lastLogin:'27 May' },
  { id:5, name:'Vikram Patel', email:'vikram@patelretail.com', role:'Business Owner', company:'Patel Retail Pvt Ltd', status:'inactive', lastLogin:'18 May' },
]

const plans = [
  { name:'Starter',  price:'₹999/mo',  clients:1,  users:2,  features:['Dashboard','Basic Reports','GST Summary','Email Support'] },
  { name:'Business', price:'₹2,499/mo', clients:5,  users:10, features:['All Reports','Tally Sync','Advanced Analytics','Priority Support'], popular:true },
  { name:'Pro',      price:'₹5,999/mo', clients:20, users:50, features:['Unlimited Reports','Multi-company','Custom Reports','Dedicated CA Support'] },
]

export default function Administration() {
  const [activeTab, setActiveTab] = useState('clients')

  const tabs = [
    { id:'clients', label:'Clients', icon:'👥' },
    { id:'users',   label:'Users & Roles', icon:'🔐' },
    { id:'billing', label:'Billing & Plans', icon:'💳' },
    { id:'audit',   label:'Audit Logs', icon:'🗂️' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Administration</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage clients, users, roles & billing</p>
        </div>
        <button className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2" style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}}>
          + Invite Client
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-5 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
            {[
              {label:'Total Clients',  value:clients.length,                              bg:'bg-blue-50',   border:'border-blue-100',   color:'text-blue-700'},
              {label:'Active Clients', value:clients.filter(c=>c.status==='active').length, bg:'bg-emerald-50',border:'border-emerald-100',color:'text-emerald-700'},
              {label:'Synced Today',   value:2,                                           bg:'bg-indigo-50', border:'border-indigo-100',  color:'text-indigo-700'},
              {label:'Inactive',       value:clients.filter(c=>c.status==='inactive').length,bg:'bg-slate-50',border:'border-slate-200',color:'text-slate-600'},
            ].map(s=>(
              <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
                <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Client Companies</h2>
              <button className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white" style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}}>
                + Add Client
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Company','Plan','Users','GSTIN','Last Sync','Status','Actions'].map(h=>(
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c=>(
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                            style={{background:`hsl(${c.id*60},70%,50%)`}}>
                            {c.name[0]}
                          </div>
                          <span className="font-semibold text-slate-800">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${c.plan==='Pro'?'bg-purple-100 text-purple-700':c.plan==='Business'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-600'}`}>
                          {c.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{c.users}</td>
                      <td className="px-5 py-3 font-mono text-[12px] text-slate-500">{c.gstin}</td>
                      <td className="px-5 py-3 text-slate-400">{c.lastSync}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${c.status==='active'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button className="text-xs text-blue-600 font-medium hover:text-blue-700">View</button>
                          <button className="text-xs text-slate-400 font-medium hover:text-slate-600">Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Users & Access Control</h2>
              <button className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white" style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}}>
                + Invite User
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['User','Role','Company','Last Login','Status','Actions'].map(h=>(
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u=>(
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                            style={{background:'linear-gradient(135deg,#2563eb,#7c3aed)'}}>
                            {u.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-xs">{u.name}</p>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          u.role.includes('CA')?'bg-purple-100 text-purple-700':
                          u.role.includes('Owner')?'bg-blue-100 text-blue-700':
                          'bg-slate-100 text-slate-600'
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{u.company}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{u.lastLogin}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${u.status==='active'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button className="text-xs text-blue-600 font-medium hover:text-blue-700">Permissions</button>
                          <button className="text-xs text-slate-400 font-medium hover:text-red-500">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="animate-fade-in">
          <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4">
            <span className="text-2xl">📋</span>
            <div>
              <p className="text-sm font-bold text-blue-800">Current Plan: Business</p>
              <p className="text-xs text-blue-600 mt-0.5">5 clients · 10 users · Renews 1 July 2025 · ₹2,499/month</p>
            </div>
            <button className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold text-blue-600 border border-blue-300 bg-white hover:bg-blue-50 transition-all whitespace-nowrap">
              Manage Billing
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(plan => (
              <div key={plan.name} className={`relative bg-white rounded-2xl border-2 p-6 transition-all ${plan.popular?'border-blue-500 shadow-lg shadow-blue-100':'border-slate-100 hover:border-slate-200'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-base font-bold text-slate-800 mb-1">{plan.name}</h3>
                <div className="text-2xl font-extrabold text-slate-900 mb-1">{plan.price}</div>
                <div className="text-xs text-slate-400 mb-4">{plan.clients} clients · {plan.users} users</div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map(f=>(
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="text-emerald-500 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${plan.popular?'text-white':'text-blue-600 border border-blue-200 hover:bg-blue-50'}`}
                  style={plan.popular?{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}:{}}>
                  {plan.name === 'Business' ? 'Current Plan' : `Switch to ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Audit Trail</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                { time:'Today 10:30 AM', user:'Rajesh Sharma',  action:'Viewed Balance Sheet',    type:'view',    ip:'103.21.44.12' },
                { time:'Today 09:15 AM', user:'CA Priya Mehta', action:'Exported P&L Report (PDF)',type:'export',  ip:'122.160.32.88' },
                { time:'Today 04:30 AM', user:'System',         action:'Tally Sync Completed',    type:'sync',    ip:'—' },
                { time:'Yesterday 6 PM', user:'Rajesh Sharma',  action:'Logged In',               type:'auth',    ip:'103.21.44.12' },
                { time:'Yesterday 5 PM', user:'CA Priya Mehta', action:'Updated permissions for Sanjay Kumar', type:'admin', ip:'122.160.32.88' },
                { time:'25 May 11 AM',   user:'System',         action:'GSTR-1 Reminder Sent',    type:'alert',   ip:'—' },
              ].map((log,i)=>{
                const colors = { view:'bg-blue-100 text-blue-700', export:'bg-purple-100 text-purple-700', sync:'bg-emerald-100 text-emerald-700', auth:'bg-slate-100 text-slate-600', admin:'bg-amber-100 text-amber-700', alert:'bg-orange-100 text-orange-700' }
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <span className="text-[11px] text-slate-400 w-36 shrink-0">{log.time}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${colors[log.type]}`}>{log.type}</span>
                    <span className="text-sm text-slate-500 shrink-0">{log.user}</span>
                    <span className="text-sm text-slate-700 flex-1">{log.action}</span>
                    <span className="text-[11px] text-slate-300 font-mono shrink-0">{log.ip}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
