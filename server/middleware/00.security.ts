import { setResponseHeader } from "h3"

const permissionsPolicy = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "browsing-topics=()",
].join(", ")

const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://www.gstatic.com https://*.google.com",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://accounts.google.com https://*.google.com",
  "form-action 'self' https://accounts.google.com https://*.google.com",
  "upgrade-insecure-requests",
].join("; ")

export default defineEventHandler((event) => {
  setResponseHeader(event, "X-Frame-Options", "DENY")
  setResponseHeader(event, "X-Content-Type-Options", "nosniff")
  setResponseHeader(event, "Referrer-Policy", "strict-origin-when-cross-origin")
  setResponseHeader(event, "Permissions-Policy", permissionsPolicy)
  setResponseHeader(event, "Content-Security-Policy-Report-Only", cspReportOnly)

  if (process.env.NODE_ENV === "production") {
    setResponseHeader(event, "Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  }

  if (!event.path.startsWith("/api/") && (event.method === "GET" || event.method === "HEAD")) {
    setResponseHeader(event, "X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet")
  }

  if (event.path.startsWith("/api/")) {
    setResponseHeader(event, "Cache-Control", "private, no-store")
  }
})
