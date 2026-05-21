import { Prisma, TransactionStatus as PrismaTransactionStatus } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import type { Context } from "../context"
import { router } from "../init"
import { protectedProcedure } from "../procedures"
import {
  conversationIdSchema,
  fetchMessagesSchema,
  getOrCreateConversationSchema,
  markAsReadSchema,
  reactToMessageSchema,
  reportConversationSchema,
  sendMessageSchema,
  transactionConversationSchema,
} from "#shared/schemas/chat"
import { sanitizeChatMessage } from "#shared/chat-moderation"
import {
  ACTIVE_DISPUTE_STATUSES,
  SUBMITTED_DISPUTE_STATUS,
  isActiveDisputeStatus,
} from "../../utils/dispute-status"
import {
  CHAT_ENABLED_TRANSACTION_STATUSES,
  getChatClosedNotice,
  getChatClosureState,
  isChatClosed,
  isChatAvailableForTransactionStatus,
} from "#shared/chat-rules"

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
  bookingId: true,
  borrowerId: true,
  lenderId: true,
  status: true,
  disputes: { select: { status: true, finalDecisionAt: true } },
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

const messageBaseSelect = {
  id: true,
  conversationId: true,
  senderUserId: true,
  replyToMessageId: true,
  body: true,
  isRead: true,
  readAt: true,
  createdAt: true,
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

type BaseMessageRecord = Prisma.MessageGetPayload<{
  select: typeof messageBaseSelect
}>

type MessageReplyPreview = {
  id: string
  senderUserId: string
  body: string
  imageUrl: string | null
  createdAt: Date
}

type ChatMessageRecord = BaseMessageRecord & {
  imageUrl: string | null
  replyToMessage: MessageReplyPreview | null
  reactions: ChatMessageReactionSummary[]
}

type ChatMessageReactionSummary = {
  emoji: string
  count: number
  reactedByCurrentUser: boolean
  userIds: string[]
}

type ChatReactionUpdate = {
  conversationId: string
  messageId: string
  emoji: string
  userId: string
  action: "added" | "removed"
  reactions: ChatMessageReactionSummary[]
}

type MessageGroupByRow = {
  conversationId: string
  _count: { id: number }
}

const prismaTransactionStatuses = PrismaTransactionStatus as Record<string, PrismaTransactionStatus>
const chatEnabledTransactionStatuses = CHAT_ENABLED_TRANSACTION_STATUSES.map(
  (status) => prismaTransactionStatuses[status],
).filter((status): status is PrismaTransactionStatus => Boolean(status))

const hasActiveDispute = (disputes?: Array<{ status: string; finalDecisionAt?: Date | null }>) =>
  (disputes ?? []).some((dispute) => isActiveDisputeStatus(dispute.status))

const getConversationClosureState = (transaction: {
  status: string
  disputes?: Array<{ status: string; finalDecisionAt?: Date | null }>
}) =>
  getChatClosureState({
    transactionStatus: transaction.status,
    hasActiveDispute: hasActiveDispute(transaction.disputes),
  })

const isConversationExpired = (transaction: {
  status: string
  disputes?: Array<{ status: string; finalDecisionAt?: Date | null }>
}) => isChatClosed(getConversationClosureState(transaction))

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

const formatConversationReportReference = (transactionId: string, bookingId: string | null) =>
  bookingId ? bookingId.slice(0, 16).toUpperCase() : transactionId.slice(0, 16).toUpperCase()

const buildConversationReportNotification = (input: {
  transactionId: string
  bookingId: string | null
  description: string | null
}) => ({
  type: "DISPUTE_SUBMITTED" as const,
  title: "A dispute concern was submitted",
  body: [
    `A chat report was opened for transaction ${formatConversationReportReference(
      input.transactionId,
      input.bookingId,
    )}.`,
    "Reason: Inappropriate chat",
    input.description ? `Details: ${input.description}` : null,
    "You may review the report and respond from the transaction page.",
  ]
    .filter(Boolean)
    .join(" "),
  actionPath: input.bookingId
    ? `/account/transactions/${input.bookingId}?action=rebuttal`
    : "/account/disputes?tab=disputes",
})

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

  const closureState = getConversationClosureState(input.transaction)
  const isExpired = isChatClosed(closureState)

  return {
    conversationId: input.conversationId,
    transactionId: input.transaction.id,
    closureState,
    isExpired,
    closedNotice: getChatClosedNotice(closureState),
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

const getMessageReactionSummaries = async (
  prisma: Context["prisma"],
  input: { messageIds: string[]; currentUserId: string },
): Promise<Map<string, ChatMessageReactionSummary[]>> => {
  if (input.messageIds.length === 0) {
    return new Map()
  }

  const rows = await prisma.$queryRaw<
    Array<{
      messageId: string
      emoji: string
      count: number | bigint
      reactedByCurrentUser: boolean
      userIds: string[]
    }>
  >(Prisma.sql`
    SELECT
      "message_id" AS "messageId",
      "emoji",
      COUNT(*) AS "count",
      BOOL_OR("user_id" = ${input.currentUserId}) AS "reactedByCurrentUser",
      ARRAY_AGG("user_id" ORDER BY "created_at" ASC) AS "userIds"
    FROM "message_reactions"
    WHERE "message_id" IN (${Prisma.join(input.messageIds)})
    GROUP BY "message_id", "emoji"
    ORDER BY MIN("created_at") ASC, "emoji" ASC
  `)

  const summariesByMessageId = new Map<string, ChatMessageReactionSummary[]>()
  for (const row of rows) {
    const current = summariesByMessageId.get(row.messageId) ?? []
    current.push({
      emoji: row.emoji,
      count: Number(row.count),
      reactedByCurrentUser: Boolean(row.reactedByCurrentUser),
      userIds: row.userIds,
    })
    summariesByMessageId.set(row.messageId, current)
  }

  return summariesByMessageId
}

const getMessageReactionUpdate = async (
  prisma: Context["prisma"],
  input: {
    conversationId: string
    messageId: string
    emoji: string
    userId: string
    action: "added" | "removed"
  },
): Promise<ChatReactionUpdate> => {
  const summaries = await getMessageReactionSummaries(prisma, {
    messageIds: [input.messageId],
    currentUserId: input.userId,
  })

  return {
    conversationId: input.conversationId,
    messageId: input.messageId,
    emoji: input.emoji,
    userId: input.userId,
    action: input.action,
    reactions: summaries.get(input.messageId) ?? [],
  }
}

const hydrateMessageDetails = async (
  prisma: Context["prisma"],
  messages: BaseMessageRecord[],
  currentUserId: string,
): Promise<ChatMessageRecord[]> => {
  if (messages.length === 0) {
    return []
  }

  const imageRows = await prisma.$queryRaw<
    Array<{
      id: string
      imageUrl: string | null
      replyId: string | null
      replySenderUserId: string | null
      replyBody: string | null
      replyImageUrl: string | null
      replyCreatedAt: Date | null
    }>
  >(Prisma.sql`
    SELECT
      m."id",
      m."image_url" AS "imageUrl",
      r."id" AS "replyId",
      r."sender_user_id" AS "replySenderUserId",
      r."body" AS "replyBody",
      r."image_url" AS "replyImageUrl",
      r."created_at" AS "replyCreatedAt"
    FROM "messages" m
    LEFT JOIN "messages" r ON r."id" = m."reply_to_message_id"
    WHERE m."id" IN (${Prisma.join(messages.map((message) => message.id))})
  `)

  const imageUrlByMessageId = new Map(imageRows.map((row) => [row.id, row.imageUrl] as const))
  const replyByMessageId = new Map(
    imageRows.map((row) => [
      row.id,
      row.replyId && row.replySenderUserId && row.replyBody !== null && row.replyCreatedAt
        ? {
            id: row.replyId,
            senderUserId: row.replySenderUserId,
            body: row.replyBody,
            imageUrl: row.replyImageUrl,
            createdAt: row.replyCreatedAt,
          }
        : null,
    ]),
  )

  const reactionsByMessageId = await getMessageReactionSummaries(prisma, {
    messageIds: messages.map((message) => message.id),
    currentUserId,
  })

  return messages.map((message) => ({
    ...message,
    replyToMessageId: message.replyToMessageId ?? null,
    imageUrl: imageUrlByMessageId.get(message.id) ?? null,
    replyToMessage: replyByMessageId.get(message.id) ?? null,
    reactions: reactionsByMessageId.get(message.id) ?? [],
  }))
}

const getReplyPreviewForMessage = async (
  prisma: Context["prisma"],
  input: { conversationId: string; replyToMessageId: string | null | undefined },
) => {
  if (!input.replyToMessageId) {
    return null
  }

  const rows = await prisma.$queryRaw<MessageReplyPreview[]>(Prisma.sql`
    SELECT
      "id",
      "sender_user_id" AS "senderUserId",
      "body",
      "image_url" AS "imageUrl",
      "created_at" AS "createdAt"
    FROM "messages"
    WHERE "id" = ${input.replyToMessageId}
      AND "conversation_id" = ${input.conversationId}
    LIMIT 1
  `)

  const replyToMessage = rows[0] ?? null
  if (!replyToMessage) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You can only reply to a message in this conversation.",
    })
  }

  return replyToMessage
}

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
    const closureState = getConversationClosureState(conversation.transaction)
    const isExpired = isChatClosed(closureState)

    return {
      conversationId: conversation.id,
      transactionId: conversation.transaction.id,
      closureState,
      isExpired,
      closedNotice: getChatClosedNotice(closureState),
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
      select: messageBaseSelect,
    })

    const hasMore = messages.length > input.limit
    const items = hasMore ? messages.slice(0, input.limit) : messages
    const hydratedItems = await hydrateMessageDetails(ctx.prisma, items, ctx.user.id)

    return {
      messages: hydratedItems.reverse(),
      nextCursor: hasMore ? (items[0]?.id ?? null) : null,
      hasMore,
    }
  }),

  sendMessage: protectedProcedure.input(sendMessageSchema).mutation(async ({ ctx, input }) => {
    const conversation = await getConversationWithTransaction(ctx.prisma, input.conversationId)

    assertParticipant(conversation.transaction, ctx.user.id)
    assertChatAvailableForTransaction(conversation.transaction)

    if (isConversationExpired(conversation.transaction)) {
      const closureState = getConversationClosureState(conversation.transaction)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: getChatClosedNotice(closureState) ?? "Chat is read-only.",
      })
    }

    const replyToMessage = await getReplyPreviewForMessage(ctx.prisma, {
      conversationId: input.conversationId,
      replyToMessageId: input.replyToMessageId,
    })

    const message = await ctx.prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderUserId: ctx.user.id,
        replyToMessageId: input.replyToMessageId ?? null,
        body: sanitizeChatMessage(input.body),
      },
      select: messageBaseSelect,
    })

    if (input.imageUrl) {
      await ctx.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "messages"
          SET "image_url" = ${input.imageUrl}
          WHERE "id" = ${message.id}
        `,
      )
    }

    return {
      ...message,
      replyToMessageId: message.replyToMessageId ?? input.replyToMessageId ?? null,
      imageUrl: input.imageUrl ?? null,
      replyToMessage,
      reactions: [],
    }
  }),

  reactToMessage: protectedProcedure
    .input(reactToMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const conversation = await getConversationWithTransaction(ctx.prisma, input.conversationId)

      assertParticipant(conversation.transaction, ctx.user.id)
      assertChatAvailableForTransaction(conversation.transaction)

      const rows = await ctx.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "messages"
        WHERE "id" = ${input.messageId}
          AND "conversation_id" = ${input.conversationId}
        LIMIT 1
      `)

      if (!rows[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found in this conversation.",
        })
      }

      const existingReaction = await ctx.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "message_reactions"
        WHERE "message_id" = ${input.messageId}
          AND "user_id" = ${ctx.user.id}
          AND "emoji" = ${input.emoji}
        LIMIT 1
      `)

      if (existingReaction[0]) {
        await ctx.prisma.$executeRaw(Prisma.sql`
          DELETE FROM "message_reactions"
          WHERE "id" = ${existingReaction[0].id}
        `)

        return getMessageReactionUpdate(ctx.prisma, {
          conversationId: input.conversationId,
          messageId: input.messageId,
          emoji: input.emoji,
          userId: ctx.user.id,
          action: "removed",
        })
      }

      await ctx.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "message_reactions" ("conversation_id", "message_id", "user_id", "emoji")
        VALUES (${input.conversationId}, ${input.messageId}, ${ctx.user.id}, ${input.emoji})
        ON CONFLICT ("message_id", "user_id", "emoji") DO NOTHING
      `)

      return getMessageReactionUpdate(ctx.prisma, {
        conversationId: input.conversationId,
        messageId: input.messageId,
        emoji: input.emoji,
        userId: ctx.user.id,
        action: "added",
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

      const { otherUserId } = assertParticipant(conversation.transaction, ctx.user.id)
      assertChatAvailableForTransaction(conversation.transaction)

      const existingDispute = await ctx.prisma.transactionDispute.findFirst({
        where: {
          transactionId: conversation.transaction.id,
          status: { in: [...ACTIVE_DISPUTE_STATUSES] },
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

      return await ctx.prisma.$transaction(async (tx) => {
        const report = await tx.transactionDispute.create({
          data: {
            transactionId: conversation.transaction.id,
            raisedById: ctx.user.id,
            status: SUBMITTED_DISPUTE_STATUS,
            reason: "INAPPROPRIATE_CHAT",
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

        await tx.appNotification.create({
          data: {
            recipientUserId: otherUserId,
            actorUserId: ctx.user.id,
            bookingId: conversation.transaction.bookingId,
            ...buildConversationReportNotification({
              transactionId: conversation.transaction.id,
              bookingId: conversation.transaction.bookingId,
              description,
            }),
          },
        })

        return report
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
