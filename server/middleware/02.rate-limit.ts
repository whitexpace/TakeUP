import { createError, getHeader, setResponseHeader } from "h3"
import { consumeRateLimit, extractClientIp, findRateLimitPolicy } from "../utils/rate-limit"

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export default defineEventHandler((event) => {
  const policy = findRateLimitPolicy(event.path, event.method)
  if (!policy) {
    return
  }

  const clientIp = extractClientIp({
    "x-forwarded-for": getHeader(event, "x-forwarded-for") ?? undefined,
    "x-real-ip": getHeader(event, "x-real-ip") ?? undefined,
    "cf-connecting-ip": getHeader(event, "cf-connecting-ip") ?? undefined,
    "x-vercel-forwarded-for": getHeader(event, "x-vercel-forwarded-for") ?? undefined,
  })

  const key = `${policy.bucket}:${clientIp}`
  const result = consumeRateLimit(rateLimitStore, key, policy)

  setResponseHeader(event, "X-RateLimit-Limit", policy.limit)
  setResponseHeader(event, "X-RateLimit-Remaining", result.remaining)
  setResponseHeader(event, "X-RateLimit-Reset", Math.floor(result.resetAt / 1000))

  if (result.allowed) {
    return
  }

  setResponseHeader(event, "Retry-After", result.retryAfterSeconds)
  throw createError({
    statusCode: 429,
    statusMessage: "Too many requests. Please try again later.",
  })
})
