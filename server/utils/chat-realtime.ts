import { createClient } from "@supabase/supabase-js"
import type { H3Event } from "h3"
import { prisma } from "./prisma"

type BroadcastableChatMessage = {
  id: string
  conversationId: string
  senderUserId: string
  body: string
  imageUrl: string | null
  isRead: boolean
  readAt: Date | string | null
  createdAt: Date | string
}

const conversationTopic = (conversationId: string) => `chat-conversation-${conversationId}`
const userTopic = (userId: string) => `chat-user-${userId}`

const normalizeMessage = (message: BroadcastableChatMessage) => ({
  id: message.id,
  conversationId: message.conversationId,
  senderUserId: message.senderUserId,
  body: message.body,
  imageUrl: message.imageUrl,
  isRead: message.isRead,
  readAt: message.readAt instanceof Date ? message.readAt.toISOString() : message.readAt,
  createdAt:
    message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
})

export const broadcastChatMessage = async (event: H3Event, message: BroadcastableChatMessage) => {
  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const serviceRoleKey = runtimeConfig.supabaseServiceRoleKey

  if (!supabaseUrl || !serviceRoleKey) {
    return
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: message.conversationId },
    select: {
      transaction: {
        select: {
          borrowerId: true,
          lenderId: true,
        },
      },
    },
  })

  const participantIds = [
    conversation?.transaction.borrowerId,
    conversation?.transaction.lenderId,
  ].filter((userId): userId is string => Boolean(userId))

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const payload = { message: normalizeMessage(message) }
  const topics = [
    conversationTopic(message.conversationId),
    ...participantIds.map((userId) => userTopic(userId)),
  ]

  await Promise.allSettled(
    topics.map((topic) =>
      supabase.channel(topic).send({
        type: "broadcast",
        event: "message",
        payload,
      }),
    ),
  )
}
