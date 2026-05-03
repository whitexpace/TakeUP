import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import {
  asWalletPrisma,
  prisma as globalPrisma,
  type WalletPrismaAdapter,
  type WalletRecord,
  type WalletTransactionRecord,
} from "./prisma"

export const SYSTEM_WALLET_KEY = "PLATFORM_REVENUE"
export const SYSTEM_WALLET_ENTITY_TYPE = "SYSTEM_WALLET"
export const BOOKING_ENTITY_TYPE = "BOOKING"

export const WalletStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CLOSED: "CLOSED",
} as const

export const WalletScope = {
  USER: "USER",
  SYSTEM: "SYSTEM",
} as const

export const WalletTransactionType = {
  TOP_UP: "TOP_UP",
  PAYMENT: "PAYMENT",
  REFUND: "REFUND",
  ADJUSTMENT: "ADJUSTMENT",
  EARNING: "EARNING",
  COMMISSION: "COMMISSION",
} as const

export const WalletTransactionMethod = {
  PSEUDO: "PSEUDO",
  GCASH: "GCASH",
  BANK: "BANK",
  MAYA: "MAYA",
  SYSTEM: "SYSTEM",
} as const

export const WalletTransactionDirection = {
  CREDIT: "CREDIT",
  DEBIT: "DEBIT",
} as const

export const WalletTransactionStatus = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  REVERSED: "REVERSED",
  PENDING: "PENDING",
} as const

type PrismaWalletTransactionType =
  (typeof WalletTransactionType)[keyof typeof WalletTransactionType]

type WalletOwner =
  | {
      scope: "USER"
      userId: string
    }
  | {
      scope: "SYSTEM"
      systemKey: string
    }

interface WalletLockResult {
  id: string
  balance: string | number | Prisma.Decimal
  status: string
}

interface WalletTransactionContext {
  type: PrismaWalletTransactionType
  relatedEntityType: string
  relatedEntityId: string
  method?: (typeof WalletTransactionMethod)[keyof typeof WalletTransactionMethod]
  metadata?: Prisma.InputJsonValue
}

type UserWalletCreditType = "EARNING" | "REFUND"

/**
 * Generate a unique reference code.
 */
function generateReferenceCode(type: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0")

  let prefix = "WTX"
  if (type === "TOP_UP") prefix = "WTX-TU"
  else if (type === "PAYMENT") prefix = "WTX-PY"
  else if (type === "EARNING") prefix = "WTX-ER"
  else if (type === "REFUND") prefix = "WTX-RF"
  else if (type === "COMMISSION") prefix = "WTX-CM"

  return `${prefix}-${date}-${random}`
}

const walletRecordSelect = Prisma.sql`
  SELECT
    id,
    scope::text AS "scope",
    user_id AS "userId",
    system_key AS "systemKey",
    currency,
    balance,
    status::text AS "status",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM wallets
`

const walletTransactionSelect = Prisma.sql`
  SELECT
    wallet_transactions.id,
    wallet_transactions.wallet_id AS "walletId",
    wallet_transactions.user_id AS "userId",
    wallet_transactions.type::text AS "type",
    wallet_transactions.method::text AS "method",
    wallet_transactions.direction::text AS "direction",
    wallet_transactions.amount,
    wallet_transactions.balance_before AS "balanceBefore",
    wallet_transactions.balance_after AS "balanceAfter",
    wallet_transactions.reference_code AS "referenceCode",
    wallet_transactions.related_entity_type AS "relatedEntityType",
    wallet_transactions.related_entity_id AS "relatedEntityId",
    wallet_transactions.status::text AS "status",
    wallet_transactions.metadata,
    wallet_transactions.created_at AS "createdAt",
    wallet_transactions.updated_at AS "updatedAt"
  FROM wallet_transactions
`

async function fetchWalletRecord(
  owner: WalletOwner,
  tx?: Prisma.TransactionClient | (Prisma.TransactionClient & WalletPrismaAdapter),
) {
  const prisma = asWalletPrisma(tx || globalPrisma)
  const rows =
    owner.scope === WalletScope.USER
      ? await prisma.$queryRaw<WalletRecord[]>(Prisma.sql`
          ${walletRecordSelect}
          WHERE user_id = ${owner.userId}
          LIMIT 1
        `)
      : await prisma.$queryRaw<WalletRecord[]>(Prisma.sql`
          ${walletRecordSelect}
          WHERE system_key = ${owner.systemKey}
          LIMIT 1
        `)

  const wallet = rows[0]
  if (!wallet) {
    throw new Error("Wallet record was not found after creation.")
  }

  return wallet
}

async function ensureWalletRecord(
  owner: WalletOwner,
  tx?: Prisma.TransactionClient | (Prisma.TransactionClient & WalletPrismaAdapter),
) {
  const prisma = asWalletPrisma(tx || globalPrisma)

  console.warn("[wallet:ensureWalletRecord] called with owner:", owner)

  try {
    if (owner.scope === WalletScope.USER) {
      console.warn(
        "[wallet:ensureWalletRecord] attempting INSERT for USER scope, userId=",
        owner.userId,
      )
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO wallets (id, scope, user_id, currency, balance, status, updated_at)
        VALUES (
          gen_random_uuid(),
          CAST(${WalletScope.USER} AS "WalletScope"),
          ${owner.userId},
          'PHP',
          0,
          CAST(${WalletStatus.ACTIVE} AS "WalletStatus"),
          NOW()
        )
        ON CONFLICT ("user_id") DO NOTHING
      `)
      console.warn(
        "[wallet:ensureWalletRecord] INSERT succeeded (or conflict — already existed) for userId=",
        owner.userId,
      )
    } else {
      console.warn(
        "[wallet:ensureWalletRecord] attempting INSERT for SYSTEM scope, systemKey=",
        owner.systemKey,
      )
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO wallets (id, scope, system_key, currency, balance, status, updated_at)
        VALUES (
          gen_random_uuid(),
          CAST(${WalletScope.SYSTEM} AS "WalletScope"),
          ${owner.systemKey},
          'PHP',
          0,
          CAST(${WalletStatus.ACTIVE} AS "WalletStatus"),
          NOW()
        )
        ON CONFLICT ("system_key") DO NOTHING
      `)
      console.warn(
        "[wallet:ensureWalletRecord] INSERT succeeded (or conflict — already existed) for systemKey=",
        owner.systemKey,
      )
    }
  } catch (err: unknown) {
    const error = err as { code?: string; name?: string; meta?: { code?: string } }
    console.error("[wallet:ensureWalletRecord] INSERT FAILED for owner:", owner)
    console.error(
      "[wallet:ensureWalletRecord] prisma error code:",
      error?.code,
      "name:",
      error?.name,
    )
    console.error("[wallet:ensureWalletRecord] prisma meta:", error?.meta)
    if (error?.meta?.code === "23502") {
      console.error(
        "[wallet:ensureWalletRecord] >>> NOT NULL violation. The INSERT only supplies (scope, user_id|system_key, currency, balance, status).",
      )
      console.error(
        "[wallet:ensureWalletRecord] >>> Likely culprit: the `id` column lacks a DB-level default (e.g. gen_random_uuid()) and/or `updated_at` is NOT NULL without a default. Prisma's @default(uuid()) and @updatedAt are CLIENT-SIDE — raw SQL bypasses them.",
      )
    }
    throw err
  }

  console.warn(
    "[wallet:ensureWalletRecord] now fetching wallet record back from DB for owner:",
    owner,
  )
  const wallet = await fetchWalletRecord(owner, prisma)
  console.warn(
    "[wallet:ensureWalletRecord] fetched wallet id=",
    wallet.id,
    "balance=",
    wallet.balance?.toString?.() ?? wallet.balance,
  )
  return wallet
}

async function lockWallet(
  owner: WalletOwner,
  client: Prisma.TransactionClient & WalletPrismaAdapter,
) {
  await ensureWalletRecord(owner, client)

  const lockedWallets =
    owner.scope === WalletScope.USER
      ? await client.$queryRaw<WalletLockResult[]>`
          SELECT id, balance, status FROM wallets WHERE user_id = ${owner.userId} FOR UPDATE
        `
      : await client.$queryRaw<WalletLockResult[]>`
          SELECT id, balance, status FROM wallets WHERE system_key = ${owner.systemKey} FOR UPDATE
        `

  const lockedWallet = lockedWallets[0]

  if (!lockedWallet) {
    throw new Error("Wallet lock result is empty")
  }

  return {
    id: lockedWallet.id,
    status: lockedWallet.status,
    balance: new Prisma.Decimal(lockedWallet.balance.toString()),
  }
}

async function updateWalletBalance(
  walletId: string,
  newBalance: Prisma.Decimal,
  client: Prisma.TransactionClient & WalletPrismaAdapter,
) {
  const rows = await client.$queryRaw<WalletRecord[]>(Prisma.sql`
    UPDATE wallets
    SET balance = ${newBalance}, updated_at = NOW()
    WHERE id = ${walletId}
    RETURNING
      id,
      scope::text AS "scope",
      user_id AS "userId",
      system_key AS "systemKey",
      currency,
      balance,
      status::text AS "status",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `)

  const wallet = rows[0]
  if (!wallet) {
    throw new Error("Wallet could not be updated.")
  }

  return wallet
}

async function insertWalletTransaction(
  client: Prisma.TransactionClient & WalletPrismaAdapter,
  params: {
    walletId: string
    userId: string | null
    type: PrismaWalletTransactionType
    method: (typeof WalletTransactionMethod)[keyof typeof WalletTransactionMethod]
    direction: (typeof WalletTransactionDirection)[keyof typeof WalletTransactionDirection]
    amount: Prisma.Decimal
    balanceBefore: Prisma.Decimal
    balanceAfter: Prisma.Decimal
    referenceCode: string
    relatedEntityType: string | null
    relatedEntityId: string | null
    status: (typeof WalletTransactionStatus)[keyof typeof WalletTransactionStatus]
    metadata: Prisma.InputJsonValue
  },
) {
  const metadataJson = JSON.stringify(params.metadata ?? {})
  const rows = await client.$queryRaw<WalletTransactionRecord[]>(Prisma.sql`
    INSERT INTO wallet_transactions (
      id,
      wallet_id,
      user_id,
      type,
      method,
      direction,
      amount,
      balance_before,
      balance_after,
      reference_code,
      related_entity_type,
      related_entity_id,
      status,
      metadata,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${params.walletId},
      ${params.userId},
      CAST(${params.type} AS "WalletTransactionType"),
      CAST(${params.method} AS "WalletTransactionMethod"),
      CAST(${params.direction} AS "WalletTransactionDirection"),
      ${params.amount},
      ${params.balanceBefore},
      ${params.balanceAfter},
      ${params.referenceCode},
      ${params.relatedEntityType},
      ${params.relatedEntityId},
      CAST(${params.status} AS "WalletTransactionStatus"),
      CAST(${metadataJson} AS jsonb),
      NOW()
    )
    RETURNING
      id,
      wallet_id AS "walletId",
      user_id AS "userId",
      type::text AS "type",
      method::text AS "method",
      direction::text AS "direction",
      amount,
      balance_before AS "balanceBefore",
      balance_after AS "balanceAfter",
      reference_code AS "referenceCode",
      related_entity_type AS "relatedEntityType",
      related_entity_id AS "relatedEntityId",
      status::text AS "status",
      metadata,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `)

  const transaction = rows[0]
  if (!transaction) {
    throw new Error("Wallet transaction could not be created.")
  }

  return transaction
}

async function creditWallet(
  owner: WalletOwner,
  amount: number,
  context: WalletTransactionContext,
  tx?: Prisma.TransactionClient,
) {
  if (amount <= 0) return null

  const execute = async (client: Prisma.TransactionClient & WalletPrismaAdapter) => {
    const walletClient = asWalletPrisma(client)
    const wallet = await lockWallet(owner, walletClient)
    const decimalAmount = new Prisma.Decimal(amount)
    const newBalance = wallet.balance.plus(decimalAmount)
    const referenceCode = generateReferenceCode(context.type)

    const transaction = await insertWalletTransaction(walletClient, {
      walletId: wallet.id,
      userId: owner.scope === WalletScope.USER ? owner.userId : null,
      type: context.type,
      method: context.method ?? WalletTransactionMethod.SYSTEM,
      direction: WalletTransactionDirection.CREDIT,
      amount: decimalAmount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      referenceCode,
      relatedEntityType: context.relatedEntityType,
      relatedEntityId: context.relatedEntityId,
      status: WalletTransactionStatus.SUCCESS,
      metadata: context.metadata ?? {},
    })
    const updatedWallet = await updateWalletBalance(wallet.id, newBalance, walletClient)

    return { wallet: updatedWallet, transaction }
  }

  if (tx) {
    return await execute(asWalletPrisma(tx))
  }

  return await globalPrisma.$transaction(async (newTx) => await execute(asWalletPrisma(newTx)))
}

/**
 * Get or create a wallet for a user.
 */
export async function getOrCreateWallet(userId: string, tx?: Prisma.TransactionClient) {
  return await ensureWalletRecord(
    {
      scope: WalletScope.USER,
      userId,
    },
    tx,
  )
}

export async function getOrCreateSystemWallet(
  systemKey = SYSTEM_WALLET_KEY,
  tx?: Prisma.TransactionClient,
) {
  return await ensureWalletRecord(
    {
      scope: WalletScope.SYSTEM,
      systemKey,
    },
    tx,
  )
}

/**
 * Top up the wallet using the pseudo flow.
 */
export async function topUpPseudo(userId: string, amount: number) {
  if (amount <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Top-up amount must be greater than zero.",
    })
  }

  return await globalPrisma.$transaction(async (tx) => {
    const walletTx = asWalletPrisma(tx)
    const wallet = await lockWallet({ scope: WalletScope.USER, userId }, walletTx)

    const decimalAmount = new Prisma.Decimal(amount)
    const newBalance = wallet.balance.plus(decimalAmount)
    const referenceCode = generateReferenceCode("TOP_UP")

    const transaction = await insertWalletTransaction(walletTx, {
      walletId: wallet.id,
      userId,
      type: WalletTransactionType.TOP_UP,
      method: WalletTransactionMethod.PSEUDO,
      direction: WalletTransactionDirection.CREDIT,
      amount: decimalAmount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      referenceCode,
      relatedEntityType: null,
      relatedEntityId: null,
      status: WalletTransactionStatus.SUCCESS,
      metadata: {},
    })
    const updatedWallet = await updateWalletBalance(wallet.id, newBalance, walletTx)

    return { wallet: updatedWallet, transaction }
  })
}

/**
 * Pay using wallet funds.
 */
export async function payWithWallet(
  userId: string,
  amount: number,
  context: { relatedEntityType: string; relatedEntityId: string },
) {
  if (amount <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Payment amount must be positive.",
    })
  }

  return await globalPrisma.$transaction(async (tx) => {
    const walletTx = asWalletPrisma(tx)
    const wallet = await lockWallet({ scope: WalletScope.USER, userId }, walletTx)
    if (wallet.status !== "ACTIVE")
      throw new TRPCError({ code: "FORBIDDEN", message: "Wallet is not active." })

    const decimalAmount = new Prisma.Decimal(amount)

    if (wallet.balance.lessThan(decimalAmount)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient wallet balance." })
    }

    const newBalance = wallet.balance.minus(decimalAmount)
    const referenceCode = generateReferenceCode("PAYMENT")

    const transaction = await insertWalletTransaction(walletTx, {
      walletId: wallet.id,
      userId,
      type: WalletTransactionType.PAYMENT,
      method: WalletTransactionMethod.SYSTEM,
      direction: WalletTransactionDirection.DEBIT,
      amount: decimalAmount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      referenceCode,
      relatedEntityType: context.relatedEntityType,
      relatedEntityId: context.relatedEntityId,
      status: WalletTransactionStatus.SUCCESS,
      metadata: {},
    })
    const updatedWallet = await updateWalletBalance(wallet.id, newBalance, walletTx)

    return { wallet: updatedWallet, transaction }
  })
}

/**
 * Credit earnings or refunds to a wallet.
 */
export async function creditToWallet(
  userId: string,
  amount: number,
  context: {
    type: UserWalletCreditType
    relatedEntityType: string
    relatedEntityId: string
    metadata?: Prisma.InputJsonValue
  },
  tx?: Prisma.TransactionClient,
) {
  return await creditWallet(
    { scope: WalletScope.USER, userId },
    amount,
    {
      type: context.type,
      relatedEntityType: context.relatedEntityType,
      relatedEntityId: context.relatedEntityId,
      metadata: context.metadata,
    },
    tx,
  )
}

export async function creditCommissionToSystemWallet(
  amount: number,
  context: {
    relatedEntityType: string
    relatedEntityId: string
    metadata?: Prisma.InputJsonValue
  },
  tx?: Prisma.TransactionClient,
) {
  return await creditWallet(
    {
      scope: WalletScope.SYSTEM,
      systemKey: SYSTEM_WALLET_KEY,
    },
    amount,
    {
      type: WalletTransactionType.COMMISSION,
      relatedEntityType: context.relatedEntityType,
      relatedEntityId: context.relatedEntityId,
      metadata: context.metadata,
    },
    tx,
  )
}

/**
 * Get wallet transactions for a user.
 */
export async function getWalletTransactions(
  userId: string,
  options: { skip?: number; take?: number } = {},
) {
  const skip = options.skip ?? 0
  const take = options.take ?? 20

  return await asWalletPrisma(globalPrisma).$queryRaw<WalletTransactionRecord[]>(Prisma.sql`
    ${walletTransactionSelect}
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    OFFSET ${skip}
    LIMIT ${take}
  `)
}

export async function getSystemWalletTransactions(
  systemKey = SYSTEM_WALLET_KEY,
  options: { skip?: number; take?: number } = {},
) {
  const skip = options.skip ?? 0
  const take = options.take ?? 20

  return await asWalletPrisma(globalPrisma).$queryRaw<WalletTransactionRecord[]>(Prisma.sql`
    ${walletTransactionSelect}
    INNER JOIN wallets ON wallets.id = wallet_transactions.wallet_id
    WHERE wallet_transactions.type = CAST(${WalletTransactionType.COMMISSION} AS "WalletTransactionType")
      AND wallets.system_key = ${systemKey}
    ORDER BY wallet_transactions.created_at DESC
    OFFSET ${skip}
    LIMIT ${take}
  `)
}

export async function findSystemCommissionTransaction(
  relatedEntityId: string,
  systemKey = SYSTEM_WALLET_KEY,
  tx?: Prisma.TransactionClient,
) {
  const prisma = asWalletPrisma(tx || globalPrisma)
  const rows = await prisma.$queryRaw<WalletTransactionRecord[]>(Prisma.sql`
    ${walletTransactionSelect}
    INNER JOIN wallets ON wallets.id = wallet_transactions.wallet_id
    WHERE wallet_transactions.type = CAST(${WalletTransactionType.COMMISSION} AS "WalletTransactionType")
      AND wallet_transactions.related_entity_type = ${BOOKING_ENTITY_TYPE}
      AND wallet_transactions.related_entity_id = ${relatedEntityId}
      AND wallets.system_key = ${systemKey}
    LIMIT 1
  `)

  return rows[0] ?? null
}

export async function runWalletSelfHealing(userId: string) {
  const relevantBookings = await globalPrisma.booking.findMany({
    where: {
      OR: [{ borrowerId: userId }, { lenderId: userId }],
      status: "COMPLETED",
      paymentMethod: "WALLET",
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  })

  if (relevantBookings.length === 0) return

  for (const booking of relevantBookings) {
    if (booking.borrowerId === userId && booking.refundAmount > 0) {
      const hasRefund = await globalPrisma.walletTransaction.findFirst({
        where: { userId, relatedEntityId: booking.id, type: "REFUND" },
      })

      if (!hasRefund) {
        await creditToWallet(userId, booking.refundAmount, {
          type: "REFUND",
          relatedEntityType: BOOKING_ENTITY_TYPE,
          relatedEntityId: booking.id,
        })
      }
    }

    if (booking.lenderId === userId) {
      const hasEarning = await globalPrisma.walletTransaction.findFirst({
        where: { userId, relatedEntityId: booking.id, type: "EARNING" },
      })

      if (!hasEarning) {
        const netEarnings =
          booking.totalFee - booking.platformCommission - (booking.refundAmount || 0)
        if (netEarnings > 0) {
          await creditToWallet(userId, netEarnings, {
            type: "EARNING",
            relatedEntityType: BOOKING_ENTITY_TYPE,
            relatedEntityId: booking.id,
          })
        }
      }
    }
  }
}

export async function runSystemWalletSelfHealing(systemKey = SYSTEM_WALLET_KEY) {
  const relevantBookings = await globalPrisma.booking.findMany({
    where: {
      status: "COMPLETED",
      paymentMethod: "WALLET",
      platformCommission: { gt: 0 },
    },
    orderBy: { updatedAt: "desc" },
  })

  if (relevantBookings.length === 0) return

  await getOrCreateSystemWallet(systemKey)

  for (const booking of relevantBookings) {
    const existingCommission = await findSystemCommissionTransaction(booking.id, systemKey)

    if (existingCommission) {
      continue
    }

    const sourceTransaction = await globalPrisma.rentalTransaction.findUnique({
      where: { bookingId: booking.id },
      select: { id: true },
    })

    await creditCommissionToSystemWallet(booking.platformCommission, {
      relatedEntityType: BOOKING_ENTITY_TYPE,
      relatedEntityId: booking.id,
      metadata: {
        sourceTransactionId: sourceTransaction?.id ?? null,
        bookingId: booking.id,
        borrowerId: booking.borrowerId,
        lenderId: booking.lenderId,
        grossAmount: booking.totalFee,
        commissionRatePercent:
          booking.totalFee > 0
            ? Number(((booking.platformCommission / booking.totalFee) * 100).toFixed(2))
            : 0,
      },
    })
  }
}
