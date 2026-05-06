import type { PrismaClient } from "@prisma/client"

type CachedUserAccess = {
  status: string
  accountType: string | null
  expiresAt: number
}

const USER_ACCESS_CACHE_TTL_MS = 30_000
const userAccessCache = new Map<string, CachedUserAccess>()

export const getCachedUserAccess = async (prisma: PrismaClient, userId: string) => {
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

  userAccessCache.set(userId, nextRecord)
  return nextRecord
}
