/**
 * Server-only plugin: hydrates session bridge state during SSR.
 * If the JWT session cookie is already valid, stores the authenticated email
 * so the client can skip the redundant POST to /api/auth/supabase-session.
 */
export default defineNuxtPlugin(() => {
  const event = useRequestEvent()
  if (event?.context.authUser?.email) {
    useState("session-cookie-email", () => event.context.authUser!.email)
  }
})
