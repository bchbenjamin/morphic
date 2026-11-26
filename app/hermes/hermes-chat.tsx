'use client'

import { useEffect, useRef, useState } from 'react'

import { ChatProvider } from '@/lib/contexts/chat-context'
import { readHermesStream } from '@/lib/hermes/sse'
import type { NoteContext, UploadedFile } from '@/lib/types'
import type { UIMessage } from '@/lib/types/ai'
import { cn } from '@/lib/utils'

import { ArtifactProvider } from '@/components/artifact/artifact-context'
import { ChatMessages } from '@/components/chat-messages'
import { ChatPanel } from '@/components/chat-panel'
import Header from '@/components/header'
import { LibraryProvider } from '@/components/library/library-context'
import { Button } from '@/components/ui/button'
import { IconLogo } from '@/components/ui/icons'
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarProvider,
  SidebarRail, SidebarTrigger, useSidebar
} from '@/components/ui/sidebar'
import { IconMessageCirclePlus } from '@tabler/icons-react'

import { History } from './history'

function OwnerSidebar({ onNewChat, busy }: { onNewChat: () => void; busy: boolean }) {
  const { open, openMobile, setOpenMobile } = useSidebar()
  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row items-center justify-between">
        <span className="flex items-center gap-2 px-2 py-3 text-sm font-semibold">
          <IconLogo className="size-5" /> Hermes
        </span>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent className="flex h-full flex-col px-2 py-4">
        <SidebarMenu>
          <Button variant="ghost" className="justify-start gap-2" disabled={busy} onClick={() => {
            onNewChat()
            setOpenMobile(false)
          }}>
            <IconMessageCirclePlus className="size-4" /> New chat
          </Button>
        </SidebarMenu>
        <div className="min-h-0 flex-1 overflow-y-auto">{(open || openMobile) && <History embedded />}</div>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

export function HermesChat() {
  return (
    <SidebarProvider defaultOpen={false}>
      <LibraryProvider>
        <ArtifactProvider><OwnerChat /></ArtifactProvider>
      </LibraryProvider>
    </SidebarProvider>
  )
}

function OwnerChat() {
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID())
  const inFlight = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null!)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready')
  const [error, setError] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [quotedContexts, setQuotedContexts] = useState<string[]>([])
  const [noteContexts, setNoteContexts] = useState<NoteContext[]>([])
  const [isAtBottom, setIsAtBottom] = useState(true)
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const update = () => setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [messages.length > 0])

  useEffect(() => {
    if (isAtBottom) {
      const el = scrollContainerRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [messages, isAtBottom])

  function newChat() {
    if (inFlight.current) return
    setConversationId(crypto.randomUUID())
    setMessages([])
    setInput('')
    setError('')
    setStatus('ready')
    setIsAtBottom(true)
  }

  async function send(text: string, onAccepted?: () => void) {
    if (inFlight.current || !text.trim() || text.length > 32000) return
    inFlight.current = true
    onAccepted?.()
    const controller = new AbortController()
    activeRequest.current = controller
    setStatus('submitted')
    setError('')
    setInput('')
    setIsAtBottom(true)
    const assistantId = crypto.randomUUID()
    setMessages(previous => [
      ...previous,
      { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] },
      { id: assistantId, role: 'assistant', parts: [{ type: 'text', text: '' }] }
    ])
    try {
      const response = await fetch('/api/hermes/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: text })
      })
      if (!response.ok || !response.body) throw new Error(`Hermes request failed (${response.status})`)
      setStatus('streaming')
      await readHermesStream(response.body, delta => setMessages(previous =>
        previous.map(m => m.id === assistantId ? {
          ...m, parts: [{ type: 'text', text: m.parts.map(p => p.type === 'text' ? p.text : '').join('') + delta }]
        } : m)
      ))
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(controller.signal.aborted
        ? 'Response disconnected. Backend execution may still be running; check Hermes before retrying.'
        : `${err instanceof Error ? err.message : 'Request failed'}. Check Hermes before retrying an action.`)
    } finally {
      activeRequest.current = null
      inFlight.current = false
    }
  }

  const sections = messages.reduce<{ id: string; userMessage: UIMessage; assistantMessages: UIMessage[] }[]>((result, message) => {
    if (message.role === 'user') result.push({ id: message.id, userMessage: message, assistantMessages: [] })
    else if (message.role === 'assistant') result.at(-1)?.assistantMessages.push(message)
    return result
  }, [])

  return (
    <>
      <OwnerSidebar onNewChat={newChat} busy={busy} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={null} hermesOwner onSignOut={async () => {
          if (inFlight.current) { setError('Disconnect the active response before signing out.'); return }
          try {
            const r = await fetch('/api/hermes/auth', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ method: 'logout' })
            })
            if (r.ok) window.location.replace('/hermes/login')
            else setError('Logout failed; retry.')
          } catch { setError('Logout failed; retry.') }
        }} />
        <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <ChatProvider isStreamingRef={inFlight} sendMessage={(message, accepted) => {
            void send(message.parts.map(p => p.text).join('\n'), accepted)
          }}>
            <div className={cn('relative flex h-full min-w-0 flex-1 flex-col', messages.length === 0 && 'items-center justify-center')} data-testid="full-chat">
              <ChatMessages sections={sections} status={status} scrollContainerRef={scrollContainerRef}
                isGuest libraryAvailable={false} />
              {error && <p role="alert" className="mx-auto w-full max-w-3xl px-4 py-2 text-sm text-destructive">{error}</p>}
              <ChatPanel hermesMode chatId={conversationId} input={input} handleInputChange={e => setInput(e.target.value)}
                handleSubmit={e => { e.preventDefault(); void send(input) }}
                status={status} messages={messages} setMessages={setMessages}
                stop={() => activeRequest.current?.abort()}
                append={message => { void send((message.parts ?? []).filter((p: { type: string }) => p.type === 'text').map((p: { text: string }) => p.text).join('\n')) }}
                showScrollToBottomButton={!isAtBottom} scrollContainerRef={scrollContainerRef}
                uploadedFiles={uploadedFiles} setUploadedFiles={setUploadedFiles}
                quotedContexts={quotedContexts} setQuotedContexts={setQuotedContexts}
                noteContexts={noteContexts} setNoteContexts={setNoteContexts}
                onNewChat={newChat} isGuest sections={sections} />
            </div>
          </ChatProvider>
        </main>
      </div>
    </>
  )
}
