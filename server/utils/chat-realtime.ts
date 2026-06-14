import { createClient } from "@supabase/supabase-js"
import type { H3Event } from "h3"
import { prisma } from "./prisma"

type BroadcastableChatMessage = {
  id: string
  conversationId: string
  senderUserId: string
  replyToMessageId: string | null
  body: string
  imageUrl: string | null
  isRead: boolean
  readAt: Date | string | null
  createdAt: Date | string
  replyToMessage: {
    id: string
    senderUserId: string
    body: string
    imageUrl: string | null
    createdAt: Date | string
  } | null
  reactions?: Array<{
    emoji: string
    count: number
    reactedByCurrentUser: boolean
    userIds?: string[]
  }>
}

type BroadcastableChatReaction = {
  conversationId: string
  messageId: string
  emoji: string
  userId: string
  action: "added" | "removed"
  reactions: Array<{
    emoji: string
    count: number
    reactedByCurrentUser: boolean
    userIds?: string[]
  }>
}

const conversationTopic = (conversationId: string) => `chat-conversation-${conversationId}`
const userTopic = (userId: string) => `chat-user-${userId}`

const normalizeMessage = (message: BroadcastableChatMessage) => ({
  id: message.id,
  conversationId: message.conversationId,
  senderUserId: message.senderUserId,
  replyToMessageId: message.replyToMessageId,
  body: message.body,
  imageUrl: message.imageUrl,
  isRead: message.isRead,
  readAt: message.readAt instanceof Date ? message.readAt.toISOString() : message.readAt,
  createdAt:
    message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
  replyToMessage: message.replyToMessage
    ? {
        ...message.replyToMessage,
        createdAt:
          message.replyToMessage.createdAt instanceof Date
            ? message.replyToMessage.createdAt.toISOString()
            : message.replyToMessage.createdAt,
      }
    : null,
  reactions: message.reactions ?? [],
})

const getChatParticipantIds = async (conversationId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      transaction: {
        select: {
          borrowerId: true,
          lenderId: true,
        },
      },
    },
  })

  return [conversation?.transaction.borrowerId, conversation?.transaction.lenderId].filter(
    (userId): userId is string => Boolean(userId),
  )
}

const sendChatBroadcast = async (
  event: H3Event,
  conversationId: string,
  eventName: "message" | "reaction",
  payload: Record<string, unknown>,
) => {
  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const serviceRoleKey = runtimeConfig.supabaseServiceRoleKey

  if (!supabaseUrl || !serviceRoleKey) {
    return
  }

  const participantIds = await getChatParticipantIds(conversationId)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const topics = [
    conversationTopic(conversationId),
    ...participantIds.map((userId) => userTopic(userId)),
  ]

  await Promise.allSettled(
    topics.map((topic) => supabase.channel(topic).httpSend(eventName, payload)),
  )
}

export const broadcastChatMessage = async (event: H3Event, message: BroadcastableChatMessage) => {
  await sendChatBroadcast(event, message.conversationId, "message", {
    message: normalizeMessage(message),
  })
}

export const broadcastChatReaction = async (
  event: H3Event,
  reaction: BroadcastableChatReaction,
) => {
  await sendChatBroadcast(event, reaction.conversationId, "reaction", { reaction })
}
