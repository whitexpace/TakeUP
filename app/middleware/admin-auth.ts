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

const reloadOnceAfterBridge = (accessToken: string, path: string) => {
  if (!import.meta.client) return false

  const reloadKey = `takeup:admin-bridge-reload:${accessToken.slice(-24)}`
  if (window.sessionStorage.getItem(reloadKey) === "1") return false

  window.sessionStorage.setItem(reloadKey, "1")
  window.location.replace(path)
  return true
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
  const nuxtApp = useNuxtApp()
  const cookieAccountType = useState<string | null>("session-cookie-account-type", () => null)
  const serverRenderedAppSession = cookieAccountType.value !== null
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

  if (nuxtApp.isHydrating && !serverRenderedAppSession) {
    if (reloadOnceAfterBridge(accessToken, to.fullPath)) {
      return abortNavigation()
    }

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
