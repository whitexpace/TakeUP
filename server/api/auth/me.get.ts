import { createError } from "h3"
import type { SessionUser } from "../../utils/auth-session"

export default defineEventHandler((event) => {
  const user = event.context.authUser as SessionUser | undefined
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
