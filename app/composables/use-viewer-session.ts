type CachedViewerSession = Awaited<
  ReturnType<ReturnType<typeof useSupabaseClient>["auth"]["getSession"]>
>["data"]["session"]
type ViewerAuthHeaders = Record<string, string> | undefined
type GetViewerSessionOptions = {
  force?: boolean
}

let inflightSessionRequest: Promise<CachedViewerSession> | null = null
const SESSION_EXPIRY_BUFFER_SECONDS = 30

const hasUsableCachedSession = (cachedSession: CachedViewerSession | null) => {
  if (!cachedSession?.expires_at) return true

  return cachedSession.expires_at > Math.floor(Date.now() / 1000) + SESSION_EXPIRY_BUFFER_SECONDS
}

export const useViewerSession = () => {
  const session = useState<CachedViewerSession | null>("viewer-session-cache", () => null)
  const loadedSession = useState<boolean>("viewer-session-loaded", () => false)

  const clear = () => {
    session.value = null
    loadedSession.value = false
    inflightSessionRequest = null
  }

  const getSession = async (options: GetViewerSessionOptions = {}) => {
    if (import.meta.server) {
      return null
    }

    if (!options.force && loadedSession.value && hasUsableCachedSession(session.value)) {
      return session.value
    }

    if (inflightSessionRequest) {
      return inflightSessionRequest
    }

    const supabase = useSupabaseClient()
    inflightSessionRequest = supabase.auth
      .getSession()
      .then(({ data }) => {
        session.value = data.session
        loadedSession.value = true
        return data.session
      })
      .finally(() => {
        inflightSessionRequest = null
      })

    return inflightSessionRequest
  }

  const getAccessToken = async (options: GetViewerSessionOptions = {}) => {
    const activeSession = await getSession(options)
    return activeSession?.access_token
  }

  const getAuthHeaders = async (): Promise<ViewerAuthHeaders> => {
    if (import.meta.server) {
      const headers = useRequestHeaders(["cookie"])
      return headers.cookie ? { cookie: headers.cookie } : undefined
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return undefined
    }

    return {
      authorization: `Bearer ${accessToken}`,
    }
  }

  const ensureBridgedSession = async () => {
    if (import.meta.server) {
      return Boolean(useRequestEvent()?.context.authUser)
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return false
    }

    const { ensureBridged } = useSessionBridge()
    return ensureBridged(accessToken)
  }

  return {
    session,
    loadedSession,
    getSession,
    getAccessToken,
    getAuthHeaders,
    ensureBridgedSession,
    clear,
  }
}
