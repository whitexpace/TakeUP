import { createError } from "h3"
import { createContext } from "../../trpc/context"

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)
  const user = ctx.user
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

  return {
    user: {
      ...user,
      accountType: dbUser?.accountType ?? null,
    },
  }
})
