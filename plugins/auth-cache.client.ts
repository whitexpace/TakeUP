/**
 * Clears the cached auth user and session bridge whenever the Supabase session changes.
 * - On logout (user becomes null): clears immediately.
 * - On login / token refresh (user changes): clears so next access re-fetches.
 */
export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  const supabaseUser = useSupabaseUser()
  const { clear } = useAuthUser()
  const { clear: clearBridge } = useSessionBridge()
  const { clear: clearViewerSession } = useViewerSession()

  let previousUserId: string | null | undefined = supabaseUser.value?.id ?? null

  watch(supabaseUser, (newUser) => {
    const newUserId = newUser?.id ?? null
    if (newUserId !== previousUserId) {
      clear()
      clearBridge()
      clearViewerSession()
      previousUserId = newUserId
    }
  })
})
