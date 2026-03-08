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

// UI-only sentinel: items whose DB category is not covered by any sidebar panel entry.
// Never stored in the database – used only as a filter value.
export const UI_OTHERS_SENTINEL = "OTHERS" as const

// All real DB categories that the sidebar explicitly covers.
// Items whose every category falls outside this list are shown under "Others".
export const KNOWN_SIDEBAR_DB_CATEGORIES = [
  "BOOKS",
  "ELECTRONICS",
  "SPORTS_OUTDOORS",
  "SCHOOL_SUPPLIES",
  "MUSIC_AUDIO",
  "TOOLS",
  "CLOTHING",
  "HOME_APPLIANCES",
  "TOYS_GAMES",
  "FURNITURE",
  "VEHICLES_ACCESSORIES",
  "HEALTH_BEAUTY",
  "PET_SUPPLIES",
] as const satisfies ReadonlyArray<z.infer<typeof itemCategorySchema>>

// Zod schema accepted by filter endpoints – real categories + the UI sentinel
export const uiCategoryFilterSchema = z.union([itemCategorySchema, z.literal(UI_OTHERS_SENTINEL)])

export const itemAvailabilityStatusSchema = z.enum(["AVAILABLE", "RENTED"])
export const itemStatusSchema = z.enum(["AVAILABLE", "RENTED", "DEACTIVATED", "DELETED"])
export const rateOptionSchema = z.enum(["PER_HOUR", "PER_DAY"])

const dedupe = <T>(items: T[]) => Array.from(new Set(items))

export const itemTagsSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(50)
      .transform((tag) => tag.trim().toLowerCase()),
  )
  .default([])
  .transform((tags) => dedupe(tags.filter(Boolean)))

export const itemAvailabilityRangeSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: itemAvailabilityStatusSchema,
  })
  .refine((range) => range.endDate > range.startDate, {
    message: "endDate must be later than startDate.",
    path: ["endDate"],
  })

const hasOverlappingAvailabilityRanges = (ranges: Array<{ startDate: Date; endDate: Date }>) => {
  const sorted = [...ranges].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  let previousRange: { startDate: Date; endDate: Date } | undefined
  for (const currentRange of sorted) {
    if (previousRange && previousRange.endDate > currentRange.startDate) {
      return true
    }
    previousRange = currentRange
  }
  return false
}

export const itemAvailabilitySchema = z
  .array(itemAvailabilityRangeSchema)
  .default([])
  .superRefine((ranges, ctx) => {
    if (hasOverlappingAvailabilityRanges(ranges)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Availability ranges must not overlap.",
      })
    }
  })

export const createItemSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  condition: itemConditionSchema,
  status: itemStatusSchema.default("AVAILABLE"),
  rateOption: rateOptionSchema.default("PER_DAY"),
  categories: z
    .array(itemCategorySchema)
    .min(1)
    .transform((categories) => dedupe(categories)),
  tags: itemTagsSchema,
  rentalFee: z.number().int().min(0),
  replacementCost: z.number().int().min(0).optional(),
  availability: itemAvailabilitySchema,
  freeToBorrow: z.boolean().default(false),
  whatItemOffers: z.string().max(2000).optional(),
  whatIsIncluded: z.string().max(2000).optional(),
  knownIssues: z.string().max(2000).optional(),
  usageLimitations: z.string().max(2000).optional(),
  thumbnailImage: z.string().url().optional(),
  isTrending: z.boolean().optional(),
  viewCount: z.number().int().min(0).optional(),
  bookingCount: z.number().int().min(0).optional(),
  likeCount: z.number().int().min(0).optional(),
  photos: z.array(z.string().url()).default([]),
})

export const updateItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    condition: itemConditionSchema.optional(),
    status: itemStatusSchema.optional(),
    rateOption: rateOptionSchema.optional(),
    categories: z
      .array(itemCategorySchema)
      .min(1)
      .transform((categories) => dedupe(categories))
      .optional(),
    tags: itemTagsSchema.optional(),
    rentalFee: z.number().int().min(0).optional(),
    replacementCost: z.number().int().min(0).nullable().optional(),
    availability: itemAvailabilitySchema.optional(),
    freeToBorrow: z.boolean().optional(),
    whatItemOffers: z.string().max(2000).nullable().optional(),
    whatIsIncluded: z.string().max(2000).nullable().optional(),
    knownIssues: z.string().max(2000).nullable().optional(),
    usageLimitations: z.string().max(2000).nullable().optional(),
    thumbnailImage: z.string().url().nullable().optional(),
    isTrending: z.boolean().optional(),
    viewCount: z.number().int().min(0).optional(),
    bookingCount: z.number().int().min(0).optional(),
    likeCount: z.number().int().min(0).optional(),
    photos: z.array(z.string().url()).optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.condition !== undefined ||
      payload.status !== undefined ||
      payload.rateOption !== undefined ||
      payload.categories !== undefined ||
      payload.tags !== undefined ||
      payload.rentalFee !== undefined ||
      payload.replacementCost !== undefined ||
      payload.availability !== undefined ||
      payload.freeToBorrow !== undefined ||
      payload.whatItemOffers !== undefined ||
      payload.whatIsIncluded !== undefined ||
      payload.knownIssues !== undefined ||
      payload.usageLimitations !== undefined ||
      payload.thumbnailImage !== undefined ||
      payload.isTrending !== undefined ||
      payload.viewCount !== undefined ||
      payload.bookingCount !== undefined ||
      payload.likeCount !== undefined ||
      payload.photos !== undefined,
    { message: "At least one field is required for update." },
  )

export const deleteItemSchema = itemIdSchema

export const itemFilterSchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  status: itemStatusSchema.optional(),
  statuses: z.array(itemStatusSchema).min(1).optional(),
  categories: z
    .array(uiCategoryFilterSchema)
    .min(1)
    .transform((categories) => dedupe(categories))
    .optional(),
  tags: itemTagsSchema.optional(),
  conditions: z
    .array(itemConditionSchema)
    .min(1)
    .transform((conditions) => dedupe(conditions))
    .optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  freeToBorrow: z.boolean().optional(),
  availableFrom: z.coerce.date().optional(),
  availableTo: z.coerce.date().optional(),
})

export const listItemsSchema = itemFilterSchema.optional()

export const itemPaginationCursorSchema = z.object({
  id: z.string().uuid(),
  bookingCount: z.number().int().min(0),
  createdAt: z.coerce.date(),
})

export const paginatedItemsSchema = itemFilterSchema
  .extend({
    limit: z.number().int().min(1).max(48).default(12),
    cursor: itemPaginationCursorSchema.optional(),
  })
  .default({})
