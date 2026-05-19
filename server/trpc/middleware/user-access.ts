import type { PrismaClient } from "@prisma/client"
import { pruneExpiredEntries, setBoundedMapEntry } from "../../utils/bounded-cache"

type CachedUserAccess = {
  status: string
  accountType: string | null
  expiresAt: number
}

const USER_ACCESS_CACHE_TTL_MS = 30_000
const MAX_USER_ACCESS_CACHE_ENTRIES = 512
const userAccessCache = new Map<string, CachedUserAccess>()

export const getCachedUserAccess = async (prisma: PrismaClient, userId: string) => {
  pruneExpiredEntries(userAccessCache)
  const cached = userAccessCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      accountType: true,
    },
  })

  if (!userRecord) {
    userAccessCache.delete(userId)
    return null
  }

  const nextRecord: CachedUserAccess = {
    status: userRecord.status,
    accountType: userRecord.accountType,
    expiresAt: Date.now() + USER_ACCESS_CACHE_TTL_MS,
  }

  setBoundedMapEntry(userAccessCache, userId, nextRecord, MAX_USER_ACCESS_CACHE_ENTRIES)
  return nextRecord
}
