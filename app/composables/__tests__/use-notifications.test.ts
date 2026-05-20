import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import { useNotifications } from "../use-notifications"

const makeNotification = (overrides: Record<string, unknown> = {}) => ({
  id: "notif-1",
  type: "BOOKING_REQUESTED",
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
  vi.stubGlobal("window", {
    setTimeout,
    clearTimeout,
  })
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

  it("merges realtime booking request inserts for the current recipient", async () => {
    const callbacks: Array<(payload: { new: Record<string, unknown> }) => void> = []
    const channel = {
      on: vi.fn((_type, _config, callback) => {
        callbacks.push(callback)
        return channel
      }),
      subscribe: vi.fn(),
    }
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "access-token" } },
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      realtime: { setAuth: vi.fn() },
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    }

    vi.stubGlobal("useSupabaseClient", () => supabase)
    vi.stubGlobal("useAuthUser", () => ({
      authUser: ref({ id: "recipient-1" }),
      fetch: vi.fn(),
    }))
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue([makeNotification()]))

    const notifications = useNotifications()
    await notifications.startNotificationRealtime()

    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "AppNotification",
      },
      expect.any(Function),
    )

    callbacks[0]?.({
      new: {
        ...makeNotification({
          id: "notif-realtime",
          body: "A borrower requested your item.",
          createdAt: "2026-04-22T10:00:00.000Z",
        }),
        recipientUserId: "recipient-1",
        readAt: null,
      },
    })

    callbacks[0]?.({
      new: {
        ...makeNotification({
          id: "notif-other",
          createdAt: "2026-04-23T10:00:00.000Z",
        }),
        recipientUserId: "recipient-2",
        readAt: null,
      },
    })

    expect(notifications.notifications.value.map((notification) => notification.id)).toEqual([
      "notif-realtime",
    ])

    notifications.stopNotificationRealtime()
  })

  it("merges realtime broadcast notifications for the current user", async () => {
    const handlers: Record<string, (payload: { payload: unknown }) => void> = {}
    const channels: Record<
      string,
      { on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> }
    > = {}
    const createChannel = (topic: string) => {
      const channel = {
        on: vi.fn((_type, config: { event?: string }, callback) => {
          if (config.event) {
            handlers[`${topic}:${config.event}`] = callback
          }
          return channel
        }),
        subscribe: vi.fn(),
      }
      channels[topic] = channel
      return channel
    }
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "access-token" } },
        }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
      realtime: { setAuth: vi.fn() },
      channel: vi.fn((topic: string) => createChannel(topic)),
      removeChannel: vi.fn(),
    }

    vi.stubGlobal("useSupabaseClient", () => supabase)
    vi.stubGlobal("useAuthUser", () => ({
      authUser: ref({ id: "recipient-1" }),
      fetch: vi.fn(),
    }))
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue([makeNotification()]))

    const notifications = useNotifications()
    await notifications.startNotificationRealtime()

    expect(channels["app-notifications-user-recipient-1"]?.on).toHaveBeenCalledWith(
      "broadcast",
      { event: "notification" },
      expect.any(Function),
    )

    handlers["app-notifications-user-recipient-1:notification"]?.({
      payload: {
        notification: {
          ...makeNotification({
            id: "notif-broadcast",
            body: "A borrower requested your item.",
            createdAt: "2026-04-24T10:00:00.000Z",
          }),
          recipientUserId: "recipient-1",
          readAt: null,
        },
      },
    })

    expect(notifications.notifications.value.map((notification) => notification.id)).toEqual([
      "notif-broadcast",
    ])

    notifications.stopNotificationRealtime()
  })
})
