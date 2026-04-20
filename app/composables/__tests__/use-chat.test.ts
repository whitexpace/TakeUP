import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  useChat,
  type ChatMessage,
  type ConversationDetail,
  type ConversationSummary,
} from "../use-chat"

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
  body: `Message ${id}`,
  isRead: false,
  readAt: null,
  createdAt: "2026-04-20T10:00:00.000Z",
  ...overrides,
})

let fetchMock = vi.fn()

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("$fetch", fetchMock)
})

afterEach(() => {
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

  it("opens a conversation, loads the first messages page, and marks it as read", async () => {
    fetchMock
      .mockResolvedValueOnce(makeConversationDetail(CONV_ID_1))
      .mockResolvedValueOnce({
        messages: [makeMessage("msg-1")],
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

  it("selects an existing conversation, loads messages, and clears local unread counters", async () => {
    fetchMock
      .mockResolvedValueOnce(makeConversationDetail(CONV_ID_2, { transactionId: TX_ID_2 }))
      .mockResolvedValueOnce({
        messages: [makeMessage("msg-1", { conversationId: CONV_ID_2 })],
        nextCursor: null,
        hasMore: false,
      })
      .mockResolvedValueOnce(undefined)

    const chat = useChat()
    chat.totalUnreadCount.value = 5
    chat.conversations.value = [
      makeConversationSummary(CONV_ID_2, { unreadCount: 2, transactionId: TX_ID_2 }),
    ]

    await chat.selectConversation(CONV_ID_2)

    expect(chat.activeConversation.value?.conversationId).toBe(CONV_ID_2)
    expect(chat.totalUnreadCount.value).toBe(3)
    expect(chat.conversations.value[0]?.unreadCount).toBe(0)
    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-1"])
    expect(fetchMock).toHaveBeenNthCalledWith(1, `/api/chat/conversations/${CONV_ID_2}`)
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/chat/messages", {
      params: { conversationId: CONV_ID_2 },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/chat/mark-read", {
      method: "POST",
      body: { conversationId: CONV_ID_2 },
    })
  })

  it("loads more messages and prepends older pages", async () => {
    fetchMock
      .mockResolvedValueOnce(makeConversationDetail(CONV_ID_1))
      .mockResolvedValueOnce({
        messages: [makeMessage("msg-2", { createdAt: "2026-04-20T10:01:00.000Z" })],
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

  it("sends a message, updates the active thread, and moves the conversation to the top", async () => {
    const sentMessage = makeMessage("msg-sent", {
      conversationId: CONV_ID_2,
      body: "Hello there",
      createdAt: "2026-04-20T12:00:00.000Z",
    })
    fetchMock.mockResolvedValue(sentMessage)

    const chat = useChat()
    chat.conversations.value = [
      makeConversationSummary(CONV_ID_1),
      makeConversationSummary(CONV_ID_2, { unreadCount: 1, transactionId: TX_ID_2 }),
    ]
    chat.activeConversation.value = makeConversationDetail(CONV_ID_2, { transactionId: TX_ID_2 })

    const result = await chat.sendMessage("Hello there")

    expect(result?.id).toBe("msg-sent")
    expect(chat.messages.value.map((message) => message.id)).toEqual(["msg-sent"])
    expect(chat.conversations.value[0]?.conversationId).toBe(CONV_ID_2)
    expect(chat.conversations.value[0]?.lastMessage?.body).toBe("Hello there")
  })

  it("ignores blank messages and surfaces send failures", async () => {
    const chat = useChat()
    chat.activeConversation.value = makeConversationDetail(CONV_ID_1)

    expect(await chat.sendMessage("   ")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockRejectedValueOnce(new Error("Send failed"))
    expect(await chat.sendMessage("Hi")).toBeNull()
    expect(chat.error.value).toBe("Send failed")
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
    chat.messages.value = [makeMessage("existing")]

    chat.onIncomingMessage(makeMessage("incoming-1", { conversationId: CONV_ID_1 }))
    chat.onIncomingMessage(makeMessage("incoming-1", { conversationId: CONV_ID_1 }))
    chat.onIncomingMessage(
      makeMessage("incoming-2", {
        conversationId: CONV_ID_2,
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
})
