import { Component } from 'react'

// Top-level safety net. A thrown error anywhere below renders the fallback
// instead of a white screen. Reset clears the error so the next render
// re-mounts the children.
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
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="text-xs uppercase tracking-widest text-rose-600 font-bold mb-2">
            Something went wrong
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Unexpected error</h1>
          <p className="text-sm text-slate-600 mb-4 break-words">
            {String(this.state.error?.message ?? this.state.error)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.assign('/')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
