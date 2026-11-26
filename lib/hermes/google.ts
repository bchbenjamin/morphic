import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'node:crypto'
export const GOOGLE_STATE = '__Host-hermes-oauth'
export const randomValue = () => randomBytes(32).toString('base64url')
export function googleConfig() {
  const origin = process.env.HERMES_WEB_ORIGIN,
    clientId = process.env.GOOGLE_CLIENT_ID,
    secret = process.env.GOOGLE_CLIENT_SECRET
  if (
    !origin ||
    !clientId ||
    !secret ||
    !process.env.HERMES_GOOGLE_ALLOWED_SUBJECTS
  )
    throw new Error('Google login not configured')
  return {
    origin,
    clientId,
    secret,
    callback: `${origin}/api/hermes/google/callback`
  }
}
export function googleAuthorization(
  config: ReturnType<typeof googleConfig>,
  state: string,
  verifier: string,
  nonce: string
) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callback,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account'
  }).toString()
  return url
}
const jwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
)
export async function googleSubject(
  config: ReturnType<typeof googleConfig>,
  code: string,
  verifier: string,
  nonce: string
) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.secret,
      redirect_uri: config.callback,
      grant_type: 'authorization_code',
      code_verifier: verifier
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  })
  if (!r.ok) throw new Error('Google exchange failed')
  const { id_token } = await r.json()
  const { payload } = await jwtVerify(id_token, jwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: config.clientId,
    algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'sub', 'nonce']
  })
  if (
    payload.nonce !== nonce ||
    payload.email_verified !== true ||
    !payload.sub ||
    (payload.azp && payload.azp !== config.clientId)
  )
    throw new Error('Google identity rejected')
  return payload.sub
}
