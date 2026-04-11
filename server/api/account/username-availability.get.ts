import { Prisma } from "@prisma/client"
import { createError, getQuery } from "h3"
import { usernameAvailabilityQuerySchema } from "../../../shared/schemas/profile"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)

  if (!ctx.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized.",
    })
  }

  const result = usernameAvailabilityQuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid username.",
      data: result.error.flatten(),
    })
  }

  const username = result.data.username
  const rows = await ctx.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE LOWER("username") = LOWER(${username})
      AND "id" <> ${ctx.user.id}
    LIMIT 1
  `)

  return {
    username,
    available: rows.length === 0,
  }
})
