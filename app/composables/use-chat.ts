import { computed, ref } from "vue"

export type ChatMessage = {
  id: string
  conversationId: string
  senderUserId: string
  body: string
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export type ChatParticipant = {
  id: string
  username: string
  firstName: string
  lastName: string
  avatarUrl: string | null
}

export type ChatItem = {
  id: string
  name: string
  thumbnailImage: string | null
}

type ConversationBase = {
  conversationId: string
  transactionId: string
  isExpired: boolean
  closedNotice: string | null
  item: ChatItem | null
  otherParticipant: ChatParticipant | null
}

export type ConversationSummary = ConversationBase & {
  lastMessage: {
    id: string
    body: string
    senderUserId: string
    createdAt: string
    isRead: boolean
  } | null
  unreadCount: number
}

export type ConversationDetail = ConversationBase

type FetchErrorData = {
  data?: {
    message?: string
  }
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as FetchErrorData).data?.message === "string"
  ) {
    return (error as FetchErrorData).data?.message ?? fallback
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

const resetConversationState = (
  messages: { value: ChatMessage[] },
  nextCursor: { value: string | null },
  hasMoreMessages: { value: boolean },
) => {
  messages.value = []
  nextCursor.value = null
  hasMoreMessages.value = false
}

export const useChat = () => {
  const conversations = ref<ConversationSummary[]>([])
  const activeConversation = ref<ConversationDetail | null>(null)
  const messages = ref<ChatMessage[]>([])
  const isLoadingConversations = ref(false)
  const isLoadingMessages = ref(false)
  const isOpeningConversation = ref(false)
  const isSending = ref(false)
  const error = ref<string | null>(null)
  const hasMoreMessages = ref(false)
  const nextCursor = ref<string | null>(null)
  const totalUnreadCount = ref(0)

  const syncLocalReadState = async (conversationId: string) => {
    await markAsRead(conversationId)

    const conversation = conversations.value.find(
      (entry) => entry.conversationId === conversationId,
    )
    if (!conversation) {
      return
    }

    totalUnreadCount.value = Math.max(0, totalUnreadCount.value - conversation.unreadCount)
    conversation.unreadCount = 0
  }

  const loadConversations = async () => {
    if (isLoadingConversations.value) return

    isLoadingConversations.value = true
    error.value = null

    try {
      const data = await $fetch<ConversationSummary[]>("/api/chat")
      conversations.value = data
      if (activeConversation.value) {
        const matchingConversation = data.find(
          (conversation) =>
            conversation.conversationId === activeConversation.value?.conversationId,
        )
        if (matchingConversation) {
          activeConversation.value = {
            conversationId: matchingConversation.conversationId,
            transactionId: matchingConversation.transactionId,
            isExpired: matchingConversation.isExpired,
            item: matchingConversation.item,
            otherParticipant: matchingConversation.otherParticipant,
          }
        }
      }
    } catch (e: unknown) {
      error.value = getErrorMessage(e, "Failed to load conversations")
      conversations.value = []
    } finally {
      isLoadingConversations.value = false
    }
  }

  const loadMessages = async (conversationId: string, cursor?: string) => {
    isLoadingMessages.value = true

    try {
      const params: Record<string, string> = { conversationId }
      if (cursor) params.cursor = cursor

      const data = await $fetch<{
        messages: ChatMessage[]
        nextCursor: string | null
        hasMore: boolean
      }>("/api/chat/messages", { params })

      if (cursor) {
        messages.value = [...data.messages, ...messages.value]
      } else {
        messages.value = data.messages
      }

      nextCursor.value = data.nextCursor
      hasMoreMessages.value = data.hasMore
    } catch (err: unknown) {
      error.value = getErrorMessage(err, "Failed to load messages.")
    } finally {
      isLoadingMessages.value = false
    }
  }

  const openConversation = async (transactionId: string) => {
    if (!transactionId) return

    isOpeningConversation.value = true
    error.value = null

    try {
      const data = await $fetch<ConversationDetail>(
        `/api/chat/transactions/${encodeURIComponent(transactionId)}`,
      )

      activeConversation.value = data
      resetConversationState(messages, nextCursor, hasMoreMessages)
      await loadMessages(data.conversationId)
      await syncLocalReadState(data.conversationId)
    } catch (err: unknown) {
      activeConversation.value = null
      resetConversationState(messages, nextCursor, hasMoreMessages)
      error.value = getErrorMessage(err, "Failed to open conversation.")
    } finally {
      isOpeningConversation.value = false
    }
  }

  const openConversationById = async (conversationId: string) => {
    if (!conversationId) return

    isOpeningConversation.value = true
    error.value = null

    try {
      const data = await $fetch<ConversationDetail>(
        `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
      )

      activeConversation.value = data
      resetConversationState(messages, nextCursor, hasMoreMessages)
      await loadMessages(data.conversationId)
      await syncLocalReadState(data.conversationId)
    } catch (err: unknown) {
      error.value = getErrorMessage(err, "Failed to open conversation.")
    } finally {
      isOpeningConversation.value = false
    }
  }

  const selectConversation = async (conversationId: string) => {
    await openConversationById(conversationId)
  }

  const loadMoreMessages = async () => {
    if (!activeConversation.value || !hasMoreMessages.value || !nextCursor.value) return
    await loadMessages(activeConversation.value.conversationId, nextCursor.value)
  }

  const sendMessage = async (body: string) => {
    if (!activeConversation.value || isSending.value || activeConversation.value.isExpired) {
      return null
    }

    if (!body.trim()) return null

    isSending.value = true
    error.value = null

    try {
      const message = await $fetch<ChatMessage>("/api/chat/send", {
        method: "POST",
        body: {
          conversationId: activeConversation.value.conversationId,
          body,
        },
      })

      messages.value.push(message)

      const conversation = conversations.value.find(
        (entry) => entry.conversationId === activeConversation.value?.conversationId,
      )

      if (conversation) {
        conversation.lastMessage = {
          id: message.id,
          body: message.body,
          senderUserId: message.senderUserId,
          createdAt: message.createdAt,
          isRead: false,
        }

        const index = conversations.value.indexOf(conversation)
        if (index > 0) {
          conversations.value.splice(index, 1)
          conversations.value.unshift(conversation)
        }
      } else {
        await loadConversations()
      }

      return msg
    } catch (e: unknown) {
      const message = getErrorMessage(e, "Failed to send message")
      error.value = message

      if (activeConversation.value && message.toLowerCase().includes("read-only")) {
        activeConversation.value = {
          ...activeConversation.value,
          isExpired: true,
        }

        const matchingConversation = conversations.value.find(
          (conversation) =>
            conversation.conversationId === activeConversation.value?.conversationId,
        )

        if (matchingConversation) {
          matchingConversation.isExpired = true
        }
      }

      return null
    } finally {
      isSending.value = false
    }
  }

  const markAsRead = async (conversationId: string) => {
    try {
      await $fetch("/api/chat/mark-read", {
        method: "POST",
        body: { conversationId },
      })
    } catch {
      // Read receipts are non-blocking.
    }
  }

  const loadUnreadCount = async () => {
    try {
      const data = await $fetch<{ unreadCount: number }>("/api/chat/unread-count")
      totalUnreadCount.value = data.unreadCount
    } catch {
      // Ignore transient badge failures.
    }
  }

  const onIncomingMessage = (message: ChatMessage) => {
    if (activeConversation.value?.conversationId === message.conversationId) {
      const exists = messages.value.some((entry) => entry.id === message.id)
      if (!exists) {
        messages.value.push(message)
        void markAsRead(message.conversationId)
      }
    } else {
      totalUnreadCount.value += 1
    }

    const conversation = conversations.value.find(
      (entry) => entry.conversationId === message.conversationId,
    )
    if (!conversation) {
      void loadConversations()
      return
    }

    conversation.lastMessage = {
      id: message.id,
      body: message.body,
      senderUserId: message.senderUserId,
      createdAt: message.createdAt,
      isRead: activeConversation.value?.conversationId === message.conversationId,
    }

    if (activeConversation.value?.conversationId !== message.conversationId) {
      conversation.unreadCount += 1
    }

    const index = conversations.value.indexOf(conversation)
    if (index > 0) {
      conversations.value.splice(index, 1)
      conversations.value.unshift(conversation)
    }
  }

  const closeConversation = () => {
    activeConversation.value = null
    resetConversationState(messages, nextCursor, hasMoreMessages)
  }

  const sortedConversations = computed(() =>
    [...conversations.value].sort((left, right) => {
      const leftTime = left.lastMessage?.createdAt ?? ""
      const rightTime = right.lastMessage?.createdAt ?? ""
      return rightTime.localeCompare(leftTime)
    }),
  )

  return {
    conversations,
    sortedConversations,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isOpeningConversation,
    isSending,
    error,
    hasMoreMessages,
    totalUnreadCount,
    loadConversations,
    openConversation,
    openConversationById,
    selectConversation,
    loadMoreMessages,
    sendMessage,
    markAsRead,
    loadUnreadCount,
    onIncomingMessage,
    closeConversation,
  }
}
