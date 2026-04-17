import { ref, computed } from "vue"

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

export type ConversationSummary = {
  conversationId: string
  transactionId: string
  isExpired: boolean
  item: ChatItem | null
  otherParticipant: ChatParticipant | null
  lastMessage: {
    id: string
    body: string
    senderUserId: string
    createdAt: string
    isRead: boolean
  } | null
  unreadCount: number
}

export type ConversationDetail = {
  conversationId: string
  transactionId: string
  isExpired: boolean
  item: ChatItem | null
  otherParticipant: ChatParticipant | null
}

export const useChat = () => {
  const conversations = ref<ConversationSummary[]>([])
  const activeConversation = ref<ConversationDetail | null>(null)
  const messages = ref<ChatMessage[]>([])
  const isLoadingConversations = ref(false)
  const isLoadingMessages = ref(false)
  const isSending = ref(false)
  const error = ref<string | null>(null)
  const hasMoreMessages = ref(false)
  const nextCursor = ref<string | null>(null)
  const totalUnreadCount = ref(0)

  const loadConversations = async () => {
    if (isLoadingConversations.value) return
    isLoadingConversations.value = true
    error.value = null
    try {
      const data = await $fetch<ConversationSummary[]>("/api/chat/conversations")
      conversations.value = data
    } catch (e: any) {
      error.value = e?.data?.message || "Failed to load conversations"
      conversations.value = []
    } finally {
      isLoadingConversations.value = false
    }
  }

  const openConversation = async (transactionId: string) => {
    error.value = null
    try {
      const data = await $fetch<ConversationDetail>("/api/chat/conversation", {
        method: "POST",
        body: { transactionId },
      })
      activeConversation.value = data
      messages.value = []
      nextCursor.value = null
      hasMoreMessages.value = false
      await loadMessages(data.conversationId)
      await markAsRead(data.conversationId)
    } catch (e: any) {
      error.value = e?.data?.message || "Failed to open conversation"
    }
  }

  const selectConversation = async (conversationId: string) => {
    const conv = conversations.value.find((c) => c.conversationId === conversationId)
    if (!conv) return
    activeConversation.value = {
      conversationId: conv.conversationId,
      transactionId: conv.transactionId,
      isExpired: conv.isExpired,
      item: conv.item,
      otherParticipant: conv.otherParticipant,
    }
    messages.value = []
    nextCursor.value = null
    hasMoreMessages.value = false
    await loadMessages(conversationId)
    await markAsRead(conversationId)
    // Update local unread count
    const c = conversations.value.find((x) => x.conversationId === conversationId)
    if (c) {
      totalUnreadCount.value = Math.max(0, totalUnreadCount.value - c.unreadCount)
      c.unreadCount = 0
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
        // Prepend older messages
        messages.value = [...data.messages, ...messages.value]
      } else {
        messages.value = data.messages
      }
      nextCursor.value = data.nextCursor
      hasMoreMessages.value = data.hasMore
    } catch (e: any) {
      error.value = e?.data?.message || "Failed to load messages"
    } finally {
      isLoadingMessages.value = false
    }
  }

  const loadMoreMessages = async () => {
    if (!activeConversation.value || !hasMoreMessages.value || !nextCursor.value) return
    await loadMessages(activeConversation.value.conversationId, nextCursor.value)
  }

  const sendMessage = async (body: string) => {
    if (!activeConversation.value || isSending.value) return null
    if (!body.trim()) return null

    isSending.value = true
    error.value = null
    try {
      const msg = await $fetch<ChatMessage>("/api/chat/send", {
        method: "POST",
        body: {
          conversationId: activeConversation.value.conversationId,
          body,
        },
      })
      messages.value.push(msg)

      // Update conversation list
      const conv = conversations.value.find(
        (c) => c.conversationId === activeConversation.value?.conversationId,
      )
      if (conv) {
        conv.lastMessage = {
          id: msg.id,
          body: msg.body,
          senderUserId: msg.senderUserId,
          createdAt: msg.createdAt,
          isRead: false,
        }
        // Move to top
        const idx = conversations.value.indexOf(conv)
        if (idx > 0) {
          conversations.value.splice(idx, 1)
          conversations.value.unshift(conv)
        }
      }

      return msg
    } catch (e: any) {
      error.value = e?.data?.message || "Failed to send message"
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
      // Silently ignore read receipt failures
    }
  }

  const loadUnreadCount = async () => {
    try {
      const data = await $fetch<{ unreadCount: number }>("/api/chat/unread-count")
      totalUnreadCount.value = data.unreadCount
    } catch {
      // ignore
    }
  }

  /** Called when a new message arrives via realtime/polling */
  const onIncomingMessage = (msg: ChatMessage) => {
    // If viewing this conversation, append and auto-read
    if (activeConversation.value?.conversationId === msg.conversationId) {
      const exists = messages.value.some((m) => m.id === msg.id)
      if (!exists) {
        messages.value.push(msg)
        markAsRead(msg.conversationId)
      }
    } else {
      // Update unread count
      totalUnreadCount.value += 1
    }

    // Update conversation list
    const conv = conversations.value.find((c) => c.conversationId === msg.conversationId)
    if (conv) {
      conv.lastMessage = {
        id: msg.id,
        body: msg.body,
        senderUserId: msg.senderUserId,
        createdAt: msg.createdAt,
        isRead: activeConversation.value?.conversationId === msg.conversationId,
      }
      if (activeConversation.value?.conversationId !== msg.conversationId) {
        conv.unreadCount += 1
      }
      // Move to top
      const idx = conversations.value.indexOf(conv)
      if (idx > 0) {
        conversations.value.splice(idx, 1)
        conversations.value.unshift(conv)
      }
    } else {
      // New conversation not in list yet — reload
      loadConversations()
    }
  }

  const closeConversation = () => {
    activeConversation.value = null
    messages.value = []
    nextCursor.value = null
    hasMoreMessages.value = false
  }

  const sortedConversations = computed(() =>
    [...conversations.value].sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? ""
      const bTime = b.lastMessage?.createdAt ?? ""
      return bTime.localeCompare(aTime)
    }),
  )

  return {
    conversations,
    sortedConversations,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    error,
    hasMoreMessages,
    totalUnreadCount,
    loadConversations,
    openConversation,
    selectConversation,
    loadMoreMessages,
    sendMessage,
    markAsRead,
    loadUnreadCount,
    onIncomingMessage,
    closeConversation,
  }
}
