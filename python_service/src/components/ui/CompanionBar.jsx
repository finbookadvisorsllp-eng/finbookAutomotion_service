import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, X, Send, Minus, EyeOff, Bot, ChevronUp } from 'lucide-react'

/**
 * CompanionBar — Global Floating AI Chatbot Assistant ("Sage").
 * Supports:
 * 1. Hide option on click (in expanded chat header & collapsed floating badge).
 * 2. Corner hover trigger zone: hovering mouse over bottom-right corner displays "Show Chatbot" button.
 * 3. Works seamlessly across all pages inside the app.
 */
const PEEKS = [
  '40 vouchers are ready to export to Tally.',
  'Supplier ledger “XYZ” is unmapped — exports may fail.',
  '3 invoices look like duplicates. Want me to flag them?',
  '12 vouchers are sitting in draft. Push them to review?',
]
const QUICK = ['Show pending vouchers', 'Export approved to Tally', 'Find duplicate vouchers', 'Unmapped masters']
const REPLIES = [
  'On it — 12 vouchers are pending review and 40 are approved & ready to export. Want me to open the export queue?',
  'I scanned the latest batch: 3 look like duplicates and 2 masters are unmapped. I can prepare fixes for you.',
  'Done. The Tally connector is live and last synced 2 hours ago — no failed records.',
]

function Avatar({ size = 32 }) {
  return (
    <span className="rounded-full flex items-center justify-center text-white shrink-0" style={{ width: size, height: size, background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow)' }}>
      <Sparkles size={size * 0.5} strokeWidth={2.4} />
    </span>
  )
}

function Bubble({ role, children }) {
  const me = role === 'user'
  return (
    <div className={`flex items-end gap-1.5 ${me ? 'flex-row-reverse' : ''}`}>
      {!me && <Avatar size={22} />}
      <div className={`max-w-[78%] px-2.5 py-1.5 text-[12px] font-medium leading-snug rounded-2xl ${me ? 'rounded-br-sm text-white' : 'rounded-bl-sm'}`}
        style={me
          ? { background: 'var(--app-accent-gradient)' }
          : { backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)', border: '1px solid var(--app-border)' }}>
        {children}
      </div>
    </div>
  )
}

export default function CompanionBar() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(() => {
    return localStorage.getItem('finbook_chatbot_hidden') === 'true'
  })
  const [cornerHover, setCornerHover] = useState(false)
  const [peek, setPeek] = useState(0)
  const [msgs, setMsgs] = useState([{ role: 'bot', text: 'Hi, I’m Sage 👋 I watch your Tally imports & exports. Ask me anything, or pick a shortcut below.' }])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bodyRef = useRef(null)
  const replyN = useRef(0)

  // Persist hidden state in localStorage
  useEffect(() => {
    localStorage.setItem('finbook_chatbot_hidden', hidden ? 'true' : 'false')
  }, [hidden])

  useEffect(() => {
    if (open || hidden) return
    const id = setInterval(() => setPeek((p) => (p + 1) % PEEKS.length), 6500)
    return () => clearInterval(id)
  }, [open, hidden])

  useEffect(() => { bodyRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' }) }, [msgs, typing])

  const send = (text) => {
    const t = (text ?? input).trim()
    if (!t) return
    setMsgs((m) => [...m, { role: 'user', text: t }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMsgs((m) => [...m, { role: 'bot', text: REPLIES[replyN.current++ % REPLIES.length] }])
    }, 900)
  }

  const handleHide = () => {
    setOpen(false)
    setHidden(true)
  }

  const handleShow = () => {
    setHidden(false)
    setCornerHover(false)
  }

  return (
    <>
      {/* CORNER HOVER TRIGGER ZONE (WHEN CHATBOT IS HIDDEN) */}
      {hidden && (
        <div
          onMouseEnter={() => setCornerHover(true)}
          onMouseLeave={() => setCornerHover(false)}
          className="fixed bottom-0 right-0 z-50 p-3 pointer-events-auto flex items-end justify-end"
          style={{ width: '160px', height: '80px' }}
        >
          <AnimatePresence>
            {cornerHover && (
              <motion.button
                key="show-btn"
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                onClick={handleShow}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                style={{ background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow-lg)' }}
                title="Click to show AI Chatbot Assistant"
              >
                <Sparkles size={15} />
                <span>Show Chatbot</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* FLOATING CHATBOT WIDGET (WHEN NOT HIDDEN) */}
      {!hidden && (
        <div className="fixed bottom-4 right-4 z-40 hidden md:block">
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div
                key="panel"
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                className="w-[350px] max-w-[calc(100vw-2rem)] rounded-2xl border overflow-hidden flex flex-col shadow-xl"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow-lg)', height: 460 }}
              >
                {/* Panel Header */}
                <div className="flex items-center gap-2.5 px-3.5 py-3 border-b" style={{ borderColor: 'var(--app-border)', background: 'linear-gradient(120deg, var(--app-accent-soft), transparent)' }}>
                  <Avatar />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-extrabold" style={{ color: 'var(--app-heading)' }}>Sage</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--app-muted)' }}>AI Assistant · Online</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-[var(--app-control-hover)] transition-colors cursor-pointer"
                      style={{ color: 'var(--app-muted)' }}
                      title="Minimize Chat"
                      aria-label="Minimize"
                    >
                      <Minus size={15} />
                    </button>

                    <button
                      onClick={handleHide}
                      className="px-2 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-bg)] hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Hide Chatbot Widget (hover bottom-right corner to show again)"
                    >
                      <EyeOff size={13} />
                      <span>Hide</span>
                    </button>
                  </div>
                </div>

                {/* Messages Body */}
                <div ref={bodyRef} className="flex-1 overflow-y-auto themed-scrollbar p-3 space-y-2.5">
                  {msgs.map((m, i) => <Bubble key={i} role={m.role}>{m.text}</Bubble>)}
                  {typing && (
                    <div className="flex items-end gap-1.5">
                      <Avatar size={22} />
                      <div className="px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1" style={{ backgroundColor: 'var(--app-control-bg)', border: '1px solid var(--app-border)' }}>
                        {[0, 1, 2].map((d) => (
                          <motion.span
                            key={d}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: 'var(--app-muted)' }}
                            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Shortcuts */}
                <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="px-2.5 py-1 rounded-full text-[10.5px] font-semibold border transition-colors hover:bg-[var(--app-accent-soft)] cursor-pointer"
                      style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Chat Input */}
                <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2 p-2.5 border-t" style={{ borderColor: 'var(--app-border)' }}>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Sage…"
                    className="flex-1 h-9 rounded-lg border px-3 text-[12px] outline-none focus:border-[var(--app-accent)]"
                    style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                  />
                  <button type="submit" className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0 cursor-pointer" style={{ background: 'var(--app-accent-gradient)' }} aria-label="Send">
                    <Send size={15} />
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="launcher"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 justify-end group"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={peek}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.3 }}
                    className="max-w-[240px] text-left rounded-2xl rounded-br-sm border px-3 py-2 text-[11.5px] font-medium hidden lg:flex items-center justify-between gap-2 shadow-sm"
                    style={{ backgroundColor: 'var(--app-panel-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)', boxShadow: 'var(--app-shadow)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpen(true)}
                      className="flex-1 text-left cursor-pointer"
                    >
                      {PEEKS[peek]}
                    </button>

                    <button
                      type="button"
                      onClick={handleHide}
                      className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 transition-colors cursor-pointer shrink-0"
                      title="Hide Chatbot"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                </AnimatePresence>

                <div className="relative">
                  <button
                    onClick={() => setOpen(true)}
                    className="relative h-13 w-13 rounded-full flex items-center justify-center text-white cursor-pointer"
                    style={{ height: 52, width: 52, background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow-lg)' }}
                    aria-label="Open Sage"
                    title="Click to open AI Chatbot"
                  >
                    <motion.span className="absolute inset-0 rounded-full" style={{ border: '2px solid var(--app-accent)' }} animate={{ scale: [1, 1.35], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} />
                    <Sparkles size={22} strokeWidth={2.4} />
                    <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2" style={{ borderColor: 'var(--app-panel-bg)' }} />
                  </button>

                  <button
                    type="button"
                    onClick={handleHide}
                    className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px]"
                    title="Hide Chatbot"
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  )
}
