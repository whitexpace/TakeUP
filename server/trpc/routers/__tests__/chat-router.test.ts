import { TRPCError } from "@trpc/server"
import type { H3Event } from "h3"
import { describe, expect, it, vi } from "vitest"
import { chatRouter } from "../chat"
import type { Context } from "../../context"
import type { SessionUser } from "../../../utils/auth-session"
import { CHAT_CLOSED_NOTICE } from "../../../../shared/chat-rules"

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const OTHER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const TX_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const CONV_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"
const MSG_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
const OUTSIDER_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"

const mockUser: SessionUser = { id: USER_ID, email: "user@up.edu.ph", name: "Test User" }
const outsiderUser: SessionUser = { id: OUTSIDER_ID, email: "outsider@up.edu.ph", name: "Outsider" }

type PrismaMockOverrides = {
  rentalTransaction?: Record<string, unknown>
  conversation?: Record<string, unknown>
  message?: Record<string, unknown>
  $queryRaw?: ReturnType<typeof vi.fn>
  $executeRaw?: ReturnType<typeof vi.fn>
}

const makeTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: TX_ID,
  borrowerId: USER_ID,
  lenderId: OTHER_USER_ID,
  status: "ONGOING",
  disputes: [],
  item: { id: "item-1", name: "Camera", images: [{ path: "/img/cam.jpg", isPrimary: true }] },
  borrower: {
    id: USER_ID,
    username: "borrower1",
    firstName: "Test",
    lastName: "User",
    avatarUrl: null,
  },
  lender: {
    id: OTHER_USER_ID,
    username: "lender1",
    firstName: "Other",
    lastName: "User",
    avatarUrl: null,
  },
  ...overrides,
})

const makeConversation = (overrides: Record<string, unknown> = {}) => ({
  id: CONV_ID,
  transactionId: TX_ID,
  createdAt: new Date("2026-04-01T00:00:00Z"),
  transaction: makeTransaction(),
  ...overrides,
})

const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: MSG_ID,
  conversationId: CONV_ID,
  senderUserId: USER_ID,
  body: "Hello!",
  imageUrl: null,
  isRead: false,
  readAt: null,
  createdAt: new Date("2026-04-01T12:00:00Z"),
  ...overrides,
})

function makePrisma(overrides: PrismaMockOverrides = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    rentalTransaction: {
      findUnique: vi.fn().mockResolvedValue(makeTransaction()),
      ...overrides.rentalTransaction,
    },
    conversation: {
      findUnique: vi.fn().mockResolvedValue(makeConversation()),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi
        .fn()
        .mockResolvedValue({ id: CONV_ID, transactionId: TX_ID, createdAt: new Date() }),
      create: vi
        .fn()
        .mockResolvedValue({ id: CONV_ID, transactionId: TX_ID, createdAt: new Date() }),
      ...overrides.conversation,
    },
    message: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(makeMessage()),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
      ...overrides.message,
    },
    ...("$queryRaw" in overrides ? { $queryRaw: overrides.$queryRaw } : {}),
    ...("$executeRaw" in overrides ? { $executeRaw: overrides.$executeRaw } : {}),
  }
}

type ChatRouterTestContext = Omit<Context, "prisma"> & {
  prisma: ReturnType<typeof makePrisma>
}

function makeContext(user = mockUser, prismaOverrides: PrismaMockOverrides = {}) {
  return {
    user,
    prisma: makePrisma(prismaOverrides),
    event: {} as H3Event,
  } satisfies ChatRouterTestContext
}

const caller = (ctx: ChatRouterTestContext) => chatRouter.createCaller(ctx as unknown as Context)

describe("chatRouter", () => {
  describe("getOrCreateConversation", () => {
    it("upserts a conversation for a valid participant", async () => {
      const ctx = makeContext(mockUser)
      const result = await caller(ctx).getOrCreateConversation({ transactionId: TX_ID })
      expect(result.conversationId).toBe(CONV_ID)
      expect(result.isExpired).toBe(false)
      expect(result.otherParticipant?.id).toBe(OTHER_USER_ID)
      expect(ctx.prisma.conversation.upsert).toHaveBeenCalledWith({
        where: { transactionId: TX_ID },
        update: {},
        create: { transactionId: TX_ID },
        select: { id: true, transactionId: true },
      })
    })

    it("rejects non-participant", async () => {
      const ctx = makeContext(outsiderUser)
      await expect(caller(ctx).getOrCreateConversation({ transactionId: TX_ID })).rejects.toThrow(
        TRPCError,
      )
    })

    it("rejects when transaction not found", async () => {
      const ctx = makeContext(mockUser, {
        rentalTransaction: { findUnique: vi.fn().mockResolvedValue(null) },
      })
      await expect(caller(ctx).getOrCreateConversation({ transactionId: TX_ID })).rejects.toThrow(
        "Transaction not found",
      )
    })

    it("marks expired when COMPLETED with OPEN dispute", async () => {
      const ctx = makeContext(mockUser, {
        rentalTransaction: {
          findUnique: vi
            .fn()
            .mockResolvedValue(
              makeTransaction({ status: "COMPLETED", disputes: [{ status: "OPEN" }] }),
            ),
        },
        conversation: {
          findUnique: vi.fn().mockResolvedValue({ id: CONV_ID, transactionId: TX_ID }),
        },
      })
      const result = await caller(ctx).getOrCreateConversation({ transactionId: TX_ID })
      expect(result.isExpired).toBe(true)
      expect(result.closedNotice).toBe(CHAT_CLOSED_NOTICE)
    })

    it("rejects transactions whose chat is not available", async () => {
      const ctx = makeContext(mockUser, {
        rentalTransaction: {
          findUnique: vi.fn().mockResolvedValue(makeTransaction({ status: "CANCELLED" })),
        },
      })

      await expect(caller(ctx).byTransaction({ transactionId: TX_ID })).rejects.toThrow(
        "Chat is only available for accepted transactions.",
      )
    })
  })

  describe("sendMessage", () => {
    it("sends a message from authorized participant", async () => {
      const ctx = makeContext()
      const result = await caller(ctx).sendMessage({
        conversationId: CONV_ID,
        body: "Hello!",
      })
      expect(result.body).toBe("Hello!")
      expect(result.senderUserId).toBe(USER_ID)
    })

    it("trims message body", async () => {
      const created = makeMessage({ body: "Hello!" })
      const ctx = makeContext(mockUser, {
        message: { create: vi.fn().mockResolvedValue(created) },
      })
      await caller(ctx).sendMessage({ conversationId: CONV_ID, body: "  Hello!  " })
      expect(ctx.prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ body: "Hello!" }),
        }),
      )
    })

    it("rejects empty message", async () => {
      const ctx = makeContext()
      await expect(caller(ctx).sendMessage({ conversationId: CONV_ID, body: "" })).rejects.toThrow()
    })

    it("rejects whitespace-only message", async () => {
      const ctx = makeContext()
      await expect(
        caller(ctx).sendMessage({ conversationId: CONV_ID, body: "   " }),
      ).rejects.toThrow()
    })

    it("rejects non-participant", async () => {
      const ctx = makeContext(outsiderUser)
      await expect(
        caller(ctx).sendMessage({ conversationId: CONV_ID, body: "Hello!" }),
      ).rejects.toThrow(TRPCError)
    })

    it("rejects send on expired conversation", async () => {
      const expiredConv = makeConversation({
        transaction: makeTransaction({
          status: "COMPLETED",
          disputes: [{ status: "OPEN" }],
        }),
      })
      const ctx = makeContext(mockUser, {
        conversation: { findUnique: vi.fn().mockResolvedValue(expiredConv) },
      })
      await expect(
        caller(ctx).sendMessage({ conversationId: CONV_ID, body: "Hello!" }),
      ).rejects.toThrow(CHAT_CLOSED_NOTICE)
    })

    it("rejects send when conversation not found", async () => {
      const ctx = makeContext(mockUser, {
        conversation: { findUnique: vi.fn().mockResolvedValue(null) },
      })
      await expect(
        caller(ctx).sendMessage({ conversationId: CONV_ID, body: "Hello!" }),
      ).rejects.toThrow("Conversation not found")
    })
  })

  describe("getMessages", () => {
    it("returns messages in chronological order for participant", async () => {
      const msgs = [
        makeMessage({ id: "m1", createdAt: new Date("2026-04-01T12:00:00Z") }),
        makeMessage({ id: "m2", createdAt: new Date("2026-04-01T12:01:00Z") }),
      ]
      const ctx = makeContext(mockUser, {
        message: { findMany: vi.fn().mockResolvedValue(msgs), findUnique: vi.fn() },
      })
      const result = await caller(ctx).getMessages({ conversationId: CONV_ID })
      expect(result.messages).toHaveLength(2)
      expect(result.hasMore).toBe(false)
    })

    it("rejects non-participant from fetching messages", async () => {
      const ctx = makeContext(outsiderUser)
      await expect(caller(ctx).getMessages({ conversationId: CONV_ID })).rejects.toThrow(TRPCError)
    })

    it("supports pagination with hasMore flag", async () => {
      const msgs = Array.from({ length: 51 }, (_, i) =>
        makeMessage({ id: `m${i}`, createdAt: new Date(Date.now() - i * 1000) }),
      )
      const ctx = makeContext(mockUser, {
        message: { findMany: vi.fn().mockResolvedValue(msgs), findUnique: vi.fn() },
      })
      const result = await caller(ctx).getMessages({ conversationId: CONV_ID, limit: 50 })
      expect(result.messages).toHaveLength(50)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBeTruthy()
    })
  })

  describe("markAsRead", () => {
    it("marks unread messages as read for current user", async () => {
      const ctx = makeContext()
      const result = await caller(ctx).markAsRead({ conversationId: CONV_ID })
      expect(result.markedCount).toBe(2)
      expect(ctx.prisma.message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: CONV_ID,
            senderUserId: { not: USER_ID },
            isRead: false,
          }),
        }),
      )
    })

    it("rejects non-participant from marking as read", async () => {
      const ctx = makeContext(outsiderUser)
      await expect(caller(ctx).markAsRead({ conversationId: CONV_ID })).rejects.toThrow(TRPCError)
    })
  })

  describe("getUnreadCount", () => {
    it("returns total unread count", async () => {
      const ctx = makeContext(mockUser, {
        message: { count: vi.fn().mockResolvedValue(5) },
      })
      const result = await caller(ctx).getUnreadCount()
      expect(result.unreadCount).toBe(5)
    })
  })

  describe("listConversations", () => {
    it("returns conversations with last message and unread count", async () => {
      const conv = {
        ...makeConversation(),
        messages: [makeMessage({ body: "Last msg" })],
      }
      const ctx = makeContext(mockUser, {
        conversation: { findMany: vi.fn().mockResolvedValue([conv]) },
        message: {
          groupBy: vi.fn().mockResolvedValue([{ conversationId: CONV_ID, _count: { id: 3 } }]),
        },
      })
      const result = await caller(ctx).listConversations()
      expect(result).toHaveLength(1)
      const [firstConversation] = result
      expect(firstConversation).toBeDefined()
      expect(firstConversation?.conversationId).toBe(CONV_ID)
      expect(firstConversation?.lastMessage?.body).toBe("Last msg")
      expect(firstConversation?.unreadCount).toBe(3)
      expect(firstConversation?.otherParticipant?.id).toBe(OTHER_USER_ID)
      expect(ctx.prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transaction: expect.objectContaining({
              status: { in: expect.any(Array) },
            }),
          }),
        }),
      )
    })

    it("returns empty list when no conversations", async () => {
      const ctx = makeContext()
      const result = await caller(ctx).listConversations()
      expect(result).toEqual([])
    })
  })
})
