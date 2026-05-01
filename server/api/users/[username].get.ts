import { createError, getRouterParam } from "h3"
import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username")

  if (!username) {
    throw createError({
      statusCode: 400,
      statusMessage: "Username is required.",
    })
  }

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.user.getPublicProfile({ username })
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "NOT_FOUND"
    ) {
      throw createError({
        statusCode: 404,
        statusMessage: "User not found.",
      })
    }
    throw error
  }
})
