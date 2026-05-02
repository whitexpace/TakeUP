import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router } from "../init"
import { publicProcedure, protectedProcedure } from "../procedures"

const formatName = (u: { firstName: string; lastName: string }) => {
  const first = (u.firstName || "").trim()
  const last = (u.lastName || "").trim()

  if (!last || last.toLowerCase() === "user") {
    return first.charAt(0).toUpperCase() + first.slice(1)
  }

  const lastInitial = last.charAt(0).toUpperCase()
  return `${first} ${lastInitial}.`
}

export const userRouter = router({
  profile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
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
      },
    })

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      })
    }

    return user
  }),

  getPublicProfile: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: input.username },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          location: true,
          createdAt: true,
          bio: true,
          pronouns: true,
          lender: {
            select: {
              lenderRating: true,
              _count: {
                select: { listedItem: true },
              },
            },
          },
          borrower: {
            select: {
              borrowerRating: true,
              _count: {
                select: { bookings: true },
              },
            },
          },
        },
      })

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        })
      }

      const name = formatName({
        firstName: user.firstName,
        lastName: user.lastName,
      })

      return {
        ...user,
        name,
      }
    }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const users = await ctx.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: input.query, mode: "insensitive" } },
            { firstName: { contains: input.query, mode: "insensitive" } },
            { lastName: { contains: input.query, mode: "insensitive" } },
          ],
          status: { not: "DEACTIVATED" },
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          lender: {
            select: {
              lenderRating: true,
              _count: {
                select: { listedItem: true },
              },
            },
          },
        },
        take: 3, // Only show top 3 matches to keep dashboard clean
      })

      return users.map((u) => ({
        id: u.id,
        username: u.username,
        name: formatName(u),
        avatarUrl: u.avatarUrl,
        rating: u.lender?.lenderRating ?? 0,
        activeListings: u.lender?._count.listedItem ?? 0,
      }))
    }),
})
