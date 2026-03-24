import { Prisma, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const addDays = (date, days) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + days)
  return next
}

const enumerateDates = (start, end) => {
  const dates = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)

  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

const sqlDateArray = (values) =>
  Prisma.sql`ARRAY[${Prisma.join(values.map((value) => Prisma.sql`${value}`))}]::timestamp[]`

const sqlIntArray = (values) =>
  Prisma.sql`ARRAY[${Prisma.join(values.map((value) => Prisma.sql`${value}`))}]::integer[]`

const countRows = async (tableName) => {
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${tableName}"`)
  return Number(rows[0]?.count ?? 0)
}

const seed = async () => {
  const [existingRequests, existingOffers] = await Promise.all([
    countRows("ItemRequest"),
    countRows("RequestOffer"),
  ])

  const borrowers = await prisma.$queryRaw`
    SELECT
      b."id",
      b."userId",
      u."firstName",
      u."lastName",
      u."email"
    FROM "Borrower" b
    INNER JOIN "User" u ON u."id" = b."userId"
    ORDER BY b."userId" ASC
  `

  const items = await prisma.$queryRaw`
    SELECT
      i."numericId",
      i."name",
      i."condition"::text AS "condition",
      l."id" AS "lenderID",
      l."userId" AS "lenderUserId"
    FROM "Item" i
    INNER JOIN "Lender" l ON l."userId" = i."lenderId"
    WHERE i."status" <> 'DELETED'::"ItemStatus"
    ORDER BY i."createdAt" ASC
  `

  if (borrowers.length === 0) {
    console.warn("[seed] Skipping item request seed: no borrower profiles found.")
    return
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let createdRequests = []

  if (existingRequests === 0) {
    const requestSeeds = [
      {
        itemNeeded: "Need a projector setup for our thesis defense this Friday",
        requestedDates: enumerateDates(addDays(today, 4), addDays(today, 4)),
        priceRange: [300, 700],
        description:
          "Looking for a projector with HDMI and enough brightness for a classroom presentation. We only need it for one afternoon and can meet on campus for pickup.",
        status: "OPEN",
      },
      {
        itemNeeded: "Looking for a professional drone for a wedding shoot",
        requestedDates: enumerateDates(addDays(today, 5), addDays(today, 6)),
        priceRange: [3000, 6000],
        description:
          "My drone crashed during practice and I have a wedding to shoot this weekend in Tagaytay. If anyone has a DJI Mavic 3 or similar that I can rent, please let me know!",
        status: "OPEN",
      },
      {
        itemNeeded: "Need a concrete drill for some DIY home repairs",
        requestedDates: enumerateDates(addDays(today, 1), addDays(today, 1)),
        priceRange: [0, 500],
        description:
          "Just moved into a new place and need to mount some heavy shelves on a concrete wall. Does anyone have a hammer drill I could borrow for a few hours?",
        status: "OPEN",
      },
    ]

    createdRequests = await Promise.all(
      requestSeeds.map(async (request, index) => {
        const borrower = borrowers[index % borrowers.length]
        const rows = await prisma.$queryRaw(Prisma.sql`
          INSERT INTO "ItemRequest" (
            "borrowerID",
            "itemNeeded",
            "requestedDates",
            "priceRange",
            "description",
            "status",
            "updatedAt"
          )
          VALUES (
            ${borrower.id},
            ${request.itemNeeded},
            ${sqlDateArray(request.requestedDates)},
            ${sqlIntArray(request.priceRange)},
            ${request.description},
            ${Prisma.raw(`'${request.status}'::"ItemRequestStatus"`)},
            NOW()
          )
          RETURNING "id", "borrowerID"
        `)

        return rows[0]
      }),
    )

    process.stdout.write(`[seed] Inserted ${createdRequests.length} item requests.\n`)
  } else {
    createdRequests = await prisma.$queryRaw`
      SELECT "id", "borrowerID"
      FROM "ItemRequest"
      ORDER BY "createdAt" ASC
      LIMIT 3
    `
  }

  if (existingOffers === 0) {
    const requestForOffer = createdRequests[0]

    if (!requestForOffer) {
      console.warn("[seed] Skipping request offer seed: no item requests available.")
      return
    }

    const requestBorrower = await prisma.$queryRaw(Prisma.sql`
      SELECT b."userId"
      FROM "ItemRequest" r
      INNER JOIN "Borrower" b ON b."id" = r."borrowerID"
      WHERE r."id" = ${requestForOffer.id}
      LIMIT 1
    `)

    const borrowerUserId = requestBorrower[0]?.userId
    const matchingItem = items.find((item) => item.lenderUserId !== borrowerUserId)

    if (!matchingItem) {
      console.warn(
        "[seed] Skipping request offer seed: no lender item available for a different borrower.",
      )
      return
    }

    await prisma.$executeRaw(Prisma.sql`
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
        ${matchingItem.lenderID},
        ${requestForOffer.id},
        ${matchingItem.numericId},
        ${500},
        ${true},
        ${Prisma.raw(`'${matchingItem.condition}'::"ItemCondition"`)},
        ${"Available for the requested date window. Includes the main unit and standard accessories. Return in the same condition after use."},
        ${Prisma.raw(`'PENDING'::"RequestOfferStatus"`)},
        NULL,
        NOW()
      )
    `)

    process.stdout.write("[seed] Inserted 1 request offer.\n")
  }
}

seed()
  .catch((error) => {
    console.error("[seed] Failed to seed item requests and request offers.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
