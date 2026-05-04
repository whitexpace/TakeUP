import { createError, getQuery } from "h3"
import { prisma } from "../../../utils/prisma"
import { getSystemCommissionAudit, runSystemWalletSelfHealing } from "../../../utils/wallet"
import { listCommissionRecordsSchema } from "../../../../shared/schemas/wallet"

async function requireAdminWalletAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true },
  })

  if (!user || user.accountType !== "ADMIN") {
    throw createError({
      statusCode: 403,
      statusMessage: "Only admins can access commission records.",
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

  const query = getQuery(event)
  const cursorRaw = typeof query.cursor === "string" ? query.cursor : undefined
  let parsedCursor: unknown

  if (cursorRaw) {
    try {
      parsedCursor = JSON.parse(cursorRaw)
    } catch {
      throw createError({ statusCode: 400, statusMessage: "Invalid cursor format." })
    }
  }

  const parsed = listCommissionRecordsSchema.safeParse({
    status: typeof query.status === "string" ? query.status : undefined,
    collectedAtFrom: typeof query.collectedAtFrom === "string" ? query.collectedAtFrom : undefined,
    collectedAtTo: typeof query.collectedAtTo === "string" ? query.collectedAtTo : undefined,
    search: typeof query.search === "string" && query.search.trim() ? query.search : undefined,
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    cursor: parsedCursor,
  })

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid commission filter.",
      data: parsed.error.flatten(),
    })
  }

  return await getSystemCommissionAudit(undefined, parsed.data)
})
