import { useViewerSession } from "../composables/use-viewer-session"

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path !== "/") return

  const destinationFor = (accountType: string | null | undefined) =>
    accountType === "ADMIN" ? "/admin/disputes" : "/dashboard"

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

  const { authUser, hasFreshCache: hasFreshAuthUserCache, fetch: fetchAuthUser } = useAuthUser()
  if (authUser.value) {
    return navigateTo(destinationFor(authUser.value.accountType), { replace: true })
  }

  const { ensureBridgedSession } = useViewerSession()
  if (!(await ensureBridgedSession())) {
    return
  }

  if (!hasFreshAuthUserCache.value && !authUser.value) {
    const fetchedUser = await fetchAuthUser()
    if (!fetchedUser) {
      return
    }

    return navigateTo(destinationFor(fetchedUser.accountType), { replace: true })
  }

  const fetchedUser = authUser.value
  if (!fetchedUser) {
    return
  }

  return navigateTo(destinationFor(fetchedUser.accountType), { replace: true })
})
