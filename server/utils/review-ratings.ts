import type { Prisma } from "@prisma/client"

type ReviewRatingClient = Prisma.TransactionClient | Prisma.DefaultPrismaClient
type RoleReviewType = "BORROWER_REVIEW" | "LENDER_REVIEW"

const buildRoleRatingMap = (
  reviews: Array<{ revieweeUserId: string | null; rating: number }>,
) => {
  const grouped = new Map<string, { total: number; count: number }>()

  for (const review of reviews) {
    if (!review.revieweeUserId) continue

    const current = grouped.get(review.revieweeUserId) ?? { total: 0, count: 0 }
    current.total += review.rating
    current.count += 1
    grouped.set(review.revieweeUserId, current)
  }

  return grouped
}

export const syncRoleRatingsFromReviews = async (
  prisma: ReviewRatingClient,
  reviewType: RoleReviewType,
  userIds?: string[],
) => {
  const uniqueUserIds = [...new Set((userIds ?? []).filter(Boolean))]

  const reviews = await prisma.transactionReview.findMany({
    where: {
      reviewType,
      revieweeUserId: uniqueUserIds.length > 0 ? { in: uniqueUserIds } : { not: null },
    },
    select: {
      revieweeUserId: true,
      rating: true,
    },
  })

  const ratingMap = buildRoleRatingMap(reviews)
  const targetUserIds = uniqueUserIds.length > 0 ? uniqueUserIds : [...ratingMap.keys()]

  await Promise.all(
    targetUserIds.map(async (userId) => {
      const aggregate = ratingMap.get(userId)
      const averageRating =
        aggregate && aggregate.count > 0 ? Number((aggregate.total / aggregate.count).toFixed(2)) : 0

      if (reviewType === "BORROWER_REVIEW") {
        await prisma.borrower.upsert({
          where: { userId },
          create: {
            userId,
            borrowStatus: "ACTIVE",
            borrowerRating: averageRating,
          },
          update: {
            borrowerRating: averageRating,
          },
        })
        return
      }

      await prisma.lender.upsert({
        where: { userId },
        create: {
          userId,
          lenderRating: averageRating,
        },
        update: {
          lenderRating: averageRating,
        },
      })
    }),
  )
}

export const syncRoleRatingForUser = async (
  prisma: ReviewRatingClient,
  reviewType: RoleReviewType,
  userId: string,
) => syncRoleRatingsFromReviews(prisma, reviewType, [userId])
