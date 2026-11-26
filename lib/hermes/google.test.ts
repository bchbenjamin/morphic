import { describe, expect, it, vi } from 'vitest'
import { googleAuthorization, googleConfig } from './google'
describe('Google owner OAuth', () => {
  it('requires an explicit owner allowlist', () => {
    vi.stubEnv('HERMES_WEB_ORIGIN', 'https://hermes.example.test')
    vi.stubEnv('GOOGLE_CLIENT_ID', 'fixture')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'fixture')
    vi.stubEnv('HERMES_GOOGLE_ALLOWED_SUBJECTS', '')
    expect(() => googleConfig()).toThrow()
    vi.unstubAllEnvs()
  })
  it('uses authorization code, PKCE, state and nonce', () => {
    const url = googleAuthorization(
      {
        origin: 'https://hermes.example.test',
        clientId: 'fixture',
        secret: 'fixture',
        callback: 'https://hermes.example.test/api/hermes/google/callback'
      },
      'state',
      'verifier',
      'nonce'
    )
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe('state')
    expect(url.searchParams.get('nonce')).toBe('nonce')
    expect(url.searchParams.has('client_secret')).toBe(false)
  })
})
