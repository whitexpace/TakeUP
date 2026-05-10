import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import { useNotifications } from "../use-notifications"

const makeNotification = (overrides: Record<string, unknown> = {}) => ({
  id: "notif-1",
  type: "DISPUTE_OPENED",
  title: "New booking request",
  body: "Someone requested your listing.",
  actionPath: "/account/transactions",
  createdAt: "2026-04-20T10:00:00.000Z",
  read: false,
  ...overrides,
})

let stateStore: Record<string, unknown> = {}

beforeEach(() => {
  stateStore = {}
  vi.stubGlobal("$fetch", vi.fn())
  vi.stubGlobal("useState", (key: string, init?: () => unknown) => {
    if (!stateStore[key]) {
      stateStore[key] = ref(init ? init() : undefined)
    }
    return stateStore[key]
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("useNotifications", () => {
  it("loads and normalizes notifications from the API", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue([
        makeNotification(),
        makeNotification({
          id: "notif-2",
          createdAt: new Date("2026-04-21T10:00:00.000Z"),
          read: 1,
        }),
      ]),
    )

    const notifications = useNotifications()
    await notifications.loadNotifications()

    expect(notifications.notifications.value).toHaveLength(2)
    expect(notifications.notifications.value[0]?.createdAt).toBeInstanceOf(Date)
    expect(notifications.notifications.value[1]?.read).toBe(true)
  })

  it("falls back to an empty list when loading fails", async () => {
    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue(new Error("boom")))

    const notifications = useNotifications()
    await notifications.loadNotifications()

    expect(notifications.notifications.value).toEqual([])
  })

  it("marks a single notification as read after a successful patch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce([makeNotification(), makeNotification({ id: "notif-2", read: false })])
      .mockResolvedValueOnce(undefined)
    vi.stubGlobal("$fetch", fetchMock)

    const notifications = useNotifications()
    await notifications.loadNotifications()
    await notifications.markNotificationRead("notif-2")

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/notifications/notif-2", {
      method: "PATCH",
    })
    expect(
      notifications.notifications.value.find((notification) => notification.id === "notif-2")?.read,
    ).toBe(true)
    expect(
      notifications.notifications.value.find((notification) => notification.id === "notif-1")?.read,
    ).toBe(false)
  })

  it("marks every notification as read after the bulk endpoint succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce([makeNotification(), makeNotification({ id: "notif-2", read: false })])
      .mockResolvedValueOnce(undefined)
    vi.stubGlobal("$fetch", fetchMock)

    const notifications = useNotifications()
    await notifications.loadNotifications()
    await notifications.markAllNotificationsRead()

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/notifications/read-all", {
      method: "POST",
    })
    expect(notifications.notifications.value.every((notification) => notification.read)).toBe(true)
  })
})
