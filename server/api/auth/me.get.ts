import { Prisma } from "@prisma/client"
import { createError } from "h3"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  const { user } = ctx

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be authenticated to access this resource.",
      data: {
        error: {
          code: "AUTH_UNAUTHORIZED",
          message: "You must be authenticated to access this resource.",
        },
      },
    })
  }

  const dbUser = await ctx.prisma.user.findUnique({
    where: { id: user.id },
    select: { accountType: true },
  })

  const userProfileRows = await ctx.prisma.$queryRaw<
    Array<{ createdAt: Date | null; location: string | null }>
  >(Prisma.sql`
    SELECT "createdAt", "location"
    FROM "User"
    WHERE "id" = ${user.id}
    LIMIT 1
  `)

  const createdAt = userProfileRows[0]?.createdAt ?? null
  const location = userProfileRows[0]?.location ?? null

  return {
    user: {
      ...user,
      accountType: dbUser?.accountType ?? null,
      createdAt,
      location,
    },
  }
})
