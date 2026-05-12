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
    select: {
      username: true,
      firstName: true,
      middleName: true,
      lastName: true,
      accountType: true,
      createdAt: true,
      location: true,
      avatarUrl: true,
      bio: true,
      pronouns: true,
      lender: {
        select: {
          lenderRating: true,
          userId: true,
        },
      },
    },
  })

  if (!dbUser) {
    throw createError({
      statusCode: 404,
      statusMessage: "User profile not found.",
    })
  }

  const totalBookingsCount = await ctx.prisma.booking.count({
    where: {
      lenderId: user.id,
    },
  })

  return {
    user: {
      ...user,
      username: dbUser.username ?? user.name,
      firstName: dbUser.firstName ?? "",
      middleName: dbUser.middleName ?? null,
      lastName: dbUser.lastName ?? "",
      accountType: dbUser.accountType ?? null,
      createdAt: dbUser.createdAt ?? null,
      location: dbUser.location ?? null,
      avatarUrl: dbUser.avatarUrl ?? null,
      bio: dbUser.bio ?? null,
      pronouns: dbUser.pronouns ?? null,
      lenderRating: dbUser.lender?.lenderRating ?? 0,
      totalLenderBookings: totalBookingsCount,
    },
  }
})
