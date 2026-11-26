'use client'
import { useEffect, useRef, useState } from 'react'
type Session = {
  id: string
  source?: string
  title?: string
  last_active?: string
}
type Entry = { role?: string; content?: unknown; tool_name?: string }
export function History({ embedded = false }: { embedded?: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]),
    [messages, setMessages] = useState<Entry[]>([]),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [open, setOpen] = useState(embedded),
    [more, setMore] = useState(false),
    [offset, setOffset] = useState(0),
    [messageOffset, setMessageOffset] = useState(0),
    [messageMore, setMessageMore] = useState(false),
    [messageBusy, setMessageBusy] = useState(false),
    [listBusy, setListBusy] = useState(false)
  const listVersion = useRef(0)
  const transcriptVersion = useRef(0)
  const transcriptAbort = useRef<AbortController | null>(null)
  async function load(next = 0) {
    const version = ++listVersion.current
    setListBusy(true)
    setError('')
    try {
      const r = await fetch(`/api/hermes/history?offset=${next}`)
      if (!r.ok) throw Error('History is unavailable')
      const d = await r.json()
      const rows = Array.isArray(d) ? d : d.sessions
      if (!Array.isArray(rows)) throw Error('Unexpected history format')
      if (version !== listVersion.current) return
      setSessions(old => (next ? [...old, ...rows.filter((r: Session) => !old.some(s => s.id === r.id))] : rows))
      setOffset(next + rows.length)
      setMore(Boolean(d.has_more))
    } catch (e) {
      if (version === listVersion.current) setError(String(e))
    } finally {
      if (version === listVersion.current) setListBusy(false)
    }
  }
  async function view(id: string, next = 0) {
    const version = ++transcriptVersion.current
    transcriptAbort.current?.abort()
    const controller = new AbortController()
    transcriptAbort.current = controller
    setSelected(id)
    setMessageBusy(true)
    if (!next) {
      setMessages([])
      setMessageOffset(0)
      setMessageMore(false)
    }
    setError('')
    try {
      const r = await fetch(`/api/hermes/history?id=${encodeURIComponent(id)}&offset=${next}`, { signal: controller.signal })
      if (!r.ok) throw Error('Transcript unavailable')
      const d = await r.json()
      const rows = Array.isArray(d) ? d : d.messages
      if (!Array.isArray(rows)) throw Error('Unexpected transcript format')
      if (version !== transcriptVersion.current) return
      setMessages(old => next ? [...old, ...rows] : rows)
      setMessageOffset(next + rows.length)
      setMessageMore(Boolean(d.has_more))
    } catch (e) {
      if (version === transcriptVersion.current && !controller.signal.aborted) setError(String(e))
    } finally {
      if (version === transcriptVersion.current) setMessageBusy(false)
    }
  }
  useEffect(() => {
    if (embedded) void load()
    // Fetch once when mounted in the original sidebar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded])
  return (
    <section className={embedded ? 'space-y-2' : 'rounded-lg border p-3'}>
      {!embedded && <button
        className="font-medium"
        onClick={() => {
          setOpen(!open)
          if (!open) void load()
        }}
      >
        {open ? 'Hide' : 'Browse'} conversation history
      </button>}
      {embedded && <h2 className="px-2 text-xs font-medium text-muted-foreground">Conversation history</h2>}
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Read-only history, including Telegram. New messages use separate web
            sessions.
          </p>
          {sessions.map(s => (
            <button
              key={s.id}
              className="block w-full truncate rounded-md px-2 py-2 text-left text-sm hover:bg-sidebar-accent"
              onClick={() => void view(s.id)}
            >
              {s.title || 'Conversation'}{' '}
              <span className="text-xs text-muted-foreground">
                {s.source || 'unknown'}
              </span>
            </button>
          ))}
          {more && <button disabled={listBusy} onClick={() => void load(offset)}>Load more conversations</button>}
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
              {messageBusy && <p role="status">Loading transcript…</p>}
              {messageMore && <button disabled={messageBusy} onClick={() => void view(selected, messageOffset)}>Load more messages</button>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
