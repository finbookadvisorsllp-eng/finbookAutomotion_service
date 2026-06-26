import { Component } from 'react'
import Doodle from '../components/ui/Doodle'

// Safety net. A thrown error below renders the themed fallback instead of a
// white screen. `compact` = inline (per-route) vs full-screen (top-level).
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Hook a real error tracker (Sentry, etc.) here.
    console.error('ErrorBoundary caught:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    const { compact } = this.props

    // Top-level boundary lives outside the themed shell — honour saved theme.
    let dark = false
    try { dark = JSON.parse(localStorage.getItem('fb-app-store') || '{}')?.state?.mode === 'dark' } catch { /* ignore */ }

    return (
      <div className={dark ? 'dark' : ''} style={{ display: 'contents' }}>
        <div className={`${compact ? 'h-full' : 'min-h-screen'} flex items-center justify-center p-6`} style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-heading)' }}>
          <div className="max-w-md w-full rounded-2xl border p-7 text-center" style={{ backgroundColor: 'var(--app-panel-bg)', borderColor: 'var(--app-border)', boxShadow: 'var(--app-shadow-lg)' }}>
            <Doodle name="error" className="w-40 h-28 mx-auto" style={{ color: 'var(--app-muted)' }} />
            <h1 className="text-[16px] font-bold mt-3" style={{ color: 'var(--app-heading)' }}>Something went wrong</h1>
            <p className="text-[12px] mt-1.5 break-words" style={{ color: 'var(--app-muted)' }}>
              {String(this.state.error?.message ?? this.state.error)}
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={this.reset} className="px-4 h-9 text-[12px] font-semibold rounded-lg text-white" style={{ background: 'var(--app-accent-gradient)' }}>Try again</button>
              <button onClick={() => window.location.assign('/')} className="px-4 h-9 text-[12px] font-semibold rounded-lg border" style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)', backgroundColor: 'var(--app-control-bg)' }}>Go home</button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
