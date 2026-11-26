import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { isAnonymousMode } from '@/lib/auth/provider'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'

import { Chat } from '@/components/chat'

export default async function Page() {
  if (process.env.HERMES_CHAT_ENABLED === 'true') redirect('/hermes')
  const userId = await getCurrentUserId()
  const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
  const libraryAvailable = !isAnonymousMode()
  const modelSelectorData = await getModelSelectorData()

  return (
    <Chat
      isGuest={!userId}
      isCloudDeployment={isCloudDeployment}
      libraryAvailable={libraryAvailable}
      modelSelectorData={modelSelectorData}
    />
  )
}
