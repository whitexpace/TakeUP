import { createError, getQuery } from "h3"
import { getSystemWalletTransactions, runSystemWalletSelfHealing } from "../../../utils/wallet"
import { listTransactionsSchema } from "../../../../shared/schemas/wallet"
import { prisma } from "../../../utils/prisma"

async function requireAdminWalletAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true },
  })

  if (!user || user.accountType !== "ADMIN") {
    throw createError({
      statusCode: 403,
      statusMessage: "Only admins can access the system wallet.",
    })
  }
}

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  }

  await requireAdminWalletAccess(user.id)
  await runSystemWalletSelfHealing()

  const query = getQuery(event)
  const result = listTransactionsSchema.safeParse({
    skip: query.skip ? Number(query.skip) : undefined,
    take: query.take ? Number(query.take) : undefined,
  })

  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid query parameters" })
  }

  return await getSystemWalletTransactions(undefined, result.data)
})
