import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const conversationSummary = {
  conversationId: "conv-1",
  transactionId: "tx-1",
  isExpired: false,
  closedNotice: null,
  item: { id: "item-1", name: "Camera", thumbnailImage: null },
  otherParticipant: {
    id: "user-2",
    username: "other",
    firstName: "Other",
    lastName: "User",
    avatarUrl: null,
  },
  lastMessage: {
    id: "message-1",
    body: "Hello",
    senderUserId: "user-2",
    createdAt: "2026-04-20T10:00:00.000Z",
    isRead: false,
  },
  unreadCount: 2,
}

const conversationDetail = {
  conversationId: "conv-1",
  transactionId: "tx-1",
  isExpired: false,
  closedNotice: null,
  item: { id: "item-1", name: "Camera", thumbnailImage: null },
  otherParticipant: {
    id: "user-2",
    username: "other",
    firstName: "Other",
    lastName: "User",
    avatarUrl: null,
  },
}

const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "message-1",
  conversationId: "conv-1",
  senderUserId: "user-1",
  body: "Hello",
  imageUrl: null,
  isRead: false,
  readAt: null,
  createdAt: "2026-04-20T10:00:00.000Z",
  ...overrides,
})

describe("useChat", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("merges polling receipt updates into the active conversation", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn((url: string) => {
        if (url === "/api/chat/conversations/conv-1") {
          return Promise.resolve(conversationDetail)
        }
        if (url === "/api/chat/messages") {
          return Promise.resolve({
            messages: [makeMessage()],
            nextCursor: null,
            hasMore: false,
          })
        }
        if (url === "/api/chat/mark-read") {
          return Promise.resolve({ markedCount: 0 })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    const { useChat } = await import("../use-chat")
    const chat = useChat()

    await chat.openConversationById("conv-1")
    await chat.mergeActiveConversationMessages([
      makeMessage({ isRead: true, readAt: "2026-04-20T10:05:00.000Z" }),
    ])

    expect(chat.messages.value[0]?.isRead).toBe(true)
    expect(chat.messages.value[0]?.readAt).toBe("2026-04-20T10:05:00.000Z")
  })

  it("resets local unread count after opening a conversation", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn((url: string) => {
        if (url === "/api/chat") {
          return Promise.resolve([structuredClone(conversationSummary)])
        }
        if (url === "/api/chat/conversations/conv-1") {
          return Promise.resolve(conversationDetail)
        }
        if (url === "/api/chat/messages") {
          return Promise.resolve({
            messages: [makeMessage({ senderUserId: "user-2" })],
            nextCursor: null,
            hasMore: false,
          })
        }
        if (url === "/api/chat/mark-read") {
          return Promise.resolve({ markedCount: 1 })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )

    const { useChat } = await import("../use-chat")
    const chat = useChat()

    await chat.loadConversations()
    await chat.openConversationById("conv-1")

    expect(chat.conversations.value[0]?.unreadCount).toBe(0)
  })

  it("sends messages through the conversation message endpoint with image support", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/chat/conversations/conv-1") {
        return Promise.resolve(conversationDetail)
      }
      if (url === "/api/chat/messages") {
        return Promise.resolve({ messages: [], nextCursor: null, hasMore: false })
      }
      if (url === "/api/chat/mark-read") {
        return Promise.resolve({ markedCount: 0 })
      }
      if (url === "/api/chat/conversations/conv-1/messages") {
        return Promise.resolve(makeMessage({ imageUrl: "https://example.com/chat.jpg" }))
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    vi.stubGlobal("$fetch", fetchMock)

    const { useChat } = await import("../use-chat")
    const chat = useChat()

    await chat.openConversationById("conv-1")
    await chat.sendMessage("Hello", "https://example.com/chat.jpg")

    expect(fetchMock).toHaveBeenCalledWith("/api/chat/conversations/conv-1/messages", {
      method: "POST",
      body: {
        body: "Hello",
        imageUrl: "https://example.com/chat.jpg",
      },
    })
  })

  it("submits a persisted chat report for the active conversation", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/chat/conversations/conv-1") {
        return Promise.resolve(conversationDetail)
      }
      if (url === "/api/chat/messages") {
        return Promise.resolve({ messages: [], nextCursor: null, hasMore: false })
      }
      if (url === "/api/chat/mark-read") {
        return Promise.resolve({ markedCount: 0 })
      }
      if (url === "/api/chat/report") {
        return Promise.resolve({
          id: "report-1",
          transactionId: "tx-1",
          reason: "INAPPROPRIATE_CHAT",
          status: "OPEN",
          description: "Threatening language",
          createdAt: "2026-04-20T12:00:00.000Z",
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    vi.stubGlobal("$fetch", fetchMock)

    const { useChat } = await import("../use-chat")
    const chat = useChat()

    await chat.openConversationById("conv-1")
    await chat.reportConversation("Threatening language")

    expect(fetchMock).toHaveBeenCalledWith("/api/chat/report", {
      method: "POST",
      body: {
        conversationId: "conv-1",
        description: "Threatening language",
      },
    })
  })
})
