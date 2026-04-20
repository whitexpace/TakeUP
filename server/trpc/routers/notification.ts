import { TRPCError } from "@trpc/server"
import { protectedProcedure } from "../procedures"
import { router } from "../init"
import {
  listNotificationsSchema,
  notificationIdSchema,
  type AppNotificationType,
} from "../../../shared/schemas/notification"
import { DISPUTE_ADMIN_REVIEW_BYPASS_ENABLED } from "../../utils/dispute-status"

const formatActorName = (
  actorUser:
    | {
        firstName: string
        lastName: string
      }
    | null
    | undefined,
) => {
  if (!actorUser?.firstName) {
    return "The other user"
  }

  const lastInitial = actorUser.lastName?.[0]
  return lastInitial ? `${actorUser.firstName} ${lastInitial}.` : actorUser.firstName
}

const extractDisputeReason = (body: string) => {
  const match = body.match(
    /Reason:\s*(.+?)(?=\s(?:Details:|Requested resolution:|Transaction:|Other party:|Summary:|You may submit|Admin review|$))/i,
  )

  return match?.[1]?.trim() || null
}

const shouldNormalizeLegacyDisputeNotification = (notification: {
  type: AppNotificationType
  title: string
}) =>
  (notification.type === "DISPUTE_SUBMITTED" &&
    notification.title === "A dispute concern was submitted") ||
  (notification.type === "DISPUTE_OPENED" &&
    notification.title === "A formal dispute has been opened")

const normalizeNotificationContent = (notification: {
  type: AppNotificationType
  title: string
  body: string
  actorUser?: {
    firstName: string
    lastName: string
  } | null
}) => {
  if (shouldNormalizeLegacyDisputeNotification(notification)) {
    const actorName = formatActorName(notification.actorUser)
    const reason = extractDisputeReason(notification.body)

    return {
      title: "New dispute on your transaction",
      body: reason
        ? `${actorName} reported "${reason}". Review the dispute and submit your rebuttal if needed.`
        : `${actorName} reported an issue with one of your transactions. Review the dispute and submit your rebuttal if needed.`,
    }
  }

  if (notification.type === "BOOKING_RETURN_REQUESTED") {
    return {
      title: "Item marked as returned",
      body: "The borrower marked this item as returned. Open the transaction to confirm receipt.",
    }
  }

  if (notification.type === "DISPUTE_REBUTTAL_SUBMITTED") {
    const actorName = formatActorName(notification.actorUser)

    return {
      title: "New rebuttal on your dispute",
      body: `${actorName} submitted a rebuttal. Open the transaction to review their response.`,
    }
  }

  return {
    title: notification.title,
    body: notification.body,
  }
}

const withRebuttalActionPath = (actionPath: string | null) => {
  if (!actionPath?.startsWith("/account/transactions/")) {
    return actionPath
  }

  const [pathname, queryString = ""] = actionPath.split("?", 2)
  const searchParams = new URLSearchParams(queryString)
  searchParams.set("action", "rebuttal")

  return `${pathname}?${searchParams.toString()}`
}

const mapNotification = (notification: {
  id: string
  type: AppNotificationType
  title: string
  body: string
  actionPath: string | null
  readAt: Date | null
  createdAt: Date
  actorUser?: {
    firstName: string
    lastName: string
  } | null
}) => ({
  id: notification.id,
  type: notification.type,
  ...normalizeNotificationContent(notification),
  actionPath:
    notification.type === "DISPUTE_OPENED" ||
    (DISPUTE_ADMIN_REVIEW_BYPASS_ENABLED &&
      notification.type === "DISPUTE_SUBMITTED" &&
      notification.title === "A dispute concern was submitted")
      ? withRebuttalActionPath(notification.actionPath)
      : notification.actionPath,
  read: notification.readAt !== null,
  createdAt: notification.createdAt,
})

export const notificationRouter = router({
  list: protectedProcedure.input(listNotificationsSchema).query(async ({ ctx, input }) => {
    const notifications = await ctx.prisma.appNotification.findMany({
      where: { recipientUserId: ctx.user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        actionPath: true,
        readAt: true,
        createdAt: true,
        actorUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return notifications.map((notification) =>
      mapNotification({
        ...notification,
        type: notification.type as AppNotificationType,
      }),
    )
  }),

  markRead: protectedProcedure.input(notificationIdSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.appNotification.findFirst({
      where: {
        id: input.id,
        recipientUserId: ctx.user.id,
      },
      select: {
        id: true,
        readAt: true,
      },
    })

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found." })
    }

    const notification = await ctx.prisma.appNotification.update({
      where: { id: input.id },
      data: {
        readAt: existing.readAt ?? new Date(),
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        actionPath: true,
        readAt: true,
        createdAt: true,
        actorUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return mapNotification({
      ...notification,
      type: notification.type as AppNotificationType,
    })
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.appNotification.updateMany({
      where: {
        recipientUserId: ctx.user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    })

    return { count: result.count }
  }),
})
