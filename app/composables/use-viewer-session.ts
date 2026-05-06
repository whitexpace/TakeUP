type CachedViewerSession = Awaited<
  ReturnType<ReturnType<typeof useSupabaseClient>["auth"]["getSession"]>
>["data"]["session"]
type ViewerAuthHeaders = Record<string, string> | undefined

let inflightSessionRequest: Promise<CachedViewerSession> | null = null

export const useViewerSession = () => {
  const session = useState<CachedViewerSession | null>("viewer-session-cache", () => null)
  const loadedSession = useState<boolean>("viewer-session-loaded", () => false)

  const clear = () => {
    session.value = null
    loadedSession.value = false
    inflightSessionRequest = null
  }

  const getSession = async () => {
    if (import.meta.server) {
      return null
    }

    if (loadedSession.value) {
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

  const getAccessToken = async () => {
    const activeSession = await getSession()
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
