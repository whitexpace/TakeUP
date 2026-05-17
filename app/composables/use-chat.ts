import { computed } from "vue"
import { mergeChatMessages } from "../utils/chat-message-utils"
import {
  getChatClosedNotice,
  getChatClosureStateFromNotice,
  isChatClosed,
  type ChatClosureState,
} from "#shared/chat-rules"

export type ChatMessage = {
  id: string
  conversationId: string
  senderUserId: string
  body: string
  imageUrl: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
  isOptimistic?: boolean
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
  closureState: ChatClosureState
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

export type ChatConversationReport = {
  id: string
  transactionId: string
  reason: string
  status: string
  description: string | null
  createdAt: string
}

type FetchErrorData = {
  data?: {
    message?: string
  }
}

type LoadConversationsOptions = {
  background?: boolean
}

type LoadMessagesOptions = {
  expectedOpenRequestId?: number
  background?: boolean
  force?: boolean
}

type PrefetchConversationsOptions = {
  initialCount?: number
}

type MessagePageState = {
  nextCursor: string | null
  hasMore: boolean
}

type RealtimeMessageEvent = "INSERT" | "UPDATE"

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

const getConversationDetailFromSummary = (
  conversation: ConversationSummary,
): ConversationDetail => ({
  conversationId: conversation.conversationId,
  transactionId: conversation.transactionId,
  closureState: conversation.closureState,
  isExpired: conversation.isExpired,
  closedNotice: conversation.closedNotice,
  item: conversation.item,
  otherParticipant: conversation.otherParticipant,
})

const createOptimisticMessageId = () =>
  `temp-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`

export const useChat = () => {
  const conversations = useState<ConversationSummary[]>("chat-conversations", () => [])
  const activeConversation = useState<ConversationDetail | null>(
    "chat-active-conversation",
    () => null,
  )
  const messages = useState<ChatMessage[]>("chat-messages", () => [])
  const messageCache = useState<Record<string, ChatMessage[]>>("chat-message-cache", () => ({}))
  const messagePageState = useState<Record<string, MessagePageState>>(
    "chat-message-page-state",
    () => ({}),
  )
  const isLoadingConversations = useState("chat-loading-conv", () => false)
  const isRefreshingConversations = useState("chat-refreshing-conv", () => false)
  const isLoadingMessages = useState("chat-loading-msg", () => false)
  const isOpeningConversation = useState("chat-opening", () => false)
  const isSending = useState("chat-sending", () => false)
  const isReporting = useState("chat-reporting", () => false)
  const error = useState<string | null>("chat-error", () => null)
  const hasMoreMessages = useState("chat-has-more", () => false)
  const nextCursor = useState<string | null>("chat-next-cursor", () => null)
  const totalUnreadCount = useState("chat-unread-count", () => 0)
  const openRequestId = useState("chat-open-request-id", () => 0)
  const processedRealtimeInsertIds = useState<string[]>("chat-processed-realtime-inserts", () => [])
  const readSyncInFlight = useState<Record<string, boolean>>("chat-read-sync-in-flight", () => ({}))
  const prefetchInFlight = useState<Record<string, boolean>>("chat-prefetch-in-flight", () => ({}))
  const messageLoadInFlight = useState<Record<string, boolean>>(
    "chat-message-load-in-flight",
    () => ({}),
  )

  const getCachedMessages = (conversationId: string) => messageCache.value[conversationId] ?? []
  const hasLoadedMessagePage = (conversationId: string) =>
    Boolean(messagePageState.value[conversationId])

  const setCachedMessages = (
    conversationId: string,
    nextMessages: ChatMessage[],
    pageState?: MessagePageState,
  ) => {
    messageCache.value = {
      ...messageCache.value,
      [conversationId]: nextMessages,
    }

    if (pageState) {
      messagePageState.value = {
        ...messagePageState.value,
        [conversationId]: pageState,
      }
    }

    if (activeConversation.value?.conversationId === conversationId) {
      messages.value = nextMessages
      const nextPageState = pageState ?? messagePageState.value[conversationId]
      nextCursor.value = nextPageState?.nextCursor ?? null
      hasMoreMessages.value = nextPageState?.hasMore ?? false
    }
  }

  const mergeCachedMessages = (conversationId: string, incoming: ChatMessage[]) => {
    const merged = mergeChatMessages(getCachedMessages(conversationId), incoming)
    setCachedMessages(conversationId, merged)
    return merged
  }

  const replaceOptimisticMessage = (
    conversationId: string,
    optimisticId: string,
    savedMessage: ChatMessage,
  ) => {
    const withoutOptimistic = getCachedMessages(conversationId).filter(
      (message) => message.id !== optimisticId,
    )
    const merged = mergeChatMessages(withoutOptimistic, [savedMessage])
    setCachedMessages(conversationId, merged)
  }

  const removeCachedMessage = (conversationId: string, messageId: string) => {
    setCachedMessages(
      conversationId,
      getCachedMessages(conversationId).filter((message) => message.id !== messageId),
    )
  }

  const hasProcessedRealtimeInsert = (messageId: string) => {
    if (processedRealtimeInsertIds.value.includes(messageId)) {
      return true
    }

    processedRealtimeInsertIds.value = [...processedRealtimeInsertIds.value, messageId].slice(-200)
    return false
  }

  const clearPrefetchInFlight = (conversationId: string) => {
    prefetchInFlight.value = Object.fromEntries(
      Object.entries(prefetchInFlight.value).filter(([key]) => key !== conversationId),
    )
  }

  const clearMessageLoadInFlight = (loadKey: string) => {
    messageLoadInFlight.value = Object.fromEntries(
      Object.entries(messageLoadInFlight.value).filter(([key]) => key !== loadKey),
    )
  }

  const updateConversationClosureState = (
    conversationId: string,
    closureState: ChatClosureState,
    overrideNotice?: string | null,
  ) => {
    const isExpired = isChatClosed(closureState)
    const closedNotice = overrideNotice ?? getChatClosedNotice(closureState)

    if (activeConversation.value?.conversationId === conversationId) {
      activeConversation.value = {
        ...activeConversation.value,
        closureState,
        isExpired,
        closedNotice,
      }
    }

    const conversation = conversations.value.find(
      (entry) => entry.conversationId === conversationId,
    )
    if (conversation) {
      conversation.closureState = closureState
      conversation.isExpired = isExpired
      conversation.closedNotice = closedNotice
    }
  }

  const updateConversationFromMessage = (message: ChatMessage, markUnread: boolean) => {
    const conversation = conversations.value.find(
      (entry) => entry.conversationId === message.conversationId,
    )

    if (!conversation) {
      void loadConversations({ background: true })
      return
    }

    const shouldReplaceLastMessage =
      !conversation.lastMessage ||
      conversation.lastMessage.id === message.id ||
      new Date(message.createdAt).getTime() >=
        new Date(conversation.lastMessage.createdAt).getTime()

    if (shouldReplaceLastMessage) {
      conversation.lastMessage = {
        id: message.id,
        body: message.body,
        senderUserId: message.senderUserId,
        createdAt: message.createdAt,
        isRead: message.isRead,
      }
    }

    if (markUnread) {
      conversation.unreadCount += 1
    }

    const index = conversations.value.indexOf(conversation)
    if (index > 0) {
      conversations.value.splice(index, 1)
      conversations.value.unshift(conversation)
    }
  }

  const syncLocalReadState = async (conversationId: string) => {
    const conversation = conversations.value.find(
      (entry) => entry.conversationId === conversationId,
    )
    const otherParticipantId =
      activeConversation.value?.conversationId === conversationId
        ? activeConversation.value.otherParticipant?.id
        : conversation?.otherParticipant?.id
    const hasUnreadIncomingMessages =
      otherParticipantId &&
      getCachedMessages(conversationId).some(
        (message) => message.senderUserId === otherParticipantId && !message.isRead,
      )
    const hasSidebarUnread = (conversation?.unreadCount ?? 0) > 0

    if (!hasUnreadIncomingMessages && !hasSidebarUnread) {
      return
    }

    if (readSyncInFlight.value[conversationId]) {
      return
    }

    readSyncInFlight.value = { ...readSyncInFlight.value, [conversationId]: true }

    try {
      await markAsRead(conversationId)
    } finally {
      readSyncInFlight.value = Object.fromEntries(
        Object.entries(readSyncInFlight.value).filter(([key]) => key !== conversationId),
      )
    }

    if (conversation) {
      totalUnreadCount.value = Math.max(0, totalUnreadCount.value - conversation.unreadCount)
      conversation.unreadCount = 0
    }

    if (otherParticipantId) {
      const readAt = new Date().toISOString()
      const readMessages = getCachedMessages(conversationId).map((message) =>
        message.senderUserId === otherParticipantId && !message.isRead
          ? { ...message, isRead: true, readAt: message.readAt ?? readAt }
          : message,
      )
      setCachedMessages(conversationId, readMessages)
    }
  }

  const mergeActiveConversationMessages = async (incoming: ChatMessage[]) => {
    if (!activeConversation.value || incoming.length === 0) {
      return
    }

    const conversationId = activeConversation.value.conversationId
    const knownIds = new Set(getCachedMessages(conversationId).map((message) => message.id))
    mergeCachedMessages(conversationId, incoming)

    for (const message of incoming) {
      updateConversationFromMessage(message, false)
    }

    const hasNewIncomingMessage = incoming.some((message) => !knownIds.has(message.id))
    if (hasNewIncomingMessage) {
      await syncLocalReadState(conversationId)
    }
  }

  const loadConversations = async (options: LoadConversationsOptions = {}) => {
    const isBackgroundRefresh = options.background === true
    if (isLoadingConversations.value || isRefreshingConversations.value) return

    if (isBackgroundRefresh) {
      isRefreshingConversations.value = true
    } else {
      isLoadingConversations.value = true
      error.value = null
    }

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
            closureState: matchingConversation.closureState,
            isExpired: matchingConversation.isExpired,
            closedNotice: matchingConversation.closedNotice,
            item: matchingConversation.item,
            otherParticipant: matchingConversation.otherParticipant,
          }
        }
      }
    } catch (e: unknown) {
      if (!isBackgroundRefresh) {
        error.value = getErrorMessage(e, "Failed to load conversations")
        conversations.value = []
      }
    } finally {
      if (isBackgroundRefresh) {
        isRefreshingConversations.value = false
      } else {
        isLoadingConversations.value = false
      }
    }
  }

  const loadMessages = async (
    conversationId: string,
    cursor?: string,
    options: LoadMessagesOptions = {},
  ) => {
    const shouldApplyResult = () =>
      options.expectedOpenRequestId === undefined ||
      options.expectedOpenRequestId === openRequestId.value

    if (!cursor && !options.force && hasLoadedMessagePage(conversationId)) {
      return
    }

    const loadKey = `${conversationId}:${cursor ?? "latest"}`
    if (messageLoadInFlight.value[loadKey]) {
      return
    }

    messageLoadInFlight.value = { ...messageLoadInFlight.value, [loadKey]: true }

    if (!options.background) {
      isLoadingMessages.value = true
    }

    try {
      const params: Record<string, string> = { conversationId }
      if (cursor) params.cursor = cursor

      const data = await $fetch<{
        messages: ChatMessage[]
        nextCursor: string | null
        hasMore: boolean
      }>("/api/chat/messages", { params })

      if (!shouldApplyResult()) return

      const pageState = {
        nextCursor: data.nextCursor,
        hasMore: data.hasMore,
      }

      if (cursor) {
        setCachedMessages(
          conversationId,
          mergeChatMessages(data.messages, getCachedMessages(conversationId)),
          pageState,
        )
      } else {
        const existingMessages = getCachedMessages(conversationId)
        setCachedMessages(
          conversationId,
          existingMessages.length > 0
            ? mergeChatMessages(existingMessages, data.messages)
            : data.messages,
          pageState,
        )
      }
    } catch (err: unknown) {
      if (shouldApplyResult() && !options.background) {
        error.value = getErrorMessage(err, "Failed to load messages.")
      }
    } finally {
      clearMessageLoadInFlight(loadKey)

      if (shouldApplyResult() && !options.background) {
        isLoadingMessages.value = false
      }
    }
  }

  const openConversation = async (transactionId: string) => {
    if (!transactionId) return

    const requestId = openRequestId.value + 1
    openRequestId.value = requestId
    isOpeningConversation.value = true
    error.value = null

    try {
      const cachedConversation = conversations.value.find(
        (conversation) => conversation.transactionId === transactionId,
      )

      if (cachedConversation) {
        const cachedMessages = getCachedMessages(cachedConversation.conversationId)
        activeConversation.value = getConversationDetailFromSummary(cachedConversation)
        if (cachedMessages.length > 0) {
          setCachedMessages(cachedConversation.conversationId, cachedMessages)
        } else {
          resetConversationState(messages, nextCursor, hasMoreMessages)
        }

        await loadMessages(cachedConversation.conversationId, undefined, {
          expectedOpenRequestId: requestId,
          background: cachedMessages.length > 0,
        })
        if (requestId !== openRequestId.value) return

        void syncLocalReadState(cachedConversation.conversationId)
        return
      }

      activeConversation.value = null
      resetConversationState(messages, nextCursor, hasMoreMessages)

      const data = await $fetch<ConversationDetail>(
        `/api/chat/transactions/${encodeURIComponent(transactionId)}`,
      )
      if (requestId !== openRequestId.value) return

      const cachedMessages = getCachedMessages(data.conversationId)
      activeConversation.value = data
      if (cachedMessages.length > 0) {
        setCachedMessages(data.conversationId, cachedMessages)
      }

      await loadMessages(data.conversationId, undefined, {
        expectedOpenRequestId: requestId,
        background: cachedMessages.length > 0,
      })
      if (requestId !== openRequestId.value) return

      void syncLocalReadState(data.conversationId)
    } catch (err: unknown) {
      if (requestId !== openRequestId.value) return
      activeConversation.value = null
      resetConversationState(messages, nextCursor, hasMoreMessages)
      error.value = getErrorMessage(err, "Failed to open conversation.")
    } finally {
      if (requestId === openRequestId.value) {
        isOpeningConversation.value = false
      }
    }
  }

  const openConversationById = async (conversationId: string) => {
    if (!conversationId) return

    const requestId = openRequestId.value + 1
    openRequestId.value = requestId
    isOpeningConversation.value = true
    error.value = null

    try {
      const cachedConversation = conversations.value.find(
        (conversation) => conversation.conversationId === conversationId,
      )
      if (cachedConversation) {
        const cachedMessages = getCachedMessages(conversationId)
        activeConversation.value = getConversationDetailFromSummary(cachedConversation)
        if (cachedMessages.length > 0) {
          setCachedMessages(conversationId, cachedMessages)
        } else {
          resetConversationState(messages, nextCursor, hasMoreMessages)
        }
      } else {
        activeConversation.value = null
        resetConversationState(messages, nextCursor, hasMoreMessages)
      }

      const data = await $fetch<ConversationDetail>(
        `/api/chat/conversations/${encodeURIComponent(conversationId)}`,
      )
      if (requestId !== openRequestId.value) return

      const cachedMessages = getCachedMessages(data.conversationId)
      activeConversation.value = data
      await loadMessages(data.conversationId, undefined, {
        expectedOpenRequestId: requestId,
        background: cachedMessages.length > 0,
      })
      if (requestId !== openRequestId.value) return

      void syncLocalReadState(data.conversationId)
    } catch (err: unknown) {
      if (requestId !== openRequestId.value) return
      error.value = getErrorMessage(err, "Failed to open conversation.")
    } finally {
      if (requestId === openRequestId.value) {
        isOpeningConversation.value = false
      }
    }
  }

  const selectConversation = async (conversationId: string) => {
    await openConversationById(conversationId)
  }

  const prefetchConversationMessages = async (conversationId: string) => {
    if (
      !conversationId ||
      hasLoadedMessagePage(conversationId) ||
      prefetchInFlight.value[conversationId]
    ) {
      return
    }

    prefetchInFlight.value = { ...prefetchInFlight.value, [conversationId]: true }

    try {
      await loadMessages(conversationId, undefined, { background: true })
    } finally {
      clearPrefetchInFlight(conversationId)
    }
  }

  const prefetchConversationMessagesForInbox = (options: PrefetchConversationsOptions = {}) => {
    const initialCount = options.initialCount ?? 8
    const conversationIds = sortedConversations.value.map(
      (conversation) => conversation.conversationId,
    )
    const priorityConversationIds = conversationIds.slice(0, initialCount)

    void Promise.allSettled(
      priorityConversationIds.map((conversationId) => prefetchConversationMessages(conversationId)),
    )
  }

  const loadMoreMessages = async () => {
    if (!activeConversation.value || !hasMoreMessages.value || !nextCursor.value) return
    await loadMessages(activeConversation.value.conversationId, nextCursor.value)
  }

  const sendMessage = async (body: string, imageUrl?: string | null) => {
    if (!activeConversation.value || isSending.value || activeConversation.value.isExpired) {
      return null
    }

    if (!body.trim() && !imageUrl) return null

    isSending.value = true
    error.value = null
    const conversationId = activeConversation.value.conversationId
    const optimisticMessage: ChatMessage = {
      id: createOptimisticMessageId(),
      conversationId,
      senderUserId: "local-user",
      body,
      imageUrl: imageUrl ?? null,
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    }

    mergeCachedMessages(conversationId, [optimisticMessage])
    updateConversationFromMessage(optimisticMessage, false)

    try {
      const message = await $fetch<ChatMessage>(
        `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          body: {
            body,
            imageUrl: imageUrl ?? null,
          },
        },
      )

      replaceOptimisticMessage(conversationId, optimisticMessage.id, message)
      updateConversationFromMessage(message, false)
      return message
    } catch (e: unknown) {
      removeCachedMessage(conversationId, optimisticMessage.id)
      const message = getErrorMessage(e, "Failed to send message")
      error.value = message

      if (activeConversation.value) {
        const closureState = getChatClosureStateFromNotice(message)

        if (closureState) {
          updateConversationClosureState(
            activeConversation.value.conversationId,
            closureState,
            message,
          )
        } else if (message.toLowerCase().includes("read-only")) {
          updateConversationClosureState(
            activeConversation.value.conversationId,
            activeConversation.value.closureState,
            message,
          )
        }
      }

      return null
    } finally {
      isSending.value = false
    }
  }

  const reportConversation = async (description?: string) => {
    if (!activeConversation.value || isReporting.value) {
      return null
    }

    isReporting.value = true
    error.value = null

    try {
      const report = await $fetch<ChatConversationReport>("/api/chat/report", {
        method: "POST",
        body: {
          conversationId: activeConversation.value.conversationId,
          description: description?.trim() || undefined,
        },
      })

      updateConversationClosureState(activeConversation.value.conversationId, "IN_DISPUTE")
      return report
    } catch (err: unknown) {
      error.value = getErrorMessage(err, "Failed to submit report.")
      return null
    } finally {
      isReporting.value = false
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

  const isMessageFromOtherParticipant = (message: ChatMessage) => {
    const isActiveConversation = activeConversation.value?.conversationId === message.conversationId
    const conversation = isActiveConversation
      ? activeConversation.value
      : conversations.value.find((entry) => entry.conversationId === message.conversationId)

    return conversation?.otherParticipant?.id === message.senderUserId
  }

  const onActiveRealtimeMessage = (message: ChatMessage, eventType: RealtimeMessageEvent) => {
    if (activeConversation.value?.conversationId !== message.conversationId) {
      return
    }

    const alreadyKnown = getCachedMessages(message.conversationId).some(
      (entry) => entry.id === message.id,
    )
    mergeCachedMessages(message.conversationId, [message])
    updateConversationFromMessage(message, false)

    if (eventType === "INSERT" && !alreadyKnown && isMessageFromOtherParticipant(message)) {
      void syncLocalReadState(message.conversationId)
    }
  }

  const onInboxRealtimeMessage = (message: ChatMessage, eventType: RealtimeMessageEvent) => {
    if (activeConversation.value?.conversationId === message.conversationId) {
      return
    }

    const conversation = conversations.value.find(
      (entry) => entry.conversationId === message.conversationId,
    )

    if (!conversation) {
      void loadConversations({ background: true })
      void loadUnreadCount()
      return
    }

    const cachedMessages = getCachedMessages(message.conversationId)
    const alreadyKnown =
      cachedMessages.some((entry) => entry.id === message.id) ||
      conversation.lastMessage?.id === message.id ||
      (eventType === "INSERT" && hasProcessedRealtimeInsert(message.id))

    if (cachedMessages.length > 0) {
      mergeCachedMessages(message.conversationId, [message])
    }

    const isUnreadIncomingInsert =
      eventType === "INSERT" && !alreadyKnown && isMessageFromOtherParticipant(message)

    updateConversationFromMessage(message, isUnreadIncomingInsert)

    if (isUnreadIncomingInsert) {
      totalUnreadCount.value += 1
      return
    }
  }

  const onIncomingMessage = (message: ChatMessage) => {
    const isActiveConversation = activeConversation.value?.conversationId === message.conversationId
    const alreadyKnown = getCachedMessages(message.conversationId).some(
      (entry) => entry.id === message.id,
    )
    const isFromOtherParticipant = isMessageFromOtherParticipant(message)

    if (isActiveConversation) {
      mergeCachedMessages(message.conversationId, [message])
      if (!alreadyKnown && isFromOtherParticipant) {
        void syncLocalReadState(message.conversationId)
      }
    } else if (!alreadyKnown && isFromOtherParticipant) {
      totalUnreadCount.value += 1
    }

    updateConversationFromMessage(
      message,
      !isActiveConversation && !alreadyKnown && isFromOtherParticipant,
    )
  }

  const closeConversation = () => {
    openRequestId.value += 1
    isOpeningConversation.value = false
    isLoadingMessages.value = false
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
    isReporting,
    error,
    hasMoreMessages,
    totalUnreadCount,
    loadConversations,
    openConversation,
    openConversationById,
    selectConversation,
    prefetchConversationMessagesForInbox,
    loadMoreMessages,
    sendMessage,
    reportConversation,
    markAsRead,
    loadUnreadCount,
    onIncomingMessage,
    onActiveRealtimeMessage,
    onInboxRealtimeMessage,
    mergeActiveConversationMessages,
    closeConversation,
  }
}
