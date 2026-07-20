import { useState, useEffect, useCallback, useRef } from 'react'
import {
  aiCfoChat, aiCfoChatStream, aiCfoSessions, aiCfoMessages,
  aiCfoSuggestions, aiCfoDeleteConversation, aiCfoInsights,
  aiCfoHealth, aiCfoHealthScore,
} from '../api'

// The AI-CFO chat engine. Intended to be instantiated exactly ONCE, inside
// <AICFOProvider>, so its state survives route changes (see context/AICFOContext).
//
// Resource loading is LAZY + memoised: nothing heavy is fetched until the user
// first opens the assistant (`activate()`), and the context-heavy, FY-dependent
// resources (suggestions / insights / health score) are loaded once per FY and
// refreshed only when the financial year actually changes.
export function useAICFOChat(fy) {
  // ── Conversation state (persists for the whole login session) ──
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  // ── Derived / view resources ──
  const [suggestions, setSuggestions] = useState([])
  const [insights, setInsights] = useState([])
  const [score, setScore] = useState(null)
  const [health, setHealth] = useState(null)

  const abortRef = useRef(null)
  const activatedRef = useRef(false)   // has the assistant been opened at least once?
  const healthRef = useRef(false)      // provider-health fetched (once ever)
  const auxFyRef = useRef(null)        // FY the heavy resources are currently loaded for

  const reloadSessions = useCallback(async () => {
    try { setSessions(await aiCfoSessions(50) || []) } catch { /* ignore */ }
  }, [])

  // FY-dependent, context-heavy resources — fetched once per FY (idempotent).
  const loadAux = useCallback((year) => {
    if (!year || auxFyRef.current === year) return
    auxFyRef.current = year
    aiCfoSuggestions(year).then(s => setSuggestions(s || [])).catch(() => {})
    aiCfoInsights(year).then(i => setInsights(i || [])).catch(() => {})
    aiCfoHealthScore(year).then(setScore).catch(() => {})
  }, [])

  // First-access initialization. Cheap data once; heavy data per FY. Safe to call
  // on every mount/open — it does real work only the first time (and per new FY).
  const activate = useCallback(() => {
    if (!healthRef.current) { healthRef.current = true; aiCfoHealth().then(setHealth).catch(() => {}) }
    if (!activatedRef.current) { activatedRef.current = true; reloadSessions() }
    loadAux(fy)
  }, [fy, reloadSessions, loadAux])

  // If the assistant is already active and the global FY changes, refresh the
  // FY-scoped resources (but never before first access — stays lazy).
  useEffect(() => {
    if (activatedRef.current && fy) loadAux(fy)
  }, [fy, loadAux])

  const refreshInsights = useCallback(() => {
    if (fy) aiCfoInsights(fy).then(i => setInsights(i || [])).catch(() => {})
  }, [fy])

  // Immutably patch the last (assistant) message as tokens stream in.
  const patchLast = useCallback((fn) => setMessages(m => {
    const last = m[m.length - 1]
    if (!last || last.role !== 'assistant') return m
    return [...m.slice(0, -1), fn(last)]
  }), [])

  const send = useCallback(async (text) => {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: msg },
                            { role: 'assistant', content: '', streaming: true }])
    setSending(true)
    let sawToken = false
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await aiCfoChatStream(msg, sessionId, fy, (event, data) => {
        if (event === 'meta') {
          if (data.sessionId) setSessionId(data.sessionId)
        } else if (event === 'token') {
          sawToken = true
          patchLast(last => ({ ...last, content: last.content + data.text }))
        } else if (event === 'done') {
          patchLast(last => ({ ...last, streaming: false, degraded: data.degraded }))
          reloadSessions()
        } else if (event === 'error') {
          patchLast(last => ({ ...last, streaming: false, degraded: true,
            content: last.content || `I couldn't complete that request: ${data.message}` }))
        }
      }, controller.signal)
    } catch (e) {
      if (sawToken) {
        patchLast(last => ({ ...last, streaming: false, degraded: true }))
      } else {
        try {
          const res = await aiCfoChat(msg, sessionId, fy)
          if (res?.sessionId) setSessionId(res.sessionId)
          patchLast(last => ({ ...last, streaming: false, content: res.answer, degraded: res.degraded }))
          reloadSessions()
        } catch (e2) {
          patchLast(last => ({ ...last, streaming: false, degraded: true,
            content: `I couldn't complete that request: ${e2.message}` }))
        }
      }
    } finally {
      setSending(false)
      abortRef.current = null
    }
  }, [input, sending, sessionId, fy, patchLast, reloadSessions])

  const newConversation = useCallback(() => { setSessionId(null); setMessages([]) }, [])

  const openSession = useCallback(async (sid) => {
    if (sid === sessionId) return
    setSessionId(sid)
    try {
      const msgs = await aiCfoMessages(sid)
      setMessages((msgs || []).map(m => ({ role: m.role, content: m.content, degraded: m?.meta?.degraded })))
    } catch { setMessages([]) }
  }, [sessionId])

  const removeSession = useCallback(async (sid) => {
    try { await aiCfoDeleteConversation(sid) } catch { /* ignore */ }
    if (sid === sessionId) { setSessionId(null); setMessages([]) }
    reloadSessions()
  }, [sessionId, reloadSessions])

  return {
    sessions, sessionId, messages, input, setInput, sending,
    suggestions, insights, score, health,
    send, newConversation, openSession, removeSession, reloadSessions,
    refreshInsights, activate, isEmpty: messages.length === 0,
  }
}
