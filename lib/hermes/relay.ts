import { createHash } from 'node:crypto'

export function isHermesOwner(
  userId: string | undefined,
  anonymous: boolean,
  env = process.env
) {
  return (
    env.HERMES_CHAT_ENABLED === 'true' &&
    !anonymous &&
    Boolean(
      userId && env.HERMES_OWNER_USER_ID && userId === env.HERMES_OWNER_USER_ID
    )
  )
}

export function hermesUpstreamUrl(
  path: string,
  env = process.env
) {
  const base = new URL(env.HERMES_API_BASE_URL ?? '')
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
  if (
    (base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !env.HERMES_API_KEY
  )
    throw new Error('Invalid Hermes configuration')
  const prefix = base.pathname.replace(/\/+$/, '')
  if (!prefix.endsWith('/v1') || !path.startsWith('/') || path.startsWith('//'))
    throw new Error('Invalid Hermes API path')
  const target = new URL(base.origin)
  target.pathname = prefix.slice(0, -3) + path.split('?')[0]
  const query = path.indexOf('?')
  if (query !== -1) target.search = path.slice(query + 1)
  return target
}

export function buildHermesRequest(
  input: unknown,
  ownerId: string,
  env = process.env
) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid request')
  const { conversationId, message } = input as Record<string, unknown>
  if (
    typeof conversationId !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      conversationId
    ) ||
    typeof message !== 'string' ||
    !message.trim() ||
    message.length > 32000
  )
    throw new Error('Invalid request')
  // Keep the legacy stable session namespace so existing conversations survive rebranding.
  const sessionId = `morphic-${createHash('sha256')
    .update(JSON.stringify([ownerId, conversationId]))
    .digest('hex')}`
  return {
    url: hermesUpstreamUrl('/v1/chat/completions', env).toString(),
    headers: {
      Authorization: `Bearer ${env.HERMES_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Hermes-Session-Id': sessionId,
      'X-Hermes-Session-Key': sessionId
    },
    body: JSON.stringify({
      model: env.HERMES_API_MODEL || 'hermes',
      messages: [{ role: 'user', content: message }],
      stream: true
    })
  }
}
