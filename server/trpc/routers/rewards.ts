import type { Prisma } from "@prisma/client"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import { redeemBoostSchema } from "#shared/schemas/rewards"
import {
  RewardEventStatus,
  expireActiveBoostsThrottled,
  listRewardLeaderboard,
  redeemListingBoost,
} from "../../utils/rewards"

export const rewardsRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    await expireActiveBoostsThrottled(ctx.prisma)

    const [rewardTotals, recentEvents, activeBoosts] = await Promise.all([
      ctx.prisma.userReward.upsert({
        where: { userId: ctx.user.id },
        create: { userId: ctx.user.id },
        update: {},
        select: {
          availablePoints: true,
          totalPointsEarned: true,
          borrowerPoints: true,
          lenderPoints: true,
          pendingPoints: true,
        },
      }),
      ctx.prisma.rewardEvent.findMany({
        where: {
          userId: ctx.user.id,
          status: {
            in: [RewardEventStatus.APPLIED, RewardEventStatus.PENDING, RewardEventStatus.BLOCKED],
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 20,
        include: {
          itemBoost: {
            include: {
              item: {
                select: { id: true, name: true },
              },
            },
          },
          transaction: {
            select: {
              id: true,
              item: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      ctx.prisma.itemBoost.findMany({
        where: { userId: ctx.user.id },
        orderBy: [{ createdAt: "desc" }],
        take: 10,
        include: {
          item: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ])

    return {
      ...rewardTotals,
      recentEvents: recentEvents.map((event) => ({
        id: event.id,
        sourceType: event.sourceType,
        roleCategory: event.roleCategory,
        status: event.status,
        pointsDelta: event.pointsDelta,
        createdAt: event.createdAt,
        metadata: event.metadata,
        item: event.itemBoost?.item ?? event.transaction?.item ?? null,
      })),
      boosts: activeBoosts,
    }
  }),

  activeBoosts: protectedProcedure.query(async ({ ctx }) => {
    await expireActiveBoostsThrottled(ctx.prisma)

    const boosts = await ctx.prisma.itemBoost.findMany({
      where: {
        userId: ctx.user.id,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ expiresAt: "asc" }],
      include: {
        item: {
          select: {
            id: true,
            name: true,
            images: {
              select: {
                path: true,
                isPrimary: true,
                sortOrder: true,
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    })

    return boosts.map((boost) => ({
      id: boost.id,
      itemId: boost.itemId,
      itemName: boost.item.name,
      itemImage:
        boost.item.images.find((image) => image.isPrimary)?.path ??
        boost.item.images[0]?.path ??
        null,
      boostStatus: boost.status,
      boostStartedAt: boost.startsAt,
      boostExpiresAt: boost.expiresAt,
      remainingTime: null,
    }))
  }),

  borrowerLeaderboard: publicProcedure.query(async ({ ctx }) => {
    await expireActiveBoostsThrottled(ctx.prisma)
    return {
      leaderboard: await listRewardLeaderboard(ctx.prisma, "BORROWER"),
    }
  }),

  lenderLeaderboard: publicProcedure.query(async ({ ctx }) => {
    await expireActiveBoostsThrottled(ctx.prisma)
    return {
      leaderboard: await listRewardLeaderboard(ctx.prisma, "LENDER"),
    }
  }),

  redeemBoost: protectedProcedure.input(redeemBoostSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const result = await redeemListingBoost(tx as Prisma.TransactionClient, ctx.user.id, {
        itemId: input.itemId,
        boostType: input.boostType,
      })

      return {
        message: "Listing boosted successfully",
        pointsSpent: result.pointsSpent,
        remainingPoints: result.remainingPoints,
        boost: {
          itemId: input.itemId,
          startsAt: result.boost.startsAt,
          expiresAt: result.boost.expiresAt,
          status: result.boost.status,
        },
      }
    })
  }),
})
