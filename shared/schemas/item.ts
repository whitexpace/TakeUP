import { z } from "zod"

export const itemIdSchema = z.object({
  id: z.string().uuid(),
})

export const itemConditionSchema = z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"])

export const itemCategorySchema = z.enum([
  "ELECTRONICS",
  "BOOKS",
  "CLOTHING",
  "TOOLS",
  "HOME_APPLIANCES",
  "SPORTS_OUTDOORS",
  "MUSIC_AUDIO",
  "TOYS_GAMES",
  "FURNITURE",
  "VEHICLES_ACCESSORIES",
  "HEALTH_BEAUTY",
  "SCHOOL_SUPPLIES",
  "PET_SUPPLIES",
  "OTHER",
])

export const createItemSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  condition: itemConditionSchema,
  category: itemCategorySchema,
  rentalFee: z.number().int().min(0),
  availabilityDates: z.array(z.coerce.date()).default([]),
  freeToBorrow: z.boolean().default(false),
  photos: z.array(z.string().url()).default([]),
})

export const updateItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    condition: itemConditionSchema.optional(),
    category: itemCategorySchema.optional(),
    rentalFee: z.number().int().min(0).optional(),
    availabilityDates: z.array(z.coerce.date()).optional(),
    freeToBorrow: z.boolean().optional(),
    photos: z.array(z.string().url()).optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.condition !== undefined ||
      payload.category !== undefined ||
      payload.rentalFee !== undefined ||
      payload.availabilityDates !== undefined ||
      payload.freeToBorrow !== undefined ||
      payload.photos !== undefined,
    { message: "At least one field is required for update." },
  )

export const deleteItemSchema = itemIdSchema
