import { deleteCookie } from "h3"
import { sessionCookieName } from "../../utils/auth-session"

export default defineEventHandler((event) => {
  deleteCookie(event, sessionCookieName, { path: "/" })
  return { ok: true }
})
