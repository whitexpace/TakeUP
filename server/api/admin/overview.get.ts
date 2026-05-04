import { createError } from "h3"
import { prisma } from "../../utils/prisma"
import { getAdminOverview } from "../../utils/admin-overview"

async function requireAdminAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true },
  })

  if (!user || user.accountType !== "ADMIN") {
    throw createError({
      statusCode: 403,
      statusMessage: "Only admins can access the overview dashboard.",
    })
  }
}

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  }

  await requireAdminAccess(user.id)
  return getAdminOverview(prisma)
})
