import { createError } from "h3"
import { createContext } from "../../trpc/context"
import { getAccountDeletionEligibility } from "../../utils/account-deletion"

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)

  if (!ctx.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized.",
    })
  }

  return getAccountDeletionEligibility(ctx.prisma, ctx.user.id)
})
