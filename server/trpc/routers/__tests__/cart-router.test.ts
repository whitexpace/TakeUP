import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"
import { cartRouter } from "../cart"

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const OTHER_USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const ITEM_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
const ENTRY_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"

const mockUser = { id: USER_ID, email: "borrower@up.edu.ph", name: "Borrower" }

const makeCartEntry = (overrides: Record<string, unknown> = {}) => ({
  id: ENTRY_ID,
  borrowerId: USER_ID,
  itemId: ITEM_ID,
  startAt: new Date("2026-04-01T09:00:00.000Z"),
  endAt: new Date("2026-04-03T09:00:00.000Z"),
  createdAt: new Date("2026-03-23T09:00:00.000Z"),
  item: {
    id: ITEM_ID,
    name: "Camera",
    rentalFee: 250,
    rateOption: "PER_DAY",
    freeToBorrow: false,
    lenderId: OTHER_USER_ID,
    images: [
      {
        path: "https://example.com/camera.jpg",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
    lender: {
      user: {
        username: "lender1",
        firstName: "Lender",
        middleName: null,
        lastName: "One",
        email: "lender@up.edu.ph",
      },
    },
  },
  ...overrides,
})

type MockCartEntry = ReturnType<typeof makeCartEntry>
type MockAvailabilityWindow = {
  startDate: Date
  endDate: Date
  status: string
}
type MockItem = {
  id: string
  status: string
  lenderId: string
  availability: MockAvailabilityWindow[]
  images?: Array<{ path: string; isPrimary: boolean; sortOrder: number }>
}
type MakeContextOptions = {
  accountType?: string
  item?: MockItem
  existingCartEntry?: MockCartEntry | null
  createdCartEntry?: MockCartEntry
  listedCartEntries?: MockCartEntry[]
  removableEntry?: { borrowerId: string } | null
  overlappingBooking?: { id: string } | null
}

const makeContext = ({
  accountType = "USER",
  item = {
    id: ITEM_ID,
    status: "AVAILABLE",
    lenderId: OTHER_USER_ID,
    availability: [
      {
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-04-10T23:59:59.000Z"),
        status: "AVAILABLE",
      },
    ],
    images: [{ path: "https://example.com/camera.jpg", isPrimary: true, sortOrder: 0 }],
  },
  existingCartEntry = null,
  createdCartEntry = makeCartEntry(),
  listedCartEntries = [makeCartEntry()],
  removableEntry = { borrowerId: USER_ID },
  overlappingBooking = null,
}: MakeContextOptions = {}) => {
  const userFindUnique = vi.fn().mockResolvedValue({ accountType, status: "ACTIVE" })
  const itemFindUnique = vi.fn().mockResolvedValue(item)
  const cartCreate = vi.fn().mockResolvedValue(createdCartEntry)
  const cartFindMany = vi.fn().mockResolvedValue(listedCartEntries)
  const cartDelete = vi.fn().mockResolvedValue({ id: ENTRY_ID })
  const cartFindUnique = vi.fn().mockImplementation((args: { where: Record<string, unknown> }) => {
    if ("borrowerId_itemId_startAt_endAt" in args.where) {
      return Promise.resolve(existingCartEntry)
    }

    return Promise.resolve(removableEntry)
  })
  const bookingFindFirst = vi.fn().mockResolvedValue(overlappingBooking)
  const queryRaw = vi.fn().mockImplementation((query) => {
    if (query.values && query.values.includes(ENTRY_ID)) {
      return Promise.resolve(removableEntry ? [removableEntry] : [])
    }
    return Promise.resolve([])
  })
  const executeRaw = vi.fn().mockResolvedValue(1)

  return {
    event: { context: {} } as never,
    prisma: {
      user: { findUnique: userFindUnique },
      item: { findUnique: itemFindUnique },
      cartEntry: {
        findUnique: cartFindUnique,
        create: cartCreate,
        findMany: cartFindMany,
        delete: cartDelete,
      },
      booking: { findFirst: bookingFindFirst },
      $queryRaw: queryRaw,
      $executeRaw: executeRaw,
    } as never,
    user: mockUser,
    mocks: {
      userFindUnique,
      itemFindUnique,
      cartFindUnique,
      cartCreate,
      cartFindMany,
      cartDelete,
      bookingFindFirst,
      queryRaw,
      executeRaw,
    },
  }
}

describe("cartRouter", () => {
  it("lists bag entries for the authenticated borrower", async () => {
    const context = makeContext()
    const caller = cartRouter.createCaller(context)

    const result = await caller.list()

    expect(context.mocks.cartFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { borrowerId: USER_ID },
      }),
    )
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: ENTRY_ID,
      itemId: ITEM_ID,
      lenderName: "lender1",
      listingType: "Rent",
    })
  })

  it("adds a cart entry for a borrower with an eligible item and window", async () => {
    const context = makeContext()
    const caller = cartRouter.createCaller(context)

    const result = await caller.add({
      itemId: ITEM_ID,
      startAt: new Date("2026-04-02T09:00:00.000Z"),
      endAt: new Date("2026-04-03T09:00:00.000Z"),
    })

    expect(context.mocks.cartCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          borrowerId: USER_ID,
          itemId: ITEM_ID,
        }),
      }),
    )
    expect(result.id).toBe(ENTRY_ID)
  })

  it("rejects duplicate borrower-item-window cart entries", async () => {
    const context = makeContext({ existingCartEntry: makeCartEntry() })
    const caller = cartRouter.createCaller(context)

    await expect(
      caller.add({
        itemId: ITEM_ID,
        startAt: new Date("2026-04-01T09:00:00.000Z"),
        endAt: new Date("2026-04-03T09:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("allows the same item with a different date window", async () => {
    const context = makeContext({ existingCartEntry: null })
    const caller = cartRouter.createCaller(context)

    await expect(
      caller.add({
        itemId: ITEM_ID,
        startAt: new Date("2026-04-05T09:00:00.000Z"),
        endAt: new Date("2026-04-06T09:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ itemId: ITEM_ID })
  })

  it("maps a duplicate create race to a conflict error", async () => {
    const context = makeContext()
    context.mocks.cartCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed.", {
        code: "P2002",
        clientVersion: "5.19.0",
      }),
    )
    const caller = cartRouter.createCaller(context)

    await expect(
      caller.add({
        itemId: ITEM_ID,
        startAt: new Date("2026-04-02T09:00:00.000Z"),
        endAt: new Date("2026-04-03T09:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("allows admin accounts to list bag entries", async () => {
    const context = makeContext({ accountType: "ADMIN" })
    const caller = cartRouter.createCaller(context)

    await expect(caller.list()).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: ENTRY_ID,
          itemId: ITEM_ID,
        }),
      ]),
    })
  })

  it("rejects adding your own listing", async () => {
    const context = makeContext({
      item: {
        id: ITEM_ID,
        status: "AVAILABLE",
        lenderId: USER_ID,
        availability: [
          {
            startDate: new Date("2026-04-01T00:00:00.000Z"),
            endDate: new Date("2026-04-10T23:59:59.000Z"),
            status: "AVAILABLE",
          },
        ],
      },
    })
    const caller = cartRouter.createCaller(context)

    await expect(
      caller.add({
        itemId: ITEM_ID,
        startAt: new Date("2026-04-02T09:00:00.000Z"),
        endAt: new Date("2026-04-03T09:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("rejects unavailable date windows", async () => {
    const context = makeContext({
      item: {
        id: ITEM_ID,
        status: "AVAILABLE",
        lenderId: OTHER_USER_ID,
        availability: [
          {
            startDate: new Date("2026-04-10T00:00:00.000Z"),
            endDate: new Date("2026-04-12T23:59:59.000Z"),
            status: "AVAILABLE",
          },
        ],
      },
    })
    const caller = cartRouter.createCaller(context)

    await expect(
      caller.add({
        itemId: ITEM_ID,
        startAt: new Date("2026-04-02T09:00:00.000Z"),
        endAt: new Date("2026-04-03T09:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("removes a bag item belonging to the authenticated borrower", async () => {
    const context = makeContext()
    const caller = cartRouter.createCaller(context)

    const result = await caller.remove({ id: ENTRY_ID })

    expect(result).toEqual({ ok: true })
    expect(context.mocks.cartDelete).toHaveBeenCalledWith({ where: { id: ENTRY_ID } })
  })

  it("rejects removing another user's bag item", async () => {
    const context = makeContext({ removableEntry: { borrowerId: OTHER_USER_ID } })
    const caller = cartRouter.createCaller(context)

    await expect(caller.remove({ id: ENTRY_ID })).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("rejects adding an item if it overlaps with an existing confirmed booking", async () => {
    const context = makeContext({ overlappingBooking: { id: "existing-booking-id" } })
    const caller = cartRouter.createCaller(context)

    await expect(
      caller.add({
        itemId: ITEM_ID,
        startAt: new Date("2026-04-02T09:00:00.000Z"),
        endAt: new Date("2026-04-03T09:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This item is already booked for the selected dates.",
    })
  })

  it("requires authentication", async () => {
    const caller = cartRouter.createCaller({
      event: { context: {} } as never,
      prisma: {} as never,
      user: null,
    })

    await expect(caller.list()).rejects.toBeInstanceOf(TRPCError)
    await expect(caller.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})
