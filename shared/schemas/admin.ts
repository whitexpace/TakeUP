import { z } from "zod"
import { itemCategorySchema, itemIdSchema } from "./item"

export const adminListingViewStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "DEACTIVATED_BY_ADMIN",
  "REMOVED_BY_ADMIN",
])

export const adminListingsCursorSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
})

export const listAdminListingsSchema = z.object({
  statuses: z.array(adminListingViewStatusSchema).min(1).optional(),
  categories: z.array(itemCategorySchema).min(1).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: adminListingsCursorSchema.optional(),
})

export const moderateAdminListingSchema = itemIdSchema.extend({
  confirmation: z.literal(true),
})

export const adminActionLogTargetTypeSchema = z.enum(["LISTING", "USER"])

export const adminActionLogsCursorSchema = z.object({
  id: z.string(),
  createdAt: z.coerce.date(),
})

export const listAdminActionLogsSchema = z.object({
  targetType: adminActionLogTargetTypeSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: adminActionLogsCursorSchema.optional(),
})

export type AdminListingViewStatus = z.infer<typeof adminListingViewStatusSchema>
