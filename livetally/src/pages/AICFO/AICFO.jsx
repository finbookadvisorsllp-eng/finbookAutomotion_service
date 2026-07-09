import { useState, useEffect, useRef } from 'react'
import { Bot, Send, Sparkles, ShieldCheck, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react'
import { useDateRange } from '../../context/DateContext'
import { aiCfoInsights, aiCfoHealth, aiCfoHealthScore } from '../../api'
import { useAICFOChat } from '../../hooks/useAICFOChat'
import MessageBubble from './MessageBubble'
import Suggestions from './Suggestions'
import HistoryPanel from './HistoryPanel'
import HealthScore from './HealthScore'

const SEVERITY = {
  danger: { icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
  warning: { icon: AlertTriangle, color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  info: { icon: Lightbulb, color: '#1e7bff', bg: 'rgba(30,123,255,0.10)' },
  success: { icon: ShieldCheck, color: '#16a34a', bg: 'rgba(22,163,74,0.10)' },
}

export default function AICFO() {
  const { fy } = useDateRange()
  const chat = useAICFOChat(fy)
  const {
    sessions, sessionId, messages, input, setInput, sending, suggestions,
    send, newConversation, openSession, removeSession, isEmpty,
  } = chat

  const [insights, setInsights] = useState([])
  const [score, setScore] = useState(null)
  const [health, setHealth] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { aiCfoHealth().then(setHealth).catch(() => { }) }, [])
  useEffect(() => {
    if (!fy) return
    aiCfoInsights(fy).then(i => setInsights(i || [])).catch(() => { })
    aiCfoHealthScore(fy).then(setScore).catch(() => { })
  }, [fy])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }
  const submit = () => { send(); inputRef.current?.focus() }

  return (
    <div className="animate-fade-in relative flex flex-col"
      style={{ height: 'calc(100vh - var(--header-height) - 2rem)' }}>
      {/* Ambient glow backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 right-1/3 w-[420px] h-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #1e7bff 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -right-20 w-[360px] h-[360px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #b6ff00 0%, transparent 70%)' }} />
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="aicfo-float w-11 h-11 rounded-2xl flex items-center justify-center aicfo-glow-ring"
            style={{ background: 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)', color: '#050505' }}>
            <Bot size={23} strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">AI CFO</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
              Your virtual finance chief — grounded in your live books ({fy || '—'}).
            </p>
          </div>
        </div>
        {health && (
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full aicfo-glass"
            style={{ color: health.configured ? 'var(--theme-accent)' : '#d97706' }}>
            <span className="w-1.5 h-1.5 rounded-full sync-dot-pulse"
              style={{ background: health.configured ? '#16a34a' : '#d97706' }} />
            {health.configured ? `${health.provider} · ${health.model?.split('/').pop()}` : 'AI model not configured'}
          </span>
        )}
      </div>

      {/* ── Body: history · chat · insights ── */}
      <div className="flex-1 min-h-0 grid gap-4"
        style={{ gridTemplateColumns: '230px minmax(0,1fr) 268px' }}>

        {/* History */}
        <div className="hidden lg:block min-h-0">
          <HistoryPanel sessions={sessions} activeId={sessionId}
            onNew={newConversation} onSelect={openSession} onDelete={removeSession} />
        </div>

        {/* Chat column */}
        <div className="flex flex-col min-h-0 rounded-2xl overflow-hidden aicfo-glass"
          style={{ boxShadow: 'var(--theme-kpi-shadow)' }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3.5">
            {isEmpty ? (
              <EmptyState suggestions={suggestions} onPick={send} disabled={sending} />
            ) : (
              messages.map((m, i) => (
                <MessageBubble key={i} role={m.role} content={m.content}
                  degraded={m.degraded} streaming={m.streaming} />
              ))
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t" style={{ borderColor: 'var(--aicfo-border)' }}>
            <div className="aicfo-input flex items-end gap-2 rounded-2xl px-3 py-2"
              style={{ background: 'var(--theme-bg)', border: '1px solid var(--aicfo-border)' }}>
              <textarea
                ref={inputRef} rows={1} value={input}
                onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Ask your AI CFO anything about your finances…"
                aria-label="Ask the AI CFO"
                className="flex-1 resize-none bg-transparent outline-none text-[13.5px] max-h-32 scrollbar-hide py-1"
                style={{ color: 'var(--theme-text-main)' }} disabled={sending}
              />
              <button
                onClick={submit} disabled={sending || !input.trim()} aria-label="Send message"
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 disabled:opacity-40 hover:brightness-110 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)', color: '#050505' }}
              >
                <Send size={16} strokeWidth={2.6} />
              </button>
            </div>
            <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--theme-text-muted)' }}>
              Figures reconcile with your reports — the AI never computes accounting itself.
            </p>
          </div>
        </div>

        {/* Insights rail */}
        <div className="hidden xl:flex flex-col min-h-0 rounded-2xl overflow-hidden aicfo-glass"
          style={{ boxShadow: 'var(--theme-kpi-shadow)' }}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b"
            style={{ borderColor: 'var(--aicfo-border)' }}>
            <span className="text-[12px] font-extrabold uppercase tracking-wider"
              style={{ color: 'var(--theme-text-muted)' }}>Live insights</span>
            <button aria-label="Refresh insights"
              onClick={() => fy && aiCfoInsights(fy).then(i => setInsights(i || [])).catch(() => { })}
              className="p-1 rounded-md cursor-pointer hover:bg-black/5 transition-colors">
              <RefreshCw size={13} style={{ color: 'var(--theme-accent)' }} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide p-2.5 space-y-2">
            <HealthScore data={score} />
            {!insights.length && (
              <p className="text-[12px] text-center py-6" style={{ color: 'var(--theme-text-muted)' }}>
                No risk signals in the current figures.
              </p>
            )}
            {insights.map((it, idx) => {
              const cfg = SEVERITY[it.severity] || SEVERITY.info
              const Icon = cfg.icon
              return (
                <button key={it.id} onClick={() => send(`Tell me more about: ${it.title}`)}
                  className="w-full text-left rounded-xl p-2.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 aicfo-pop"
                  style={{
                    background: cfg.bg, border: '1px solid var(--aicfo-border)',
                    animationDelay: `${idx * 60}ms`
                  }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={13} style={{ color: cfg.color }} />
                    <span className="text-[12px] font-extrabold" style={{ color: 'var(--theme-text-main)' }}>
                      {it.title}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug" style={{ color: 'var(--theme-text-muted)' }}>
                    {it.detail}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ suggestions, onPick, disabled }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-6">
      <div className="relative">
        <div className="aicfo-float aicfo-glow-ring w-16 h-16 rounded-3xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)', color: '#050505' }}>
          <Sparkles size={30} />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-black aicfo-gradient-text">Your virtual CFO is ready</h2>
        <p className="text-[13px] mt-1.5 max-w-md mx-auto" style={{ color: 'var(--theme-text-muted)' }}>
          Ask anything about profit, sales, expenses, cash or collections. Every answer uses your
          real, reconciled figures — never guesses.
        </p>
      </div>
      <div className="w-full max-w-2xl">
        <Suggestions items={suggestions} onPick={onPick} disabled={disabled} />
      </div>
    </div>
  )
}
