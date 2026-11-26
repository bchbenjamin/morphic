import { NextRequest, NextResponse } from 'next/server'

import { GOOGLE_STATE,googleConfig, googleSubject } from '@/lib/hermes/google'
import {
  createGoogleOwnerSession,
  OWNER_COOKIE
} from '@/lib/hermes/owner-session'
export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
  if (process.env.HERMES_CHAT_ENABLED !== 'true')
    return new NextResponse('Not found', { status: 404 })
  const origin = process.env.HERMES_WEB_ORIGIN
  if (!origin || req.nextUrl.origin !== origin)
    return new NextResponse('Forbidden', { status: 403 })
  const res = NextResponse.redirect(
    new URL('/hermes/login?error=google', origin)
  )
  res.cookies.set(GOOGLE_STATE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })
  try {
    const config = googleConfig(),
      data = JSON.parse(req.cookies.get(GOOGLE_STATE)?.value || '{}'),
      code = req.nextUrl.searchParams.get('code')
    if (
      !code ||
      !data.state ||
      data.state !== req.nextUrl.searchParams.get('state') ||
      !data.verifier ||
      !data.nonce
    )
      return res
    const subject = await googleSubject(
        config,
        code,
        data.verifier,
        data.nonce
      ),
      token = await createGoogleOwnerSession(subject)
    if (!token) return res
    res.headers.set('location', new URL('/hermes', origin).toString())
    res.cookies.set(OWNER_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 43200
    })
    return res
  } catch {
    return res
  }
}
