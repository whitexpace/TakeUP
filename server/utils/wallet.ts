import { Prisma } from "@prisma/client"
import { TRPCError } from "@trpc/server"
import { asWalletPrisma, prisma as globalPrisma, type WalletPrismaAdapter } from "./prisma"

export const WalletStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CLOSED: "CLOSED",
} as const

export const WalletTransactionType = {
  TOP_UP: "TOP_UP",
  PAYMENT: "PAYMENT",
  REFUND: "REFUND",
  ADJUSTMENT: "ADJUSTMENT",
  EARNING: "EARNING",
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

interface WalletLockResult {
  id: string
  balance: string | number | Prisma.Decimal
}

interface WalletPaymentLockResult extends WalletLockResult {
  status: string
}

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

  return `${prefix}-${date}-${random}`
}

/**
 * Get or create a wallet for a user.
 */
export async function getOrCreateWallet(userId: string, tx?: Prisma.TransactionClient) {
  const prisma = asWalletPrisma(tx || globalPrisma)
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  })

  if (wallet) return wallet

  return await prisma.wallet.create({
    data: {
      userId,
      balance: 0,
      currency: "PHP",
      status: "ACTIVE",
    },
  })
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
    const wallets = await walletTx.$queryRaw<WalletLockResult[]>`
      SELECT id, balance FROM wallets WHERE user_id = ${userId} FOR UPDATE
    `

    let walletId: string
    let currentBalance: Prisma.Decimal

    if (wallets.length === 0) {
      const newWallet = await walletTx.wallet.create({
        data: { userId, balance: 0, currency: "PHP", status: "ACTIVE" },
      })
      walletId = newWallet.id
      currentBalance = new Prisma.Decimal(0)
    } else {
      const w = wallets[0]
      if (!w) throw new Error("Wallet lock result is empty")
      walletId = w.id
      currentBalance = new Prisma.Decimal(w.balance.toString())
    }

    const decimalAmount = new Prisma.Decimal(amount)
    const newBalance = currentBalance.plus(decimalAmount)
    const referenceCode = generateReferenceCode("TOP_UP")

    const transaction = await walletTx.walletTransaction.create({
      data: {
        walletId,
        userId,
        type: "TOP_UP",
        method: "PSEUDO",
        direction: "CREDIT",
        amount: decimalAmount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        referenceCode,
        status: "SUCCESS",
      },
    })

    const updatedWallet = await walletTx.wallet.update({
      where: { id: walletId },
      data: { balance: newBalance },
    })

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
    const wallets = await walletTx.$queryRaw<WalletPaymentLockResult[]>`
      SELECT id, balance, status FROM wallets WHERE user_id = ${userId} FOR UPDATE
    `

    const wallet = wallets[0]
    if (!wallet) throw new TRPCError({ code: "NOT_FOUND", message: "Wallet not found." })
    if (wallet.status !== "ACTIVE")
      throw new TRPCError({ code: "FORBIDDEN", message: "Wallet is not active." })

    const currentBalance = new Prisma.Decimal(wallet.balance.toString())
    const decimalAmount = new Prisma.Decimal(amount)

    if (currentBalance.lessThan(decimalAmount)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient wallet balance." })
    }

    const newBalance = currentBalance.minus(decimalAmount)
    const referenceCode = generateReferenceCode("PAYMENT")

    const transaction = await walletTx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: "PAYMENT",
        method: "SYSTEM",
        direction: "DEBIT",
        amount: decimalAmount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        referenceCode,
        relatedEntityType: context.relatedEntityType,
        relatedEntityId: context.relatedEntityId,
        status: "SUCCESS",
      },
    })

    const updatedWallet = await walletTx.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    })

    return { wallet: updatedWallet, transaction }
  })
}

/**
 * Credit earnings or refunds to a wallet.
 */
export async function creditToWallet(
  userId: string,
  amount: number,
  context: { type: "EARNING" | "REFUND"; relatedEntityType: string; relatedEntityId: string },
  tx?: Prisma.TransactionClient,
) {
  if (amount <= 0) return null

  const execute = async (client: Prisma.TransactionClient & WalletPrismaAdapter) => {
    const walletClient = asWalletPrisma(client)
    const wallets = await walletClient.$queryRaw<WalletLockResult[]>`
      SELECT id, balance FROM wallets WHERE user_id = ${userId} FOR UPDATE
    `

    let walletId: string
    let currentBalance: Prisma.Decimal

    if (wallets.length === 0) {
      const newWallet = await walletClient.wallet.create({
        data: { userId, balance: 0, currency: "PHP", status: "ACTIVE" },
      })
      walletId = newWallet.id
      currentBalance = new Prisma.Decimal(0)
    } else {
      const w = wallets[0]
      if (!w) throw new Error("Wallet lock result is empty")
      walletId = w.id
      currentBalance = new Prisma.Decimal(w.balance.toString())
    }

    const decimalAmount = new Prisma.Decimal(amount)
    const newBalance = currentBalance.plus(decimalAmount)
    const referenceCode = generateReferenceCode(context.type)

    const transaction = await walletClient.walletTransaction.create({
      data: {
        walletId,
        userId,
        type: context.type as PrismaWalletTransactionType,
        method: "SYSTEM",
        direction: "CREDIT", // Always CREDIT for earnings and refunds
        amount: decimalAmount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        referenceCode,
        relatedEntityType: context.relatedEntityType,
        relatedEntityId: context.relatedEntityId,
        status: "SUCCESS",
      },
    })

    const updatedWallet = await walletClient.wallet.update({
      where: { id: walletId },
      data: { balance: newBalance },
    })

    return { wallet: updatedWallet, transaction }
  }

  // If a transaction client is already provided, use it.
  if (tx) {
    return await execute(asWalletPrisma(tx))
  } else {
    return await globalPrisma.$transaction(async (newTx) => {
      return await execute(asWalletPrisma(newTx))
    })
  }
}

/**
 * Get wallet transactions for a user.
 */
export async function getWalletTransactions(
  userId: string,
  options: { skip?: number; take?: number } = {},
) {
  return await asWalletPrisma(globalPrisma).walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: options.skip,
    take: options.take,
  })
}
