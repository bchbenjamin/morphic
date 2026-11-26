import { cookies } from 'next/headers'

import { checkOwnerSession, OWNER_COOKIE } from '@/lib/hermes/owner-session'
import { buildHermesRequest } from '@/lib/hermes/relay'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  if (process.env.HERMES_CHAT_ENABLED !== 'true')
    return new Response('Not found', { status: 404 })
  const ownerId = process.env.HERMES_OWNER_USER_ID
  const valid = await checkOwnerSession(
    (await cookies()).get(OWNER_COOKIE)?.value
  ).catch(() => false)
  if (!ownerId || !valid) return new Response('Forbidden', { status: 403 })
  // Do not trust client-supplied forwarded host headers for CSRF protection.
  if (
    !process.env.HERMES_WEB_ORIGIN ||
    req.headers.get('origin') !== process.env.HERMES_WEB_ORIGIN
  )
    return new Response('Forbidden origin', { status: 403 })
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    return new Response('Invalid content type', { status: 415 })
  let input: unknown
  try {
    const raw = await req.text()
    if (raw.length > 200000)
      return new Response('Request too large', { status: 413 })
    input = JSON.parse(raw)
  } catch {
    return new Response('Invalid request', { status: 400 })
  }
  try {
    const upstream = buildHermesRequest(input, ownerId)
    const result = await fetch(upstream.url, {
      method: 'POST',
      headers: upstream.headers,
      body: upstream.body,
      signal: req.signal,
      redirect: 'error',
      cache: 'no-store'
    })
    if (
      !result.ok ||
      !result.body ||
      !result.headers.get('content-type')?.includes('text/event-stream')
    ) {
      await result.body?.cancel()
      return new Response('Hermes request failed', { status: 502 })
    }
    return new Response(result.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid request')
      return new Response('Invalid request', { status: 400 })
    return new Response('Hermes unavailable', { status: 502 })
  }
}
