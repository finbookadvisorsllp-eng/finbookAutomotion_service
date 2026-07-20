// Business Health — the single hub. One page, five tabs, one place to understand
// the whole business. The tab is reflected in the URL (/health, /health/score, …)
// so deep-links and evidence cross-links keep working, and the sidebar needs just
// one entry. Panels are imported eagerly so tab switches are instant (the hub
// itself is lazy-loaded by the router, so the feature still code-splits as a unit).
import { useNavigate, useParams } from 'react-router-dom'
import { HeartPulse, LayoutGrid, Gauge, ListChecks, Lightbulb, TrendingUp } from 'lucide-react'
import { useDateRange } from '../../context/DateContext'
import { TabBar } from './components/ExplainUI'

import OverviewPanel from './CommandCenter'
import ScorePanel from './HealthScore'
import DecisionsPanel from './Decisions'
import OpportunitiesPanel from './OpportunitiesRisks'
import ImpactPanel from './Impact'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, path: '/health', Panel: OverviewPanel },
  { id: 'score', label: 'Health Score', icon: Gauge, path: '/health/score', Panel: ScorePanel },
  { id: 'decisions', label: 'Decisions', icon: ListChecks, path: '/health/decisions', Panel: DecisionsPanel },
  { id: 'opportunities', label: 'Opportunities & Risks', icon: Lightbulb, path: '/health/opportunities', Panel: OpportunitiesPanel },
  { id: 'impact', label: 'Impact', icon: TrendingUp, path: '/health/impact', Panel: ImpactPanel },
]

export default function BusinessHealth() {
  const { fy } = useDateRange()
  const navigate = useNavigate()
  const { tab } = useParams()
  const active = TABS.find((t) => t.id === tab) ? tab : 'overview'
  const ActivePanel = (TABS.find((t) => t.id === active) || TABS[0]).Panel

  const select = (id) => {
    const t = TABS.find((x) => x.id === id)
    if (t) navigate(t.path)
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* Hub header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#b6ff00,#1e7bff)', color: '#050505' }}>
          <HeartPulse size={22} strokeWidth={2.4} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Business Health</h1>
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            Your business at a glance — what’s wrong, what it’s worth, what to do · {fy || '—'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} active={active} onSelect={select} />

      {/* Active tab */}
      <div key={active}>
        <ActivePanel />
      </div>
    </div>
  )
}
