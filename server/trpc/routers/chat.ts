import { TRPCError } from "@trpc/server"
import type { Prisma, PrismaClient } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
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

type ConversationWithTransaction = Prisma.ConversationGetPayload<{
  include: typeof conversationWithTransactionInclude
}>

type ConversationListEntry = Prisma.ConversationGetPayload<{
  include: typeof conversationListInclude
}>

type MessageGroupByRow = {
  conversationId: string
  _count: { id: number }
}

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

async function getConversationWithTransaction(prisma: PrismaClient, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationWithTransactionInclude,
  })
  if (!conversation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" })
  }
  return conversation as ConversationWithTransaction
}

export const chatRouter = router({
  /** Get or create a conversation for a transaction */
  getOrCreateConversation: protectedProcedure
    .input(getOrCreateConversationSchema)
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.prisma.rentalTransaction.findUnique({
        where: { id: input.transactionId },
        select: transactionSummarySelect,
      })

      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" })
      }

      assertParticipant(transaction, ctx.user.id)

      let conversation = await ctx.prisma.conversation.findUnique({
        where: { transactionId: input.transactionId },
      })

      if (!conversation) {
        conversation = await ctx.prisma.conversation.create({
          data: { transactionId: input.transactionId },
        })
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
    const userId = ctx.user.id

    const conversations = await ctx.prisma.conversation.findMany({
      where: {
        transaction: {
          OR: [{ borrowerId: userId }, { lenderId: userId }],
        },
      },
      include: conversationListInclude,
      orderBy: { createdAt: "desc" },
    })

    // Get unread counts per conversation
    const conversationIds = conversations.map((c) => c.id)
    const unreadCounts =
      conversationIds.length > 0
        ? await ctx.prisma.message.groupBy({
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

    return (conversations as ConversationListEntry[]).map((conv) => {
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
    const conv = await getConversationWithTransaction(ctx.prisma, input.conversationId)
    assertParticipant(conv.transaction, ctx.user.id)

    const where: Prisma.MessageWhereInput = { conversationId: input.conversationId }
    if (input.cursor) {
      const cursorMessage = await ctx.prisma.message.findUnique({
        where: { id: input.cursor },
        select: { createdAt: true },
      })
      if (cursorMessage) {
        where.createdAt = { lt: cursorMessage.createdAt }
      }
    }

    const messages = await ctx.prisma.message.findMany({
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
    })

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
    const conv = await getConversationWithTransaction(ctx.prisma, input.conversationId)
    assertParticipant(conv.transaction, ctx.user.id)

    if (isConversationExpired(conv.transaction)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "This conversation is read-only. The transaction is completed with an open dispute.",
      })
    }

    const message = await ctx.prisma.message.create({
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
    })

    return message
  }),

  /** Mark all unread messages in a conversation as read for the current user */
  markAsRead: protectedProcedure.input(markAsReadSchema).mutation(async ({ ctx, input }) => {
    const conv = await getConversationWithTransaction(ctx.prisma, input.conversationId)
    assertParticipant(conv.transaction, ctx.user.id)

    const result = await ctx.prisma.message.updateMany({
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
    const userId = ctx.user.id

    const count = await ctx.prisma.message.count({
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
