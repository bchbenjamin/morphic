import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { checkOwnerSession, OWNER_COOKIE } from '@/lib/hermes/owner-session'

import { HermesChat } from './hermes-chat'

export default async function HermesPage() {
  if (process.env.HERMES_CHAT_ENABLED !== 'true') notFound()
  const valid = await checkOwnerSession(
    (await cookies()).get(OWNER_COOKIE)?.value
  ).catch(() => false)
  if (!valid) redirect('/hermes/login')
  return <HermesChat />
}
