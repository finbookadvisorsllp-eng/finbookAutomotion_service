import { Bot, User, AlertTriangle } from 'lucide-react'

// Lightweight inline renderer — no markdown dependency. Handles **bold**, bullet
// lines (•, -, *) and preserves line breaks. Enough for the CFO's answers.
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} className="font-extrabold">{p.slice(2, -2)}</strong>
    }
    return <span key={i}>{p}</span>
  })
}

function renderBody(content) {
  const lines = (content || '').split('\n')
  const out = []
  let bullets = []
  const flush = (key) => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${key}`} className="my-1.5 space-y-1 pl-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="mt-[6px] w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: 'var(--theme-accent)' }} />
              <span>{renderInline(b)}</span>
            </li>
          ))}
        </ul>
      )
      bullets = []
    }
  }
  lines.forEach((line, idx) => {
    const t = line.trim()
    if (/^[•\-*]\s+/.test(t)) {
      bullets.push(t.replace(/^[•\-*]\s+/, ''))
    } else {
      flush(idx)
      if (t) out.push(<p key={idx} className="my-1 leading-relaxed">{renderInline(t)}</p>)
    }
  })
  flush('end')
  return out
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map(d => (
        <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: 'var(--theme-accent)', animationDelay: `${d * 0.15}s` }} />
      ))}
    </span>
  )
}

export default function MessageBubble({ role, content, degraded, streaming }) {
  const isUser = role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''} aicfo-pop`}>
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: isUser ? 'var(--theme-kpi-bg)' : 'linear-gradient(135deg, #b6ff00 0%, #1e7bff 100%)',
          border: isUser ? '1px solid var(--aicfo-border)' : 'none',
          color: isUser ? 'var(--theme-text-muted)' : '#050505',
          boxShadow: isUser ? 'none' : '0 4px 14px rgba(30,123,255,0.35)',
        }}
      >
        {isUser ? <User size={15} /> : <Bot size={16} strokeWidth={2.4} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`px-4 py-2.5 text-[13.5px] ${isUser ? '' : 'aicfo-glass'}`}
          style={{
            background: isUser ? 'linear-gradient(135deg, #1e7bff 0%, #4f46e5 100%)' : undefined,
            color: isUser ? '#fff' : 'var(--theme-text-main)',
            borderRadius: 18,
            borderTopRightRadius: isUser ? 5 : 18,
            borderTopLeftRadius: isUser ? 18 : 5,
            fontWeight: isUser ? 600 : 500,
            boxShadow: isUser ? '0 6px 18px rgba(30,123,255,0.30)' : 'var(--theme-kpi-shadow)',
          }}
        >
          {isUser ? (
            <span>{content}</span>
          ) : (streaming && !content) ? (
            <ThinkingDots />
          ) : (
            <span>
              {renderBody(content)}
              {streaming && (
                <span className="aicfo-caret inline-block w-[7px] h-[14px] ml-0.5 align-middle"
                      style={{ background: 'var(--theme-accent)', borderRadius: 1 }} />
              )}
            </span>
          )}
        </div>
        {degraded && (
          <span className="flex items-center gap-1 text-[10px] font-bold mt-1 text-amber-600 dark:text-[#FFF200]">
            <AlertTriangle size={11} /> Grounded summary (AI model unavailable)
          </span>
        )}
      </div>
    </div>
  )
}
