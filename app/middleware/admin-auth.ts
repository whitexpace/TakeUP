/**
 * Ensures users navigating to /admin/* have a valid session and admin access.
 * On the server, verifies admin status from the JWT session cookie for instant SSR.
 * On the client, caches verification so subsequent navigations are instant.
 */
import { useViewerSession } from "../composables/use-viewer-session"

type AdminAuthCache = {
  accessToken: string | null
  accountType: string | null
  checked: boolean
}

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
  const authCache = useState<AdminAuthCache>("admin-auth-cache", () => ({
    accessToken: null,
    accountType: null,
    checked: false,
  }))

  const { getAccessToken, ensureBridgedSession } = useViewerSession()
  const accessToken = await getAccessToken()

  if (!accessToken) {
    authCache.value = { accessToken: null, accountType: null, checked: false }
    return navigateTo("/")
  }

  const verifiedAccessToken = useState<string | null>("admin-verified-access-token", () => null)

  // Skip both bridge and admin check if we already verified this token
  if (verifiedAccessToken.value === accessToken) return

  if (!(await ensureBridgedSession())) {
    return navigateTo("/")
  }

  if (authCache.value.checked && authCache.value.accessToken === accessToken) {
    if (authCache.value.accountType !== "ADMIN") {
      return navigateTo("/account")
    }

    return
  }

  try {
    const { authUser: cachedAuthUser, fetch: fetchAuthUser } = useAuthUser()
    const authUser = cachedAuthUser.value ?? (await fetchAuthUser())

    authCache.value = {
      accessToken,
      accountType: authUser?.accountType ?? null,
      checked: true,
    }

    if (authUser?.accountType !== "ADMIN") {
      return navigateTo("/account")
    }

    verifiedAccessToken.value = accessToken
  } catch {
    authCache.value = { accessToken: null, accountType: null, checked: false }
    return navigateTo("/account")
  }
})
