import { getOrCreateWallet, getWalletTransactions, runWalletSelfHealing } from "../../utils/wallet"
import { listTransactionsSchema } from "#shared/schemas/wallet"

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const query = getQuery(event)
  const result = listTransactionsSchema.safeParse({
    skip: query.skip ? Number(query.skip) : undefined,
    take: query.take ? Number(query.take) : undefined,
  })

  if (!result.success) {
    throw createError({ statusCode: 400, message: "Invalid query parameters" })
  }

  runWalletSelfHealing(user.id).catch((error: unknown) => {
    const err = error as { message?: string }
    console.error("[wallet:preview] self-healing failed (skipping):", err?.message ?? error)
  })

  const [wallet, transactions] = await Promise.all([
    getOrCreateWallet(user.id),
    getWalletTransactions(user.id, result.data),
  ])

  return {
    wallet,
    transactions,
    viewerKey: user.id,
  }
})
