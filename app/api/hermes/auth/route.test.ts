import { NextRequest } from 'next/server'

import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/hermes/owner-session', () => ({
  authenticateOwner: vi.fn(),
  revokeOwnerSession: vi.fn(),
  OWNER_COOKIE: '__Host-hermes-session'
}))
import {
  authenticateOwner,
  revokeOwnerSession
} from '@/lib/hermes/owner-session'

import { POST } from './route'
const origin = 'https://hermes.example.test'
function req(body: object, from = origin) {
  return new NextRequest(origin + '/api/hermes/auth', {
    method: 'POST',
    headers: {
      origin: from,
      'content-type': 'application/json',
      cookie: '__Host-hermes-session=fixture'
    },
    body: JSON.stringify(body)
  })
}
beforeEach(() => {
  vi.stubEnv('HERMES_CHAT_ENABLED', 'true')
  vi.stubEnv('HERMES_WEB_ORIGIN', origin)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})
describe('owner login and logout', () => {
  it('rejects cross-origin and invalid credentials', async () => {
    expect(
      (await POST(req({ method: 'totp' }, 'https://evil.test'))).status
    ).toBe(403)
    expect(authenticateOwner).not.toHaveBeenCalled()
    vi.mocked(authenticateOwner).mockResolvedValue(null)
    expect(
      (await POST(req({ method: 'totp', credential: '000000' }))).status
    ).toBe(401)
  })
  it('issues secure cookie and revokes session on logout', async () => {
    vi.mocked(authenticateOwner).mockResolvedValue('fixture')
    const login = await POST(req({ method: 'totp', credential: '123456' }))
    expect(login.status).toBe(200)
    expect(login.headers.get('set-cookie')).toContain('HttpOnly')
    expect(login.headers.get('set-cookie')).toContain('Secure')
    const logout = await POST(req({ method: 'logout' }))
    expect(revokeOwnerSession).toHaveBeenCalledWith('fixture')
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})
