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

  const userProfileRows = await ctx.prisma.$queryRaw<
    Array<{
      username: string
      firstName: string
      middleName: string | null
      lastName: string
      accountType: string | null
      createdAt: Date | null
      location: string | null
      avatarUrl: string | null
      bio: string | null
      pronouns: string | null
    }>
  >(Prisma.sql`
    SELECT
      "username",
      "firstName",
      "middleName",
      "lastName",
      "accountType",
      "createdAt",
      "location",
      "avatarUrl",
      "bio",
      "pronouns"
    FROM "User"
    WHERE "id" = ${user.id}
    LIMIT 1
  `)

  const dbUser = userProfileRows[0]

  return {
    user: {
      ...user,
      username: dbUser?.username ?? user.name,
      firstName: dbUser?.firstName ?? "",
      middleName: dbUser?.middleName ?? null,
      lastName: dbUser?.lastName ?? "",
      accountType: dbUser?.accountType ?? null,
      createdAt: dbUser?.createdAt ?? null,
      location: dbUser?.location ?? null,
      avatarUrl: dbUser?.avatarUrl ?? null,
      bio: dbUser?.bio ?? null,
      pronouns: dbUser?.pronouns ?? null,
    },
  }
})
