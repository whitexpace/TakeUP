/**
 * Shared composable that fetches and caches the current user's profile from /api/auth/me.
 * The result is stored in useState so it's computed once and shared across
 * all components, pages, and middleware for the lifetime of the client session.
 * Re-fetches only when explicitly requested (e.g. after profile edits).
 *
 * Client-only — must not run during SSR (module-level dedup is not request-scoped).
 */
import { computed } from "vue"
import { usePersistedSessionState } from "./use-persisted-session-state"
import { recordPerfEvent, withPerfTimer } from "../utils/performance-telemetry"

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
const AUTH_USER_CACHE_TTL_MS = 60_000

export const useAuthUser = () => {
  const authUser = usePersistedSessionState<AuthMeUser | null>("auth-user-cache", () => null)
  const lastFetchedAt = usePersistedSessionState<number | null>(
    "auth-user-cache:fetched-at",
    () => null,
  )
  const hasFreshCache = computed(
    () =>
      Boolean(authUser.value) &&
      lastFetchedAt.value !== null &&
      Date.now() - lastFetchedAt.value < AUTH_USER_CACHE_TTL_MS,
  )

  /** Seed the shared cache from another authenticated endpoint. */
  const setCached = (user: AuthMeUser | null) => {
    authUser.value = user
    lastFetchedAt.value = user ? Date.now() : null
  }

  /** Fetch once; returns cached value on subsequent calls. */
  const fetch = async (): Promise<AuthMeUser | null> => {
    if (import.meta.server) return null
    if (hasFreshCache.value) {
      recordPerfEvent("auth-user", "me", "cache-hit")
      return authUser.value
    }

    if (authUser.value) {
      recordPerfEvent("auth-user", "me", "cache-stale")
    } else {
      recordPerfEvent("auth-user", "me", "cache-miss")
    }

    if (inflightRequest) {
      recordPerfEvent("auth-user", "me", "request-dedup-hit")
      return inflightRequest
    }

    inflightRequest = withPerfTimer("auth-user", "me", () =>
      $fetch<{ user: AuthMeUser }>("/api/auth/me"),
    )
      .then((response) => {
        authUser.value = response.user
        lastFetchedAt.value = Date.now()
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
    recordPerfEvent("auth-user", "me", "cache-bypass")
    try {
      const response = await withPerfTimer("auth-user", "me", () =>
        $fetch<{ user: AuthMeUser }>("/api/auth/me"),
      )
      authUser.value = response.user
      lastFetchedAt.value = Date.now()
      return response.user
    } catch {
      authUser.value = null
      lastFetchedAt.value = null
      return null
    }
  }

  /** Clear cache (call on logout). */
  const clear = () => {
    authUser.value = null
    lastFetchedAt.value = null
    inflightRequest = null
  }

  return { authUser, hasFreshCache, fetch, refresh, clear, setCached }
}
