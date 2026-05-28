import { alerts } from '../data/mockData'
import { useNavigate } from 'react-router-dom'

const CHIP_STYLES = {
  danger:  'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info:    'bg-indigo-50 border-indigo-200 text-indigo-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
}

export default function AlertsPanel() {
  const navigate = useNavigate()

  return (
    <div className="flex gap-4 mb-6 sm:mb-8 overflow-x-auto pb-2 scrollbar-hide">
      {alerts.map(alert => (
        <div
          key={alert.id}
          onClick={() => {
            if (alert.action === 'View Receivables') navigate('/sales/receivables')
            else if (alert.action === 'View Payables') navigate('/purchase/payables')
            else if (alert.action === 'View Inventory') navigate('/inventory')
            else if (alert.action === 'View GST') navigate('/reports/gst')
            else if (alert.action === 'View Analytics') navigate('/analytics')
          }}
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl border text-[15px] cursor-pointer whitespace-nowrap shrink-0 hover:-translate-y-0.5 hover:shadow-md transition-all ${CHIP_STYLES[alert.type]}`}
        >
          <span className="text-xl leading-none">{alert.icon}</span>
          <span className="font-medium">{alert.text}</span>
          <span className="font-bold">{alert.value}</span>
          <span className="hidden sm:inline text-xs opacity-80 font-medium">· {alert.subtext}</span>
        </div>
      ))}
    </div>
  )
}
