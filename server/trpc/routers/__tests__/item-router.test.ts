import { TRPCError } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"
import { itemRouter } from "../item"

const VALID_UUID = "11111111-1111-1111-1111-111111111111"
const SECOND_UUID = "22222222-2222-2222-2222-222222222222"
const THIRD_UUID = "33333333-3333-3333-3333-333333333333"

const makeFeedRecord = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Item ${id}`,
  status: "AVAILABLE",
  lenderId: "owner-1",
  lender: {
    user: {
      username: "owner1",
      firstName: "Owner",
      middleName: null,
      lastName: "One",
      email: "owner1@up.edu.ph",
      status: "ACTIVE",
    },
  },
  availability: [
    {
      id: `${id}-availability`,
      startDate: new Date("2099-03-10T00:00:00.000Z"),
      endDate: new Date("2099-03-12T00:00:00.000Z"),
      status: "AVAILABLE",
    },
  ],
  bookings: [],
  images: [{ path: `https://example.com/${id}.jpg`, isPrimary: true, sortOrder: 0 }],
  categories: [{ category: "ELECTRONICS" }],
  tags: [{ tag: { name: "camera" } }],
  likes: [],
  description: null,
  condition: "GOOD",
  rateOption: "PER_DAY",
  createdAt: new Date("2026-03-22T00:00:00.000Z"),
  rentalFee: 250,
  replacementCost: null,
  freeToBorrow: false,
  whatItemOffers: null,
  whatIsIncluded: null,
  knownIssues: null,
  usageLimitations: null,
  isTrending: false,
  viewCount: 0,
  bookingCount: 0,
  likeCount: 0,
  rating: 0,
  boostScore: 0,
  boostExpiresAt: null,
  ...overrides,
})

describe("itemRouter", () => {
  it("create throws BAD_REQUEST when the signed-in user is missing from the database", async () => {
    const userFindUnique = vi.fn().mockResolvedValue(null)
    const lenderUpsert = vi.fn()
    const itemCreate = vi.fn()

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        user: { findUnique: userFindUnique },
        lender: { upsert: lenderUpsert },
        item: { create: itemCreate },
      } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    await expect(
      caller.create({
        name: "Camera",
        description: "Mirrorless camera for class projects.",
        condition: "GOOD",
        categories: ["ELECTRONICS"],
        tags: [],
        rentalFee: 250,
        availability: [],
        freeToBorrow: false,
        rateOption: "PER_DAY",
        whatItemOffers: "Sharp photos and reliable autofocus.",
        whatIsIncluded: "Camera body and charger.",
        thumbnailImage: "https://example.com/camera.jpg",
        photos: ["https://example.com/camera.jpg"],
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "Your account is missing from the database. Sign out and sign in again before publishing an item.",
    })

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "owner-1" },
      select: { id: true },
    })
    expect(lenderUpsert).not.toHaveBeenCalled()
    expect(itemCreate).not.toHaveBeenCalled()
  })

  it("create uses nested image create writes without deleteMany", async () => {
    const userFindUnique = vi.fn().mockResolvedValue({ id: "owner-1" })
    const lenderUpsert = vi.fn().mockResolvedValue({ userId: "owner-1" })
    const itemCreate = vi.fn().mockResolvedValue({
      id: VALID_UUID,
      name: "Camera",
      status: "AVAILABLE",
      lenderId: "owner-1",
      lender: {
        user: {
          username: "owner1",
          firstName: "Owner",
          middleName: null,
          lastName: "One",
          email: "owner1@up.edu.ph",
        },
      },
      images: [
        {
          path: "https://example.com/camera.jpg",
          isPrimary: true,
          sortOrder: 0,
        },
      ],
      availability: [],
      categories: [{ category: "ELECTRONICS" }],
      tags: [{ tag: { name: "photo" } }],
      likes: [],
      description: null,
      condition: "GOOD",
      rateOption: "PER_DAY",
      createdAt: new Date("2026-03-22T00:00:00.000Z"),
      rentalFee: 250,
      replacementCost: null,
      freeToBorrow: false,
      whatItemOffers: null,
      whatIsIncluded: null,
      knownIssues: null,
      usageLimitations: null,
      isTrending: false,
      viewCount: 0,
      bookingCount: 0,
      likeCount: 0,
      rating: 0,
    })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        user: { findUnique: userFindUnique },
        lender: { upsert: lenderUpsert },
        item: { create: itemCreate },
      } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    await caller.create({
      name: "Camera",
      description: "Mirrorless camera for class projects.",
      condition: "GOOD",
      categories: ["ELECTRONICS"],
      tags: ["photo"],
      rentalFee: 250,
      availability: [],
      freeToBorrow: false,
      rateOption: "PER_DAY",
      whatItemOffers: "Sharp photos and reliable autofocus.",
      whatIsIncluded: "Camera body and charger.",
      thumbnailImage: "https://example.com/camera.jpg",
      photos: ["https://example.com/camera.jpg"],
    })

    const createArgs = itemCreate.mock.calls[0]?.[0]
    expect(createArgs?.data.images).toEqual({
      create: [
        {
          path: "https://example.com/camera.jpg",
          sortOrder: 0,
          isPrimary: true,
        },
      ],
    })
    expect(createArgs?.data.images).not.toHaveProperty("deleteMany")
  })

  it("list maps taxonomy relations into plain arrays", async () => {
    const findMany = vi.fn().mockResolvedValue([
      makeFeedRecord(VALID_UUID, {
        name: "Camera",
        availability: [
          {
            id: SECOND_UUID,
            startDate: new Date("2099-03-10T00:00:00.000Z"),
            endDate: new Date("2099-03-12T00:00:00.000Z"),
            status: "AVAILABLE",
          },
        ],
        images: [{ path: "https://example.com/camera.jpg", isPrimary: true, sortOrder: 0 }],
        tags: [{ tag: { name: "photo" } }],
      }),
    ])
    const likeFindMany = vi.fn().mockResolvedValue([])

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findMany }, like: { findMany: likeFindMany } } as never,
      user: null,
    })

    const result = await caller.list()

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          availability: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              startDate: true,
              endDate: true,
              status: true,
            }),
            orderBy: { startDate: "asc" },
          }),
          bookings: expect.objectContaining({
            where: expect.objectContaining({
              status: { in: ["CONFIRMED", "IN_DISPUTE"] },
            }),
          }),
        }),
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ status: { not: "DELETED" } }),
            expect.objectContaining({
              status: { in: expect.arrayContaining(["AVAILABLE", "RENTED"]) },
            }),
          ]),
        }),
      }),
    )
    expect(result[0]?.categories).toEqual(["ELECTRONICS"])
    expect(result[0]?.tags).toEqual(["photo"])
    expect(result[0]?.ownerName).toBe("owner1")
    expect(result[0]?.lenderUsername).toBe("owner1")
    expect(result[0]?.lenderFullName).toBe("Owner One")
    expect(result[0]?.availability).toEqual([
      {
        id: "22222222-2222-2222-2222-222222222222",
        startDate: new Date("2099-03-10T00:00:00.000Z"),
        endDate: new Date("2099-03-12T00:00:00.000Z"),
        status: "AVAILABLE",
      },
    ])
    expect(result[0]?.images).toEqual([
      { path: "https://example.com/camera.jpg", isPrimary: true, sortOrder: 0 },
    ])
    expect(result[0]?.thumbnailImage).toBe("https://example.com/camera.jpg")
    expect(result[0]?.photos).toEqual(["https://example.com/camera.jpg"])
  })

  it("personalizes public listing order for signed-in viewers", async () => {
    const findMany = vi.fn().mockResolvedValue([
      makeFeedRecord(VALID_UUID, {
        categories: [{ category: "TOOLS" }],
        tags: [{ tag: { name: "drill" } }],
        bookingCount: 12,
        likeCount: 20,
        viewCount: 300,
      }),
      makeFeedRecord(SECOND_UUID, {
        categories: [{ category: "BOOKS" }],
        tags: [{ tag: { name: "novel" } }],
      }),
    ])
    const likeFindMany = vi.fn().mockResolvedValue([
      {
        item: {
          categories: [{ category: "BOOKS" }],
          tags: [{ tag: { name: "novel" } }],
        },
      },
    ])

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findMany }, like: { findMany: likeFindMany } } as never,
      user: { id: "viewer-1", email: "viewer@up.edu.ph", name: "Viewer" },
    })

    const result = await caller.list()

    expect(result.map((item) => item.id)).toEqual([SECOND_UUID, VALID_UUID])
  })

  it("uses carry-over cursor ids for paginated personalized feeds", async () => {
    const firstBatch = [
      makeFeedRecord(VALID_UUID, {
        categories: [{ category: "TOOLS" }],
        tags: [{ tag: { name: "drill" } }],
        bookingCount: 6,
      }),
      makeFeedRecord(SECOND_UUID, {
        categories: [{ category: "BOOKS" }],
        tags: [{ tag: { name: "novel" } }],
      }),
      makeFeedRecord(THIRD_UUID, {
        categories: [{ category: "MUSIC_AUDIO" }],
        tags: [{ tag: { name: "guitar" } }],
      }),
    ]
    const pendingItem = makeFeedRecord(THIRD_UUID, {
      categories: [{ category: "MUSIC_AUDIO" }],
      tags: [{ tag: { name: "guitar" } }],
    })
    const findMany = vi.fn().mockResolvedValueOnce(firstBatch).mockResolvedValueOnce([pendingItem])
    const likeFindMany = vi.fn().mockResolvedValue([
      {
        item: {
          categories: [{ category: "BOOKS" }],
          tags: [{ tag: { name: "novel" } }],
        },
      },
    ])

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { item: { findMany }, like: { findMany: likeFindMany } } as never,
      user: { id: "viewer-1", email: "viewer@up.edu.ph", name: "Viewer" },
    })

    const firstPage = await caller.paginatedList({ limit: 2 })

    expect(firstPage.items.map((item) => item.id)).toEqual([SECOND_UUID, VALID_UUID])
    expect(firstPage.nextCursor).toEqual({
      version: 1,
      scanExhausted: true,
      scanCursor: null,
      pendingIds: [THIRD_UUID],
    })

    const secondPage = await caller.paginatedList({
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    })

    expect(secondPage.items.map((item) => item.id)).toEqual([THIRD_UUID])
    expect(secondPage.nextCursor).toBeNull()
  })

  it("byId returns item review images for display", async () => {
    const reviewImageUrl =
      "https://example.supabase.co/storage/v1/object/public/item-images/reviews/u/r1.jpg"
    const findById = vi.fn().mockResolvedValue({
      id: VALID_UUID,
      name: "Camera",
      status: "AVAILABLE",
      lenderId: "owner-1",
      lender: {
        user: {
          username: "owner1",
          firstName: "Owner",
          middleName: null,
          lastName: "One",
          email: "owner1@up.edu.ph",
          status: "ACTIVE",
        },
      },
      availability: [
        {
          id: "33333333-3333-3333-3333-333333333333",
          startDate: new Date("2099-03-10T00:00:00.000Z"),
          endDate: new Date("2099-03-12T00:00:00.000Z"),
          status: "AVAILABLE",
        },
      ],
      images: [{ path: "https://example.com/camera.jpg", isPrimary: true, sortOrder: 0 }],
      categories: [{ category: "ELECTRONICS" }],
      tags: [{ tag: { name: "photo" } }],
      likes: [],
      description: "Mirrorless camera",
      condition: "GOOD",
      rateOption: "PER_DAY",
      createdAt: new Date("2026-03-22T00:00:00.000Z"),
      rentalFee: 250,
      replacementCost: null,
      freeToBorrow: false,
      whatItemOffers: null,
      whatIsIncluded: null,
      knownIssues: null,
      usageLimitations: null,
      isTrending: false,
      viewCount: 0,
      bookingCount: 0,
      likeCount: 0,
      rating: 0,
      transactionReviews: [
        {
          id: "review-1",
          transactionId: "txn-1",
          reviewerUserId: "borrower-1",
          reviewType: "ITEM_REVIEW",
          revieweeUserId: null,
          itemId: VALID_UUID,
          rating: 5,
          reviewText: "Very clean and complete.",
          images: [reviewImageUrl],
          isAnonymous: false,
          createdAt: new Date("2026-04-14T00:00:00.000Z"),
          reviewerUser: {
            id: "borrower-1",
            username: "borrower1",
            firstName: "Borrower",
            middleName: null,
            lastName: "One",
            avatarUrl: null,
          },
          revieweeUser: null,
        },
      ],
      bookings: [],
    })
    const incrementViewCount = vi.fn().mockResolvedValue({ id: VALID_UUID })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([{ adminModerationState: null }]),
        item: { findUnique: findById, findFirst: findById, update: incrementViewCount },
        transactionReview: {
          aggregate: vi.fn().mockResolvedValue({
            _avg: { rating: 5 },
            _count: { _all: 1 },
          }),
        },
      } as never,
      user: null,
    })

    const result = await caller.byId({ id: VALID_UUID })

    expect(findById).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: VALID_UUID }),
      }),
    )
    expect(incrementViewCount).toHaveBeenCalledWith({
      where: { id: VALID_UUID },
      data: { viewCount: { increment: 1 } },
    })
    expect(result?.reviewsCount).toBe(1)
    expect(result?.reviews[0]?.images).toEqual([reviewImageUrl])
  })

  it("update throws NOT_FOUND when item does not exist", async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const update = vi.fn()

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { $queryRaw: vi.fn(), item: { findUnique, update } } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    await expect(caller.update({ id: VALID_UUID, name: "Updated name" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("update throws FORBIDDEN when user does not own the item", async () => {
    const findUnique = vi.fn().mockResolvedValue({ lenderId: "owner-2" })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: { $queryRaw: vi.fn(), item: { findUnique, update: vi.fn() } } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    try {
      await caller.update({ id: VALID_UUID, name: "Updated name" })
      throw new Error("Expected update to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError)
      expect((error as TRPCError).code).toBe("FORBIDDEN")
    }
  })

  it("delete performs a soft delete by setting status to DELETED", async () => {
    const findUnique = vi.fn().mockResolvedValue({ lenderId: "owner-1", transactions: [] })
    const update = vi.fn().mockResolvedValue({
      id: VALID_UUID,
      name: "Camera",
      status: "DELETED",
      lenderId: "owner-1",
      lender: {
        user: {
          username: "owner1",
          firstName: "Owner",
          middleName: null,
          lastName: "One",
          email: "owner1@up.edu.ph",
        },
      },
      availability: [],
      images: [],
      categories: [{ category: "ELECTRONICS" }],
      tags: [{ tag: { name: "photo" } }],
    })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([{ adminModerationState: null }]),
        item: { findUnique, update },
      } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    const result = await caller.delete({ id: VALID_UUID })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_UUID },
        data: { status: "DELETED" },
      }),
    )
    expect(result.status).toBe("DELETED")
    expect(result.ownerName).toBe("owner1")
    expect(result.lenderUsername).toBe("owner1")
    expect(result.lenderFullName).toBe("Owner One")
    expect(result.categories).toEqual(["ELECTRONICS"])
    expect(result.tags).toEqual(["photo"])
  })

  it("delete blocks items with active or upcoming transactions", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      lenderId: "owner-1",
      transactions: [{ id: "txn-1" }],
    })
    const update = vi.fn()

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([{ adminModerationState: null }]),
        item: { findUnique, update },
      } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    await expect(caller.delete({ id: VALID_UUID })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "This item cannot be deleted because it has active or upcoming transactions. Deactivate the listing instead to preserve system records.",
    })

    expect(update).not.toHaveBeenCalled()
  })

  it("update blocks owner changes when a listing is admin moderated", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      lenderId: "owner-1",
      images: [],
    })
    const update = vi.fn()

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([{ adminModerationState: "DEACTIVATED" }]),
        item: { findUnique, update },
      } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    await expect(caller.update({ id: VALID_UUID, name: "Updated name" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message:
        "This listing was deactivated by an administrator and cannot be changed by the owner.",
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("delete blocks owner changes when a listing is admin moderated", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      lenderId: "owner-1",
      transactions: [],
    })
    const update = vi.fn()

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        $queryRaw: vi.fn().mockResolvedValue([{ adminModerationState: "REMOVED" }]),
        item: { findUnique, update },
      } as never,
      user: { id: "owner-1", email: "owner@up.edu.ph", name: "Owner" },
    })

    await expect(caller.delete({ id: VALID_UUID })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message:
        "This listing was removed by an administrator and can no longer be changed by the owner.",
    })
    expect(update).not.toHaveBeenCalled()
  })

  it("toggleLike creates a like when it does not exist", async () => {
    const itemUpdate = vi.fn().mockResolvedValue({ id: VALID_UUID })
    const itemFindFirst = vi.fn().mockResolvedValue({
      id: VALID_UUID,
      status: "AVAILABLE",
      lender: { user: { status: "ACTIVE" } },
      availability: [
        {
          startDate: new Date("2099-03-10T00:00:00.000Z"),
          endDate: new Date("2099-03-12T00:00:00.000Z"),
          status: "AVAILABLE",
        },
      ],
      bookings: [],
    })
    const likeFindUnique = vi
      .fn()
      .mockResolvedValueOnce(null) // check if like exists
      .mockResolvedValueOnce({ userId: "user-1", itemId: VALID_UUID }) // after create, check like exists

    const create = vi.fn().mockResolvedValue({ userId: "user-1", itemId: VALID_UUID })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        item: { findFirst: itemFindFirst, update: itemUpdate },
        like: { findUnique: likeFindUnique, create, delete: vi.fn() },
      } as never,
      user: { id: "user-1", email: "user@up.edu.ph", name: "User" },
    })

    const result = await caller.toggleLike({ itemId: VALID_UUID })

    expect(create).toHaveBeenCalledWith({
      data: { userId: "user-1", itemId: VALID_UUID },
    })
    expect(itemUpdate).toHaveBeenCalledWith({
      where: { id: VALID_UUID },
      data: { likeCount: { increment: 1 } },
    })
    expect(result.isLiked).toBe(true)
    expect(result.itemId).toBe(VALID_UUID)
  })

  it("toggleLike deletes a like when it exists", async () => {
    const itemUpdate = vi.fn().mockResolvedValue({ id: VALID_UUID })
    const itemFindFirst = vi.fn().mockResolvedValue({
      id: VALID_UUID,
      status: "AVAILABLE",
      lender: { user: { status: "ACTIVE" } },
      availability: [
        {
          startDate: new Date("2099-03-10T00:00:00.000Z"),
          endDate: new Date("2099-03-12T00:00:00.000Z"),
          status: "AVAILABLE",
        },
      ],
      bookings: [],
    })
    const likeFindUnique = vi
      .fn()
      .mockResolvedValueOnce({ userId: "user-1", itemId: VALID_UUID }) // check if like exists
      .mockResolvedValueOnce(null) // after delete, check like exists

    const deleteLike = vi.fn().mockResolvedValue({ userId: "user-1", itemId: VALID_UUID })

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        item: { findFirst: itemFindFirst, update: itemUpdate },
        like: { findUnique: likeFindUnique, delete: deleteLike, create: vi.fn() },
      } as never,
      user: { id: "user-1", email: "user@up.edu.ph", name: "User" },
    })

    const result = await caller.toggleLike({ itemId: VALID_UUID })

    expect(deleteLike).toHaveBeenCalledWith({
      where: {
        userId_itemId: {
          userId: "user-1",
          itemId: VALID_UUID,
        },
      },
    })
    expect(itemUpdate).toHaveBeenCalledWith({
      where: { id: VALID_UUID },
      data: { likeCount: { decrement: 1 } },
    })
    expect(result.isLiked).toBe(false)
    expect(result.itemId).toBe(VALID_UUID)
  })

  it("toggleLike throws NOT_FOUND when item does not exist", async () => {
    const itemFindFirst = vi.fn().mockResolvedValue(null) // item not found

    const caller = itemRouter.createCaller({
      event: { context: {} } as never,
      prisma: {
        item: { findFirst: itemFindFirst },
        like: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
      } as never,
      user: { id: "user-1", email: "user@up.edu.ph", name: "User" },
    })

    await expect(caller.toggleLike({ itemId: VALID_UUID })).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })

  describe("myListings", () => {
    const makeItem = (id: string, lenderId: string, status = "AVAILABLE") => ({
      id,
      name: "Test Item",
      status,
      createdAt: new Date("2026-03-15"),
      updatedAt: new Date("2026-03-15"),
      bookingCount: 0,
      rating: 0,
      viewCount: 0,
      likeCount: 0,
      isTrending: false,
      description: null,
      rentalFee: 0,
      replacementCost: null,
      freeToBorrow: false,
      rateOption: "PER_DAY",
      thumbnailImage: null,
      photos: [],
      whatItemOffers: null,
      whatIsIncluded: null,
      knownIssues: null,
      usageLimitations: null,
      lenderId,
      lender: {
        user: {
          username: "lender1",
          firstName: "Lender",
          middleName: null,
          lastName: "One",
          email: "lender1@up.edu.ph",
        },
      },
      availability: [],
      images: [],
      categories: [{ category: "ELECTRONICS" }],
      tags: [{ tag: { name: "photo" } }],
      transactions: [],
    })

    it("returns only items belonging to the authenticated user", async () => {
      const findMany = vi.fn().mockResolvedValue([makeItem(VALID_UUID, VALID_UUID)])
      const caller = itemRouter.createCaller({
        event: { context: {} } as never,
        prisma: { item: { findMany } } as never,
        user: { id: VALID_UUID, email: "lender@up.edu.ph", name: "Lender" },
      })

      const result = await caller.myListings({})

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([expect.objectContaining({ lenderId: VALID_UUID })]),
          }),
        }),
      )
      expect(result.items).toHaveLength(1)
      expect(result.nextCursor).toBeNull()
    })

    it("excludes DELETED items when no status filter is provided", async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const caller = itemRouter.createCaller({
        event: { context: {} } as never,
        prisma: { item: { findMany } } as never,
        user: { id: VALID_UUID, email: "lender@up.edu.ph", name: "Lender" },
      })

      await caller.myListings({})

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([expect.objectContaining({ status: { not: "DELETED" } })]),
          }),
        }),
      )
    })

    it("filters by selected derived statuses and categories when provided", async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const caller = itemRouter.createCaller({
        event: { context: {} } as never,
        prisma: { item: { findMany } } as never,
        user: { id: VALID_UUID, email: "lender@up.edu.ph", name: "Lender" },
      })

      await caller.myListings({ statuses: ["INACTIVE"], categories: ["ELECTRONICS"] })

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    status: "DEACTIVATED",
                  }),
                ]),
                categories: {
                  some: {
                    category: {
                      in: ["ELECTRONICS"],
                    },
                  },
                },
              }),
            ]),
          }),
        }),
      )
    })

    it("maps active disputes into DISPUTED display status", async () => {
      const disputedItem = {
        ...makeItem(VALID_UUID, VALID_UUID, "RENTED"),
        transactions: [
          {
            disputes: [{ id: "99999999-9999-9999-9999-999999999999" }],
          },
        ],
      }
      const findMany = vi.fn().mockResolvedValue([disputedItem])
      const caller = itemRouter.createCaller({
        event: { context: {} } as never,
        prisma: { item: { findMany } } as never,
        user: { id: VALID_UUID, email: "lender@up.edu.ph", name: "Lender" },
      })

      const result = await caller.myListings({})

      expect(result.items[0]).toMatchObject({
        hasActiveDispute: true,
        displayStatus: "DISPUTED",
      })
    })

    it("throws UNAUTHORIZED when the user is not authenticated", async () => {
      const caller = itemRouter.createCaller({
        event: { context: {} } as never,
        prisma: { item: { findMany: vi.fn() } } as never,
        user: null as never,
      })

      await expect(caller.myListings({})).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })

    it("returns nextCursor when results exceed the limit", async () => {
      const item1 = makeItem(VALID_UUID, VALID_UUID)
      const item2 = makeItem("33333333-3333-3333-3333-333333333333", VALID_UUID)
      const findMany = vi.fn().mockResolvedValue([
        item1,
        {
          ...item2,
          createdAt: new Date("2026-03-14"),
        },
      ])
      const caller = itemRouter.createCaller({
        event: { context: {} } as never,
        prisma: { item: { findMany } } as never,
        user: { id: VALID_UUID, email: "lender@up.edu.ph", name: "Lender" },
      })

      const result = await caller.myListings({ limit: 1 })

      expect(result.items).toHaveLength(1)
      expect(result.nextCursor).not.toBeNull()
      expect(result.nextCursor?.id).toBe(VALID_UUID)
    })
  })
})
