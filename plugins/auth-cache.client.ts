/**
 * Clears the cached auth user and session bridge whenever the Supabase session changes.
 * Uses Supabase auth events instead of a raw user watcher so initial client
 * hydration does not wipe a valid persisted cache and force /api/auth/me again.
 */
export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  const supabase = useSupabaseClient()
  const { clear } = useAuthUser()
  const { clear: clearBridge } = useSessionBridge()
  const { clear: clearViewerSession } = useViewerSession()

  supabase.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user?.id ?? null

    if (event === "SIGNED_OUT") {
      clear()
      clearBridge()
      clearViewerSession()
      return
    }

    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      clear()
      clearBridge()
      clearViewerSession()
      return
    }

    if (event === "SIGNED_IN" && !nextUserId) {
      clear()
      clearBridge()
      clearViewerSession()
    }
  })
})
