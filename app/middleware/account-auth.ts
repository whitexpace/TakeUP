/**
 * Ensures users navigating to /account/* have a valid custom JWT session.
 * If they have a Supabase session but no custom JWT, we bridge it automatically.
 * If neither, redirect to /.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/account")) return

  // Only run on client — server doesn't have access to Supabase client session
  if (import.meta.server) return

  const supabase = useSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return navigateTo("/")
  }

  const { ensureBridged } = useSessionBridge()
  await ensureBridged(session.access_token)
})
