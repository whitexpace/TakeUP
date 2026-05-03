/**
 * Ensures users navigating to /admin/* have a valid session and admin access.
 */
type AdminAuthCache = {
  accessToken: string | null
  accountType: string | null
  checked: boolean
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/admin")) return

  if (import.meta.server) return

  const supabase = useSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const authCache = useState<AdminAuthCache>("admin-auth-cache", () => ({
    accessToken: null,
    accountType: null,
    checked: false,
  }))

  if (!session) {
    authCache.value = { accessToken: null, accountType: null, checked: false }
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

  if (authCache.value.checked && authCache.value.accessToken === session.access_token) {
    if (authCache.value.accountType !== "ADMIN") {
      return navigateTo("/account")
    }

    return
  }

  try {
    const response = await $fetch<{ user: { accountType: string | null } }>("/api/auth/me")
    authCache.value = {
      accessToken: session.access_token,
      accountType: response.user.accountType,
      checked: true,
    }

    if (response.user.accountType !== "ADMIN") {
      return navigateTo("/account")
    }
  } catch {
    authCache.value = { accessToken: null, accountType: null, checked: false }
    return navigateTo("/account")
  }
})
