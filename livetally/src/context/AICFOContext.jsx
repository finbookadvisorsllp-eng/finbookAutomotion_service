import { createContext, useContext } from 'react'
import { useDateRange } from './DateContext'
import { useAICFOChat } from '../hooks/useAICFOChat'

// ── AI CFO service provider ───────────────────────────────────────────────
// Mounted ONCE above the router (in App, inside DateProvider). It runs the chat
// engine a single time and shares that one instance with every view (the full
// /ai-cfo page and the global floating launcher).
//
// Because it lives above <Routes>, navigating between pages never unmounts it:
// the active conversation, in-flight streaming query, input draft and loaded
// resources all persist. Its lifecycle is bound to the *session*, not the page —
// it unmounts (and thus resets) only on logout (App swaps to <Login/>), a full
// browser refresh, or app restart. This is the "continuously running assistant".
const AICFOContext = createContext(null)

export function AICFOProvider({ children }) {
  const { fy } = useDateRange()
  const value = useAICFOChat(fy)   // the single, persistent engine instance
  return <AICFOContext.Provider value={value}>{children}</AICFOContext.Provider>
}

export function useAICFO() {
  const ctx = useContext(AICFOContext)
  if (!ctx) throw new Error('useAICFO must be used within <AICFOProvider>')
  return ctx
}
