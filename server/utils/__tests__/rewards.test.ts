import { DisputeStatus, TransactionStatus, type Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"
import {
  DisputeOutcome,
  ItemBoostType,
  RewardEventStatus,
  RewardRoleCategory,
  RewardSourceType,
  calculateRewardTotalsFromEvents,
  processReviewRewards,
  processTransactionRewards,
  redeemListingBoost,
} from "../rewards"
import type { ItemBoostStatus } from "../rewards"

type MockRewardEvent = {
  id: string
  userId: string
  transactionId: string | null
  reviewId: string | null
  itemBoostId: string | null
  idempotencyKey: string
  sourceType: RewardSourceType
  roleCategory: RewardRoleCategory
  pointsDelta: number
  status: RewardEventStatus
  metadata: unknown
  appliedAt: Date | null
}

type MockUserReward = {
  userId: string
  availablePoints: number
  totalPointsEarned: number
  borrowerPoints: number
  lenderPoints: number
  pendingPoints: number
}

type MockStore = {
  transactions: Array<{
    id: string
    status: TransactionStatus
    borrowerId: string | null
    lenderId: string | null
    disputes: Array<{
      id: string
      status: DisputeStatus
      outcome: DisputeOutcome | null
      createdAt: Date
      resolvedAt: Date | null
    }>
    reviews: Array<{ id: string }>
  }>
  reviews: Array<{
    id: string
    reviewerUserId: string
    transactionId: string
    reviewType: "ITEM_REVIEW" | "LENDER_REVIEW" | "BORROWER_REVIEW"
  }>
  rewardEvents: MockRewardEvent[]
  userRewards: MockUserReward[]
  items: Array<{
    id: string
    lenderId: string
    status: "AVAILABLE" | "RENTED" | "DEACTIVATED" | "DELETED"
    boostScore: number
    boostExpiresAt: Date | null
  }>
  itemBoosts: Array<{
    id: string
    itemId: string
    userId: string
    pointsSpent: number
    boostType: ItemBoostType
    boostScore: number
    status: ItemBoostStatus
    startsAt: Date
    expiresAt: Date
    createdAt: Date
  }>
}

const clone = <T>(value: T): T => structuredClone(value)

const pickFields = <T extends Record<string, unknown>>(
  value: T,
  select?: Record<string, unknown>,
) => {
  if (!select) {
    return clone(value)
  }

  const result: Record<string, unknown> = {}
  for (const [key, enabled] of Object.entries(select)) {
    if (!enabled) continue
    result[key] = clone(value[key] as unknown)
  }
  return result
}

const createMockPrisma = (store: MockStore) =>
  ({
    rentalTransaction: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const record = store.transactions.find((transaction) => transaction.id === where.id)
        return record ? clone(record) : null
      },
    },
    transactionReview: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const review = store.reviews.find((entry) => entry.id === where.id)
        if (!review) return null
        const transaction = store.transactions.find((entry) => entry.id === review.transactionId)
        if (!transaction) return null

        return {
          ...clone(review),
          transaction: clone({
            id: transaction.id,
            status: transaction.status,
            itemId: "item-1",
            borrowerId: transaction.borrowerId,
            lenderId: transaction.lenderId,
            disputes: transaction.disputes,
          }),
        }
      },
      findMany: async ({
        where,
        select,
      }: {
        where: { transactionId: string; reviewerUserId: string }
        select?: Record<string, unknown>
      }) =>
        store.reviews
          .filter(
            (review) =>
              review.transactionId === where.transactionId &&
              review.reviewerUserId === where.reviewerUserId,
          )
          .map((review) => pickFields(review, select)),
    },
    rewardEvent: {
      findMany: async ({
        where,
        select,
      }: {
        where: { userId?: string }
        select?: Record<string, unknown>
      }) =>
        store.rewardEvents
          .filter((event) => (where.userId ? event.userId === where.userId : true))
          .map((event) => pickFields(event, select)),
      findUnique: async ({
        where,
        select,
      }: {
        where: { idempotencyKey: string }
        select?: Record<string, unknown>
      }) => {
        const event = store.rewardEvents.find(
          (entry) => entry.idempotencyKey === where.idempotencyKey,
        )
        return event ? pickFields(event, select) : null
      },
      create: async ({
        data,
      }: {
        data: Omit<MockRewardEvent, "id" | "transactionId" | "reviewId" | "itemBoostId"> &
          Partial<MockRewardEvent>
      }) => {
        const nextData = clone(data)
        const event: MockRewardEvent = {
          id: `event-${store.rewardEvents.length + 1}`,
          userId: nextData.userId,
          transactionId: nextData.transactionId ?? null,
          reviewId: nextData.reviewId ?? null,
          itemBoostId: nextData.itemBoostId ?? null,
          idempotencyKey: nextData.idempotencyKey,
          sourceType: nextData.sourceType,
          roleCategory: nextData.roleCategory,
          pointsDelta: nextData.pointsDelta,
          status: nextData.status,
          metadata: nextData.metadata,
          appliedAt: nextData.appliedAt ?? null,
        }
        store.rewardEvents.push(event)
        return clone(event)
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { idempotencyKey: string }
        create: Omit<MockRewardEvent, "id">
        update: Partial<Omit<MockRewardEvent, "id" | "idempotencyKey" | "sourceType" | "userId">>
      }) => {
        const existingIndex = store.rewardEvents.findIndex(
          (event) => event.idempotencyKey === where.idempotencyKey,
        )

        if (existingIndex >= 0) {
          const existingEvent = store.rewardEvents[existingIndex]!
          store.rewardEvents[existingIndex] = {
            ...existingEvent,
            ...clone(update),
          } as MockRewardEvent
          return clone(store.rewardEvents[existingIndex]!)
        }

        const nextEvent = {
          id: `event-${store.rewardEvents.length + 1}`,
          ...clone(create),
        } as MockRewardEvent
        store.rewardEvents.push(nextEvent)
        return clone(nextEvent)
      },
    },
    userReward: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { userId: string }
        select?: Record<string, unknown>
      }) => {
        const reward = store.userRewards.find((entry) => entry.userId === where.userId)
        return reward ? pickFields(reward, select) : null
      },
      upsert: async ({
        where,
        create,
        update,
        select,
      }: {
        where: { userId: string }
        create: Partial<MockUserReward> & { userId: string }
        update: Partial<MockUserReward>
        select?: Record<string, unknown>
      }) => {
        const existingIndex = store.userRewards.findIndex((entry) => entry.userId === where.userId)

        if (existingIndex >= 0) {
          const existingReward = store.userRewards[existingIndex]!
          store.userRewards[existingIndex] = {
            ...existingReward,
            ...clone(update),
          } as MockUserReward
          return pickFields(store.userRewards[existingIndex]!, select)
        }

        const nextReward: MockUserReward = {
          userId: create.userId,
          availablePoints: create.availablePoints ?? 0,
          totalPointsEarned: create.totalPointsEarned ?? 0,
          borrowerPoints: create.borrowerPoints ?? 0,
          lenderPoints: create.lenderPoints ?? 0,
          pendingPoints: create.pendingPoints ?? 0,
        }
        store.userRewards.push(nextReward)
        return pickFields(nextReward, select)
      },
    },
    item: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { id: string }
        select?: Record<string, unknown>
      }) => {
        const item = store.items.find((entry) => entry.id === where.id)
        return item ? pickFields(item, select) : null
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: Partial<MockStore["items"][number]>
      }) => {
        const item = store.items.find((entry) => entry.id === where.id)
        if (!item) throw new Error("Item not found")
        Object.assign(item, clone(data))
        return clone(item)
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { boostExpiresAt?: { lte: Date } }
        data: Partial<MockStore["items"][number]>
      }) => {
        for (const item of store.items) {
          const shouldUpdate =
            !where.boostExpiresAt ||
            (item.boostExpiresAt instanceof Date &&
              item.boostExpiresAt.getTime() <= where.boostExpiresAt.lte.getTime())

          if (shouldUpdate) {
            Object.assign(item, clone(data))
          }
        }

        return { count: 0 }
      },
    },
    itemBoost: {
      findFirst: async ({
        where,
        select,
      }: {
        where: { itemId: string; status: ItemBoostStatus; expiresAt: { gt: Date } }
        select?: Record<string, unknown>
      }) => {
        const boost = store.itemBoosts.find(
          (entry) =>
            entry.itemId === where.itemId &&
            entry.status === where.status &&
            entry.expiresAt.getTime() > where.expiresAt.gt.getTime(),
        )
        return boost ? pickFields(boost, select) : null
      },
      create: async ({
        data,
      }: {
        data: Omit<MockStore["itemBoosts"][number], "id" | "createdAt">
      }) => {
        const boost = {
          id: `boost-${store.itemBoosts.length + 1}`,
          createdAt: new Date(),
          ...clone(data),
        }
        store.itemBoosts.push(boost)
        return clone(boost)
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { status: ItemBoostStatus; expiresAt: { lte: Date } }
        data: Partial<MockStore["itemBoosts"][number]>
      }) => {
        for (const boost of store.itemBoosts) {
          if (
            boost.status === where.status &&
            boost.expiresAt.getTime() <= where.expiresAt.lte.getTime()
          ) {
            Object.assign(boost, clone(data))
          }
        }
        return { count: 0 }
      },
    },
  }) as unknown as Prisma.DefaultPrismaClient

const createBaseStore = (): MockStore => ({
  transactions: [],
  reviews: [],
  rewardEvents: [],
  userRewards: [],
  items: [],
  itemBoosts: [],
})

describe("rewards utility", () => {
  it("awards idempotent base points on a clean completed transaction", async () => {
    const store = createBaseStore()
    store.transactions.push({
      id: "txn-1",
      status: TransactionStatus.COMPLETED,
      borrowerId: "borrower-1",
      lenderId: "lender-1",
      disputes: [],
      reviews: [],
    })

    const prisma = createMockPrisma(store)

    await processTransactionRewards(prisma, "txn-1")
    await processTransactionRewards(prisma, "txn-1")

    expect(store.rewardEvents).toHaveLength(2)
    expect(store.rewardEvents.map((event) => event.status)).toEqual([
      RewardEventStatus.APPLIED,
      RewardEventStatus.APPLIED,
    ])

    expect(store.userRewards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "borrower-1",
          availablePoints: 10,
          totalPointsEarned: 10,
          borrowerPoints: 10,
          lenderPoints: 0,
        }),
        expect.objectContaining({
          userId: "lender-1",
          availablePoints: 10,
          totalPointsEarned: 10,
          borrowerPoints: 0,
          lenderPoints: 10,
        }),
      ]),
    )
  })

  it("defers rewards for active disputes, then applies the resolved outcome", async () => {
    const store = createBaseStore()
    store.transactions.push({
      id: "txn-2",
      status: TransactionStatus.COMPLETED,
      borrowerId: "borrower-2",
      lenderId: "lender-2",
      disputes: [
        {
          id: "dispute-1",
          status: DisputeStatus.OPEN,
          outcome: null,
          createdAt: new Date("2026-04-18T00:00:00.000Z"),
          resolvedAt: null,
        },
      ],
      reviews: [],
    })

    const prisma = createMockPrisma(store)

    await processTransactionRewards(prisma, "txn-2")

    expect(store.userRewards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "borrower-2", availablePoints: 0, pendingPoints: 10 }),
        expect.objectContaining({ userId: "lender-2", availablePoints: 0, pendingPoints: 10 }),
      ]),
    )

    const dispute = store.transactions[0]!.disputes[0]!
    store.transactions[0]!.disputes[0] = {
      ...dispute,
      status: DisputeStatus.RESOLVED,
      outcome: DisputeOutcome.BORROWER_AT_FAULT,
      resolvedAt: new Date("2026-04-18T01:00:00.000Z"),
    }

    await processTransactionRewards(prisma, "txn-2")

    expect(store.rewardEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "borrower-2",
          status: RewardEventStatus.BLOCKED,
          pointsDelta: 0,
        }),
        expect.objectContaining({
          userId: "lender-2",
          status: RewardEventStatus.APPLIED,
          pointsDelta: 10,
        }),
      ]),
    )

    expect(store.userRewards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "borrower-2", availablePoints: 0, pendingPoints: 0 }),
        expect.objectContaining({ userId: "lender-2", availablePoints: 10, pendingPoints: 0 }),
      ]),
    )
  })

  it("applies reduced shared-fault base points and awards a single +5 bonus after borrower submits both required reviews", async () => {
    const store = createBaseStore()
    store.transactions.push({
      id: "txn-3",
      status: TransactionStatus.COMPLETED,
      borrowerId: "borrower-3",
      lenderId: "lender-3",
      disputes: [
        {
          id: "dispute-2",
          status: DisputeStatus.RESOLVED,
          outcome: DisputeOutcome.SHARED_FAULT,
          createdAt: new Date("2026-04-18T00:00:00.000Z"),
          resolvedAt: new Date("2026-04-18T02:00:00.000Z"),
        },
      ],
      reviews: [{ id: "review-1" }],
    })
    store.reviews.push({
      id: "review-1",
      reviewerUserId: "borrower-3",
      transactionId: "txn-3",
      reviewType: "LENDER_REVIEW",
    })
    store.transactions[0]!.reviews.push({ id: "review-2" })
    store.reviews.push({
      id: "review-2",
      reviewerUserId: "borrower-3",
      transactionId: "txn-3",
      reviewType: "ITEM_REVIEW",
    })

    const prisma = createMockPrisma(store)

    await processTransactionRewards(prisma, "txn-3")
    await processReviewRewards(prisma, "review-1")
    await processReviewRewards(prisma, "review-2")
    await processReviewRewards(prisma, "review-1")

    expect(store.userRewards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "borrower-3",
          availablePoints: 10,
          totalPointsEarned: 10,
          borrowerPoints: 10,
        }),
        expect.objectContaining({
          userId: "lender-3",
          availablePoints: 5,
          totalPointsEarned: 5,
          lenderPoints: 5,
        }),
      ]),
    )

    expect(
      store.rewardEvents.filter((event) => event.sourceType === RewardSourceType.REVIEW_SUBMITTED),
    ).toHaveLength(1)
    expect(
      store.rewardEvents.find((event) => event.sourceType === RewardSourceType.REVIEW_SUBMITTED)
        ?.pointsDelta,
    ).toBe(5)
  })

  it("does not award borrower review bonus until both lender and item reviews are submitted", async () => {
    const store = createBaseStore()
    store.transactions.push({
      id: "txn-4",
      status: TransactionStatus.COMPLETED,
      borrowerId: "borrower-4",
      lenderId: "lender-4",
      disputes: [],
      reviews: [{ id: "review-3" }],
    })
    store.reviews.push({
      id: "review-3",
      reviewerUserId: "borrower-4",
      transactionId: "txn-4",
      reviewType: "LENDER_REVIEW",
    })

    const prisma = createMockPrisma(store)

    await processReviewRewards(prisma, "review-3")

    expect(
      store.rewardEvents.find(
        (event) => event.idempotencyKey === "review:txn-4:borrower-4:submission",
      ),
    ).toEqual(
      expect.objectContaining({
        pointsDelta: 0,
        status: RewardEventStatus.BLOCKED,
      }),
    )

    store.transactions[0]!.reviews.push({ id: "review-4" })
    store.reviews.push({
      id: "review-4",
      reviewerUserId: "borrower-4",
      transactionId: "txn-4",
      reviewType: "ITEM_REVIEW",
    })

    await processReviewRewards(prisma, "review-4")

    expect(
      store.rewardEvents.find(
        (event) => event.idempotencyKey === "review:txn-4:borrower-4:submission",
      ),
    ).toEqual(
      expect.objectContaining({
        pointsDelta: 5,
        status: RewardEventStatus.APPLIED,
      }),
    )
  })

  it("redeems a listing boost from available points without changing historical category points", async () => {
    const store = createBaseStore()
    store.items.push({
      id: "item-1",
      lenderId: "lender-4",
      status: "AVAILABLE",
      boostScore: 0,
      boostExpiresAt: null,
    })
    store.userRewards.push({
      userId: "lender-4",
      availablePoints: 60,
      totalPointsEarned: 60,
      borrowerPoints: 0,
      lenderPoints: 0,
      pendingPoints: 0,
    })

    const prisma = createMockPrisma(store)

    const result = await redeemListingBoost(prisma, "lender-4", {
      itemId: "item-1",
      boostType: ItemBoostType.STANDARD_24_HOUR,
    })

    expect(result.pointsSpent).toBe(50)
    expect(result.remainingPoints).toBe(10)
    expect(store.items[0]).toEqual(
      expect.objectContaining({
        id: "item-1",
        boostScore: 1,
      }),
    )
    expect(store.itemBoosts).toHaveLength(1)
    expect(store.userRewards[0]).toEqual(
      expect.objectContaining({
        userId: "lender-4",
        availablePoints: 10,
        totalPointsEarned: 60,
        lenderPoints: 0,
      }),
    )
  })

  it("prevents boost redemption when points are insufficient", async () => {
    const store = createBaseStore()
    store.items.push({
      id: "item-2",
      lenderId: "lender-5",
      status: "AVAILABLE",
      boostScore: 0,
      boostExpiresAt: null,
    })
    store.userRewards.push({
      userId: "lender-5",
      availablePoints: 20,
      totalPointsEarned: 20,
      borrowerPoints: 0,
      lenderPoints: 0,
      pendingPoints: 0,
    })

    const prisma = createMockPrisma(store)

    await expect(
      redeemListingBoost(prisma, "lender-5", {
        itemId: "item-2",
        boostType: ItemBoostType.STANDARD_24_HOUR,
      }),
    ).rejects.toThrow("Not enough available points")
  })

  it("keeps achievement totals stable when spending only affects available points", () => {
    const totals = calculateRewardTotalsFromEvents([
      {
        roleCategory: RewardRoleCategory.LENDER,
        pointsDelta: 10,
        status: RewardEventStatus.APPLIED,
      },
      {
        roleCategory: RewardRoleCategory.GENERAL,
        pointsDelta: -50,
        status: RewardEventStatus.APPLIED,
      },
    ])

    expect(totals).toEqual({
      availablePoints: -40,
      totalPointsEarned: 10,
      borrowerPoints: 0,
      lenderPoints: 10,
      pendingPoints: 0,
    })
  })
})
