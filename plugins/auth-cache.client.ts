/**
 * Clears the cached auth user and session bridge whenever the Supabase session changes.
 * Uses Supabase auth events instead of a raw user watcher so initial client
 * hydration does not wipe a valid persisted cache and force /api/auth/me again.
 */
export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  const supabase = useSupabaseClient()
  const { authUser, clear } = useAuthUser()
  const { bridgedAccessToken, clear: clearBridge } = useSessionBridge()
  const { clear: clearViewerSession } = useViewerSession()

  const clearAuthCaches = () => {
    clear()
    clearBridge()
    clearViewerSession()
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user?.id ?? null

    if (event === "SIGNED_OUT") {
      clearAuthCaches()
      return
    }

    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      clearAuthCaches()
      return
    }

    if (
      event === "SIGNED_IN" &&
      (!nextUserId ||
        (authUser.value?.id && authUser.value.id !== nextUserId) ||
        (bridgedAccessToken.value && bridgedAccessToken.value !== session?.access_token))
    ) {
      clearAuthCaches()
    }
  })

  import.meta.hot?.dispose(() => {
    subscription.unsubscribe()
  })
})
