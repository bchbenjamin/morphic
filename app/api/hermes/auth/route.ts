import { NextRequest, NextResponse } from 'next/server'

import {
  authenticateOwner,
  OWNER_COOKIE,
  revokeOwnerSession
} from '@/lib/hermes/owner-session'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  if (process.env.HERMES_CHAT_ENABLED !== 'true')
    return new NextResponse('Not found', { status: 404 })
  if (
    !process.env.HERMES_WEB_ORIGIN ||
    req.headers.get('origin') !== process.env.HERMES_WEB_ORIGIN
  )
    return new NextResponse('Forbidden', { status: 403 })
  try {
    const raw = await req.text()
    if (raw.length > 4096)
      return new NextResponse('Invalid request', { status: 400 })
    const body = JSON.parse(raw)
    if (body.method === 'logout') {
      await revokeOwnerSession(req.cookies.get(OWNER_COOKIE)?.value)
      const res = NextResponse.json({ ok: true })
      res.cookies.set(OWNER_COOKIE, '', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 0
      })
      return res
    }
    const token = await authenticateOwner(
      body.method,
      body.email,
      body.credential
    )
    if (!token)
      return NextResponse.json(
        { error: 'Invalid credentials or too many attempts' },
        { status: 401 }
      )
    const res = NextResponse.json({ ok: true })
    res.cookies.set(OWNER_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 43200
    })
    return res
  } catch {
    return NextResponse.json(
      { error: 'Authentication unavailable' },
      { status: 503 }
    )
  }
}
