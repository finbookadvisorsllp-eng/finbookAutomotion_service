import { useState } from 'react'

const steps = [
  {
    num: 1,
    title: 'Download TallyView Connector',
    desc: 'Download and install the TallyView Connector on the same computer where Tally is running.',
    status: 'done',
    action: 'Download Connector (v2.1)',
    actionStyle: 'bg-blue-600 text-white',
  },
  {
    num: 2,
    title: 'Configure Tally for TCP Access',
    desc: 'In Tally, go to F12 (Configure) → Advanced → Enable ODBC Server. Set port to 9000 and ensure "Allow Data Access" is ON.',
    status: 'done',
    action: 'View Instructions',
    actionStyle: 'border border-slate-200 text-slate-600',
  },
  {
    num: 3,
    title: 'Enter Your Tally Server Details',
    desc: 'Enter the IP address of the computer running Tally and the port number configured above.',
    status: 'active',
    hasForm: true,
  },
  {
    num: 4,
    title: 'Test Connection',
    desc: 'Click the test button to verify that TallyView can reach your Tally server.',
    status: 'pending',
    action: 'Test Connection',
    actionStyle: 'bg-emerald-600 text-white',
  },
  {
    num: 5,
    title: 'Map Your Company',
    desc: 'Select which Tally company to sync. All vouchers, ledgers, and masters will be imported.',
    status: 'pending',
  },
  {
    num: 6,
    title: 'Start First Sync',
    desc: 'Begin syncing your Tally data. First sync may take a few minutes depending on your data volume.',
    status: 'pending',
    action: 'Start Sync',
    actionStyle: 'bg-indigo-600 text-white',
  },
]

export default function TallySetup() {
  const [ip, setIp]     = useState('192.168.1.')
  const [port, setPort] = useState('9000')
  const [testing, setTesting] = useState(false)
  const [tested, setTested]   = useState(false)

  const handleTest = () => {
    setTesting(true)
    setTimeout(() => { setTesting(false); setTested(true) }, 2000)
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-slate-900">Connect Your Tally</h1>
        <p className="text-sm text-slate-400 mt-0.5">Follow the steps below to sync your Tally data with TallyView</p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
        <span className="text-xl">💡</span>
        <div>
          <p className="text-sm font-bold text-blue-800">Before you begin</p>
          <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
            Make sure Tally is running on your computer or server. You'll need network access from this browser to that computer. 
            TallyView uses a secure local connector — your data never leaves your network without your permission.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="relative">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const statusIcon = step.status === 'done' ? '✓' : step.status === 'active' ? step.num : step.num
          const iconStyle = step.status === 'done'
            ? 'bg-emerald-500 text-white'
            : step.status === 'active'
            ? 'bg-blue-600 text-white ring-4 ring-blue-100'
            : 'bg-white border-2 border-slate-200 text-slate-400'

          return (
            <div key={step.num} className="relative flex gap-5 mb-0">
              {/* Line */}
              {!isLast && (
                <div className="absolute left-[19px] top-10 w-0.5 h-full"
                  style={{ background: step.status === 'done' ? '#10b981' : '#e2e8f0' }} />
              )}

              {/* Number */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 z-10 ${iconStyle}`}>
                {statusIcon}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-8 ${step.status === 'pending' ? 'opacity-50' : ''}`}>
                <div className={`bg-white rounded-2xl border p-5 transition-all ${step.status === 'active' ? 'border-blue-300 shadow-md shadow-blue-100' : 'border-slate-100'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-bold text-slate-800">{step.title}</h3>
                    {step.status === 'done' && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">Completed</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{step.desc}</p>

                  {/* Form for step 3 */}
                  {step.hasForm && (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tally Server IP</label>
                        <input
                          value={ip}
                          onChange={e => setIp(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                          placeholder="192.168.1.100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Port Number</label>
                        <input
                          value={port}
                          onChange={e => setPort(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                          placeholder="9000"
                        />
                      </div>
                    </div>
                  )}

                  {/* Test connection (step 4) */}
                  {step.num === 4 && (
                    <div className="mb-3">
                      {tested && (
                        <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                          <span className="text-emerald-600 font-bold">✓</span>
                          <div>
                            <p className="text-xs font-bold text-emerald-700">Connection Successful!</p>
                            <p className="text-[11px] text-emerald-600">Tally Prime 4.1 detected at {ip}:{port}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action button */}
                  {step.action && (
                    <button
                      disabled={step.status === 'pending' || testing}
                      onClick={step.num === 4 ? handleTest : undefined}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 ${step.actionStyle}`}
                    >
                      {step.num === 4 && testing ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Testing...
                        </span>
                      ) : step.action}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Help */}
      <div className="mt-2 p-5 bg-slate-50 border border-slate-100 rounded-2xl">
        <h3 className="text-sm font-bold text-slate-700 mb-3">Need Help?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon:'📄', title:'Setup Guide', desc:'Step-by-step PDF guide for Tally connector setup' },
            { icon:'▶️', title:'Video Tutorial', desc:'Watch our 5-minute walkthrough video' },
            { icon:'🎧', title:'Contact Support', desc:'Chat with our team — Mon–Sat 9AM–6PM' },
          ].map(h=>(
            <button key={h.title} className="text-left p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="text-xl mb-1.5">{h.icon}</div>
              <p className="text-xs font-bold text-slate-800">{h.title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{h.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
