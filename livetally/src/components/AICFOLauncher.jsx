import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bot, Send, X, Maximize2, Sparkles } from 'lucide-react'
import { useDateRange } from '../context/DateContext'
import { useAICFO } from '../context/AICFOContext'
import MessageBubble from '../pages/AICFO/MessageBubble'
import Suggestions from '../pages/AICFO/Suggestions'

// Global floating AI CFO launcher (Phase 7) — a fixed bottom-right button that is
// permanently visible on every page and opens a compact, glassy slide-up chat.
// Streams answers in real time; can expand to the full /ai-cfo page.
export default function AICFOLauncher() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { fy } = useDateRange()
  // Shared, persistent engine instance — same conversation as the full page.
  const { messages, input, setInput, sending, suggestions, send, isEmpty, activate } = useAICFO()
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Don't duplicate the launcher on the full page itself.
  const onFullPage = location.pathname.startsWith('/ai-cfo')

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, open])

  // Lazy first-access load: initialize resources the first time the popup opens.
  useEffect(() => {
    if (!open) return
    activate()
    const t = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [open, activate])

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (onFullPage) return null

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }
  const expand = () => { setOpen(false); navigate('/ai-cfo') }

  return (
    <div className="fixed z-50 bottom-5 right-5 flex flex-col items-end gap-3"
         style={{ maxWidth: 'calc(100vw - 2.5rem)' }}>
      {/* ── Popup panel ── */}
      {open && (
        <div className="aicfo-pop flex flex-col rounded-2xl overflow-hidden aicfo-glass"
             style={{ width: 'min(92vw, 384px)', height: 'min(72vh, 560px)',
                      boxShadow: '0 24px 60px rgba(0,0,0,0.28)' }}
             role="dialog" aria-label="AI CFO chat">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-3 shrink-0"
               style={{ background: 'linear-gradient(120deg, rgba(30,123,255,0.16), rgba(182,255,0,0.14))',
                        borderBottom: '1px solid var(--aicfo-border)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)', color: '#050505',
                            boxShadow: '0 4px 12px rgba(30,123,255,0.35)' }}>
                <Bot size={17} strokeWidth={2.4} />
              </div>
              <div className="leading-tight">
                <p className="text-[13px] font-black" style={{ color: 'var(--theme-text-main)' }}>AI CFO</p>
                <p className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--theme-text-muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full sync-dot-pulse" style={{ background: '#16a34a' }} />
                  Online · {fy || '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={expand} aria-label="Open full page"
                      className="p-1.5 rounded-lg cursor-pointer hover:bg-black/10 transition-colors">
                <Maximize2 size={15} style={{ color: 'var(--theme-text-muted)' }} />
              </button>
              <button onClick={() => setOpen(false)} aria-label="Close chat"
                      className="p-1.5 rounded-lg cursor-pointer hover:bg-black/10 transition-colors">
                <X size={16} style={{ color: 'var(--theme-text-muted)' }} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3">
            {isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-1">
                <div className="aicfo-float aicfo-glow-ring w-12 h-12 rounded-2xl flex items-center justify-center"
                     style={{ background: 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)', color: '#050505' }}>
                  <Sparkles size={22} />
                </div>
                <p className="text-[13px] font-black aicfo-gradient-text">Ask me about your finances</p>
                <p className="text-[11px] max-w-[16rem]" style={{ color: 'var(--theme-text-muted)' }}>
                  Profit, cash, sales or overdue customers — grounded in your live books.
                </p>
                <div className="w-full mt-1">
                  <Suggestions items={(suggestions || []).slice(0, 4)} onPick={send} disabled={sending} />
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <MessageBubble key={i} role={m.role} content={m.content}
                               degraded={m.degraded} streaming={m.streaming} />
              ))
            )}
          </div>

          {/* Input */}
          <div className="p-2.5 shrink-0 border-t" style={{ borderColor: 'var(--aicfo-border)' }}>
            <div className="aicfo-input flex items-end gap-2 rounded-xl px-2.5 py-1.5"
                 style={{ background: 'var(--theme-bg)', border: '1px solid var(--aicfo-border)' }}>
              <textarea
                ref={inputRef} rows={1} value={input}
                onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Ask anything…" aria-label="Ask the AI CFO"
                className="flex-1 resize-none bg-transparent outline-none text-[13px] max-h-24 scrollbar-hide py-1"
                style={{ color: 'var(--theme-text-main)' }} disabled={sending}
              />
              <button onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send message"
                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all disabled:opacity-40 hover:brightness-110 active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)', color: '#050505' }}>
                <Send size={15} strokeWidth={2.6} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating action button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close AI CFO' : 'Open AI CFO'}
        className={`relative w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 ${open ? '' : 'aicfo-glow-ring'}`}
        style={{ background: 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)', color: '#050505' }}
      >
        {open ? <X size={24} strokeWidth={2.6} /> : (
          <>
            <Bot size={26} strokeWidth={2.3} />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: '#050505' }}>
              <Sparkles size={9} style={{ color: '#b6ff00' }} />
            </span>
          </>
        )}
      </button>
    </div>
  )
}
