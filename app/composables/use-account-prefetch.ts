const ACCOUNT_PREFETCH_TTL_MS = 30_000

let pendingAccountWarmup: Promise<void> | null = null
let lastAccountWarmupAt = 0

export const useAccountPrefetch = () => {
  const user = useSupabaseUser()
  const { authUser, hasFreshCache: hasFreshAuthUserCache, fetch: fetchAuthUser } = useAuthUser()
  const { ensureBridgedSession } = useViewerSession()

  const warmAccount = (targetPath = "/account"): Promise<void> => {
    if (!import.meta.client) return Promise.resolve()

    void preloadRouteComponents(targetPath).catch(() => {})

    if (!user.value) return Promise.resolve()

    const now = Date.now()
    if (pendingAccountWarmup) {
      return pendingAccountWarmup
    }

    if (hasFreshAuthUserCache.value && now - lastAccountWarmupAt < ACCOUNT_PREFETCH_TTL_MS) {
      return Promise.resolve()
    }

    pendingAccountWarmup = (async () => {
      if (!(await ensureBridgedSession())) return

      if (!hasFreshAuthUserCache.value && !authUser.value) {
        await fetchAuthUser()
      }

      lastAccountWarmupAt = Date.now()
    })()
      .catch(() => {})
      .finally(() => {
        pendingAccountWarmup = null
      })

    return pendingAccountWarmup
  }

  return {
    warmAccount,
  }
}
