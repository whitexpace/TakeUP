import { describe, expect, it, vi } from "vitest"
import { communityRouter } from "../community"

const BORROWER_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const LENDER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const OTHER_USER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const ROOT_REPLY_ID = "11111111-1111-4111-8111-111111111111"
const CHILD_REPLY_ID = "22222222-2222-4222-8222-222222222222"

const borrowerUser = {
  id: BORROWER_USER_ID,
  email: "borrower@up.edu.ph",
  name: "Borrower User",
}

const lenderUser = {
  id: LENDER_USER_ID,
  email: "lender@up.edu.ph",
  name: "Lender User",
}

const makeOfferableItemRow = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  numericId: "101",
  name: "Camera",
  thumbnailImage: "https://example.com/camera.jpg",
  condition: "GOOD",
  rentalFee: "500",
  freeToBorrow: false,
  status: "AVAILABLE",
  rateOption: "PER_DAY",
  createdAt: "2026-04-20T10:00:00.000Z",
  ...overrides,
})

const makeRequestRow = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  borrowerID: 100,
  itemNeeded: "Tripod",
  referenceImageUrl: null,
  requestedDates: [new Date("2026-04-20T00:00:00.000Z"), new Date("2026-04-21T00:00:00.000Z")],
  priceRange: [100, 200],
  description: "Need a tripod for a campus event.",
  status: "OPEN",
  createdAt: new Date("2026-04-18T00:00:00.000Z"),
  updatedAt: new Date("2026-04-18T00:00:00.000Z"),
  borrowerProfileId: 100,
  borrowerUserId: BORROWER_USER_ID,
  borrowerUsername: "borrower1",
  borrowerFirstName: "Juan",
  borrowerMiddleName: null,
  borrowerLastName: "Cruz",
  borrowerEmail: "borrower@up.edu.ph",
  borrowerAvatarUrl: "",
  offersCount: 1,
  repliesCount: 0,
  ...overrides,
})

const makeOfferRow = (overrides: Record<string, unknown> = {}) => ({
  id: 20,
  lenderID: 200,
  requestID: 10,
  itemID: 101,
  rentalFee: 500,
  availability: true,
  condition: "GOOD",
  rentalTerms: "Handle with care",
  status: "PENDING",
  borrowerReadAt: null,
  createdAt: new Date("2026-04-18T00:00:00.000Z"),
  updatedAt: new Date("2026-04-18T00:00:00.000Z"),
  itemName: "Camera",
  itemThumbnailImage: "https://example.com/camera.jpg",
  lenderProfileId: 200,
  lenderUserId: LENDER_USER_ID,
  lenderUsername: "lender1",
  lenderFirstName: "Issa",
  lenderMiddleName: null,
  lenderLastName: "Santos",
  lenderEmail: "lender@up.edu.ph",
  requestBorrowerID: 100,
  requestBorrowerUserId: BORROWER_USER_ID,
  requestItemNeeded: "Tripod",
  ...overrides,
})

const makePrisma = (overrides: Record<string, unknown> = {}) => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn().mockResolvedValue(1),
  itemRequestReply: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
  itemRequestReplyUpvote: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue({ id: BORROWER_USER_ID }),
  },
  borrower: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  lender: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  ...overrides,
})

const makeContext = (
  user: typeof borrowerUser | typeof lenderUser | typeof borrowerUser | null,
  prismaOverrides = {},
) => ({
  event: { context: {} } as never,
  prisma: makePrisma(prismaOverrides) as never,
  user,
})

describe("communityRouter", () => {
  it("returns offerable items normalized for the current lender", async () => {
    const queryRaw = vi.fn().mockResolvedValue([makeOfferableItemRow()])
    const caller = communityRouter.createCaller(makeContext(lenderUser, { $queryRaw: queryRaw }))

    const result = await caller.offerableItems()

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(result).toEqual([
      expect.objectContaining({
        id: "item-1",
        numericId: 101,
        rentalFee: 500,
        createdAt: new Date("2026-04-20T10:00:00.000Z"),
      }),
    ])
  })

  it("lists public item requests with mapped offers", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([makeRequestRow()])
      .mockResolvedValueOnce([makeOfferRow()])
    const caller = communityRouter.createCaller(makeContext(null, { $queryRaw: queryRaw }))

    const result = await caller.listRequests({})

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 10,
      itemNeeded: "Tripod",
      borrower: {
        userId: BORROWER_USER_ID,
        name: "Juan Cruz",
      },
      offersCount: 1,
    })
    expect(result[0]?.requestedDates[0]).toBeInstanceOf(Date)
    expect(result[0]?.offers[0]).toMatchObject({
      id: 20,
      itemName: "Camera",
      lender: { userId: LENDER_USER_ID, name: "Issa Santos" },
    })
    expect(result[0]?.replies).toEqual([])
  })

  it("can include request reply trees in the request feed payload", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([makeRequestRow({ repliesCount: 1 })])
      .mockResolvedValueOnce([makeOfferRow()])
    const replyFindMany = vi.fn().mockResolvedValue([
      {
        id: ROOT_REPLY_ID,
        requestId: 10,
        parentReplyId: null,
        body: "I can help with this.",
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        updatedAt: new Date("2026-04-18T00:00:00.000Z"),
        author: {
          id: LENDER_USER_ID,
          username: "lender1",
          firstName: "Issa",
          middleName: null,
          lastName: "Santos",
          email: "lender@up.edu.ph",
          avatarUrl: "",
        },
        _count: { upvotes: 1 },
        upvotes: [],
      },
    ])
    const caller = communityRouter.createCaller(
      makeContext(null, {
        $queryRaw: queryRaw,
        itemRequestReply: { findMany: replyFindMany },
      }),
    )

    const result = await caller.listRequests({ includeReplies: true })

    expect(replyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requestId: 10 },
      }),
    )
    expect(result[0]?.replies).toMatchObject([
      {
        id: ROOT_REPLY_ID,
        text: "I can help with this.",
        upvotes: 1,
      },
    ])
  })

  it("lists request replies as a nested tree with viewer upvote state", async () => {
    const replyFindMany = vi.fn().mockResolvedValue([
      {
        id: ROOT_REPLY_ID,
        requestId: 10,
        parentReplyId: null,
        body: "Top-level reply",
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        updatedAt: new Date("2026-04-18T00:00:00.000Z"),
        author: {
          id: BORROWER_USER_ID,
          username: "borrower1",
          firstName: "Juan",
          middleName: null,
          lastName: "Cruz",
          email: "borrower@up.edu.ph",
          avatarUrl: "",
        },
        _count: { upvotes: 2 },
        upvotes: [{ id: "vote-1" }],
      },
      {
        id: CHILD_REPLY_ID,
        requestId: 10,
        parentReplyId: ROOT_REPLY_ID,
        body: "Nested reply",
        createdAt: new Date("2026-04-18T01:00:00.000Z"),
        updatedAt: new Date("2026-04-18T01:00:00.000Z"),
        author: {
          id: LENDER_USER_ID,
          username: "lender1",
          firstName: "Issa",
          middleName: null,
          lastName: "Santos",
          email: "lender@up.edu.ph",
          avatarUrl: "",
        },
        _count: { upvotes: 0 },
        upvotes: [],
      },
    ])
    const queryRaw = vi.fn().mockResolvedValueOnce([makeRequestRow()])
    const caller = communityRouter.createCaller(
      makeContext(borrowerUser, {
        $queryRaw: queryRaw,
        itemRequestReply: { findMany: replyFindMany },
      }),
    )

    const result = await caller.listReplies({ requestId: 10 })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: ROOT_REPLY_ID,
      text: "Top-level reply",
      isUpvoted: true,
      replies: [{ id: CHILD_REPLY_ID, text: "Nested reply" }],
    })
  })

  it("creates a reply for an existing request", async () => {
    const queryRaw = vi.fn().mockResolvedValueOnce([makeRequestRow()])
    const createReply = vi.fn().mockResolvedValue({ id: ROOT_REPLY_ID })
    const replyFindMany = vi.fn().mockResolvedValue([
      {
        id: ROOT_REPLY_ID,
        requestId: 10,
        parentReplyId: null,
        body: "Fresh reply",
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        updatedAt: new Date("2026-04-18T00:00:00.000Z"),
        author: {
          id: BORROWER_USER_ID,
          username: "borrower1",
          firstName: "Juan",
          middleName: null,
          lastName: "Cruz",
          email: "borrower@up.edu.ph",
          avatarUrl: "",
        },
        _count: { upvotes: 0 },
        upvotes: [],
      },
    ])
    const findUnique = vi.fn().mockResolvedValue({ id: BORROWER_USER_ID })
    const caller = communityRouter.createCaller(
      makeContext(borrowerUser, {
        $queryRaw: queryRaw,
        user: { findUnique },
        itemRequestReply: {
          create: createReply,
          findMany: replyFindMany,
        },
      }),
    )

    const result = await caller.createReply({
      requestId: 10,
      text: "Fresh reply",
    })

    expect(createReply).toHaveBeenCalledWith({
      data: {
        requestId: 10,
        authorUserId: BORROWER_USER_ID,
        parentReplyId: null,
        body: "Fresh reply",
      },
      select: { id: true },
    })
    expect(result).toMatchObject({
      id: ROOT_REPLY_ID,
      requestId: 10,
      text: "Fresh reply",
    })
  })

  it("toggles a reply upvote for the current user", async () => {
    const queryRaw = vi.fn().mockResolvedValueOnce([
      {
        id: ROOT_REPLY_ID,
        requestId: 10,
        parentReplyId: null,
        authorUserId: BORROWER_USER_ID,
      },
    ])
    const upvoteFindUnique = vi.fn().mockResolvedValue(null)
    const upvoteCreate = vi.fn().mockResolvedValue({ id: "vote-1" })
    const replyFindMany = vi.fn().mockResolvedValue([
      {
        id: ROOT_REPLY_ID,
        requestId: 10,
        parentReplyId: null,
        body: "Fresh reply",
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        updatedAt: new Date("2026-04-18T00:00:00.000Z"),
        author: {
          id: BORROWER_USER_ID,
          username: "borrower1",
          firstName: "Juan",
          middleName: null,
          lastName: "Cruz",
          email: "borrower@up.edu.ph",
          avatarUrl: "",
        },
        _count: { upvotes: 1 },
        upvotes: [{ id: "vote-1" }],
      },
    ])
    const findUnique = vi.fn().mockResolvedValue({ id: LENDER_USER_ID })
    const caller = communityRouter.createCaller(
      makeContext(lenderUser, {
        $queryRaw: queryRaw,
        user: { findUnique },
        itemRequestReply: { findMany: replyFindMany },
        itemRequestReplyUpvote: {
          findUnique: upvoteFindUnique,
          create: upvoteCreate,
          delete: vi.fn(),
        },
      }),
    )

    const result = await caller.toggleReplyUpvote({ id: ROOT_REPLY_ID })

    expect(upvoteCreate).toHaveBeenCalledWith({
      data: {
        replyId: ROOT_REPLY_ID,
        userId: LENDER_USER_ID,
      },
    })
    expect(result).toEqual({
      replyId: ROOT_REPLY_ID,
      requestId: 10,
      isUpvoted: true,
      upvotes: 1,
    })
  })

  it("throws not found when requestById cannot find the request", async () => {
    const queryRaw = vi.fn().mockResolvedValueOnce([])
    const caller = communityRouter.createCaller(makeContext(null, { $queryRaw: queryRaw }))

    await expect(caller.requestById({ id: 10 })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Item request not found.",
    })
  })

  it("creates a request for the authenticated borrower and returns the mapped result", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ id: 100, userId: BORROWER_USER_ID }])
      .mockResolvedValueOnce([{ id: 10 }])
      .mockResolvedValueOnce([makeRequestRow()])
      .mockResolvedValueOnce([])
    const borrowerUpsert = vi.fn().mockResolvedValue({})
    const findUnique = vi.fn().mockResolvedValue({ id: BORROWER_USER_ID })

    const caller = communityRouter.createCaller(
      makeContext(borrowerUser, {
        $queryRaw: queryRaw,
        borrower: { upsert: borrowerUpsert },
        user: { findUnique },
      }),
    )

    const result = await caller.createRequest({
      itemNeeded: "Tripod",
      requestedDates: [new Date("2026-04-20T00:00:00.000Z")],
      priceRange: [100, 200],
      description: "Need a tripod for a campus event.",
      status: "OPEN",
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: BORROWER_USER_ID },
      select: { id: true },
    })
    expect(borrowerUpsert).toHaveBeenCalledWith({
      where: { userId: BORROWER_USER_ID },
      create: { userId: BORROWER_USER_ID, borrowStatus: "ACTIVE", borrowerRating: 0 },
      update: {},
    })
    expect(result).toMatchObject({
      id: 10,
      itemNeeded: "Tripod",
      borrower: { userId: BORROWER_USER_ID },
    })
  })

  it("forbids updating a request owned by another borrower", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 10, status: "OPEN", borrowerID: 100, borrowerUserId: OTHER_USER_ID },
      ])
    const caller = communityRouter.createCaller(makeContext(borrowerUser, { $queryRaw: queryRaw }))

    await expect(
      caller.updateRequest({
        id: 10,
        description: "Updated description",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You are not allowed to update this item request.",
    })
  })

  it("deletes a request owned by the current borrower", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 10, status: "OPEN", borrowerID: 100, borrowerUserId: BORROWER_USER_ID },
      ])
      .mockResolvedValueOnce([{ id: 10 }])
    const caller = communityRouter.createCaller(makeContext(borrowerUser, { $queryRaw: queryRaw }))

    const result = await caller.deleteRequest({ id: 10 })

    expect(result).toEqual({ id: 10 })
  })

  it("rejects creating an offer for the user's own request", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ id: 200, userId: LENDER_USER_ID }])
      .mockResolvedValueOnce([
        { id: 10, status: "OPEN", borrowerID: 100, borrowerUserId: LENDER_USER_ID },
      ])
    const caller = communityRouter.createCaller(
      makeContext(lenderUser, {
        $queryRaw: queryRaw,
        user: { findUnique: vi.fn().mockResolvedValue({ id: LENDER_USER_ID }) },
      }),
    )

    await expect(
      caller.createOffer({
        requestID: 10,
        itemID: 101,
        rentalFee: 500,
        availability: true,
        condition: "GOOD",
        rentalTerms: "Handle with care",
        status: "PENDING",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You cannot offer an item to your own request.",
    })
  })

  it("rejects creating an offer with an unavailable item", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ id: 200, userId: LENDER_USER_ID }])
      .mockResolvedValueOnce([
        { id: 10, status: "OPEN", borrowerID: 100, borrowerUserId: BORROWER_USER_ID },
      ])
      .mockResolvedValueOnce([
        { numericId: 101, lenderId: LENDER_USER_ID, condition: "GOOD", status: "DEACTIVATED" },
      ])
    const caller = communityRouter.createCaller(
      makeContext(lenderUser, {
        $queryRaw: queryRaw,
        user: { findUnique: vi.fn().mockResolvedValue({ id: LENDER_USER_ID }) },
      }),
    )

    await expect(
      caller.createOffer({
        requestID: 10,
        itemID: 101,
        rentalFee: 500,
        availability: true,
        condition: "GOOD",
        rentalTerms: "Handle with care",
        status: "PENDING",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only active available listings can be offered on requests.",
    })
  })

  it("rejects duplicate offers from the same lender for one request", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ id: 200, userId: LENDER_USER_ID }])
      .mockResolvedValueOnce([
        { id: 10, status: "OPEN", borrowerID: 100, borrowerUserId: BORROWER_USER_ID },
      ])
      .mockResolvedValueOnce([
        { numericId: 101, lenderId: LENDER_USER_ID, condition: "GOOD", status: "AVAILABLE" },
      ])
      .mockResolvedValueOnce([{ id: 99 }])
    const caller = communityRouter.createCaller(
      makeContext(lenderUser, {
        $queryRaw: queryRaw,
        user: { findUnique: vi.fn().mockResolvedValue({ id: LENDER_USER_ID }) },
      }),
    )

    await expect(
      caller.createOffer({
        requestID: 10,
        itemID: 101,
        rentalFee: 500,
        availability: true,
        condition: "GOOD",
        rentalTerms: "Handle with care",
        status: "PENDING",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You already have an offer for this request. Update the existing offer instead.",
    })
  })

  it("creates an offer for an owned available item and returns the mapped offer", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ id: 200, userId: LENDER_USER_ID }])
      .mockResolvedValueOnce([
        { id: 10, status: "OPEN", borrowerID: 100, borrowerUserId: BORROWER_USER_ID },
      ])
      .mockResolvedValueOnce([
        { numericId: 101, lenderId: LENDER_USER_ID, condition: "GOOD", status: "AVAILABLE" },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 20 }])
      .mockResolvedValueOnce([makeOfferRow()])
    const caller = communityRouter.createCaller(
      makeContext(lenderUser, {
        $queryRaw: queryRaw,
        user: { findUnique: vi.fn().mockResolvedValue({ id: LENDER_USER_ID }) },
      }),
    )

    const result = await caller.createOffer({
      requestID: 10,
      itemID: 101,
      rentalFee: 500,
      availability: true,
      condition: "GOOD",
      rentalTerms: "Handle with care",
      status: "PENDING",
    })

    expect(result).toMatchObject({
      id: 20,
      requestID: 10,
      itemID: 101,
      lender: { userId: LENDER_USER_ID },
    })
  })

  it("blocks borrowers from updating non-status offer fields", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        makeOfferRow({ requestBorrowerUserId: BORROWER_USER_ID, lenderUserId: LENDER_USER_ID }),
      ])
    const caller = communityRouter.createCaller(makeContext(borrowerUser, { $queryRaw: queryRaw }))

    await expect(
      caller.updateOffer({
        id: 20,
        rentalFee: 600,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Borrowers can only update the offer status.",
    })
  })

  it("blocks lenders from switching an offer to another user's item", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        makeOfferRow({ lenderUserId: LENDER_USER_ID, requestBorrowerUserId: BORROWER_USER_ID }),
      ])
      .mockResolvedValueOnce([
        { numericId: 999, lenderId: OTHER_USER_ID, condition: "GOOD", status: "AVAILABLE" },
      ])
    const caller = communityRouter.createCaller(makeContext(lenderUser, { $queryRaw: queryRaw }))

    await expect(
      caller.updateOffer({
        id: 20,
        itemID: 999,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You can only switch the offer to one of your own items.",
    })
  })

  it("deletes an offer for an authorized participant", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([makeOfferRow({ requestBorrowerUserId: BORROWER_USER_ID })])
      .mockResolvedValueOnce([{ id: 20 }])
    const caller = communityRouter.createCaller(makeContext(borrowerUser, { $queryRaw: queryRaw }))

    const result = await caller.deleteOffer({ id: 20 })

    expect(result).toEqual({ id: 20 })
  })

  it("lists notifications with derived read state", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValue([
        makeOfferRow({ id: 20, borrowerReadAt: null }),
        makeOfferRow({ id: 21, borrowerReadAt: new Date("2026-04-19T00:00:00.000Z") }),
      ])
    const caller = communityRouter.createCaller(makeContext(borrowerUser, { $queryRaw: queryRaw }))

    const result = await caller.notifications()

    expect(result).toEqual([
      expect.objectContaining({ id: 20, read: false, actorName: "Issa Santos" }),
      expect.objectContaining({ id: 21, read: true }),
    ])
  })

  it("marks one request-offer notification as read", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValue([makeOfferRow({ id: 20, requestBorrowerUserId: BORROWER_USER_ID })])
    const executeRaw = vi.fn().mockResolvedValue(1)
    const caller = communityRouter.createCaller(
      makeContext(borrowerUser, { $queryRaw: queryRaw, $executeRaw: executeRaw }),
    )

    const result = await caller.markNotificationRead({ id: 20 })

    expect(executeRaw).toHaveBeenCalledTimes(1)
    expect(result.id).toBe(20)
    expect(result.borrowerReadAt).toBeInstanceOf(Date)
  })

  it("marks all request-offer notifications as read and returns the affected count", async () => {
    const executeRaw = vi.fn().mockResolvedValue(3n)
    const caller = communityRouter.createCaller(
      makeContext(borrowerUser, { $executeRaw: executeRaw }),
    )

    const result = await caller.markAllNotificationsRead()

    expect(result).toEqual({ count: 3 })
  })
})
