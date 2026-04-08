import type { H3Event } from "h3"
import { getHeader, setResponseHeader } from "h3"
import { hasAuthorizationHeader, hasSessionCookie } from "./request-security-core"

export function hasViewerCredentials(event: H3Event): boolean {
  const authorizationHeader = getHeader(event, "authorization")
  const cookieHeader = getHeader(event, "cookie")

  return hasAuthorizationHeader(authorizationHeader) || hasSessionCookie(cookieHeader)
}

export function setPrivateNoStoreApiHeaders(event: H3Event) {
  setResponseHeader(event, "Cache-Control", "private, no-store")
  setResponseHeader(event, "Vary", "Authorization, Cookie")
}

export function setPublicSWRApiHeaders(event: H3Event, maxAgeSeconds: number, swrSeconds: number) {
  setResponseHeader(
    event,
    "Cache-Control",
    `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${swrSeconds}`,
  )
  setResponseHeader(event, "Vary", "Authorization, Cookie")
}
