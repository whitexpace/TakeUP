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
          id: "legacy-dispute-submitted",
          type: "DISPUTE_SUBMITTED",
          title: "A dispute concern was submitted",
          body: "Reason: Damage / Missing parts Requested resolution: Refund / deposit return",
          actionPath: "/account/transactions/booking-legacy",
          readAt: null,
          createdAt: new Date("2026-03-26T00:00:00.000Z"),
          actorUser: {
            firstName: "Npguarin",
            lastName: "User",
          },
        },
        {
          id: NOTIFICATION_ID,
          type: "BOOKING_RETURN_REQUESTED",
          title: "Item return requested",
          body: "A borrower marked your item as returned.",
          actionPath: "/account/transactions/booking-1",
          readAt: null,
          createdAt: new Date("2026-03-25T00:00:00.000Z"),
          actorUser: null,
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
        actorUser: null,
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
    expect(notifications).toHaveLength(2)
    expect(notifications[0]).toMatchObject({
      id: "legacy-dispute-submitted",
      read: false,
      title: "New dispute on your transaction",
      body: 'Npguarin U. reported "Damage / Missing parts". Review the dispute and submit your rebuttal if needed.',
      actionPath: "/account/transactions/booking-legacy?action=rebuttal",
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
