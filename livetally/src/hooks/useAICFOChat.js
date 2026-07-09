import { useState, useEffect, useCallback, useRef } from 'react'
import {
  aiCfoChat, aiCfoChatStream, aiCfoSessions, aiCfoMessages,
  aiCfoSuggestions, aiCfoDeleteConversation,
} from '../api'

// Shared AI-CFO chat engine used by both the full page and the floating popup.
// Owns messages, session, streaming send (real-time typing), suggestions and
// history — so both surfaces behave identically.
export function useAICFOChat(fy) {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const abortRef = useRef(null)

  const reloadSessions = useCallback(async () => {
    try { setSessions(await aiCfoSessions(50) || []) } catch { /* ignore */ }
  }, [])

  useEffect(() => { reloadSessions() }, [reloadSessions])
  useEffect(() => {
    if (!fy) return
    aiCfoSuggestions(fy).then(s => setSuggestions(s || [])).catch(() => {})
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
        // Streaming unavailable → fall back to the non-streaming endpoint.
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
    sessions, sessionId, messages, input, setInput, sending, suggestions,
    send, newConversation, openSession, removeSession, reloadSessions,
    isEmpty: messages.length === 0,
  }
}
