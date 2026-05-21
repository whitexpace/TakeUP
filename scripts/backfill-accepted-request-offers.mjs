import { Prisma, PrismaClient } from "@prisma/client"
import { randomUUID } from "node:crypto"

const prisma = new PrismaClient()

const BOOKING_ENTITY_TYPE = "BOOKING"
const DEFAULT_PLATFORM_COMMISSION_RATE_PERCENT = 5

const args = new Set(process.argv.slice(2))
const dryRun = args.has("--dry-run")

const getPlatformCommissionRatePercent = () => {
  const rawRate =
    process.env.PLATFORM_COMMISSION_RATE_PERCENT ?? DEFAULT_PLATFORM_COMMISSION_RATE_PERCENT
  const parsedRate = Number(rawRate)

  if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100) {
    throw new Error(
      `Invalid PLATFORM_COMMISSION_RATE_PERCENT value "${rawRate}". Expected a number between 0 and 100.`,
    )
  }

  return parsedRate
}

const calculatePlatformCommissionAmount = (grossAmount) => {
  if (grossAmount <= 0) return 0
  return Math.round((grossAmount * getPlatformCommissionRatePercent()) / 100)
}

const normalizeRequestedDateWindow = (requestedDates) => {
  const dates = requestedDates
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())

  const startDate = dates[0]
  const endDate = dates[dates.length - 1]

  if (!startDate || !endDate) {
    return null
  }

  return { startDate, endDate }
}

const findAcceptedOffersMissingBookings = async () =>
  await prisma.$queryRaw`
    SELECT
      o."id",
      o."requestID",
      o."rentalFee",
      o."availability",
      r."status"::text AS "requestStatus",
      r."requestedDates",
      rb."userId" AS "borrowerUserId",
      l."userId" AS "lenderUserId",
      i."id" AS "itemId",
      i."status"::text AS "itemStatus"
    FROM "RequestOffer" o
    INNER JOIN "ItemRequest" r ON r."id" = o."requestID"
    INNER JOIN "Borrower" rb ON rb."id" = r."borrowerID"
    INNER JOIN "Lender" l ON l."id" = o."lenderID"
    INNER JOIN "Item" i ON i."numericId" = o."itemID"
    LEFT JOIN "Booking" b ON b."requestOfferId" = o."id"
    WHERE o."status" = 'ACCEPTED'::"RequestOfferStatus"
      AND b."id" IS NULL
    ORDER BY o."updatedAt" ASC, o."id" ASC
  `

const lockOfferForBackfill = async (tx, offerId) => {
  const rows = await tx.$queryRaw`
    SELECT
      o."id",
      o."requestID",
      o."rentalFee",
      o."availability",
      o."status"::text AS "offerStatus",
      r."status"::text AS "requestStatus",
      r."requestedDates",
      rb."userId" AS "borrowerUserId",
      l."userId" AS "lenderUserId",
      i."id" AS "itemId",
      i."status"::text AS "itemStatus"
    FROM "RequestOffer" o
    INNER JOIN "ItemRequest" r ON r."id" = o."requestID"
    INNER JOIN "Borrower" rb ON rb."id" = r."borrowerID"
    INNER JOIN "Lender" l ON l."id" = o."lenderID"
    INNER JOIN "Item" i ON i."numericId" = o."itemID"
    WHERE o."id" = ${offerId}
    FOR UPDATE OF o, r, i
  `

  return rows[0] ?? null
}

const lockUserWallet = async (tx, userId) => {
  await tx.wallet.upsert({
    where: { userId },
    create: {
      scope: "USER",
      userId,
      currency: "PHP",
      balance: new Prisma.Decimal(0),
      status: "ACTIVE",
    },
    update: {},
  })

  const rows = await tx.$queryRaw`
    SELECT id, balance, status
    FROM wallets
    WHERE user_id = ${userId}
    FOR UPDATE
  `

  const wallet = rows[0]
  if (!wallet) {
    throw new Error(`Wallet lock failed for user ${userId}.`)
  }

  return {
    id: wallet.id,
    status: wallet.status,
    balance: new Prisma.Decimal(wallet.balance.toString()),
  }
}

const createWalletPayment = async (tx, offer, bookingId, totalFee) => {
  if (totalFee <= 0) return { debited: false }

  const wallet = await lockUserWallet(tx, offer.borrowerUserId)
  if (wallet.status !== "ACTIVE") {
    return { skipped: true, reason: "borrower wallet is not active" }
  }

  const amount = new Prisma.Decimal(totalFee)
  if (wallet.balance.lessThan(amount)) {
    return { skipped: true, reason: "insufficient borrower wallet balance" }
  }

  const newBalance = wallet.balance.minus(amount)
  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId: offer.borrowerUserId,
      type: "PAYMENT",
      method: "SYSTEM",
      direction: "DEBIT",
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      referenceCode: `PAYMENT_BACKFILL_${offer.id}_${randomUUID()}`,
      relatedEntityType: BOOKING_ENTITY_TYPE,
      relatedEntityId: bookingId,
      status: "SUCCESS",
      metadata: {
        bookingId,
        requestOfferId: offer.id,
        backfilled: true,
      },
    },
  })

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance },
  })

  return { debited: true }
}

const backfillOffer = async (offerId) =>
  await prisma.$transaction(async (tx) => {
    const offer = await lockOfferForBackfill(tx, offerId)
    if (!offer) return { status: "skipped", reason: "offer no longer exists" }

    const existingBooking = await tx.booking.findUnique({
      where: { requestOfferId: offer.id },
      select: { id: true },
    })
    if (existingBooking) {
      return { status: "skipped", reason: "booking already exists", bookingId: existingBooking.id }
    }

    if (offer.offerStatus !== "ACCEPTED") {
      return { status: "skipped", reason: `offer is ${offer.offerStatus}` }
    }

    if (!["OPEN", "FULFILLED"].includes(offer.requestStatus)) {
      return { status: "skipped", reason: `request is ${offer.requestStatus}` }
    }

    if (!offer.availability || offer.itemStatus !== "AVAILABLE") {
      return { status: "skipped", reason: "offered item is not available" }
    }

    const dateWindow = normalizeRequestedDateWindow(offer.requestedDates)
    if (!dateWindow) {
      return { status: "skipped", reason: "request has invalid requested dates" }
    }

    const totalFee = Number(offer.rentalFee)
    const platformCommission = calculatePlatformCommissionAmount(totalFee)
    const now = new Date()
    const booking = await tx.booking.create({
      data: {
        borrowerId: offer.borrowerUserId,
        lenderId: offer.lenderUserId,
        itemId: offer.itemId,
        requestOfferId: offer.id,
        startDate: dateWindow.startDate,
        endDate: dateWindow.endDate,
        status: "PENDING",
        paymentStatus: "PAID",
        paymentMethod: "WALLET",
        paymentProcessedAt: now,
        totalFee,
        platformCommission,
        updatedAt: now,
      },
      select: {
        id: true,
        borrowerId: true,
        lenderId: true,
        itemId: true,
        startDate: true,
        endDate: true,
        totalFee: true,
        platformCommission: true,
      },
    })

    const payment = await createWalletPayment(tx, offer, booking.id, totalFee)
    if (payment.skipped) {
      throw new Error(payment.reason)
    }

    await tx.rentalTransaction.create({
      data: {
        bookingId: booking.id,
        borrowerId: booking.borrowerId,
        lenderId: booking.lenderId,
        itemId: booking.itemId,
        startDate: booking.startDate,
        endDate: booking.endDate,
        rentalFee: Math.max(0, booking.totalFee - booking.platformCommission),
        platformFee: booking.platformCommission,
        status: "PENDING",
      },
    })

    await tx.requestOffer.updateMany({
      where: {
        requestID: offer.requestID,
        id: { not: offer.id },
        status: "PENDING",
      },
      data: { status: "DECLINED" },
    })

    await tx.itemRequest.update({
      where: { id: offer.requestID },
      data: { status: "FULFILLED" },
    })

    return { status: "backfilled", bookingId: booking.id }
  })

const main = async () => {
  const candidates = await findAcceptedOffersMissingBookings()

  console.log(
    `[accepted-offer-backfill] Found ${candidates.length} accepted offer(s) without linked bookings.`,
  )

  let backfilled = 0
  let skipped = 0

  for (const candidate of candidates) {
    if (dryRun) {
      const dateWindow = normalizeRequestedDateWindow(candidate.requestedDates)
      const reason = !["OPEN", "FULFILLED"].includes(candidate.requestStatus)
        ? `request is ${candidate.requestStatus}`
        : !candidate.availability || candidate.itemStatus !== "AVAILABLE"
          ? "offered item is not available"
          : !dateWindow
            ? "request has invalid requested dates"
            : null

      if (reason) {
        skipped += 1
        console.log(`[accepted-offer-backfill] SKIP offer ${candidate.id}: ${reason}`)
      } else {
        console.log(`[accepted-offer-backfill] WOULD backfill offer ${candidate.id}`)
      }
      continue
    }

    try {
      const result = await backfillOffer(candidate.id)
      if (result.status === "backfilled") {
        backfilled += 1
        console.log(
          `[accepted-offer-backfill] Backfilled offer ${candidate.id} with booking ${result.bookingId}.`,
        )
      } else {
        skipped += 1
        console.log(`[accepted-offer-backfill] SKIP offer ${candidate.id}: ${result.reason}`)
      }
    } catch (error) {
      skipped += 1
      console.log(`[accepted-offer-backfill] SKIP offer ${candidate.id}: ${error.message}`)
    }
  }

  console.log(
    `[accepted-offer-backfill] Done. Backfilled ${backfilled}; skipped ${skipped}; dryRun=${dryRun}.`,
  )
}

main()
  .catch((error) => {
    console.error("[accepted-offer-backfill] Failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
