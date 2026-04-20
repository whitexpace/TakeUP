import { z } from "zod"

export const listingAnalyticsRangeSchema = z.enum(["7d", "30d", "90d", "all"])

export const listingAnalyticsQuerySchema = z
  .object({
    range: listingAnalyticsRangeSchema.default("all"),
  })
  .default({ range: "all" })

export type ListingAnalyticsRange = z.infer<typeof listingAnalyticsRangeSchema>
