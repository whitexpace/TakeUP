import type { H3Event } from "h3"
import { TRPCError } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"
import { chatRouter } from "../chat"
import type { Context } from "../../context"
import type { SessionUser } from "../../../utils/auth-session"

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const OTHER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const TX_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const CONV_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"

const mockUser: SessionUser = { id: USER_ID, email: "user@up.edu.ph", name: "Test User" }

const makeTransaction = () => ({
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
})

const makeConversation = () => ({
  id: CONV_ID,
  transactionId: TX_ID,
  createdAt: new Date("2026-04-01T00:00:00Z"),
  transaction: makeTransaction(),
})

function makeContext() {
  return {
    user: mockUser,
    prisma: {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(1),
      rentalTransaction: {
        findUnique: vi.fn().mockResolvedValue(makeTransaction()),
      },
      conversation: {
        findUnique: vi.fn().mockResolvedValue(makeConversation()),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi
          .fn()
          .mockResolvedValue({ id: CONV_ID, transactionId: TX_ID, createdAt: new Date() }),
      },
      transactionDispute: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "report-1",
            transactionId: data.transactionId,
            reason: data.reason,
            status: "SUBMITTED",
            description: data.description ?? null,
            createdAt: new Date("2026-04-01T13:00:00Z"),
          }),
        ),
      },
      message: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "message-1",
            conversationId: data.conversationId,
            senderUserId: data.senderUserId,
            body: data.body,
            imageUrl: data.imageUrl ?? null,
            isRead: false,
            readAt: null,
            createdAt: new Date("2026-04-01T12:00:00Z"),
          }),
        ),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    },
    event: {} as H3Event,
  } satisfies Omit<Context, "prisma"> & {
    prisma: {
      rentalTransaction: { findUnique: ReturnType<typeof vi.fn> }
      conversation: {
        findUnique: ReturnType<typeof vi.fn>
        findMany: ReturnType<typeof vi.fn>
        upsert: ReturnType<typeof vi.fn>
      }
      transactionDispute: {
        findFirst: ReturnType<typeof vi.fn>
        create: ReturnType<typeof vi.fn>
      }
      $queryRaw: ReturnType<typeof vi.fn>
      $executeRaw: ReturnType<typeof vi.fn>
      message: {
        findUnique: ReturnType<typeof vi.fn>
        findMany: ReturnType<typeof vi.fn>
        create: ReturnType<typeof vi.fn>
        updateMany: ReturnType<typeof vi.fn>
        count: ReturnType<typeof vi.fn>
        groupBy: ReturnType<typeof vi.fn>
      }
    }
  }
}

const caller = (ctx: ReturnType<typeof makeContext>) =>
  chatRouter.createCaller(ctx as unknown as Context)

describe("chatRouter follow-up", () => {
  it("stores sanitized body text instead of raw personal contact info or profanity", async () => {
    const ctx = makeContext()

    const result = await caller(ctx).sendMessage({
      conversationId: CONV_ID,
      body: "Call me at 09171234567, bitch",
    })

    expect(ctx.prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "Call me at [censored], [censored]",
        }),
      }),
    )
    expect(result.body).toBe("Call me at [censored], [censored]")
  })

  it("persists an optional imageUrl with the sent message", async () => {
    const ctx = makeContext()

    const result = await caller(ctx).sendMessage({
      conversationId: CONV_ID,
      body: "Photo attached",
      imageUrl: "https://example.com/chat.jpg",
    })

    expect(ctx.prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "Photo attached",
        }),
      }),
    )
    expect(ctx.prisma.$executeRaw).toHaveBeenCalledTimes(1)
    expect(result.imageUrl).toBe("https://example.com/chat.jpg")
  })

  it("creates a persisted transaction dispute for a chat report", async () => {
    const ctx = makeContext()

    const result = await caller(ctx).reportConversation({
      conversationId: CONV_ID,
      description: "Threatening language",
    })

    expect(ctx.prisma.transactionDispute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: TX_ID,
          raisedById: USER_ID,
          reason: "INAPPROPRIATE_CHAT",
          description: "Threatening language",
        }),
      }),
    )
    expect(result.reason).toBe("INAPPROPRIATE_CHAT")
  })

  it("rejects duplicate active reports for the same conversation", async () => {
    const ctx = makeContext()
    ctx.prisma.transactionDispute.findFirst.mockResolvedValue({ id: "report-1" })

    await expect(
      caller(ctx).reportConversation({ conversationId: CONV_ID, description: "Still happening" }),
    ).rejects.toThrow(TRPCError)
    await expect(
      caller(ctx).reportConversation({ conversationId: CONV_ID, description: "Still happening" }),
    ).rejects.toThrow("A report is already open for this conversation.")
  })
})
