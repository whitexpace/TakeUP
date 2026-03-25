import { describe, expect, it, vi } from "vitest"
import { notificationRouter } from "../notification"

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const NOTIFICATION_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

const mockContext = () => ({
  event: { context: {} } as never,
  prisma: {
    appNotification: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: NOTIFICATION_ID,
          type: "BOOKING_RETURN_REQUESTED",
          title: "Item return requested",
          body: "A borrower marked your item as returned.",
          actionPath: "/account/transactions/booking-1",
          readAt: null,
          createdAt: new Date("2026-03-25T00:00:00.000Z"),
        },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        id: NOTIFICATION_ID,
        readAt: null,
      }),
      update: vi.fn().mockResolvedValue({
        id: NOTIFICATION_ID,
        type: "BOOKING_RETURN_REQUESTED",
        title: "Item return requested",
        body: "A borrower marked your item as returned.",
        actionPath: "/account/transactions/booking-1",
        readAt: new Date("2026-03-25T01:00:00.000Z"),
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  },
  user: { id: USER_ID, email: "user@up.edu.ph", name: "User" },
})

describe("notificationRouter", () => {
  it("lists notifications for the authenticated user", async () => {
    const ctx = mockContext()
    const caller = notificationRouter.createCaller(ctx as never)

    const notifications = await caller.list({})

    expect(ctx.prisma.appNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientUserId: USER_ID },
      }),
    )
    expect(notifications[0]).toMatchObject({
      id: NOTIFICATION_ID,
      read: false,
      title: "Item return requested",
    })
  })

  it("marks a single notification as read", async () => {
    const ctx = mockContext()
    const caller = notificationRouter.createCaller(ctx as never)

    const notification = await caller.markRead({ id: NOTIFICATION_ID })

    expect(ctx.prisma.appNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: NOTIFICATION_ID },
      }),
    )
    expect(notification.read).toBe(true)
  })

  it("marks all notifications as read", async () => {
    const ctx = mockContext()
    const caller = notificationRouter.createCaller(ctx as never)

    const result = await caller.markAllRead()

    expect(ctx.prisma.appNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recipientUserId: USER_ID,
          readAt: null,
        },
      }),
    )
    expect(result).toEqual({ count: 2 })
  })
})
