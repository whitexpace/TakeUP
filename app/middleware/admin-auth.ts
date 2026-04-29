/**
 * Ensures users navigating to /admin/* have a valid session and admin access.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/admin")) return

  if (import.meta.server) return

  const supabase = useSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return navigateTo("/")
  }

  const bridgedAccessToken = useState<string | null>("admin-bridged-access-token", () => null)
  if (bridgedAccessToken.value !== session.access_token) {
    try {
      await $fetch("/api/auth/supabase-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } finally {
      bridgedAccessToken.value = session.access_token
    }
  }

  try {
    const response = await $fetch<{ user: { accountType: string | null } }>("/api/auth/me")

    if (response.user.accountType !== "ADMIN") {
      return navigateTo("/account")
    }
  } catch {
    return navigateTo("/account")
  }
})
