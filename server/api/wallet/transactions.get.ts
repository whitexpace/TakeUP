import { getWalletTransactions, runWalletSelfHealing } from "../../utils/wallet"
import { listTransactionsSchema } from "../../../shared/schemas/wallet"

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  // Ensure self-healing runs before we fetch the list
  await runWalletSelfHealing(user.id)

  const query = getQuery(event)
  const result = listTransactionsSchema.safeParse({
    skip: query.skip ? Number(query.skip) : undefined,
    take: query.take ? Number(query.take) : undefined,
  })

  if (!result.success) {
    throw createError({ statusCode: 400, message: "Invalid query parameters" })
  }

  return await getWalletTransactions(user.id, result.data)
})
