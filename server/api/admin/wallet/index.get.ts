import { createError } from "h3"
import { getOrCreateSystemWallet, runSystemWalletSelfHealing } from "../../../utils/wallet"
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

  try {
    await runSystemWalletSelfHealing()
  } catch (error) {
    console.error("System wallet self-healing failed (skipping):", error)
  }

  return await getOrCreateSystemWallet()
})
