import { Prisma } from "@prisma/client"
import { getOrCreateWallet } from "../../utils/wallet"
import { prisma } from "../../utils/prisma"

/**
 * Self-healing helper to ensure test data is correct.
 * Uses row-level locking to prevent race conditions during parallel API calls.
 */
export async function runWalletSelfHealing(userId: string) {
  const relevantBookings = await prisma.booking.findMany({
    where: {
      OR: [{ borrowerId: userId }, { lenderId: userId }],
      status: "COMPLETED",
      paymentMethod: "WALLET",
    },
  })

  if (relevantBookings.length === 0) return

  await prisma.$transaction(
    async (tx) => {
      // 0. CRITICAL: Lock the wallet row to prevent parallel self-healing requests.
      // In default isolation level, this will make parallel requests wait in line.
      await tx.$queryRaw`SELECT id FROM wallets WHERE user_id = ${userId} FOR UPDATE`

      for (const b of relevantBookings) {
        // 1A. As Borrower: CLEAN AND REBUILD REFUNDS
        if (b.borrowerId === userId) {
          await tx.walletTransaction.deleteMany({
            where: {
              userId,
              relatedEntityId: b.id,
              type: "REFUND",
            },
          })

          if (b.refundAmount > 0) {
            const refundDate = new Date((b.returnedAt || b.updatedAt).getTime() + 1000)
            const decimalAmount = new Prisma.Decimal(b.refundAmount)
            const wallet = await tx.wallet.findUnique({ where: { userId } })

            if (wallet) {
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  userId,
                  type: "REFUND",
                  method: "SYSTEM",
                  direction: "CREDIT",
                  amount: decimalAmount,
                  balanceBefore: 0,
                  balanceAfter: 0,
                  referenceCode: `RECON-RF-${b.id.slice(0, 8)}-${Date.now()}`,
                  relatedEntityType: "BOOKING",
                  relatedEntityId: b.id,
                  createdAt: refundDate,
                },
              })
            }
          }
        }

        // 1B. As Lender: CLEAN AND REBUILD EARNINGS
        if (b.lenderId === userId) {
          await tx.walletTransaction.deleteMany({
            where: { userId, relatedEntityId: b.id, type: "EARNING" },
          })

          const netEarnings = b.totalFee - b.platformCommission - (b.refundAmount || 0)
          if (netEarnings > 0) {
            const earningDate = new Date((b.completedAt || b.updatedAt).getTime() + 2000)
            const decimalAmount = new Prisma.Decimal(netEarnings)
            const wallet = await tx.wallet.findUnique({ where: { userId } })

            if (wallet) {
              await tx.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  userId,
                  type: "EARNING",
                  method: "SYSTEM",
                  direction: "CREDIT",
                  amount: decimalAmount,
                  balanceBefore: 0,
                  balanceAfter: 0,
                  referenceCode: `RECON-ER-${b.id.slice(0, 8)}-${Date.now()}`,
                  relatedEntityType: "BOOKING",
                  relatedEntityId: b.id,
                  createdAt: earningDate,
                },
              })
            }
          }
        }
      }

      // 2. FINAL STEP: SNAPSHOT RECONCILIATION
      const allTx = await tx.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      })

      let runningBalance = new Prisma.Decimal(0)
      for (const t of allTx) {
        const amount = new Prisma.Decimal(t.amount.toString())
        const balanceBefore = runningBalance

        if (t.direction === "CREDIT") {
          runningBalance = runningBalance.plus(amount)
        } else {
          runningBalance = runningBalance.minus(amount)
        }

        await tx.walletTransaction.update({
          where: { id: t.id },
          data: {
            balanceBefore: balanceBefore,
            balanceAfter: runningBalance,
          },
        })
      }

      await tx.wallet.update({
        where: { userId },
        data: { balance: runningBalance },
      })
    },
    {
      timeout: 30000, // Extended timeout for safety
    },
  )
}

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  await runWalletSelfHealing(user.id)
  return await getOrCreateWallet(user.id)
})
