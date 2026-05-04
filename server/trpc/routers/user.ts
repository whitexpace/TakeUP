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
              listedItem: {
                where: { status: "AVAILABLE" },
                select: {
                  id: true,
                  name: true,
                  status: true,
                  rentalFee: true,
                  freeToBorrow: true,
                  rateOption: true,
                  rating: true,
                  bookingCount: true,
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                  categories: {
                    select: { category: true },
                    take: 1,
                  },
                },
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
          transactionReviewsReviewee: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              rating: true,
              reviewText: true,
              createdAt: true,
              isAnonymous: true,
              reviewType: true,
              reviewerUser: {
                select: {
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
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
        user: {
          id: user.id,
          username: user.username,
          name,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          bio: user.bio,
          pronouns: user.pronouns,
          location: user.location,
          rating: user.lender?.lenderRating ?? 0,
          borrowerRating: user.borrower?.borrowerRating ?? 0,
          itemsSold: user.lender?._count.listedItem ?? 0, // Simplified mapping
          activeListings: user.lender?._count.listedItem ?? 0,
        },
        reviews: user.transactionReviewsReviewee.map((r) => ({
          id: r.id,
          rating: r.rating,
          text: r.reviewText,
          createdAt: r.createdAt,
          isAnonymous: r.isAnonymous,
          reviewType: r.reviewType,
          reviewer: {
            username: r.reviewerUser.username,
            name: formatName(r.reviewerUser),
            avatarUrl: r.reviewerUser.avatarUrl,
          },
        })),
        items: (user.lender?.listedItem ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          status: item.status,
          rentalFee: Number(item.rentalFee),
          freeToBorrow: item.freeToBorrow,
          rateOption: item.rateOption,
          rating: item.rating,
          bookingCount: item.bookingCount,
          ownerName: name,
          lenderUsername: user.username,
          category: item.categories[0]?.category ?? "OTHER",
          image: item.images[0]?.path ?? null,
          isLiked: false, // Default for public view
        })),
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
