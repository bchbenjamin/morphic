'use client'
import { useState } from 'react'
type Session = {
  id: string
  source?: string
  title?: string
  last_active?: string
}
type Entry = { role?: string; content?: unknown; tool_name?: string }
export function History() {
  const [sessions, setSessions] = useState<Session[]>([]),
    [messages, setMessages] = useState<Entry[]>([]),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false),
    [more, setMore] = useState(false),
    [offset, setOffset] = useState(0)
  async function load(next = 0) {
    setError('')
    try {
      const r = await fetch(`/api/hermes/history?offset=${next}`)
      if (!r.ok) throw Error('History is unavailable')
      const d = await r.json()
      const rows = Array.isArray(d) ? d : d.sessions
      if (!Array.isArray(rows)) throw Error('Unexpected history format')
      setSessions(old => (next ? [...old, ...rows] : rows))
      setOffset(next + rows.length)
      setMore(Boolean(d.has_more))
    } catch (e) {
      setError(String(e))
    }
  }
  async function view(id: string) {
    setSelected(id)
    setMessages([])
    setError('')
    try {
      const r = await fetch(`/api/hermes/history?id=${encodeURIComponent(id)}`)
      if (!r.ok) throw Error('Transcript unavailable')
      const d = await r.json()
      const rows = Array.isArray(d) ? d : d.messages
      if (!Array.isArray(rows)) throw Error('Unexpected transcript format')
      setMessages(rows)
    } catch (e) {
      setError(String(e))
    }
  }
  return (
    <section className="rounded-lg border p-3">
      <button
        className="font-medium"
        onClick={() => {
          setOpen(!open)
          if (!open) void load()
        }}
      >
        {open ? 'Hide' : 'Browse'} conversation history
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Read-only history, including Telegram. New messages use separate web
            sessions.
          </p>
          {sessions.map(s => (
            <button
              key={s.id}
              className="block w-full rounded border p-2 text-left"
              onClick={() => void view(s.id)}
            >
              {s.title || 'Conversation'}{' '}
              <span className="text-xs text-muted-foreground">
                {s.source || 'unknown'}
              </span>
            </button>
          ))}
          {more && <button onClick={() => void load(offset)}>Load more</button>}
          {error && <p role="alert">{error}</p>}
          {selected && (
            <div className="max-h-96 overflow-auto border-t pt-2 space-y-3">
              {messages.map((m, i) => (
                <article key={i}>
                  <strong>
                    {m.role || 'event'} {m.tool_name || ''}
                  </strong>
                  <pre className="whitespace-pre-wrap break-words text-sm">
                    {typeof m.content === 'string'
                      ? m.content
                      : JSON.stringify(m.content ?? '', null, 2)}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
