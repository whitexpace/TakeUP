import { TRPCError } from "@trpc/server"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import type { Context } from "../context"
import {
  sendMessageSchema,
  getOrCreateConversationSchema,
  fetchMessagesSchema,
  markAsReadSchema,
} from "../../../shared/schemas/chat"

const participantSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const

type ParticipantInfo = {
  id: string
  username: string
  firstName: string
  lastName: string
  avatarUrl: string | null
}

const transactionSummarySelect = {
  id: true,
  borrowerId: true,
  lenderId: true,
  status: true,
  disputes: { select: { status: true } },
  item: {
    select: {
      id: true,
      name: true,
      images: {
        select: { path: true, isPrimary: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
  },
  borrower: { select: participantSelect },
  lender: { select: participantSelect },
} as const

const conversationWithTransactionInclude = {
  transaction: {
    select: {
      id: true,
      borrowerId: true,
      lenderId: true,
      status: true,
      disputes: { select: { status: true } },
      item: {
        select: {
          id: true,
          name: true,
          images: {
            select: { path: true, isPrimary: true },
            orderBy: { sortOrder: "asc" },
            take: 1,
          },
        },
      },
    },
  },
} as const

const conversationListInclude = {
  transaction: {
    select: transactionSummarySelect,
  },
  messages: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, body: true, senderUserId: true, createdAt: true, isRead: true },
  },
} as const

type ChatTransactionWithParticipants = {
  id: string
  borrowerId: string | null
  lenderId: string | null
  status: string
  disputes: Array<{ status: string }>
  item: {
    id: string
    name: string
    images: Array<{ path: string; isPrimary: boolean }>
  } | null
  borrower: ParticipantInfo | null
  lender: ParticipantInfo | null
}

type ChatTransactionSummary = Omit<ChatTransactionWithParticipants, "borrower" | "lender"> & {
  borrower?: ParticipantInfo | null
  lender?: ParticipantInfo | null
}

type ConversationWithTransaction = {
  id: string
  transactionId: string
  createdAt?: Date
  transaction: ChatTransactionSummary
}

type ConversationListEntry = {
  id: string
  transactionId?: string
  createdAt?: Date
  transaction: ChatTransactionWithParticipants
  messages: Array<{
    id: string
    body: string
    senderUserId: string
    createdAt: Date
    isRead: boolean
  }>
}

type ChatMessageRecord = {
  id: string
  conversationId: string
  senderUserId: string
  body: string
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}

type MessageGroupByRow = {
  conversationId: string
  _count: { id: number }
}

type ChatPrisma = Context["prisma"] & {
  conversation: {
    findUnique(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown>
    create(args: unknown): Promise<unknown>
  }
  message: {
    groupBy(args: unknown): Promise<unknown>
    findUnique(args: unknown): Promise<unknown>
    findMany(args: unknown): Promise<unknown>
    create(args: unknown): Promise<unknown>
    updateMany(args: unknown): Promise<{ count: number }>
    count(args: unknown): Promise<number>
  }
}

const getChatPrisma = (prisma: Context["prisma"]) => prisma as unknown as ChatPrisma

/** Check if a transaction+dispute combo means the chat is expired (read-only). */
function isConversationExpired(transaction: {
  status: string
  disputes?: Array<{ status: string }>
}): boolean {
  return (
    transaction.status === "COMPLETED" &&
    (transaction.disputes ?? []).some((d) => d.status === "OPEN")
  )
}

/** Verify current user is borrower or lender on the transaction. Returns the other participant's userId. */
function assertParticipant(
  transaction: { borrowerId: string | null; lenderId: string | null },
  userId: string,
): { otherUserId: string } {
  if (transaction.borrowerId === userId) {
    if (!transaction.lenderId)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction has no lender" })
    return { otherUserId: transaction.lenderId }
  }
  if (transaction.lenderId === userId) {
    if (!transaction.borrowerId)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction has no borrower" })
    return { otherUserId: transaction.borrowerId }
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You are not a participant of this conversation",
  })
}

async function getConversationWithTransaction(prisma: Context["prisma"], conversationId: string) {
  const conversation = (await getChatPrisma(prisma).conversation.findUnique({
    where: { id: conversationId },
    include: conversationWithTransactionInclude,
  })) as ConversationWithTransaction | null
  if (!conversation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" })
  }
  return conversation
}

export const chatRouter = router({
  /** Get or create a conversation for a transaction */
  getOrCreateConversation: protectedProcedure
    .input(getOrCreateConversationSchema)
    .mutation(async ({ ctx, input }) => {
      const prisma = getChatPrisma(ctx.prisma)
      const transaction = await ctx.prisma.rentalTransaction.findUnique({
        where: { id: input.transactionId },
        select: transactionSummarySelect,
      })

      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" })
      }

      assertParticipant(transaction, ctx.user.id)

      let conversation = (await prisma.conversation.findUnique({
        where: { transactionId: input.transactionId },
      })) as { id: string; transactionId: string } | null

      if (!conversation) {
        conversation = (await prisma.conversation.create({
          data: { transactionId: input.transactionId },
        })) as { id: string; transactionId: string }
      }

      const otherUser =
        transaction.borrowerId === ctx.user.id ? transaction.lender : transaction.borrower

      return {
        conversationId: conversation.id,
        transactionId: transaction.id,
        isExpired: isConversationExpired(transaction),
        item: transaction.item
          ? {
              id: transaction.item.id,
              name: transaction.item.name,
              thumbnailImage: transaction.item.images?.[0]?.path ?? null,
            }
          : null,
        otherParticipant: (otherUser as ParticipantInfo | null) ?? null,
      }
    }),

  /** List all conversations for the current user */
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    const prisma = getChatPrisma(ctx.prisma)
    const userId = ctx.user.id

    const conversations = (await prisma.conversation.findMany({
      where: {
        transaction: {
          OR: [{ borrowerId: userId }, { lenderId: userId }],
        },
      },
      include: conversationListInclude,
      orderBy: { createdAt: "desc" },
    })) as ConversationListEntry[]

    // Get unread counts per conversation
    const conversationIds = conversations.map((c) => c.id)
    const unreadCounts =
      conversationIds.length > 0
        ? await prisma.message.groupBy({
            by: ["conversationId"],
            where: {
              conversationId: { in: conversationIds },
              senderUserId: { not: userId },
              isRead: false,
            },
            _count: { id: true },
          })
        : []

    const unreadMap = new Map(
      (unreadCounts as MessageGroupByRow[]).map((u) => [u.conversationId, u._count.id]),
    )

    return conversations.map((conv) => {
      const otherUser =
        conv.transaction.borrowerId === userId ? conv.transaction.lender : conv.transaction.borrower

      const lastMessage = conv.messages[0] ?? null

      return {
        conversationId: conv.id,
        transactionId: conv.transaction.id,
        isExpired: isConversationExpired(conv.transaction),
        item: conv.transaction.item
          ? {
              id: conv.transaction.item.id,
              name: conv.transaction.item.name,
              thumbnailImage: conv.transaction.item.images?.[0]?.path ?? null,
            }
          : null,
        otherParticipant: (otherUser as ParticipantInfo | null) ?? null,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              body: lastMessage.body,
              senderUserId: lastMessage.senderUserId,
              createdAt: lastMessage.createdAt,
              isRead: lastMessage.isRead,
            }
          : null,
        unreadCount: unreadMap.get(conv.id) ?? 0,
      }
    })
  }),

  /** Fetch messages for a conversation (paginated, chronological) */
  getMessages: protectedProcedure.input(fetchMessagesSchema).query(async ({ ctx, input }) => {
    const prisma = getChatPrisma(ctx.prisma)
    const conv = await getConversationWithTransaction(ctx.prisma, input.conversationId)
    assertParticipant(conv.transaction, ctx.user.id)

    const where: {
      conversationId: string
      createdAt?: { lt: Date }
    } = { conversationId: input.conversationId }
    if (input.cursor) {
      const cursorMessage = (await prisma.message.findUnique({
        where: { id: input.cursor },
        select: { createdAt: true },
      })) as { createdAt: Date } | null
      if (cursorMessage) {
        where.createdAt = { lt: cursorMessage.createdAt }
      }
    }

    const messages = (await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit + 1,
      select: {
        id: true,
        conversationId: true,
        senderUserId: true,
        body: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
    })) as ChatMessageRecord[]

    const hasMore = messages.length > input.limit
    const items = hasMore ? messages.slice(0, input.limit) : messages

    return {
      messages: items.reverse(),
      nextCursor: hasMore ? (items[0]?.id ?? null) : null,
      hasMore,
    }
  }),

  /** Send a message */
  sendMessage: protectedProcedure.input(sendMessageSchema).mutation(async ({ ctx, input }) => {
    const prisma = getChatPrisma(ctx.prisma)
    const conv = await getConversationWithTransaction(ctx.prisma, input.conversationId)
    assertParticipant(conv.transaction, ctx.user.id)

    if (isConversationExpired(conv.transaction)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "This conversation is read-only. The transaction is completed with an open dispute.",
      })
    }

    const message = (await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderUserId: ctx.user.id,
        body: input.body.trim(),
      },
      select: {
        id: true,
        conversationId: true,
        senderUserId: true,
        body: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
    })) as ChatMessageRecord

    return message
  }),

  /** Mark all unread messages in a conversation as read for the current user */
  markAsRead: protectedProcedure.input(markAsReadSchema).mutation(async ({ ctx, input }) => {
    const prisma = getChatPrisma(ctx.prisma)
    const conv = await getConversationWithTransaction(ctx.prisma, input.conversationId)
    assertParticipant(conv.transaction, ctx.user.id)

    const result = await prisma.message.updateMany({
      where: {
        conversationId: input.conversationId,
        senderUserId: { not: ctx.user.id },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return { markedCount: result.count }
  }),

  /** Get total unread message count across all conversations */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const prisma = getChatPrisma(ctx.prisma)
    const userId = ctx.user.id

    const count = await prisma.message.count({
      where: {
        senderUserId: { not: userId },
        isRead: false,
        conversation: {
          transaction: {
            OR: [{ borrowerId: userId }, { lenderId: userId }],
          },
        },
      },
    })

    return { unreadCount: count }
  }),
})
