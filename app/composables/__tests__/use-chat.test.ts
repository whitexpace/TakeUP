import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import {
  useChat,
  type ChatMessage,
  type ConversationDetail,
  type ConversationSummary,
} from "../use-chat"
import { CHAT_DISPUTE_NOTICE, CHAT_ENDED_NOTICE } from "#shared/chat-rules"

const CONV_ID_1 = "conv-1"
const CONV_ID_2 = "conv-2"
const TX_ID_1 = "tx-1"
const TX_ID_2 = "tx-2"

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const makeConversationSummary = (
  conversationId: string,
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary => ({
  conversationId,
  transactionId: conversationId === CONV_ID_1 ? TX_ID_1 : TX_ID_2,
  closureState: "OPEN",
  isExpired: false,
  closedNotice: null,
  item: { id: `item-${conversationId}`, name: `Item ${conversationId}`, thumbnailImage: null },
  otherParticipant: {
    id: `user-${conversationId}`,
    username: `user-${conversationId}`,
    firstName: "Test",
    lastName: "User",
    avatarUrl: null,
  },
  lastMessage: {
    id: `last-${conversationId}`,
    body: `Last message ${conversationId}`,
    senderUserId: "sender-1",
    createdAt:
      conversationId === CONV_ID_1 ? "2026-04-20T10:00:00.000Z" : "2026-04-20T09:00:00.000Z",
    isRead: false,
  },
  unreadCount: 0,
  ...overrides,
})

const makeConversationDetail = (
  conversationId: string,
  overrides: Partial<ConversationDetail> = {},
): ConversationDetail => ({
  conversationId,
  transactionId: conversationId === CONV_ID_1 ? TX_ID_1 : TX_ID_2,
  closureState: "OPEN",
  isExpired: false,
  closedNotice: null,
  item: { id: `item-${conversationId}`, name: `Item ${conversationId}`, thumbnailImage: null },
  otherParticipant: {
    id: `user-${conversationId}`,
    username: `user-${conversationId}`,
    firstName: "Test",
    lastName: "User",
    avatarUrl: null,
  },
  ...overrides,
})

const makeMessage = (id: string, overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  conversationId: CONV_ID_1,
  senderUserId: "sender-1",
  replyToMessageId: null,
  body: `Message ${id}`,
  imageUrl: null,
  isRead: false,
  readAt: null,
  createdAt: "2026-04-20T10:00:00.000Z",
  replyToMessage: null,
  ...overrides,
})

let fetchMock = vi.fn()
let stateStore: Record<string, unknown> = {}

beforeEach(() => {
  fetchMock = vi.fn()
  stateStore = {}
  vi.stubGlobal("$fetch", fetchMock)
  vi.stubGlobal("useState", (key: string, init?: () => unknown) => {
    if (!stateStore[key]) {
      stateStore[key] = ref(init ? init() : undefined)
    }
    return stateStore[key]
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("useChat", () => {
  it("loads conversations and exposes them in latest-message order", async () => {
    fetchMock.mockResolvedValue([
      makeConversationSummary(CONV_ID_2),
      makeConversationSummary(CONV_ID_1),
    ])

    const chat = useChat()
    await chat.loadConversations()

    expect(fetchMock).toHaveBeenCalledWith("/api/chat")
    expect(chat.conversations.value).toHaveLength(2)
    expect(
      chat.sortedConversations.value.map((conversation) => conversation.conversationId),
    ).toEqual([CONV_ID_1, CONV_ID_2])
  })

  it("refreshes conversations in the background without showing the loading state", async () => {
    let resolveConversations!: (value: ConversationSummary[]) => void
    fetchMock.mockReturnValue(
      new Promise<ConversationSummary[]>((resolve) => {
        resolveConversations = resolve
      }),
    )

    const chat = useChat()
    const pendingRefresh = chat.loadConversations({ background: true })

    expect(chat.isLoadingConversations.value).toBe(false)

    resolveConversations([makeConversationSummary(CONV_ID_1)])
    await pendingRefresh

    expect(chat.conversations.value.map((conversation) => conversation.conversationId)).toEqual([
      CONV_ID_1,
    ])
    expect(chat.isLoadingConversations.value).toBe(false)
  })

  it("keeps the current sidebar conversations when a background refresh fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"))

    const chat = useChat()
    chat.conversations.value = [makeConversationSummary(CONV_ID_1)]

    await chat.loadConversations({ background: true })

    expect(chat.error.value).toBeNull()
    expect(chat.conversations.value.map((conversation) => conversation.conversationId)).toEqual([
      CONV_ID_1,
    ])
  })

  it("opens a conversation, loads the first messages page, and marks it as read", async () => {
    fetchMock
      .mockResolvedValueOnce(makeConversationDetail(CONV_ID_1))
      .mockResolvedValueOnce({
        messages: [makeMessage("msg-1", { senderUserId: "user-conv-1" })],
        nextCursor: "cursor-1",
        hasMore: true,
      })
      .mockResolvedValueOnce(undefined)

    const chat = useChat()
    await chat.openConversation(TX_ID_1)

    expect(chat.activeConversation.value?.conversationId).toBe(CONV_ID_1)
    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-1"])
    expect(chat.hasMoreMessages.value).toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(1, `/api/chat/transactions/${TX_ID_1}`)
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/chat/messages", {
      params: { conversationId: CONV_ID_1 },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/chat/mark-read", {
      method: "POST",
      body: { conversationId: CONV_ID_1 },
    })
  })

  it("opens sidebar conversations from cached summaries without refetching details first", async () => {
    fetchMock
      .mockResolvedValueOnce({
        messages: [makeMessage("msg-1", { senderUserId: "user-conv-1" })],
        nextCursor: null,
        hasMore: false,
      })
      .mockResolvedValueOnce(undefined)

    const chat = useChat()
    chat.conversations.value = [makeConversationSummary(CONV_ID_1)]

    await chat.openConversation(TX_ID_1)
    await flushPromises()

    expect(chat.activeConversation.value?.conversationId).toBe(CONV_ID_1)
    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-1"])
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/chat/messages", {
      params: { conversationId: CONV_ID_1 },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/chat/mark-read", {
      method: "POST",
      body: { conversationId: CONV_ID_1 },
    })

    fetchMock.mockClear()
    await chat.openConversation(TX_ID_1)
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("prefetches recent messages for the first eight inbox conversations first", async () => {
    fetchMock.mockResolvedValue({ messages: [], nextCursor: null, hasMore: false })

    const chat = useChat()
    chat.conversations.value = Array.from({ length: 10 }, (_value, index) =>
      makeConversationSummary(`conv-${index + 1}`),
    )

    chat.prefetchConversationMessagesForInbox({ initialCount: 8 })
    for (let index = 0; index < 30; index += 1) {
      await Promise.resolve()
    }

    expect(fetchMock).toHaveBeenCalledTimes(8)
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/chat/messages", {
      params: { conversationId: "conv-1" },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(8, "/api/chat/messages", {
      params: { conversationId: "conv-8" },
    })
  })

  it("prefetches later inbox conversations by start index", async () => {
    fetchMock.mockResolvedValue({ messages: [], nextCursor: null, hasMore: false })

    const chat = useChat()
    chat.conversations.value = Array.from({ length: 12 }, (_value, index) =>
      makeConversationSummary(`conv-${index + 1}`),
    )

    chat.prefetchConversationMessagesForInbox({ startIndex: 8, initialCount: 4 })
    for (let index = 0; index < 30; index += 1) {
      await Promise.resolve()
    }

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/chat/messages", {
      params: { conversationId: "conv-9" },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/chat/messages", {
      params: { conversationId: "conv-12" },
    })
  })

  it("keeps a stale message load cached when the user switches conversations mid-load", async () => {
    let resolveFirstMessages!: (value: {
      messages: ChatMessage[]
      nextCursor: string | null
      hasMore: boolean
    }) => void

    fetchMock.mockImplementation(
      (url: string, options?: { params?: { conversationId?: string } }) => {
        if (url !== "/api/chat/messages") return Promise.resolve(undefined)

        if (options?.params?.conversationId === CONV_ID_1) {
          return new Promise((resolve) => {
            resolveFirstMessages = resolve
          })
        }

        return Promise.resolve({
          messages: [makeMessage("msg-conv-2", { conversationId: CONV_ID_2 })],
          nextCursor: null,
          hasMore: false,
        })
      },
    )

    const chat = useChat()
    chat.conversations.value = [
      makeConversationSummary(CONV_ID_1),
      makeConversationSummary(CONV_ID_2, { transactionId: TX_ID_2 }),
    ]

    const firstOpen = chat.openConversation(TX_ID_1)
    await flushPromises()

    const secondOpen = chat.openConversation(TX_ID_2)
    await secondOpen

    resolveFirstMessages({
      messages: [makeMessage("msg-conv-1")],
      nextCursor: null,
      hasMore: false,
    })
    await firstOpen

    fetchMock.mockClear()
    await chat.openConversation(TX_ID_1)

    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-conv-1"])
    expect(fetchMock).not.toHaveBeenCalledWith("/api/chat/messages", {
      params: { conversationId: CONV_ID_1 },
    })
  })

  it("loads more messages and prepends older pages", async () => {
    fetchMock
      .mockResolvedValueOnce(makeConversationDetail(CONV_ID_1))
      .mockResolvedValueOnce({
        messages: [
          makeMessage("msg-2", {
            senderUserId: "user-conv-1",
            createdAt: "2026-04-20T10:01:00.000Z",
          }),
        ],
        nextCursor: "cursor-older",
        hasMore: true,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        messages: [makeMessage("msg-1", { createdAt: "2026-04-20T10:00:00.000Z" })],
        nextCursor: null,
        hasMore: false,
      })

    const chat = useChat()
    await chat.openConversation(TX_ID_1)
    await chat.loadMoreMessages()

    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-1", "msg-2"])
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/chat/messages", {
      params: { conversationId: CONV_ID_1, cursor: "cursor-older" },
    })
  })

  it("sends a message with image support and moves the conversation to the top", async () => {
    const sentMessage = makeMessage("msg-sent", {
      conversationId: CONV_ID_2,
      body: "Hello there",
      imageUrl: "https://example.com/chat.jpg",
      createdAt: "2026-04-20T12:00:00.000Z",
    })
    fetchMock.mockResolvedValue(sentMessage)

    const chat = useChat()
    chat.conversations.value = [
      makeConversationSummary(CONV_ID_1),
      makeConversationSummary(CONV_ID_2, { unreadCount: 1, transactionId: TX_ID_2 }),
    ]
    chat.activeConversation.value = makeConversationDetail(CONV_ID_2, { transactionId: TX_ID_2 })

    const result = await chat.sendMessage("Hello there", "https://example.com/chat.jpg")

    expect(result?.id).toBe("msg-sent")
    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-sent"])
    expect(chat.conversations.value[0]?.conversationId).toBe(CONV_ID_2)
    expect(chat.conversations.value[0]?.lastMessage?.body).toBe("Hello there")
    expect(fetchMock).toHaveBeenCalledWith(`/api/chat/conversations/${CONV_ID_2}/messages`, {
      method: "POST",
      body: {
        body: "Hello there",
        imageUrl: "https://example.com/chat.jpg",
        replyToMessageId: null,
      },
    })
  })

  it("sends a reply with optimistic quoted-message metadata", async () => {
    const originalMessage = makeMessage("msg-original", {
      senderUserId: "user-conv-1",
      body: "Original message",
      createdAt: "2026-04-20T11:59:00.000Z",
    })
    const sentMessage = makeMessage("msg-reply", {
      body: "Replying now",
      replyToMessageId: "msg-original",
      replyToMessage: {
        id: "msg-original",
        senderUserId: "user-conv-1",
        body: "Original message",
        imageUrl: null,
        createdAt: "2026-04-20T11:59:00.000Z",
      },
      createdAt: "2026-04-20T12:00:00.000Z",
    })
    fetchMock.mockResolvedValue(sentMessage)

    const chat = useChat()
    chat.conversations.value = [makeConversationSummary(CONV_ID_1)]
    chat.activeConversation.value = makeConversationDetail(CONV_ID_1)
    await chat.mergeActiveConversationMessages([originalMessage])

    const pendingSend = chat.sendMessage("Replying now", null, originalMessage)

    expect(chat.messages.value[1]).toMatchObject({
      body: "Replying now",
      replyToMessageId: "msg-original",
      replyToMessage: {
        id: "msg-original",
        body: "Original message",
      },
      isOptimistic: true,
    })

    await expect(pendingSend).resolves.toMatchObject({ id: "msg-reply" })
    expect(fetchMock).toHaveBeenCalledWith(`/api/chat/conversations/${CONV_ID_1}/messages`, {
      method: "POST",
      body: {
        body: "Replying now",
        imageUrl: null,
        replyToMessageId: "msg-original",
      },
    })
  })

  it("sends an image-only message", async () => {
    const sentMessage = makeMessage("msg-image", {
      conversationId: CONV_ID_1,
      body: "",
      imageUrl: "https://example.com/chat.jpg",
      createdAt: "2026-04-20T12:00:00.000Z",
    })
    fetchMock.mockResolvedValue(sentMessage)

    const chat = useChat()
    chat.conversations.value = [makeConversationSummary(CONV_ID_1)]
    chat.activeConversation.value = makeConversationDetail(CONV_ID_1)

    const result = await chat.sendMessage("", "https://example.com/chat.jpg")

    expect(result?.id).toBe("msg-image")
    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-image"])
    expect(fetchMock).toHaveBeenCalledWith(`/api/chat/conversations/${CONV_ID_1}/messages`, {
      method: "POST",
      body: {
        body: "",
        imageUrl: "https://example.com/chat.jpg",
        replyToMessageId: null,
      },
    })
  })

  it("queues consecutive sends while showing both optimistic messages immediately", async () => {
    vi.useFakeTimers()
    let resolveFirst!: (message: ChatMessage) => void
    let resolveSecond!: (message: ChatMessage) => void
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<ChatMessage>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<ChatMessage>((resolve) => {
            resolveSecond = resolve
          }),
      )

    const chat = useChat()
    chat.conversations.value = [makeConversationSummary(CONV_ID_1)]
    chat.activeConversation.value = makeConversationDetail(CONV_ID_1)

    vi.setSystemTime(new Date("2026-04-20T10:00:00.000Z"))
    const firstSend = chat.sendMessage("First")
    vi.setSystemTime(new Date("2026-04-20T10:00:00.001Z"))
    const secondSend = chat.sendMessage("Second")

    expect(chat.messages.value.map((message) => message.body)).toEqual(["First", "Second"])
    expect(chat.messages.value.every((message) => message.isOptimistic)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenNthCalledWith(1, `/api/chat/conversations/${CONV_ID_1}/messages`, {
      method: "POST",
      body: {
        body: "First",
        imageUrl: null,
        replyToMessageId: null,
      },
    })

    resolveFirst(makeMessage("msg-first", { body: "First", createdAt: "2099-04-20T10:00:00.000Z" }))
    await flushPromises()

    expect(chat.messages.value.map((message) => message.body)).toEqual(["First", "Second"])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(2, `/api/chat/conversations/${CONV_ID_1}/messages`, {
      method: "POST",
      body: {
        body: "Second",
        imageUrl: null,
        replyToMessageId: null,
      },
    })

    resolveSecond(
      makeMessage("msg-second", {
        body: "Second",
        createdAt: "2100-04-20T10:01:00.000Z",
      }),
    )

    await expect(firstSend).resolves.toMatchObject({ id: "msg-first" })
    await expect(secondSend).resolves.toMatchObject({ id: "msg-second" })
    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-first", "msg-second"])
    expect(chat.messages.value.some((message) => message.isOptimistic)).toBe(false)
  })

  it("replaces a pending optimistic message when realtime echoes the saved row first", async () => {
    let resolveSend!: (message: ChatMessage) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<ChatMessage>((resolve) => {
          resolveSend = resolve
        }),
    )

    const chat = useChat()
    chat.conversations.value = [makeConversationSummary(CONV_ID_1)]
    chat.activeConversation.value = makeConversationDetail(CONV_ID_1)

    const send = chat.sendMessage("Profanity-free message")
    const savedMessage = makeMessage("msg-saved", { body: "Profanity-free message" })

    chat.onActiveRealtimeMessage(savedMessage, "INSERT")

    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-saved"])
    expect(chat.messages.value[0]?.isOptimistic).toBeUndefined()

    resolveSend(savedMessage)

    await expect(send).resolves.toMatchObject({ id: "msg-saved" })
    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-saved"])
  })

  it("merges polling receipt updates into the active conversation", async () => {
    fetchMock
      .mockResolvedValueOnce(makeConversationDetail(CONV_ID_1))
      .mockResolvedValueOnce({
        messages: [makeMessage("msg-1", { senderUserId: "user-conv-1" })],
        nextCursor: null,
        hasMore: false,
      })
      .mockResolvedValueOnce({ markedCount: 0 })
      .mockResolvedValueOnce({ markedCount: 0 })

    const chat = useChat()
    await chat.openConversationById(CONV_ID_1)
    await chat.mergeActiveConversationMessages([
      makeMessage("msg-1", {
        senderUserId: "user-conv-1",
        isRead: true,
        readAt: "2026-04-20T10:05:00.000Z",
      }),
    ])

    expect(chat.messages.value[0]?.isRead).toBe(true)
    expect(chat.messages.value[0]?.readAt).toBe("2026-04-20T10:05:00.000Z")
  })

  it("submits a persisted chat report for the active conversation", async () => {
    fetchMock
      .mockResolvedValueOnce(makeConversationDetail(CONV_ID_1))
      .mockResolvedValueOnce({ messages: [], nextCursor: null, hasMore: false })
      .mockResolvedValueOnce({
        id: "report-1",
        transactionId: TX_ID_1,
        reason: "INAPPROPRIATE_CHAT",
        status: "SUBMITTED",
        description: "Threatening language",
        createdAt: "2026-04-20T12:00:00.000Z",
      })

    const chat = useChat()
    await chat.openConversationById(CONV_ID_1)
    await chat.reportConversation("Threatening language")

    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/chat/report", {
      method: "POST",
      body: {
        conversationId: CONV_ID_1,
        description: "Threatening language",
      },
    })
    expect(chat.activeConversation.value?.closureState).toBe("IN_DISPUTE")
    expect(chat.activeConversation.value?.isExpired).toBe(true)
    expect(chat.activeConversation.value?.closedNotice).toBe(CHAT_DISPUTE_NOTICE)
  })

  it("updates local closure state when the server rejects sending to a completed chat", async () => {
    fetchMock.mockRejectedValueOnce({ data: { message: CHAT_ENDED_NOTICE } })

    const chat = useChat()
    chat.conversations.value = [makeConversationSummary(CONV_ID_1)]
    chat.activeConversation.value = makeConversationDetail(CONV_ID_1)

    const result = await chat.sendMessage("Hello there")

    expect(result).toBeNull()
    expect(chat.activeConversation.value?.closureState).toBe("ENDED")
    expect(chat.activeConversation.value?.isExpired).toBe(true)
    expect(chat.conversations.value[0]?.closedNotice).toBe(CHAT_ENDED_NOTICE)
  })

  it("handles incoming messages for active and background conversations", async () => {
    fetchMock.mockResolvedValue(undefined)

    const chat = useChat()
    chat.totalUnreadCount.value = 1
    chat.conversations.value = [
      makeConversationSummary(CONV_ID_1),
      makeConversationSummary(CONV_ID_2, {
        unreadCount: 2,
        lastMessage: {
          id: "old-last",
          body: "Old",
          senderUserId: "sender-2",
          createdAt: "2026-04-20T08:00:00.000Z",
          isRead: false,
        },
      }),
    ]
    chat.activeConversation.value = makeConversationDetail(CONV_ID_1)
    await chat.mergeActiveConversationMessages([makeMessage("existing")])

    chat.onIncomingMessage(
      makeMessage("incoming-1", {
        conversationId: CONV_ID_1,
        senderUserId: "user-conv-1",
      }),
    )
    chat.onIncomingMessage(
      makeMessage("incoming-1", {
        conversationId: CONV_ID_1,
        senderUserId: "user-conv-1",
      }),
    )
    chat.onIncomingMessage(
      makeMessage("incoming-2", {
        conversationId: CONV_ID_2,
        senderUserId: "user-conv-2",
        createdAt: "2026-04-20T13:00:00.000Z",
      }),
    )
    await flushPromises()

    expect(chat.messages.value.map((message) => message.id)).toEqual(["existing", "incoming-1"])
    expect(chat.totalUnreadCount.value).toBe(2)
    expect(chat.conversations.value[0]?.conversationId).toBe(CONV_ID_2)
    expect(chat.conversations.value[0]?.unreadCount).toBe(3)
    expect(fetchMock).toHaveBeenCalledWith("/api/chat/mark-read", {
      method: "POST",
      body: { conversationId: CONV_ID_1 },
    })
  })

  it("does not count realtime echoes from the current user as unread", async () => {
    fetchMock.mockResolvedValue(undefined)

    const chat = useChat()
    chat.totalUnreadCount.value = 1
    chat.conversations.value = [
      makeConversationSummary(CONV_ID_2, {
        unreadCount: 2,
        lastMessage: {
          id: "old-last",
          body: "Old",
          senderUserId: "user-conv-2",
          createdAt: "2026-04-20T08:00:00.000Z",
          isRead: false,
        },
      }),
    ]

    chat.onIncomingMessage(
      makeMessage("own-message", {
        conversationId: CONV_ID_2,
        senderUserId: "current-user",
        createdAt: "2026-04-20T13:00:00.000Z",
      }),
    )
    await flushPromises()

    expect(chat.totalUnreadCount.value).toBe(1)
    expect(chat.conversations.value[0]?.unreadCount).toBe(2)
    expect(chat.conversations.value[0]?.lastMessage?.id).toBe("own-message")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
