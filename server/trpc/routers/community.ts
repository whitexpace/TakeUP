import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import {
  createItemRequestSchema,
  createRequestOfferSchema,
  deleteItemRequestSchema,
  deleteRequestOfferSchema,
  itemRequestIdSchema,
  itemRequestStatusSchema,
  listItemRequestsSchema,
  listRequestOffersSchema,
  markRequestOfferNotificationReadSchema,
  requestOfferIdSchema,
  requestOfferStatusSchema,
  type ItemRequestStatus,
  type RequestOfferStatus,
  updateItemRequestSchema,
  updateRequestOfferSchema,
} from "../../../shared/schemas/item-request"

type ProfileIdRow = {
  id: number
  userId: string
}

type OfferableItemRow = {
  id: string
  numericId: number | bigint | string
  name: string
  thumbnailImage: string | null
  condition: string
  rentalFee: number | bigint | string
  freeToBorrow: boolean
  status: string
  rateOption: string
  createdAt: Date | string
}

type RequestRow = {
  id: number
  borrowerID: number
  itemNeeded: string
  referenceImageUrl: string | null
  requestedDates: Date[] | string[]
  priceRange: number[] | bigint[] | string[]
  description: string
  status: string
  createdAt: Date | string
  updatedAt: Date | string
  borrowerProfileId: number
  borrowerUserId: string
  borrowerUsername: string
  borrowerFirstName: string
  borrowerMiddleName: string | null
  borrowerLastName: string
  borrowerEmail: string
  offersCount: number | bigint
}

type OfferRow = {
  id: number
  lenderID: number
  requestID: number
  itemID: number
  rentalFee: number
  availability: boolean
  condition: string
  rentalTerms: string | null
  status: string
  borrowerReadAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
  itemName: string
  itemThumbnailImage: string | null
  lenderProfileId: number
  lenderUserId: string
  lenderUsername: string
  lenderFirstName: string
  lenderMiddleName: string | null
  lenderLastName: string
  lenderEmail: string
  requestBorrowerID: number
  requestBorrowerUserId: string
  requestItemNeeded: string
}

const toDate = (value: Date | string | null | undefined) => {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

const toNumber = (value: number | bigint | string) => {
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  return Number(value)
}

const normalizeRequestedDates = (values: Date[] | string[]) =>
  values.map((value) => (value instanceof Date ? value : new Date(value)))

const normalizePriceRange = (values: number[] | bigint[] | string[]) =>
  values.map((value) => toNumber(value as number | bigint | string))

const formatUserName = (user: {
  username: string
  firstName: string
  middleName: string | null
  lastName: string
  email: string
}) =>
  user.username ||
  [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") ||
  user.email

const sqlDateArray = (values: Date[]) =>
  Prisma.sql`ARRAY[${Prisma.join(values.map((value) => Prisma.sql`${value}`))}]::timestamp[]`

const sqlIntArray = (values: number[]) =>
  Prisma.sql`ARRAY[${Prisma.join(values.map((value) => Prisma.sql`${value}`))}]::integer[]`

const sqlItemRequestStatus = (status: ItemRequestStatus) =>
  Prisma.sql`${Prisma.raw(`'${status}'::"ItemRequestStatus"`)}`

const sqlRequestOfferStatus = (status: RequestOfferStatus) =>
  Prisma.sql`${Prisma.raw(`'${status}'::"RequestOfferStatus"`)}`

const sqlItemCondition = (condition: string) =>
  Prisma.sql`${Prisma.raw(`'${condition}'::"ItemCondition"`)}`

const mapOffer = (offer: OfferRow) => ({
  id: offer.id,
  lenderID: offer.lenderID,
  requestID: offer.requestID,
  itemID: offer.itemID,
  itemName: offer.itemName,
  itemThumbnailImage: offer.itemThumbnailImage,
  rentalFee: offer.rentalFee,
  availability: offer.availability,
  condition: offer.condition,
  rentalTerms: offer.rentalTerms ?? "",
  status: offer.status,
  borrowerReadAt: toDate(offer.borrowerReadAt),
  createdAt: toDate(offer.createdAt),
  updatedAt: toDate(offer.updatedAt),
  lender: {
    profileId: offer.lenderProfileId,
    userId: offer.lenderUserId,
    name: formatUserName({
      username: offer.lenderUsername,
      firstName: offer.lenderFirstName,
      middleName: offer.lenderMiddleName,
      lastName: offer.lenderLastName,
      email: offer.lenderEmail,
    }),
    avatar: "",
  },
})

const mapRequest = (request: RequestRow, offers: OfferRow[]) => ({
  id: request.id,
  borrowerID: request.borrowerID,
  itemNeeded: request.itemNeeded,
  referenceImageUrl: request.referenceImageUrl,
  requestedDates: normalizeRequestedDates(request.requestedDates),
  priceRange: normalizePriceRange(request.priceRange),
  description: request.description,
  status: request.status,
  createdAt: toDate(request.createdAt),
  updatedAt: toDate(request.updatedAt),
  offersCount: toNumber(request.offersCount),
  borrower: {
    profileId: request.borrowerProfileId,
    userId: request.borrowerUserId,
    name: formatUserName({
      username: request.borrowerUsername,
      firstName: request.borrowerFirstName,
      middleName: request.borrowerMiddleName,
      lastName: request.borrowerLastName,
      email: request.borrowerEmail,
    }),
    avatar: "",
  },
  offers: offers.map(mapOffer),
})

const buildRequestWhereSql = (
  options: {
    requestId?: number
    status?: ItemRequestStatus
    borrowerOnly?: boolean
  },
  viewerUserId: string | null,
) => {
  const clauses: Prisma.Sql[] = []

  if (options.requestId !== undefined) {
    clauses.push(Prisma.sql`r."id" = ${options.requestId}`)
  }

  if (options.status) {
    clauses.push(Prisma.sql`r."status" = ${sqlItemRequestStatus(options.status)}`)
  }

  if (options.borrowerOnly) {
    if (!viewerUserId) {
      clauses.push(Prisma.sql`1 = 0`)
    } else {
      clauses.push(Prisma.sql`b."userId" = ${viewerUserId}`)
    }
  }

  return clauses.length > 0 ? Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}` : Prisma.empty
}

const fetchRequestRows = async (
  prisma: {
    $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>
  },
  options: {
    requestId?: number
    status?: ItemRequestStatus
    borrowerOnly?: boolean
  },
  viewerUserId: string | null,
) => {
  const whereSql = buildRequestWhereSql(options, viewerUserId)

  return prisma.$queryRaw<RequestRow[]>(Prisma.sql`
    SELECT
      r."id",
      r."borrowerID",
      r."itemNeeded",
      r."referenceImageUrl",
      r."requestedDates",
      r."priceRange",
      r."description",
      r."status"::text AS "status",
      r."createdAt",
      r."updatedAt",
      b."id" AS "borrowerProfileId",
      b."userId" AS "borrowerUserId",
      u."username" AS "borrowerUsername",
      u."firstName" AS "borrowerFirstName",
      u."middleName" AS "borrowerMiddleName",
      u."lastName" AS "borrowerLastName",
      u."email" AS "borrowerEmail",
      COALESCE(oc."offersCount", 0) AS "offersCount"
    FROM "ItemRequest" r
    INNER JOIN "Borrower" b ON b."id" = r."borrowerID"
    INNER JOIN "User" u ON u."id" = b."userId"
    LEFT JOIN (
      SELECT
        "requestID",
        COUNT(*)::int AS "offersCount"
      FROM "RequestOffer"
      WHERE "status" <> ${sqlRequestOfferStatus(requestOfferStatusSchema.enum.CANCELLED)}
      GROUP BY "requestID"
    ) oc ON oc."requestID" = r."id"
    ${whereSql}
    ORDER BY r."createdAt" DESC
  `)
}

const fetchOfferRows = async (
  prisma: {
    $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>
  },
  options: {
    offerId?: number
    requestIds?: number[]
    requestID?: number
    status?: RequestOfferStatus
    viewerUserId: string | null
    includeCancelled?: boolean
    sentOnly?: boolean
    receivedOnly?: boolean
  },
) => {
  const clauses: Prisma.Sql[] = []

  if (options.offerId !== undefined) {
    clauses.push(Prisma.sql`o."id" = ${options.offerId}`)
  }

  if (options.requestIds && options.requestIds.length > 0) {
    clauses.push(
      Prisma.sql`o."requestID" IN (${Prisma.join(options.requestIds.map((id) => Prisma.sql`${id}`))})`,
    )
  }

  if (options.requestID !== undefined) {
    clauses.push(Prisma.sql`o."requestID" = ${options.requestID}`)
  }

  if (!options.includeCancelled) {
    clauses.push(
      Prisma.sql`o."status" <> ${sqlRequestOfferStatus(requestOfferStatusSchema.enum.CANCELLED)}`,
    )
  }

  if (options.status) {
    clauses.push(Prisma.sql`o."status" = ${sqlRequestOfferStatus(options.status)}`)
  }

  if (options.sentOnly) {
    clauses.push(Prisma.sql`l."userId" = ${options.viewerUserId ?? "__anonymous__"}`)
  } else if (options.receivedOnly) {
    clauses.push(Prisma.sql`rb."userId" = ${options.viewerUserId ?? "__anonymous__"}`)
  } else if (options.viewerUserId) {
    clauses.push(
      Prisma.sql`(l."userId" = ${options.viewerUserId} OR rb."userId" = ${options.viewerUserId})`,
    )
  } else {
    clauses.push(Prisma.sql`1 = 0`)
  }

  const whereSql =
    clauses.length > 0 ? Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}` : Prisma.empty

  return prisma.$queryRaw<OfferRow[]>(Prisma.sql`
    SELECT
      o."id",
      o."lenderID",
      o."requestID",
      o."itemID",
      o."rentalFee",
      o."availability",
      o."condition"::text AS "condition",
      o."rentalTerms",
      o."status"::text AS "status",
      o."borrowerReadAt",
      o."createdAt",
      o."updatedAt",
      i."name" AS "itemName",
      ii."path" AS "itemThumbnailImage",
      l."id" AS "lenderProfileId",
      l."userId" AS "lenderUserId",
      lu."username" AS "lenderUsername",
      lu."firstName" AS "lenderFirstName",
      lu."middleName" AS "lenderMiddleName",
      lu."lastName" AS "lenderLastName",
      lu."email" AS "lenderEmail",
      r."borrowerID" AS "requestBorrowerID",
      rb."userId" AS "requestBorrowerUserId",
      r."itemNeeded" AS "requestItemNeeded"
    FROM "RequestOffer" o
    INNER JOIN "Item" i ON i."numericId" = o."itemID"
    LEFT JOIN LATERAL (
      SELECT "path"
      FROM "ItemImage"
      WHERE "itemId" = i."id"
      ORDER BY "isPrimary" DESC, "sortOrder" ASC, "createdAt" ASC
      LIMIT 1
    ) ii ON TRUE
    INNER JOIN "Lender" l ON l."id" = o."lenderID"
    INNER JOIN "User" lu ON lu."id" = l."userId"
    INNER JOIN "ItemRequest" r ON r."id" = o."requestID"
    INNER JOIN "Borrower" rb ON rb."id" = r."borrowerID"
    ${whereSql}
    ORDER BY o."createdAt" DESC
  `)
}

const fetchMappedRequests = async (
  prisma: {
    $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>
  },
  options: {
    requestId?: number
    status?: ItemRequestStatus
    borrowerOnly?: boolean
    includeCancelledOffers?: boolean
  },
  viewerUserId: string | null,
) => {
  const requests = await fetchRequestRows(prisma, options, viewerUserId)
  const requestIds = requests.map((request) => request.id)
  const offers =
    requestIds.length > 0
      ? await fetchOfferRows(prisma, {
          requestIds,
          viewerUserId,
          includeCancelled: options.includeCancelledOffers,
        })
      : []

  const offersByRequestId = new Map<number, OfferRow[]>()
  for (const offer of offers) {
    const entries = offersByRequestId.get(offer.requestID) ?? []
    entries.push(offer)
    offersByRequestId.set(offer.requestID, entries)
  }

  return requests.map((request) => mapRequest(request, offersByRequestId.get(request.id) ?? []))
}

const assertUserExists = async (
  prisma: {
    user: {
      findUnique(args: {
        where: { id: string }
        select: { id: true }
      }): Promise<{ id: string } | null>
    }
  },
  userId: string,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Your account is missing from the database. Sign out and sign in again.",
    })
  }
}

const ensureBorrowerProfile = async (
  prisma: {
    borrower: {
      upsert(args: {
        where: { userId: string }
        create: { userId: string; borrowStatus: string; borrowerRating: number }
        update: Record<string, never>
      }): Promise<unknown>
    }
    $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>
  },
  userId: string,
) => {
  await prisma.borrower.upsert({
    where: { userId },
    create: { userId, borrowStatus: "ACTIVE", borrowerRating: 0 },
    update: {},
  })

  const rows = await prisma.$queryRaw<ProfileIdRow[]>(Prisma.sql`
    SELECT "id", "userId"
    FROM "Borrower"
    WHERE "userId" = ${userId}
    LIMIT 1
  `)

  const borrower = rows[0]
  if (!borrower) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Borrower profile could not be created for this account.",
    })
  }

  return borrower
}

const ensureLenderProfile = async (
  prisma: {
    lender: {
      upsert(args: {
        where: { userId: string }
        create: { userId: string; lenderRating: number }
        update: Record<string, never>
      }): Promise<unknown>
    }
    $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>
  },
  userId: string,
) => {
  await prisma.lender.upsert({
    where: { userId },
    create: { userId, lenderRating: 0 },
    update: {},
  })

  const rows = await prisma.$queryRaw<ProfileIdRow[]>(Prisma.sql`
    SELECT "id", "userId"
    FROM "Lender"
    WHERE "userId" = ${userId}
    LIMIT 1
  `)

  const lender = rows[0]
  if (!lender) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Lender profile could not be created for this account.",
    })
  }

  return lender
}

type EditableRequestRow = {
  id: number
  status: string
  borrowerID: number
  borrowerUserId: string
}

const getEditableRequest = async (
  prisma: {
    $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>
  },
  requestId: number,
) => {
  const rows = await prisma.$queryRaw<EditableRequestRow[]>(Prisma.sql`
    SELECT
      r."id",
      r."status"::text AS "status",
      r."borrowerID",
      b."userId" AS "borrowerUserId"
    FROM "ItemRequest" r
    INNER JOIN "Borrower" b ON b."id" = r."borrowerID"
    WHERE r."id" = ${requestId}
    LIMIT 1
  `)

  const request = rows[0]
  if (!request) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Item request not found." })
  }

  return request
}

type ItemOwnershipRow = {
  numericId: number
  lenderId: string
  condition: string
  status: string
}

const getOwnedItem = async (
  prisma: {
    $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>
  },
  itemID: number,
) => {
  const rows = await prisma.$queryRaw<ItemOwnershipRow[]>(Prisma.sql`
    SELECT
      "numericId" AS "numericId",
      "lenderId" AS "lenderId",
      "condition"::text AS "condition",
      "status"::text AS "status"
    FROM "Item"
    WHERE "numericId" = ${itemID}
    LIMIT 1
  `)

  return rows[0] ?? null
}

export const communityRouter = router({
  offerableItems: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.$queryRaw<OfferableItemRow[]>(Prisma.sql`
      SELECT
        i."id",
        i."numericId",
        i."name",
        ii."path" AS "thumbnailImage",
        i."condition"::text AS "condition",
        i."rentalFee",
        i."freeToBorrow",
        i."status"::text AS "status",
        i."rateOption"::text AS "rateOption",
        i."createdAt"
      FROM "Item" i
      LEFT JOIN LATERAL (
        SELECT "path"
        FROM "ItemImage"
        WHERE "itemId" = i."id"
        ORDER BY "isPrimary" DESC, "sortOrder" ASC, "createdAt" ASC
        LIMIT 1
      ) ii ON TRUE
      WHERE i."lenderId" = ${ctx.user.id}
        AND i."status" = 'AVAILABLE'::"ItemStatus"
      ORDER BY i."createdAt" DESC
    `)

    return rows.map((item) => ({
      id: item.id,
      numericId: toNumber(item.numericId),
      name: item.name,
      thumbnailImage: item.thumbnailImage,
      condition: item.condition,
      rentalFee: toNumber(item.rentalFee),
      freeToBorrow: item.freeToBorrow,
      status: item.status,
      rateOption: item.rateOption,
      createdAt: toDate(item.createdAt),
    }))
  }),

  listRequests: publicProcedure.input(listItemRequestsSchema).query(async ({ ctx, input }) => {
    return fetchMappedRequests(ctx.prisma, input, ctx.user?.id ?? null)
  }),

  requestById: publicProcedure.input(itemRequestIdSchema).query(async ({ ctx, input }) => {
    const requests = await fetchMappedRequests(
      ctx.prisma,
      {
        requestId: input.id,
        includeCancelledOffers: true,
      },
      ctx.user?.id ?? null,
    )

    const request = requests[0]
    if (!request) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item request not found." })
    }

    return request
  }),

  createRequest: protectedProcedure
    .input(createItemRequestSchema)
    .mutation(async ({ ctx, input }) => {
      await assertUserExists(ctx.prisma, ctx.user.id)
      const borrower = await ensureBorrowerProfile(ctx.prisma, ctx.user.id)

      const rows = await ctx.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        INSERT INTO "ItemRequest" (
          "borrowerID",
          "itemNeeded",
          "referenceImageUrl",
          "requestedDates",
          "priceRange",
          "description",
          "status",
          "updatedAt"
        )
        VALUES (
          ${borrower.id},
          ${input.itemNeeded},
          ${input.referenceImageUrl ?? null},
          ${sqlDateArray(input.requestedDates)},
          ${sqlIntArray(input.priceRange)},
          ${input.description},
          ${sqlItemRequestStatus(input.status)},
          NOW()
        )
        RETURNING "id"
      `)

      const requestId = rows[0]?.id
      if (!requestId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to create item request." })
      }

      const [request] = await fetchMappedRequests(
        ctx.prisma,
        { requestId, includeCancelledOffers: true },
        ctx.user.id,
      )

      return request
    }),

  updateRequest: protectedProcedure
    .input(updateItemRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await getEditableRequest(ctx.prisma, input.id)

      if (existing.borrowerUserId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to update this item request.",
        })
      }

      const clauses: Prisma.Sql[] = []
      if (input.itemNeeded !== undefined) {
        clauses.push(Prisma.sql`"itemNeeded" = ${input.itemNeeded}`)
      }
      if (input.requestedDates !== undefined) {
        clauses.push(Prisma.sql`"requestedDates" = ${sqlDateArray(input.requestedDates)}`)
      }
      if (input.priceRange !== undefined) {
        clauses.push(Prisma.sql`"priceRange" = ${sqlIntArray(input.priceRange)}`)
      }
      if (input.description !== undefined) {
        clauses.push(Prisma.sql`"description" = ${input.description}`)
      }
      if (input.referenceImageUrl !== undefined) {
        clauses.push(Prisma.sql`"referenceImageUrl" = ${input.referenceImageUrl}`)
      }
      if (input.status !== undefined) {
        clauses.push(Prisma.sql`"status" = ${sqlItemRequestStatus(input.status)}`)
      }
      clauses.push(Prisma.sql`"updatedAt" = NOW()`)

      await ctx.prisma.$executeRaw(Prisma.sql`
        UPDATE "ItemRequest"
        SET ${Prisma.join(clauses, ", ")}
        WHERE "id" = ${input.id}
      `)

      const [request] = await fetchMappedRequests(
        ctx.prisma,
        { requestId: input.id, includeCancelledOffers: true },
        ctx.user.id,
      )

      return request
    }),

  deleteRequest: protectedProcedure
    .input(deleteItemRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await getEditableRequest(ctx.prisma, input.id)

      if (existing.borrowerUserId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to delete this item request.",
        })
      }

      const rows = await ctx.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        DELETE FROM "ItemRequest"
        WHERE "id" = ${input.id}
        RETURNING "id"
      `)

      return rows[0] ?? { id: input.id }
    }),

  listOffers: protectedProcedure.input(listRequestOffersSchema).query(async ({ ctx, input }) => {
    const offers = await fetchOfferRows(ctx.prisma, {
      requestID: input.requestID,
      status: input.status,
      sentOnly: input.sentOnly,
      receivedOnly: input.receivedOnly,
      viewerUserId: ctx.user.id,
      includeCancelled: true,
    })

    return offers.map(mapOffer)
  }),

  offerById: protectedProcedure.input(requestOfferIdSchema).query(async ({ ctx, input }) => {
    const offers = await fetchOfferRows(ctx.prisma, {
      offerId: input.id,
      viewerUserId: ctx.user.id,
      includeCancelled: true,
    })

    const offer = offers[0]
    if (!offer) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Request offer not found." })
    }

    return mapOffer(offer)
  }),

  createOffer: protectedProcedure
    .input(createRequestOfferSchema)
    .mutation(async ({ ctx, input }) => {
      await assertUserExists(ctx.prisma, ctx.user.id)
      const lender = await ensureLenderProfile(ctx.prisma, ctx.user.id)
      const request = await getEditableRequest(ctx.prisma, input.requestID)

      if (request.borrowerUserId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot offer an item to your own request.",
        })
      }

      if (request.status !== itemRequestStatusSchema.enum.OPEN) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request is no longer accepting offers.",
        })
      }

      const item = await getOwnedItem(ctx.prisma, input.itemID)
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
      }

      if (item.lenderId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only offer items from your own listings.",
        })
      }

      if (item.status !== "AVAILABLE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only active available listings can be offered on requests.",
        })
      }

      const existingOffers = await ctx.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        SELECT "id"
        FROM "RequestOffer"
        WHERE "lenderID" = ${lender.id}
          AND "requestID" = ${input.requestID}
        LIMIT 1
      `)

      if (existingOffers[0]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You already have an offer for this request. Update the existing offer instead.",
        })
      }

      const rows = await ctx.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        INSERT INTO "RequestOffer" (
          "lenderID",
          "requestID",
          "itemID",
          "rentalFee",
          "availability",
          "condition",
          "rentalTerms",
          "status",
          "borrowerReadAt",
          "updatedAt"
        )
        VALUES (
          ${lender.id},
          ${input.requestID},
          ${input.itemID},
          ${input.rentalFee},
          ${input.availability},
          ${sqlItemCondition(input.condition)},
          ${input.rentalTerms},
          ${sqlRequestOfferStatus(input.status)},
          NULL,
          NOW()
        )
        RETURNING "id"
      `)

      const offerId = rows[0]?.id
      if (!offerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to create request offer." })
      }

      const createdOffers = await fetchOfferRows(ctx.prisma, {
        offerId,
        viewerUserId: ctx.user.id,
        includeCancelled: true,
      })

      const offer = createdOffers[0]
      if (!offer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request offer not found." })
      }

      return mapOffer(offer)
    }),

  updateOffer: protectedProcedure
    .input(updateRequestOfferSchema)
    .mutation(async ({ ctx, input }) => {
      const offers = await fetchOfferRows(ctx.prisma, {
        offerId: input.id,
        viewerUserId: ctx.user.id,
        includeCancelled: true,
      })

      const existing = offers[0]
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request offer not found." })
      }

      const isLender = existing.lenderUserId === ctx.user.id
      const isBorrower = existing.requestBorrowerUserId === ctx.user.id

      if (!isLender && !isBorrower) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to update this request offer.",
        })
      }

      if (isBorrower) {
        const hasNonStatusPatch =
          input.itemID !== undefined ||
          input.rentalFee !== undefined ||
          input.availability !== undefined ||
          input.condition !== undefined ||
          input.rentalTerms !== undefined

        if (hasNonStatusPatch) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Borrowers can only update the offer status.",
          })
        }
      }

      if (isLender && input.itemID !== undefined) {
        const replacementItem = await getOwnedItem(ctx.prisma, input.itemID)
        if (!replacementItem) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." })
        }

        if (replacementItem.lenderId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only switch the offer to one of your own items.",
          })
        }

        if (replacementItem.status !== "AVAILABLE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only active available listings can be offered on requests.",
          })
        }
      }

      const clauses: Prisma.Sql[] = []
      if (input.itemID !== undefined) {
        clauses.push(Prisma.sql`"itemID" = ${input.itemID}`)
      }
      if (input.rentalFee !== undefined) {
        clauses.push(Prisma.sql`"rentalFee" = ${input.rentalFee}`)
      }
      if (input.availability !== undefined) {
        clauses.push(Prisma.sql`"availability" = ${input.availability}`)
      }
      if (input.condition !== undefined) {
        clauses.push(Prisma.sql`"condition" = ${sqlItemCondition(input.condition)}`)
      }
      if (input.rentalTerms !== undefined) {
        clauses.push(Prisma.sql`"rentalTerms" = ${input.rentalTerms}`)
      }
      if (input.status !== undefined) {
        clauses.push(Prisma.sql`"status" = ${sqlRequestOfferStatus(input.status)}`)
      }
      if (isLender) {
        clauses.push(Prisma.sql`"borrowerReadAt" = NULL`)
      }
      clauses.push(Prisma.sql`"updatedAt" = NOW()`)

      await ctx.prisma.$executeRaw(Prisma.sql`
        UPDATE "RequestOffer"
        SET ${Prisma.join(clauses, ", ")}
        WHERE "id" = ${input.id}
      `)

      const updatedOffers = await fetchOfferRows(ctx.prisma, {
        offerId: input.id,
        viewerUserId: ctx.user.id,
        includeCancelled: true,
      })

      const offer = updatedOffers[0]
      if (!offer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request offer not found." })
      }

      return mapOffer(offer)
    }),

  deleteOffer: protectedProcedure
    .input(deleteRequestOfferSchema)
    .mutation(async ({ ctx, input }) => {
      const offers = await fetchOfferRows(ctx.prisma, {
        offerId: input.id,
        viewerUserId: ctx.user.id,
        includeCancelled: true,
      })

      const existing = offers[0]
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request offer not found." })
      }

      const isLender = existing.lenderUserId === ctx.user.id
      const isBorrower = existing.requestBorrowerUserId === ctx.user.id

      if (!isLender && !isBorrower) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to delete this request offer.",
        })
      }

      const rows = await ctx.prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
        DELETE FROM "RequestOffer"
        WHERE "id" = ${input.id}
        RETURNING "id"
      `)

      return rows[0] ?? { id: input.id }
    }),

  notifications: protectedProcedure.query(async ({ ctx }) => {
    const offers = await fetchOfferRows(ctx.prisma, {
      viewerUserId: ctx.user.id,
      receivedOnly: true,
      includeCancelled: false,
    })

    return offers.map((offer) => ({
      id: offer.id,
      requestId: offer.requestID,
      requestTitle: offer.requestItemNeeded,
      recipientId: offer.requestBorrowerID,
      actorName: formatUserName({
        username: offer.lenderUsername,
        firstName: offer.lenderFirstName,
        middleName: offer.lenderMiddleName,
        lastName: offer.lenderLastName,
        email: offer.lenderEmail,
      }),
      itemName: offer.itemName,
      fee: offer.rentalFee,
      createdAt: toDate(offer.createdAt),
      read: toDate(offer.borrowerReadAt) !== null,
    }))
  }),

  markNotificationRead: protectedProcedure
    .input(markRequestOfferNotificationReadSchema)
    .mutation(async ({ ctx, input }) => {
      const offers = await fetchOfferRows(ctx.prisma, {
        offerId: input.id,
        viewerUserId: ctx.user.id,
        receivedOnly: true,
        includeCancelled: true,
      })

      const offer = offers[0]
      if (!offer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request offer not found." })
      }

      await ctx.prisma.$executeRaw(Prisma.sql`
        UPDATE "RequestOffer"
        SET
          "borrowerReadAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = ${input.id}
      `)

      return { id: input.id, borrowerReadAt: new Date() }
    }),

  markAllNotificationsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.$executeRaw(Prisma.sql`
      UPDATE "RequestOffer" o
      SET
        "borrowerReadAt" = NOW(),
        "updatedAt" = NOW()
      FROM "ItemRequest" r
      INNER JOIN "Borrower" b ON b."id" = r."borrowerID"
      WHERE o."requestID" = r."id"
        AND b."userId" = ${ctx.user.id}
        AND o."borrowerReadAt" IS NULL
    `)

    return { count: toNumber(result) }
  }),
})
