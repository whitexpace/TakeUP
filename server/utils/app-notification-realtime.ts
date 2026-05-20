import { createClient } from "@supabase/supabase-js"
import type { H3Event } from "h3"

type BroadcastableAppNotification = {
  id: string
  recipientUserId: string
  actorUserId: string | null
  bookingId: string | null
  type: string
  title: string
  body: string
  actionPath: string | null
  readAt: Date | string | null
  createdAt: Date | string
}

const notificationTopic = (userId: string) => `app-notifications-user-${userId}`

const normalizeNotification = (notification: BroadcastableAppNotification) => ({
  id: notification.id,
  recipientUserId: notification.recipientUserId,
  actorUserId: notification.actorUserId,
  bookingId: notification.bookingId,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  actionPath: notification.actionPath,
  readAt:
    notification.readAt instanceof Date ? notification.readAt.toISOString() : notification.readAt,
  createdAt:
    notification.createdAt instanceof Date
      ? notification.createdAt.toISOString()
      : notification.createdAt,
})

export const getAppNotificationBroadcastTopic = (userId: string) => notificationTopic(userId)

export const broadcastAppNotification = async (
  event: H3Event,
  notification: BroadcastableAppNotification,
) => {
  const runtimeConfig = useRuntimeConfig(event)
  const supabaseUrl = runtimeConfig.public.supabase?.url
  const serviceRoleKey = runtimeConfig.supabaseServiceRoleKey

  if (!supabaseUrl || !serviceRoleKey) {
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  await supabase
    .channel(notificationTopic(notification.recipientUserId))
    .httpSend("notification", { notification: normalizeNotification(notification) })
}
