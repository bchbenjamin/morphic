import { NextRequest, NextResponse } from 'next/server'

import {
  GOOGLE_STATE,
  googleAuthorization,
  googleConfig,
  randomValue
} from '@/lib/hermes/google'
export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
  if (process.env.HERMES_CHAT_ENABLED !== 'true')
    return new NextResponse('Not found', { status: 404 })
  try {
    const config = googleConfig()
    if (req.nextUrl.origin !== config.origin)
      return new NextResponse('Invalid origin', { status: 403 })
    const state = randomValue(),
      verifier = randomValue(),
      nonce = randomValue()
    const res = NextResponse.redirect(
      googleAuthorization(config, state, verifier, nonce)
    )
    res.cookies.set(GOOGLE_STATE, JSON.stringify({ state, verifier, nonce }), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 300
    })
    return res
  } catch {
    return new NextResponse('Google login is not configured', { status: 503 })
  }
}
