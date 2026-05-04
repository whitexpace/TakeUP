import { TRPCError } from "@trpc/server"
import { createError, getQuery } from "h3"
import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"
import { listingAnalyticsQuerySchema } from "#shared/schemas/listing-analytics"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const result = listingAnalyticsQuerySchema.safeParse({
    range: typeof query.range === "string" ? query.range : undefined,
  })

  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid analytics query parameters." })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.listingAnalytics.list(result.data)
  } catch (err) {
    if (err instanceof TRPCError && err.code === "UNAUTHORIZED") {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
    }

    throw err
  }
})
