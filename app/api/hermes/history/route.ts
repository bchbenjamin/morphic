import { cookies } from 'next/headers'

import { checkOwnerSession, OWNER_COOKIE } from '@/lib/hermes/owner-session'
import { hermesUpstreamUrl } from '@/lib/hermes/relay'
export const runtime = 'nodejs'
export async function GET(req: Request) {
  if (process.env.HERMES_CHAT_ENABLED !== 'true')
    return new Response('Not found', { status: 404 })
  if (
    !(await checkOwnerSession((await cookies()).get(OWNER_COOKIE)?.value).catch(
      () => false
    ))
  )
    return new Response('Forbidden', { status: 403 })
  const query = new URL(req.url).searchParams
  const id = query.get('id')
  if (id && !/^[a-zA-Z0-9_-]{1,180}$/.test(id))
    return new Response('Invalid session', { status: 400 })
  const offset = query.get('offset') || '0'
  if (!/^\d{1,7}$/.test(offset))
    return new Response('Invalid offset', { status: 400 })
  try {
    const path = id
      ? `/api/sessions/${encodeURIComponent(id)}/messages?limit=100&order=oldest&offset=${offset}`
      : `/api/sessions?limit=50&offset=${offset}`
    const upstream = await fetch(hermesUpstreamUrl(path), {
      headers: { Authorization: `Bearer ${process.env.HERMES_API_KEY}` },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(20000)
    })
    if (!upstream.ok)
      return new Response('History unavailable', { status: 502 })
    return Response.json(await upstream.json(), {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch {
    return new Response('History unavailable', { status: 502 })
  }
}
