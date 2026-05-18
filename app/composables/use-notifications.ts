import { computed } from "vue"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { AppHeaderNotification } from "../types/notifications"

const NOTIFICATION_FETCH_LIMIT = 20
const REALTIME_SESSION_WAIT_MS = 5_000
const REALTIME_REFRESH_DEBOUNCE_MS = 250
const APP_NOTIFICATION_TYPES = new Set<AppHeaderNotification["type"]>([
  "BOOKING_REQUESTED",
  "BOOKING_RETURN_REQUESTED",
  "DISPUTE_SUBMITTED",
  "DISPUTE_OPENED",
  "DISPUTE_REBUTTAL_SUBMITTED",
  "DISPUTE_RESOLVED",
])

type RealtimeNotificationPayload = {
  new: Record<string, unknown>
}

type ApiNotification = {
  id: string
  type: AppHeaderNotification["type"]
  title: string
  body: string
  actionPath: string | null
  createdAt: string | Date
  read: boolean
}

type LoadNotificationsOptions = {
  background?: boolean
}

let realtimeChannel: RealtimeChannel | null = null
let realtimeAuthSubscription: { unsubscribe: () => void } | null = null
let realtimeUserId: string | null = null
let realtimeSetupPromise: Promise<void> | null = null
let realtimeRefreshTimer: number | null = null
let hasWarnedMissingRealtimeSession = false

const normalizeNotification = (notification: ApiNotification): AppHeaderNotification => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  actionPath: notification.actionPath,
  createdAt: new Date(notification.createdAt),
  read: Boolean(notification.read),
})

const isNotificationType = (value: unknown): value is AppHeaderNotification["type"] =>
  typeof value === "string" && APP_NOTIFICATION_TYPES.has(value as AppHeaderNotification["type"])

const mapRealtimeNotification = (row: Record<string, unknown>): AppHeaderNotification | null => {
  if (
    typeof row.id !== "string" ||
    !isNotificationType(row.type) ||
    typeof row.title !== "string" ||
    typeof row.body !== "string" ||
    typeof row.createdAt !== "string"
  ) {
    return null
  }

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    actionPath: typeof row.actionPath === "string" ? row.actionPath : null,
    createdAt: new Date(row.createdAt),
    read: row.readAt !== null && row.readAt !== undefined,
  }
}

const getRealtimeAccessToken = async (supabase: ReturnType<typeof useSupabaseClient>) => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token ?? null
}

const waitForRealtimeAccessToken = async (supabase: ReturnType<typeof useSupabaseClient>) => {
  const currentAccessToken = await getRealtimeAccessToken(supabase)
  if (currentAccessToken) return currentAccessToken

  if (typeof window === "undefined") return null

  return await new Promise<string | null>((resolve) => {
    let timeoutId: number | null = null
    let authSubscription: { unsubscribe: () => void } | null = null
    let settled = false

    const finish = (accessToken: string | null) => {
      if (settled) return
      settled = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      authSubscription?.unsubscribe()
      resolve(accessToken)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        finish(session.access_token)
      }
    })
    authSubscription = subscription

    timeoutId = window.setTimeout(() => {
      void getRealtimeAccessToken(supabase)
        .then(finish)
        .catch(() => finish(null))
    }, REALTIME_SESSION_WAIT_MS)
  })
}

const logRealtimeStatus = (status: string, error?: Error) => {
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
    console.warn("[notifications realtime]", status, error)
  }
}

export const useNotifications = () => {
  const notifications = useState<AppHeaderNotification[]>("app-notifications", () => [])
  const isLoading = useState("app-notifications-loading", () => false)

  const loadNotifications = async (options: LoadNotificationsOptions = {}) => {
    if (isLoading.value) return
    if (!options.background) {
      isLoading.value = true
    }

    try {
      const response = await $fetch<ApiNotification[]>("/api/notifications", {
        query: { limit: NOTIFICATION_FETCH_LIMIT },
      })
      notifications.value = response.map(normalizeNotification)
    } catch {
      if (!options.background) {
        notifications.value = []
      }
    } finally {
      if (!options.background) {
        isLoading.value = false
      }
    }
  }

  const mergeRealtimeNotification = (notification: AppHeaderNotification) => {
    notifications.value = [
      notification,
      ...notifications.value.filter((entry) => String(entry.id) !== String(notification.id)),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, NOTIFICATION_FETCH_LIMIT)
  }

  const scheduleRealtimeRefresh = () => {
    if (typeof window === "undefined") return

    if (realtimeRefreshTimer !== null) {
      window.clearTimeout(realtimeRefreshTimer)
    }

    realtimeRefreshTimer = window.setTimeout(() => {
      realtimeRefreshTimer = null
      void loadNotifications({ background: true })
    }, REALTIME_REFRESH_DEBOUNCE_MS)
  }

  const handleRealtimeNotification = (
    payload: RealtimeNotificationPayload,
    eventType: "INSERT" | "UPDATE",
  ) => {
    const notification = mapRealtimeNotification(payload.new)
    if (!notification) return

    if (eventType === "INSERT") {
      mergeRealtimeNotification(notification)
      scheduleRealtimeRefresh()
      return
    }

    notifications.value = notifications.value.map((entry) =>
      String(entry.id) === String(notification.id) ? { ...entry, read: notification.read } : entry,
    )
  }

  const stopNotificationRealtime = () => {
    if (realtimeChannel) {
      const supabase = useSupabaseClient()
      void supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }

    realtimeAuthSubscription?.unsubscribe()
    realtimeAuthSubscription = null
    realtimeUserId = null
    realtimeSetupPromise = null

    if (realtimeRefreshTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(realtimeRefreshTimer)
      realtimeRefreshTimer = null
    }
  }

  const setupRealtimeAuthListener = (supabase: ReturnType<typeof useSupabaseClient>) => {
    if (realtimeAuthSubscription) return

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
        return
      }

      if (event === "SIGNED_OUT") {
        stopNotificationRealtime()
      }
    })

    realtimeAuthSubscription = subscription
  }

  const startNotificationRealtime = async () => {
    if (import.meta.server) return
    if (realtimeSetupPromise) return realtimeSetupPromise

    realtimeSetupPromise = (async () => {
      const supabase = useSupabaseClient()
      const { authUser, fetch: fetchAuthUser } = useAuthUser()
      const currentUser = authUser.value ?? (await fetchAuthUser().catch(() => null))

      if (!currentUser?.id) return
      if (realtimeChannel && realtimeUserId === currentUser.id) return

      stopNotificationRealtime()

      const accessToken = await waitForRealtimeAccessToken(supabase)
      if (!accessToken) {
        if (!hasWarnedMissingRealtimeSession) {
          console.warn(
            "[notifications realtime] no Supabase auth session; notification subscriptions were not started",
          )
          hasWarnedMissingRealtimeSession = true
        }
        return
      }

      hasWarnedMissingRealtimeSession = false
      supabase.realtime.setAuth(accessToken)
      setupRealtimeAuthListener(supabase)

      realtimeUserId = currentUser.id
      realtimeChannel = supabase
        .channel(`app-notifications-${currentUser.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "AppNotification",
            filter: `recipientUserId=eq.${currentUser.id}`,
          },
          (payload) => handleRealtimeNotification(payload, "INSERT"),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "AppNotification",
            filter: `recipientUserId=eq.${currentUser.id}`,
          },
          (payload) => handleRealtimeNotification(payload, "UPDATE"),
        )
        .subscribe((status, error) => logRealtimeStatus(status, error))
    })().finally(() => {
      realtimeSetupPromise = null
    })

    return realtimeSetupPromise
  }

  const markNotificationRead = async (notificationId: string | number) => {
    const id = String(notificationId)

    try {
      await $fetch(`/api/notifications/${id}`, {
        method: "PATCH",
      })

      notifications.value = notifications.value.map((notification) =>
        String(notification.id) === id ? { ...notification, read: true } : notification,
      )
    } catch {
      return
    }
  }

  const markAllNotificationsRead = async () => {
    try {
      await $fetch("/api/notifications/read-all", {
        method: "POST",
      })

      notifications.value = notifications.value.map((notification) => ({
        ...notification,
        read: true,
      }))
    } catch {
      return
    }
  }

  return {
    notifications,
    isLoading: computed(() => isLoading.value),
    loadNotifications,
    startNotificationRealtime,
    stopNotificationRealtime,
    markNotificationRead,
    markAllNotificationsRead,
  }
}
