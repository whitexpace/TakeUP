/**
 * Ensures users navigating to /account/* have a valid custom JWT session.
 * If they have a Supabase session but no custom JWT, we bridge it automatically.
 * If neither, redirect to /.
 */
import { useViewerSession } from "../composables/use-viewer-session"

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/account")) return

  if (import.meta.server) {
    if (!useRequestEvent()?.context.authUser) {
      return navigateTo("/")
    }

    return
  }

  const { ensureBridgedSession } = useViewerSession()
  if (!(await ensureBridgedSession())) {
    return navigateTo("/")
  }
})
