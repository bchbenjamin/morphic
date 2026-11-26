import { createHash, randomBytes } from 'node:crypto'
import postgres from 'postgres'

import { totpCounter, verifyOwnerPassword } from './owner-credentials'

export const OWNER_COOKIE = '__Host-hermes-session'
let client: ReturnType<typeof postgres> | undefined
function db() {
  if (!process.env.HERMES_AUTH_DATABASE_URL)
    throw new Error('Owner authentication not configured')
  return (client ??= postgres(process.env.HERMES_AUTH_DATABASE_URL, {
    ssl: 'require',
    max: 2,
    prepare: false
  }))
}
const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex')
export async function checkOwnerSession(token: string | undefined) {
  if (
    !token ||
    !/^[a-f0-9]{64}$/.test(token) ||
    !process.env.HERMES_OWNER_USER_ID
  )
    return false
  const rows =
    await db()`select 1 from hermes_owner_sessions where token_hash=${digest(token)} and expires_at > now()`
  return rows.length === 1
}
export async function revokeOwnerSession(token: string | undefined) {
  if (token && /^[a-f0-9]{64}$/.test(token))
    await db()`delete from hermes_owner_sessions where token_hash=${digest(token)}`
}
export async function authenticateOwner(
  method: unknown,
  email: unknown,
  credential: unknown
) {
  if (
    typeof credential !== 'string' ||
    credential.length > 1024 ||
    !process.env.HERMES_OWNER_USER_ID
  )
    return null
  const sql = db()
  const bucket = Math.floor(Date.now() / 300000)
  const limits =
    await sql`insert into hermes_auth_limits(bucket,window_id,attempts) values ('owner-login',${bucket},1) on conflict(bucket) do update set attempts=case when hermes_auth_limits.window_id=excluded.window_id then hermes_auth_limits.attempts+1 else 1 end,window_id=excluded.window_id returning attempts`
  if (Number(limits[0].attempts) > 5) return null
  return sql.begin(async tx => {
    if (method === 'totp') {
      const counter = totpCounter(
        credential,
        process.env.HERMES_TOTP_SECRET || ''
      )
      if (counter === null) return null
      const rows =
        await tx`insert into hermes_totp_replay(owner_id,last_counter) values (${process.env.HERMES_OWNER_USER_ID!},${counter}) on conflict(owner_id) do update set last_counter=excluded.last_counter where hermes_totp_replay.last_counter < excluded.last_counter returning owner_id`
      if (!rows.length) return null
    } else if (method === 'password') {
      if (
        typeof email !== 'string' ||
        !process.env.HERMES_OWNER_EMAIL ||
        email.trim().toLowerCase() !==
          process.env.HERMES_OWNER_EMAIL.toLowerCase() ||
        !verifyOwnerPassword(credential, process.env.HERMES_PASSWORD_HASH || '')
      )
        return null
    } else return null
    const token = randomBytes(32).toString('hex')
    await tx`insert into hermes_owner_sessions(token_hash,expires_at) values (${digest(token)},now()+interval '12 hours')`
    return token
  })
}

export async function createGoogleOwnerSession(subject: string) {
  if (
    !process.env.HERMES_OWNER_USER_ID ||
    !(process.env.HERMES_GOOGLE_ALLOWED_SUBJECTS || '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .includes(subject)
  )
    return null
  const token = randomBytes(32).toString('hex')
  await db()`insert into hermes_owner_sessions(token_hash,expires_at) values (${digest(token)},now()+interval '12 hours')`
  return token
}
