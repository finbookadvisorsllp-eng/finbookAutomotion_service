import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, X, Send, Minus } from 'lucide-react'

// Sage — AI assistant. Collapsed: a floating gradient launcher with a rotating
// peek. Expanded: a proper chat panel with mock Tally-domain conversation.
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
  const [peek, setPeek] = useState(0)
  const [msgs, setMsgs] = useState([{ role: 'bot', text: 'Hi, I’m Sage 👋 I watch your Tally imports & exports. Ask me anything, or pick a shortcut below.' }])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bodyRef = useRef(null)
  const replyN = useRef(0)

  useEffect(() => {
    if (open) return
    const id = setInterval(() => setPeek((p) => (p + 1) % PEEKS.length), 6500)
    return () => clearInterval(id)
  }, [open])

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

  return (
    <div className="absolute bottom-4 right-4 z-30 hidden md:block">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-[348px] max-w-[calc(100vw-2rem)] rounded-2xl border overflow-hidden flex flex-col"
            style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)', boxShadow: 'var(--app-shadow-lg)', height: 460 }}
          >
            {/* header */}
            <div className="flex items-center gap-2.5 px-3.5 py-3 border-b" style={{ borderColor: 'var(--app-border)', background: 'linear-gradient(120deg, var(--app-accent-soft), transparent)' }}>
              <Avatar />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-extrabold" style={{ color: 'var(--app-heading)' }}>Sage</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--app-muted)' }}>AI assistant · online</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-[var(--app-control-hover)]" style={{ color: 'var(--app-muted)' }} aria-label="Minimize"><Minus size={16} /></button>
            </div>

            {/* messages */}
            <div ref={bodyRef} className="flex-1 overflow-y-auto themed-scrollbar p-3 space-y-2.5">
              {msgs.map((m, i) => <Bubble key={i} role={m.role}>{m.text}</Bubble>)}
              {typing && (
                <div className="flex items-end gap-1.5">
                  <Avatar size={22} />
                  <div className="px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1" style={{ backgroundColor: 'var(--app-control-bg)', border: '1px solid var(--app-border)' }}>
                    {[0, 1, 2].map((d) => <motion.span key={d} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--app-muted)' }} animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />)}
                  </div>
                </div>
              )}
            </div>

            {/* quick replies */}
            <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)} className="px-2.5 py-1 rounded-full text-[10.5px] font-semibold border transition-colors hover:bg-[var(--app-accent-soft)]"
                  style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }}>{q}</button>
              ))}
            </div>

            {/* input */}
            <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex items-center gap-2 p-2.5 border-t" style={{ borderColor: 'var(--app-border)' }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Sage…" className="flex-1 h-9 rounded-lg border px-3 text-[12px] outline-none focus:border-[var(--app-accent)]"
                style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)', color: 'var(--app-heading)' }} />
              <button type="submit" className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)' }} aria-label="Send"><Send size={15} /></button>
            </form>
          </motion.div>
        ) : (
          <motion.div key="launcher" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-2 justify-end">
            <AnimatePresence mode="wait">
              <motion.button
                key={peek} onClick={() => setOpen(true)}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.3 }}
                className="max-w-[230px] text-left rounded-2xl rounded-br-sm border px-3 py-2 text-[11.5px] font-medium hidden lg:block"
                style={{ backgroundColor: 'var(--app-panel-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)', boxShadow: 'var(--app-shadow)' }}
              >
                {PEEKS[peek]}
              </motion.button>
            </AnimatePresence>
            <button onClick={() => setOpen(true)} className="relative h-13 w-13 rounded-full flex items-center justify-center text-white" style={{ height: 52, width: 52, background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow-lg)' }} aria-label="Open Sage">
              <motion.span className="absolute inset-0 rounded-full" style={{ border: '2px solid var(--app-accent)' }} animate={{ scale: [1, 1.35], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} />
              <Sparkles size={22} strokeWidth={2.4} />
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2" style={{ borderColor: 'var(--app-panel-bg)' }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
