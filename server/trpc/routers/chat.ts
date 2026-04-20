import {
  DisputeReason as PrismaDisputeReason,
  DisputeStatus as PrismaDisputeStatus,
  TransactionStatus as PrismaTransactionStatus,
  type Prisma,
} from "@prisma/client"
import { TRPCError } from "@trpc/server"
import type { Context } from "../context"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import {
  conversationIdSchema,
  fetchMessagesSchema,
  getOrCreateConversationSchema,
  markAsReadSchema,
  reportConversationSchema,
  sendMessageSchema,
  transactionConversationSchema,
} from "../../../shared/schemas/chat"
import { sanitizeChatMessage } from "../../../shared/chat-moderation"
import {
  CHAT_CLOSED_NOTICE,
  CHAT_ENABLED_TRANSACTION_STATUSES,
  isChatAvailableForTransactionStatus,
  isChatReadOnly,
} from "../../../shared/chat-rules"

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
    select: transactionSummarySelect,
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

type ChatTransactionRecord = Prisma.RentalTransactionGetPayload<{
  select: typeof transactionSummarySelect
}>

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

const prismaTransactionStatuses = PrismaTransactionStatus as Record<string, PrismaTransactionStatus>
const chatEnabledTransactionStatuses = CHAT_ENABLED_TRANSACTION_STATUSES.map(
  (status) => prismaTransactionStatuses[status],
).filter((status): status is PrismaTransactionStatus => Boolean(status))

const hasOpenDispute = (disputes?: Array<{ status: string }>) =>
  (disputes ?? []).some((dispute) => dispute.status === "OPEN")

const isConversationExpired = (transaction: {
  status: string
  disputes?: Array<{ status: string }>
}) =>
  isChatReadOnly({
    transactionStatus: transaction.status,
    hasOpenDispute: hasOpenDispute(transaction.disputes),
  })

const assertChatAvailableForTransaction = (transaction: { status: string }) => {
  if (isChatAvailableForTransactionStatus(transaction.status)) {
    return
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Chat is only available for accepted transactions.",
  })
}

const assertParticipant = (
  transaction: { borrowerId: string | null; lenderId: string | null },
  userId: string,
): { otherUserId: string } => {
  if (transaction.borrowerId === userId) {
    if (!transaction.lenderId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction has no lender." })
    }

    return { otherUserId: transaction.lenderId }
  }

  if (transaction.lenderId === userId) {
    if (!transaction.borrowerId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction has no borrower." })
    }

    return { otherUserId: transaction.borrowerId }
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You are not a participant of this conversation.",
  })
}

const getConversationWithTransaction = async (
  prisma: Context["prisma"],
  conversationId: string,
) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationWithTransactionInclude,
  })

  if (!conversation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found." })
  }

  return conversation as ConversationWithTransaction
}

const getTransactionForChat = async (
  prisma: Context["prisma"],
  transactionId: string,
  userId: string,
) => {
  const transaction = await prisma.rentalTransaction.findUnique({
    where: { id: transactionId },
    select: transactionSummarySelect,
  })

  if (!transaction) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found." })
  }

  assertParticipant(transaction, userId)
  assertChatAvailableForTransaction(transaction)

  return transaction as ChatTransactionRecord
}

const mapConversationDetail = (input: {
  conversationId: string
  transaction: ChatTransactionRecord
  userId: string
}) => {
  const otherUser =
    input.transaction.borrowerId === input.userId
      ? input.transaction.lender
      : input.transaction.borrower

  const isExpired = isConversationExpired(input.transaction)

  return {
    conversationId: input.conversationId,
    transactionId: input.transaction.id,
    isExpired,
    closedNotice: isExpired ? CHAT_CLOSED_NOTICE : null,
    item: input.transaction.item
      ? {
          id: input.transaction.item.id,
          name: input.transaction.item.name,
          thumbnailImage: input.transaction.item.images?.[0]?.path ?? null,
        }
      : null,
    otherParticipant: (otherUser as ParticipantInfo | null) ?? null,
  }
}

const upsertConversationForTransaction = async (prisma: Context["prisma"], transactionId: string) =>
  prisma.conversation.upsert({
    where: { transactionId },
    update: {},
    create: { transactionId },
    select: { id: true, transactionId: true },
  })

const getConversationByTransaction = async (
  prisma: Context["prisma"],
  transactionId: string,
  userId: string,
) => {
  const transaction = await getTransactionForChat(prisma, transactionId, userId)
  const conversation = await upsertConversationForTransaction(prisma, transaction.id)

  return mapConversationDetail({
    conversationId: conversation.id,
    transaction,
    userId,
  })
}

const listUserConversations = async (prisma: Context["prisma"], userId: string) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      transaction: {
        status: { in: chatEnabledTransactionStatuses },
        OR: [{ borrowerId: userId }, { lenderId: userId }],
      },
    },
    include: conversationListInclude,
    orderBy: { createdAt: "desc" },
  })

  const conversationIds = conversations.map((conversation) => conversation.id)
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
    (unreadCounts as MessageGroupByRow[]).map((row) => [row.conversationId, row._count.id]),
  )

  return (conversations as ConversationListEntry[]).map((conversation) => {
    const otherUser =
      conversation.transaction.borrowerId === userId
        ? conversation.transaction.lender
        : conversation.transaction.borrower
    const lastMessage = conversation.messages[0] ?? null
    const isExpired = isConversationExpired(conversation.transaction)

    return {
      conversationId: conversation.id,
      transactionId: conversation.transaction.id,
      isExpired,
      closedNotice: isExpired ? CHAT_CLOSED_NOTICE : null,
      item: conversation.transaction.item
        ? {
            id: conversation.transaction.item.id,
            name: conversation.transaction.item.name,
            thumbnailImage: conversation.transaction.item.images?.[0]?.path ?? null,
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
      unreadCount: unreadMap.get(conversation.id) ?? 0,
    }
  })
}

export const chatRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => listUserConversations(ctx.prisma, ctx.user.id)),

  listConversations: protectedProcedure.query(async ({ ctx }) =>
    listUserConversations(ctx.prisma, ctx.user.id),
  ),

  byTransaction: protectedProcedure
    .input(transactionConversationSchema)
    .query(async ({ ctx, input }) =>
      getConversationByTransaction(ctx.prisma, input.transactionId, ctx.user.id),
    ),

  getOrCreateConversation: protectedProcedure
    .input(getOrCreateConversationSchema)
    .mutation(async ({ ctx, input }) =>
      getConversationByTransaction(ctx.prisma, input.transactionId, ctx.user.id),
    ),

  byConversation: protectedProcedure.input(conversationIdSchema).query(async ({ ctx, input }) => {
    const conversation = await getConversationWithTransaction(ctx.prisma, input.conversationId)

    assertParticipant(conversation.transaction, ctx.user.id)
    assertChatAvailableForTransaction(conversation.transaction)

    return mapConversationDetail({
      conversationId: conversation.id,
      transaction: conversation.transaction,
      userId: ctx.user.id,
    })
  }),

  getMessages: protectedProcedure.input(fetchMessagesSchema).query(async ({ ctx, input }) => {
    const conversation = await getConversationWithTransaction(ctx.prisma, input.conversationId)

    assertParticipant(conversation.transaction, ctx.user.id)
    assertChatAvailableForTransaction(conversation.transaction)

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
        imageUrl: true,
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

  sendMessage: protectedProcedure.input(sendMessageSchema).mutation(async ({ ctx, input }) => {
    const conversation = await getConversationWithTransaction(ctx.prisma, input.conversationId)

    assertParticipant(conversation.transaction, ctx.user.id)
    assertChatAvailableForTransaction(conversation.transaction)

    if (isConversationExpired(conversation.transaction)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: CHAT_CLOSED_NOTICE,
      })
    }

    return await ctx.prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderUserId: ctx.user.id,
        body: sanitizeChatMessage(input.body),
        imageUrl: input.imageUrl ?? null,
      },
      select: {
        id: true,
        conversationId: true,
        senderUserId: true,
        body: true,
        imageUrl: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
    })
  }),

  markAsRead: protectedProcedure.input(markAsReadSchema).mutation(async ({ ctx, input }) => {
    const conversation = await getConversationWithTransaction(ctx.prisma, input.conversationId)

    assertParticipant(conversation.transaction, ctx.user.id)
    assertChatAvailableForTransaction(conversation.transaction)

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

  reportConversation: protectedProcedure
    .input(reportConversationSchema)
    .mutation(async ({ ctx, input }) => {
      const conversation = await getConversationWithTransaction(ctx.prisma, input.conversationId)

      assertParticipant(conversation.transaction, ctx.user.id)
      assertChatAvailableForTransaction(conversation.transaction)

      const existingDispute = await ctx.prisma.transactionDispute.findFirst({
        where: {
          transactionId: conversation.transaction.id,
          status: {
            in: [
              PrismaDisputeStatus.OPEN,
              PrismaDisputeStatus.UNDER_REVIEW,
              PrismaDisputeStatus.APPEALED,
            ],
          },
        },
        select: { id: true },
      })

      if (existingDispute) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A report is already open for this conversation.",
        })
      }

      const description =
        input.description && input.description.length > 0 ? input.description : null

      return await ctx.prisma.transactionDispute.create({
        data: {
          transactionId: conversation.transaction.id,
          filedByUserId: ctx.user.id,
          reason: PrismaDisputeReason.INAPPROPRIATE_CHAT,
          description,
        },
        select: {
          id: true,
          transactionId: true,
          reason: true,
          status: true,
          description: true,
          createdAt: true,
        },
      })
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id

    const unreadCount = await ctx.prisma.message.count({
      where: {
        senderUserId: { not: userId },
        isRead: false,
        conversation: {
          transaction: {
            status: { in: chatEnabledTransactionStatuses },
            OR: [{ borrowerId: userId }, { lenderId: userId }],
          },
        },
      },
    })

    return { unreadCount }
  }),
})
