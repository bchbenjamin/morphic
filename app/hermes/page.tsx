import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isAnonymousMode } from '@/lib/auth/provider'
import { isHermesOwner } from '@/lib/hermes/relay'

import { HermesChat } from './hermes-chat'

export default async function HermesPage() {
  if (process.env.HERMES_CHAT_ENABLED !== 'true' || isAnonymousMode())
    notFound()
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')
  if (!isHermesOwner(user.id, false)) notFound()
  return <HermesChat />
}
