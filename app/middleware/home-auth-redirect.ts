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

  // --- Client-side: Failsafe to break infinite redirect loops ---
  const supabase = useSupabaseClient()

  // 1. Check if we actually have a valid Supabase session.
  // We use getSession() instead of the reactive useSupabaseUser() because
  // getSession() is the ground truth and doesn't flicker as much.
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    // If no real Supabase session exists, definitely stay on the home page
    // and ensure our local caches are cleared to prevent stale redirects.
    const { clear: clearAuth } = useAuthUser()
    const { clear: clearBridge } = useSessionBridge()
    clearAuth()
    clearBridge()
    return
  }

  // 2. We have a Supabase session. Now check if we have our custom bridged session.
  const { authUser, fetch: fetchAuthUser } = useAuthUser()
  let user = authUser.value

  // If no cached user profile, try to fetch it.
  if (!user) {
    user = await fetchAuthUser()
  }

  // 3. If we have both a Supabase session AND a user profile, it's safe to redirect.
  if (user) {
    return navigateTo(destinationFor(user.accountType), { replace: true })
  }
})
