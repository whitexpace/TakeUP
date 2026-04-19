import { z } from "zod"

export const notificationIdSchema = z.object({
  id: z.string().uuid(),
})

export const appNotificationTypeSchema = z.enum(["BOOKING_RETURN_REQUESTED", "DISPUTE_OPENED"])

export const listNotificationsSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(20),
  })
  .default({})

export const appNotificationSchema = z.object({
  id: z.string().uuid(),
  type: appNotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  actionPath: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.coerce.date(),
})

export type AppNotification = z.infer<typeof appNotificationSchema>
export type AppNotificationType = z.infer<typeof appNotificationTypeSchema>
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>
