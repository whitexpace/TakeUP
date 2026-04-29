/**
 * Shared composable that fetches and caches the current user's profile from /api/auth/me.
 * The result is stored in useState so it's computed once and shared across
 * all components, pages, and middleware for the lifetime of the client session.
 * Re-fetches only when explicitly requested (e.g. after profile edits).
 *
 * Client-only — must not run during SSR (module-level dedup is not request-scoped).
 */

export type AuthMeUser = {
  id: string
  email: string
  name: string
  username: string
  firstName: string
  middleName: string | null
  lastName: string
  accountType: string | null
  createdAt: string | null
  location: string | null
  avatarUrl: string | null
  bio: string | null
  pronouns: string | null
}

// Client-only in-flight promise so concurrent callers share one network request
let inflightRequest: Promise<AuthMeUser | null> | null = null

export const useAuthUser = () => {
  const authUser = useState<AuthMeUser | null>("auth-user-cache", () => null)

  /** Fetch once; returns cached value on subsequent calls. */
  const fetch = async (): Promise<AuthMeUser | null> => {
    if (import.meta.server) return null
    if (authUser.value) return authUser.value
    if (inflightRequest) return inflightRequest

    inflightRequest = $fetch<{ user: AuthMeUser }>("/api/auth/me")
      .then((response) => {
        authUser.value = response.user
        return response.user
      })
      .catch(() => {
        return null
      })
      .finally(() => {
        inflightRequest = null
      })

    return inflightRequest
  }

  /** Force re-fetch (e.g. after profile update). Keeps old value visible until new data arrives. */
  const refresh = async (): Promise<AuthMeUser | null> => {
    if (import.meta.server) return null
    inflightRequest = null
    try {
      const response = await $fetch<{ user: AuthMeUser }>("/api/auth/me")
      authUser.value = response.user
      return response.user
    } catch {
      authUser.value = null
      return null
    }
  }

  /** Clear cache (call on logout). */
  const clear = () => {
    authUser.value = null
    inflightRequest = null
  }

  return { authUser, fetch, refresh, clear }
}
