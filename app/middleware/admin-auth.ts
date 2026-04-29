/**
 * Ensures users navigating to /admin/* have a valid session and admin access.
 * On the server, verifies admin status from the JWT session cookie for instant SSR.
 * On the client, caches verification so subsequent navigations are instant.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/admin")) return

  // --- Server-side: check JWT session directly for SSR ---
  if (import.meta.server) {
    const event = useRequestEvent()
    const authUser = event?.context.authUser
    if (!authUser) {
      return navigateTo("/")
    }
    if (authUser.accountType !== "ADMIN") {
      return navigateTo("/account")
    }
    return
  }

  // --- Client-side: bridge Supabase session and verify admin status ---
  const supabase = useSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return navigateTo("/")
  }

  const verifiedAccessToken = useState<string | null>("admin-verified-access-token", () => null)

  // Skip both bridge and admin check if we already verified this token
  if (verifiedAccessToken.value === session.access_token) return

  const { ensureBridged } = useSessionBridge()
  if (!(await ensureBridged(session.access_token))) {
    return navigateTo("/")
  }

  try {
    const { fetch: fetchAuthUser } = useAuthUser()
    const authUser = await fetchAuthUser()

    if (authUser?.accountType !== "ADMIN") {
      return navigateTo("/account")
    }

    verifiedAccessToken.value = session.access_token
  } catch {
    return navigateTo("/account")
  }
})
