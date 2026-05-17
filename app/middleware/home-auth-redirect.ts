export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path !== "/") return

  const destinationFor = (accountType: string | null | undefined) =>
    accountType === "ADMIN" ? "/admin/disputes" : "/dashboard"

  // --- Server-side: use the authenticated user from event context (set by server middleware) ---
  if (import.meta.server) {
    const authUser = useRequestEvent()?.context.authUser
    if (authUser) {
      return navigateTo(destinationFor(authUser.accountType), {
        replace: true,
        redirectCode: 302,
      })
    }
    return
  }

  const { authUser, refresh: refreshAuthUser, clear: clearAuthUser } = useAuthUser()
  const { getSession, ensureBridgedSession, clear: clearViewerSession } = useViewerSession()
  const { clear: clearBridge } = useSessionBridge()

  const clearAuthCaches = () => {
    clearAuthUser()
    clearBridge()
    clearViewerSession()
  }

  const session = await getSession({ force: true })
  if (!session) {
    if (authUser.value) {
      clearAuthCaches()
    }
    return
  }

  if (!(await ensureBridgedSession())) {
    clearAuthCaches()
    return
  }

  const fetchedUser = await refreshAuthUser()
  if (!fetchedUser) {
    clearAuthCaches()
    return
  }

  if (authUser.value?.id && authUser.value.id !== fetchedUser.id) {
    clearAuthCaches()
  }

  return navigateTo(destinationFor(fetchedUser.accountType), { replace: true })
})
