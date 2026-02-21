import { getCookie } from "h3"
import { sessionCookieName, verifySessionToken, type SessionUser } from "../utils/auth-session"
import { AuthApiError } from "../utils/auth-errors"

export default defineEventHandler((event) => {
  const token = getCookie(event, sessionCookieName)
  if (!token) {
    return
  }

  try {
    const runtimeConfig = useRuntimeConfig(event)
    const session = verifySessionToken(token, runtimeConfig.jwtSecret)
    event.context.authUser = session.user
  } catch (error) {
    if (error instanceof AuthApiError) {
      return
    }
    return
  }
})

declare module "h3" {
  interface H3EventContext {
    authUser?: SessionUser
  }
}
