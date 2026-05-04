export type RateLimitPolicy = {
  bucket: string
  methods: string[]
  pathPrefixes: string[]
  limit: number
  windowMs: number
}

export type RateLimitEntry = {
  count: number
  resetAt: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

export const RATE_LIMIT_POLICIES: RateLimitPolicy[] = [
  {
    bucket: "auth",
    methods: ["POST"],
    pathPrefixes: ["/api/auth/google", "/api/auth/supabase-session"],
    limit: 10,
    windowMs: 60_000,
  },
  {
    bucket: "uploads",
    methods: ["POST"],
    pathPrefixes: ["/api/item-images/cleanup"],
    limit: 20,
    windowMs: 60_000,
  },
  {
    bucket: "public-read",
    methods: ["GET"],
    pathPrefixes: ["/api/items", "/api/items/count", "/api/items/filter-metadata", "/api/requests"],
    limit: 120,
    windowMs: 60_000,
  },
  {
    bucket: "mutations",
    methods: ["POST", "PATCH", "DELETE"],
    pathPrefixes: [
      "/api/bookings",
      "/api/cart",
      "/api/items",
      "/api/item-requests",
      "/api/notifications",
      "/api/request-offers",
      "/api/requests",
      "/api/transactions",
    ],
    limit: 30,
    windowMs: 60_000,
  },
]

export function findRateLimitPolicy(path: string, method: string): RateLimitPolicy | null {
  const upperMethod = method.toUpperCase()

  return (
    RATE_LIMIT_POLICIES.find(
      (policy) =>
        policy.methods.includes(upperMethod) &&
        policy.pathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
    ) ?? null
  )
}

export function extractClientIp(headers: Record<string, string | undefined>): string {
  const candidates = [
    headers["x-forwarded-for"],
    headers["x-real-ip"],
    headers["cf-connecting-ip"],
    headers["x-vercel-forwarded-for"],
  ]

  for (const candidate of candidates) {
    if (!candidate) continue

    const first = candidate
      .split(",")
      .map((value) => value.trim())
      .find(Boolean)

    if (first) {
      return first
    }
  }

  return "unknown"
}

export function consumeRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  policy: Pick<RateLimitPolicy, "limit" | "windowMs">,
  now = Date.now(),
): RateLimitResult {
  const current = store.get(key)

  if (!current || current.resetAt <= now) {
    const nextEntry = {
      count: 1,
      resetAt: now + policy.windowMs,
    }
    store.set(key, nextEntry)

    return {
      allowed: true,
      remaining: Math.max(policy.limit - 1, 0),
      resetAt: nextEntry.resetAt,
      retryAfterSeconds: Math.ceil(policy.windowMs / 1000),
    }
  }

  if (current.count >= policy.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    }
  }

  current.count += 1
  store.set(key, current)

  return {
    allowed: true,
    remaining: Math.max(policy.limit - current.count, 0),
    resetAt: current.resetAt,
    retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
  }
}
