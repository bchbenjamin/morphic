import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/get-current-user', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/auth/provider', () => ({ isAnonymousMode: vi.fn() }))

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isAnonymousMode } from '@/lib/auth/provider'

import { POST } from './route'

const origin = 'https://hermes.example.test'
const payload = {
  conversationId: '01234567-0123-4567-89ab-0123456789ab',
  message: 'hostname'
}
function request(value = payload, requestOrigin = origin) {
  return new Request(`${origin}/api/hermes/chat`, {
    method: 'POST',
    headers: { origin: requestOrigin, 'content-type': 'application/json' },
    body: JSON.stringify(value)
  })
}

beforeEach(() => {
  vi.stubEnv('HERMES_CHAT_ENABLED', 'true')
  vi.stubEnv('HERMES_OWNER_USER_ID', 'owner')
  vi.stubEnv('HERMES_WEB_ORIGIN', origin)
  vi.stubEnv('HERMES_API_BASE_URL', 'http://127.0.0.1:8642/v1')
  vi.stubEnv('HERMES_API_KEY', 'fixture')
  vi.mocked(isAnonymousMode).mockReturnValue(false)
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 'owner', email: null })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('Hermes API route', () => {
  it('rejects anonymous, guest, other owner, and cross-origin requests without contacting upstream', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    vi.mocked(isAnonymousMode).mockReturnValue(true)
    expect((await POST(request())).status).toBe(403)
    vi.mocked(isAnonymousMode).mockReturnValue(false)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect((await POST(request())).status).toBe(403)
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'other', email: null })
    expect((await POST(request())).status).toBe(403)
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'owner', email: null })
    expect((await POST(request(payload, 'https://wrong.test'))).status).toBe(
      403
    )
    expect(upstream).not.toHaveBeenCalled()
  })
  it('relays an authenticated SSE response without exposing upstream headers', async () => {
    const body =
      'data: {"choices":[{"delta":{"content":"raspberrypi"}}]}\n\ndata: [DONE]\n\n'
    const upstream = vi
      .fn()
      .mockResolvedValue(
        new Response(body, {
          headers: {
            'content-type': 'text/event-stream',
            'set-cookie': 'sensitive=1'
          }
        })
      )
    vi.stubGlobal('fetch', upstream)
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(body)
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(upstream).toHaveBeenCalledWith(
      'http://127.0.0.1:8642/v1/chat/completions',
      expect.objectContaining({
        redirect: 'error',
        headers: expect.objectContaining({ Authorization: 'Bearer fixture' })
      })
    )
  })
  it('does not disclose upstream authentication errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('private error body', { status: 401 }))
    )
    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('private error body')
  })
})
