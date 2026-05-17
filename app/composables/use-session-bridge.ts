/**
 * Shared composable for bridging Supabase auth → custom JWT session cookie.
 * Ensures the bridge call only happens once per unique Supabase access token,
 * regardless of how many middleware/components need it.
 *
 * Optimizations:
 * - SSR hydration: if the server already authenticated via JWT cookie, skips the POST
 * - In-flight dedup: concurrent callers share a single network request
 */

import type { AuthMeUser } from "./use-auth-user"

type SupabaseSessionBridgeResponse = {
  ok: boolean
  expiresAt: string
  user?: AuthMeUser
}

type InflightBridge = {
  accessToken: string
  request: Promise<boolean>
}

// Client-only in-flight promise so concurrent callers for the same token share one request
let inflightBridge: InflightBridge | null = null

export const useSessionBridge = () => {
  const bridgedAccessToken = useState<string | null>("session-bridged-access-token", () => null)
  // Hydrated by plugins/session-hydrate.server.ts when the JWT cookie is valid during SSR
  const cookieEmail = useState<string | null>("session-cookie-email", () => null)
  const cookieAccountType = useState<string | null>("session-cookie-account-type", () => null)

  /**
   * Bridge the Supabase access token to a server-side httpOnly JWT cookie.
   * Returns `true` if the bridge succeeded (or was already done), `false` on failure.
   */
  const ensureBridged = async (accessToken: string): Promise<boolean> => {
    if (bridgedAccessToken.value === accessToken) return true

    if (inflightBridge && inflightBridge.accessToken !== accessToken) {
      inflightBridge = null
    }

    // SSR confirmed a valid cookie — skip POST if it belongs to the same user
    if (cookieEmail.value) {
      const tokenEmail = decodeJwtEmail(accessToken)
      if (tokenEmail && tokenEmail.toLowerCase() === cookieEmail.value.toLowerCase()) {
        bridgedAccessToken.value = accessToken
        cookieEmail.value = null
        return true
      }
      cookieEmail.value = null
    }

    // Deduplicate concurrent bridge calls
    if (inflightBridge) return inflightBridge.request

    const request = $fetch<SupabaseSessionBridgeResponse>("/api/auth/supabase-session", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((response) => {
        if (inflightBridge?.request !== request || !response.ok) {
          return false
        }

        bridgedAccessToken.value = accessToken
        cookieAccountType.value = response.user?.accountType ?? null
        if (response.user) {
          const { setCached } = useAuthUser()
          setCached(response.user)
        }
        return true
      })
      .catch(() => false)
      .finally(() => {
        if (inflightBridge?.request === request) {
          inflightBridge = null
        }
      })

    inflightBridge = { accessToken, request }

    return request
  }

  /** Clear bridge state (call on logout / user switch). */
  const clear = () => {
    bridgedAccessToken.value = null
    cookieEmail.value = null
    cookieAccountType.value = null
    inflightBridge = null
  }

  return { bridgedAccessToken, ensureBridged, clear }
}

/** Decode the email claim from a JWT payload without cryptographic verification. */
function decodeJwtEmail(token: string): string | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3 || !parts[1]) return null
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(base64)) as { email?: string }
    return payload.email ?? null
  } catch {
    return null
  }
}
