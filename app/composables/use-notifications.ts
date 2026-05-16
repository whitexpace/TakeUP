import { computed } from "vue"
import type { AppHeaderNotification } from "../types/notifications"

type ApiNotification = {
  id: string
  type: AppHeaderNotification["type"]
  title: string
  body: string
  actionPath: string | null
  createdAt: string | Date
  read: boolean
}

const normalizeNotification = (notification: ApiNotification): AppHeaderNotification => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  actionPath: notification.actionPath,
  createdAt: new Date(notification.createdAt),
  read: Boolean(notification.read),
})

export const useNotifications = () => {
  const notifications = useState<AppHeaderNotification[]>("app-notifications", () => [])
  const isLoading = useState("app-notifications-loading", () => false)

  const loadNotifications = async () => {
    if (isLoading.value) return
    isLoading.value = true

    try {
      const response = await $fetch<ApiNotification[]>("/api/notifications")
      notifications.value = response.map(normalizeNotification)
    } catch {
      notifications.value = []
    } finally {
      isLoading.value = false
    }
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
    markNotificationRead,
    markAllNotificationsRead,
  }
}
