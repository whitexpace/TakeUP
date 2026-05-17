import type { PublicProfile } from "~/types/user"

type ProfileCacheEntry = {
  expiresAt: number
  data: PublicProfile
}

const PUBLIC_PROFILE_CACHE_TTL_MS = 60_000
const MAX_PUBLIC_PROFILE_CACHE_ENTRIES = 24
const PUBLIC_PROFILE_PREVIEW_IMAGE_LIMIT = 4

const publicProfileCache = new Map<string, ProfileCacheEntry>()
const pendingPublicProfileRequests = new Map<string, Promise<PublicProfile>>()
const warmedProfileImageUrls = new Set<string>()

const normalizeUsername = (username: string | null | undefined) => {
  if (!username) return null
  const normalized = username.trim().replace(/^@/, "")
  return normalized || null
}

const getProfileCacheKey = (username: string) => `profile-${username}`

const prunePublicProfileCache = () => {
  const now = Date.now()
  for (const [username, entry] of publicProfileCache) {
    if (entry.expiresAt <= now) {
      publicProfileCache.delete(username)
    }
  }

  while (publicProfileCache.size > MAX_PUBLIC_PROFILE_CACHE_ENTRIES) {
    const oldestUsername = publicProfileCache.keys().next().value
    if (!oldestUsername) break
    publicProfileCache.delete(oldestUsername)
  }

  while (warmedProfileImageUrls.size > MAX_PUBLIC_PROFILE_CACHE_ENTRIES * 4) {
    const oldestUrl = warmedProfileImageUrls.values().next().value
    if (!oldestUrl) break
    warmedProfileImageUrls.delete(oldestUrl)
  }
}

const seedNuxtProfileData = (username: string, data: PublicProfile) => {
  const key = getProfileCacheKey(username)
  const nuxtApp = useNuxtApp() as typeof useNuxtApp extends () => infer T
    ? T & {
        static?: { data?: Record<string, unknown> }
        _asyncData?: Record<
          string,
          {
            data: { value: unknown }
            error: { value: unknown }
            pending?: { value: boolean }
            status: { value: string }
          }
        >
      }
    : never

  nuxtApp.payload.data[key] = data

  if (nuxtApp.static?.data) {
    nuxtApp.static.data[key] = data
  }

  const asyncData = nuxtApp._asyncData?.[key]
  if (asyncData) {
    asyncData.data.value = data
    asyncData.error.value = undefined
    if (asyncData.pending) {
      asyncData.pending.value = false
    }
    asyncData.status.value = "success"
  }
}

const setCachedPublicProfile = (username: string, data: PublicProfile) => {
  publicProfileCache.delete(username)
  publicProfileCache.set(username, {
    expiresAt: Date.now() + PUBLIC_PROFILE_CACHE_TTL_MS,
    data,
  })
  prunePublicProfileCache()
  seedNuxtProfileData(username, data)
}

export const getCachedPublicProfile = (username: string | null | undefined) => {
  const normalizedUsername = normalizeUsername(username)
  if (!normalizedUsername) return null

  const cached = publicProfileCache.get(normalizedUsername)
  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    publicProfileCache.delete(normalizedUsername)
    return null
  }

  return cached.data
}

const warmImage = (src: string | null | undefined) => {
  if (!import.meta.client || !src || warmedProfileImageUrls.has(src)) return

  const browserImage = new Image()
  const priorityImage = browserImage as HTMLImageElement & {
    fetchPriority?: "high" | "low" | "auto"
  }

  browserImage.decoding = "async"
  if ("fetchPriority" in priorityImage) {
    priorityImage.fetchPriority = "low"
  }
  browserImage.src = src
  warmedProfileImageUrls.add(src)
}

const warmProfileImages = (profile: PublicProfile) => {
  warmImage(profile.user.avatarUrl)

  for (const review of profile.reviews.slice(0, PUBLIC_PROFILE_PREVIEW_IMAGE_LIMIT)) {
    warmImage(review.reviewer.avatarUrl)
  }

  for (const item of profile.items.slice(0, PUBLIC_PROFILE_PREVIEW_IMAGE_LIMIT)) {
    warmImage(item.image)
  }
}

export const prefetchPublicProfile = (username: string | null | undefined) => {
  const normalizedUsername = normalizeUsername(username)
  if (!normalizedUsername) return Promise.resolve(null)

  const cached = getCachedPublicProfile(normalizedUsername)
  if (cached) {
    return Promise.resolve(cached)
  }

  const pending = pendingPublicProfileRequests.get(normalizedUsername)
  if (pending) {
    return pending
  }

  const request = $fetch<PublicProfile>(`/api/users/${encodeURIComponent(normalizedUsername)}`)
    .then((profile) => {
      setCachedPublicProfile(normalizedUsername, profile)
      warmProfileImages(profile)
      return profile
    })
    .finally(() => {
      if (pendingPublicProfileRequests.get(normalizedUsername) === request) {
        pendingPublicProfileRequests.delete(normalizedUsername)
      }
    })

  pendingPublicProfileRequests.set(normalizedUsername, request)
  return request
}

export const usePublicProfilePrefetch = () => {
  const warmPublicProfile = (username: string | null | undefined) => {
    const normalizedUsername = normalizeUsername(username)
    if (!normalizedUsername || !import.meta.client) return

    const targetPath = `/profile/${encodeURIComponent(normalizedUsername)}`
    void preloadRouteComponents(targetPath).catch(() => {})
    void prefetchPublicProfile(normalizedUsername).catch(() => {})
  }

  const warmPublicProfilePath = (path: string) => {
    if (!import.meta.client) return

    const segments = path.split("/").filter(Boolean)
    if (segments[0] !== "profile" || !segments[1]) return

    try {
      warmPublicProfile(decodeURIComponent(segments[1]))
    } catch {
      warmPublicProfile(segments[1])
    }
  }

  return {
    warmPublicProfile,
    warmPublicProfilePath,
  }
}
