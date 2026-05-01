import { z } from "zod"
import { router } from "../init"
import { publicProcedure } from "../procedures"
import { TRPCError } from "@trpc/server"

export const userRouter = router({
  getPublicProfile: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          createdAt: true,
          bio: true,
          lender: {
            select: {
              lenderRating: true,
              listedItem: {
                where: { status: "AVAILABLE" },
                select: { id: true },
              },
            },
          },
          borrower: {
            select: {
              borrowerRating: true,
            },
          },
          _count: {
            select: {
              lentTransactions: {
                where: { status: "COMPLETED" },
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

      // Fetch reviews for this user (where they are the reviewee)
      // We explicitly exclude ITEM_REVIEW and only fetch feedback "towards the user"
      const reviews = await ctx.prisma.transactionReview.findMany({
        where: {
          revieweeUserId: user.id,
          reviewType: { in: ["LENDER_REVIEW", "BORROWER_REVIEW"] },
        },
        include: {
          reviewerUser: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      // Fetch active listings for this user
      const items = await ctx.prisma.item.findMany({
        where: { lenderId: user.id, status: "AVAILABLE" },
        include: {
          images: {
            select: { path: true, isPrimary: true },
            orderBy: { sortOrder: "asc" },
          },
          categories: { select: { category: true } },
          tags: { select: { tag: { select: { name: true } } } },
          lender: {
            select: {
              user: {
                select: {
                  username: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      })

      return {
        user: {
          id: user.id,
          username: user.username,
          name: `${user.firstName} ${user.lastName}`,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          bio: user.bio,
          rating: user.lender?.lenderRating ?? 0,
          borrowerRating: user.borrower?.borrowerRating ?? 0,
          itemsSold: user._count.lentTransactions,
          activeListings: user.lender?.listedItem.length ?? 0,
        },
        reviews: reviews.map((r) => {
          const isAnon = Boolean(r.isAnonymous)
          return {
            id: r.id,
            rating: r.rating,
            text: r.reviewText,
            createdAt: r.createdAt,
            isAnonymous: isAnon,
            reviewType: r.reviewType,
            reviewer: {
              username: isAnon ? "anonymous" : r.reviewerUser?.username || "unknown",
              name: isAnon
                ? r.reviewerUser
                  ? `${r.reviewerUser.firstName[0]}***`
                  : "Anonymous"
                : r.reviewerUser
                  ? `${r.reviewerUser.firstName} ${r.reviewerUser.lastName}`
                  : "User",
              avatarUrl: isAnon ? null : r.reviewerUser?.avatarUrl || null,
            },
          }
        }),
        items: items.map((item) => {
          const lenderUser = item.lender?.user
          const lenderUsername = lenderUser?.username || null
          const lenderFullName = lenderUser
            ? `${lenderUser.firstName} ${lenderUser.lastName}`
            : "Unknown"
          const ownerName = lenderUsername || lenderFullName

          return {
            id: item.id,
            name: item.name,
            status: item.status,
            rentalFee: item.rentalFee,
            freeToBorrow: item.freeToBorrow,
            rateOption: item.rateOption,
            rating: item.rating,
            bookingCount: item.bookingCount,
            ownerName,
            lenderUsername,
            category: item.categories[0]?.category ?? "Other",
            image: item.images.find((i) => i.isPrimary)?.path ?? item.images[0]?.path ?? null,
            isLiked: false,
          }
        }),
      }
    }),

  search: publicProcedure.input(z.object({ query: z.string() })).query(async ({ ctx, input }) => {
    const users = await ctx.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: input.query, mode: "insensitive" } },
          { firstName: { contains: input.query, mode: "insensitive" } },
          { lastName: { contains: input.query, mode: "insensitive" } },
        ],
        status: "ACTIVE",
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
              select: {
                listedItem: {
                  where: { status: "AVAILABLE" },
                },
              },
            },
          },
        },
      },
      take: 3, // Only show top 3 matches to keep dashboard clean
    })

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      name: `${u.firstName} ${u.lastName}`,
      avatarUrl: u.avatarUrl,
      rating: u.lender?.lenderRating ?? 0,
      activeListings: u.lender?._count.listedItem ?? 0,
    }))
  }),
})
