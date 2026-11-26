'use client'

import { useRef, useState } from 'react'

import { readHermesStream } from '@/lib/hermes/sse'

import { History } from './history'

type Message = { role: 'user' | 'assistant'; text: string }

export function HermesChat() {
  const conversation = useRef<string | null>(null)
  const inFlight = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function send() {
    if (inFlight.current || !input.trim()) return
    inFlight.current = true
    const controller = new AbortController()
    activeRequest.current = controller
    setBusy(true)
    setError('')
    const message = input.trim()
    setInput('')
    conversation.current ??= crypto.randomUUID()
    setMessages(previous => [
      ...previous,
      { role: 'user', text: message },
      { role: 'assistant', text: '' }
    ])
    try {
      const response = await fetch('/api/hermes/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.current, message })
      })
      if (!response.ok || !response.body)
        throw new Error(`Hermes request failed (${response.status})`)
      await readHermesStream(response.body, text =>
        setMessages(previous =>
          previous.map((item, index) =>
            index === previous.length - 1
              ? { ...item, text: item.text + text }
              : item
          )
        )
      )
    } catch (err) {
      setError(controller.signal.aborted
        ? 'Response stream disconnected. The backend operation may still be running; check Hermes before retrying.'
        : `${err instanceof Error ? err.message : 'Request failed'}. Check Hermes before retrying an action.`
      )
    } finally {
      activeRequest.current = null
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pb-10 pt-20">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hermes</h1>
          <p className="text-sm text-muted-foreground">
            Private personal agent
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => {
            conversation.current = null
            setMessages([])
            setError('')
          }}
        >
          New chat
        </button>
        <button
          type="button"
          className="rounded-md border px-3 py-2"
          onClick={async () => {
            const r = await fetch('/api/hermes/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ method: 'logout' })
            })
            if (r.ok) window.location.replace('/hermes/login')
            else setError('Logout failed; retry.')
          }}
        >
          Sign out
        </button>
      </header>
      <History />
      <div className="flex min-h-40 flex-col gap-5" aria-live="polite">
        {messages.map((message, i) => (
          <article
            key={i}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-xl bg-muted p-3'
                : 'w-full'
            }
          >
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {message.role === 'user' ? 'You' : 'Hermes'}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {message.text || (busy ? 'Working…' : 'No text received')}
            </p>
          </article>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <form
        className="flex flex-col gap-3 rounded-xl border p-3"
        onSubmit={event => {
          event.preventDefault()
          void send()
        }}
      >
        <textarea
          aria-label="Message Hermes"
          value={input}
          maxLength={32000}
          onChange={event => setInput(event.target.value)}
          placeholder="Ask Hermes…"
          rows={3}
          className="w-full resize-y bg-transparent outline-none"
        />
        {busy && <button type="button" className="self-end rounded-md border px-4 py-2" onClick={() => activeRequest.current?.abort()}>Disconnect response</button>}
        <button
          disabled={busy || !input.trim()}
          type="submit"
          className="self-end rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Send'}
        </button>
      </form>
    </main>
  )
}
