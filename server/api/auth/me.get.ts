import { createError } from "h3"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const { user } = await createContext(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be authenticated to access this resource.",
      data: {
        error: {
          code: "AUTH_UNAUTHORIZED",
          message: "You must be authenticated to access this resource.",
        },
      },
    })
  }

  return { user }
})
