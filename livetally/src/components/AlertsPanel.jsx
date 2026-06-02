import { alerts } from '../data/mockData'
import { useNavigate } from 'react-router-dom'

const CHIP_STYLES = {
  danger: 'bg-red-50 border-red-200/80 text-red-700 dark:bg-[rgba(255,51,102,0.1)] dark:border-[rgba(255,51,102,0.3)] dark:text-[#FF3366]',
  warning: 'bg-amber-50 border-amber-200/80 text-amber-700 dark:bg-[rgba(255,242,0,0.1)] dark:border-[rgba(255,242,0,0.3)] dark:text-[#FFF200]',
  info: 'bg-indigo-50 border-indigo-200/80 text-indigo-700 dark:bg-[rgba(30,123,255,0.1)] dark:border-[rgba(30,123,255,0.3)] dark:text-[#1E7BFF]',
  success: 'bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-[rgba(182,255,0,0.1)] dark:border-[rgba(182,255,0,0.3)] dark:text-[#B6FF00]',
}

export default function AlertsPanel() {
  const navigate = useNavigate()

  const repeatedAlerts = [...alerts, ...alerts]

  return (
    <div className="mb-2 overflow-hidden relative w-full flex group">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {repeatedAlerts.map((alert, index) => (
          <div
            key={`${alert.id}-${index}`}
            onClick={() => {
              if (alert.action === 'View Receivables') navigate('/sales/receivables')
              else if (alert.action === 'View Payables') navigate('/purchase/payables')
              else if (alert.action === 'View Inventory') navigate('/inventory')
              else if (alert.action === 'View GST') navigate('/reports/gst')
              else if (alert.action === 'View Analytics') navigate('/analytics')
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 mx-1.5 rounded-xl border text-[12px] cursor-pointer whitespace-nowrap shrink-0 hover:-translate-y-px hover:shadow-sm transition-all ${CHIP_STYLES[alert.type]}`}
          >
            <span className="text-base leading-none">{alert.icon}</span>
            <span className="font-medium">{alert.text}</span>
            <span className="font-bold">{alert.value}</span>
            <span className="hidden sm:inline text-[11px] opacity-70 font-medium">· {alert.subtext}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
