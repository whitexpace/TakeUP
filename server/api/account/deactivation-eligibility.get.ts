import { createError } from "h3"
import { createContext } from "../../trpc/context"
import { getDeactivationEligibility } from "../../utils/account-deactivation"

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)

  if (!ctx.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be signed in to deactivate your account.",
    })
  }

  return getDeactivationEligibility(ctx.prisma, ctx.user.id)
})
