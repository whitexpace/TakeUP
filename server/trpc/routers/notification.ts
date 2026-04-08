import { TRPCError } from "@trpc/server"
import { protectedProcedure } from "../procedures"
import { router } from "../init"
import { listNotificationsSchema, notificationIdSchema } from "../../../shared/schemas/notification"

const mapNotification = (notification: {
  id: string
  type: "BOOKING_RETURN_REQUESTED"
  title: string
  body: string
  actionPath: string | null
  readAt: Date | null
  createdAt: Date
}) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  actionPath: notification.actionPath,
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
      },
    })

    return notifications.map((notification) =>
      mapNotification({
        ...notification,
        type: notification.type as "BOOKING_RETURN_REQUESTED",
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
      },
    })

    return mapNotification({
      ...notification,
      type: notification.type as "BOOKING_RETURN_REQUESTED",
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
