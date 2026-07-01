import { useNavigate } from 'react-router-dom'
import { formatINR } from '../data/mockData'

const CHIP_STYLES = {
  danger: 'bg-red-50 border-red-200/80 text-red-700 dark:bg-[rgba(255,51,102,0.1)] dark:border-[rgba(255,51,102,0.3)] dark:text-[#FF3366]',
  warning: 'bg-amber-50 border-amber-200/80 text-amber-700 dark:bg-[rgba(255,242,0,0.1)] dark:border-[rgba(255,242,0,0.3)] dark:text-[#FFF200]',
  info: 'bg-indigo-50 border-indigo-200/80 text-indigo-700 dark:bg-[rgba(30,123,255,0.1)] dark:border-[rgba(30,123,255,0.3)] dark:text-[#1E7BFF]',
  success: 'bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-[rgba(182,255,0,0.1)] dark:border-[rgba(182,255,0,0.3)] dark:text-[#B6FF00]',
}

// Map an alert's `action` label to its drill-down route.
const ACTION_ROUTES = {
  'View Receivables': '/sales/receivables',
  'View Payables': '/purchase/payables',
  'View Inventory': '/inventory/alerts',
  'View Cash & Bank': '/reports/cf',
  'View GST': '/reports/gst',
  'View Analytics': '/analytics',
}

// Dynamic, data-derived alerts strip. `alerts` come from the backend
// (/dashboard/overview); every chip is generated from live Tally data — nothing
// is hardcoded. Renders nothing when there are no active alerts.
export default function AlertsPanel({ alerts = [] }) {
  const navigate = useNavigate()
  if (!alerts.length) return null

  const fmt = (v) => (typeof v === 'number' ? formatINR(v) : v)
  // Duplicate the list so the marquee scrolls seamlessly.
  const repeated = [...alerts, ...alerts]

  return (
    <div className="mb-2 overflow-hidden relative w-full flex group">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {repeated.map((alert, index) => (
          <div
            key={`${alert.text}-${index}`}
            onClick={() => { const r = ACTION_ROUTES[alert.action]; if (r) navigate(r) }}
            className={`flex items-center gap-2 px-3.5 py-1.5 mx-1.5 rounded-xl border text-[12px] cursor-pointer whitespace-nowrap shrink-0 hover:-translate-y-px hover:shadow-sm transition-all ${CHIP_STYLES[alert.type] || CHIP_STYLES.info}`}
          >
            {alert.icon && <span className="text-base leading-none">{alert.icon}</span>}
            <span className="font-medium">{alert.text}</span>
            <span className="font-bold">{fmt(alert.value)}</span>
            {alert.subtext && <span className="hidden sm:inline text-[11px] opacity-70 font-medium">· {alert.subtext}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
