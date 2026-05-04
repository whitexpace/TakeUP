import { createError, getRouterParam, readBody } from "h3"
import { moderateAdminListingSchema } from "../../../../../shared/schemas/admin"
import { appRouter } from "../../../../trpc/routers"
import { createContext } from "../../../../trpc/context"
import { handleAdminApiError } from "../../handle-admin-api-error"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  const body = await readBody(event)

  const parsed = moderateAdminListingSchema.safeParse({
    id,
    confirmation: Boolean(body?.confirmation),
  })

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid moderation request." })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.admin.listings.remove(parsed.data)
  } catch (error) {
    handleAdminApiError(error)
  }
})
