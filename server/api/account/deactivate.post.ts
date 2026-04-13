import { createError, deleteCookie } from "h3"
import { createContext } from "../../trpc/context"
import { getDeactivationEligibility } from "../../utils/account-deactivation"
import { sessionCookieName } from "../../utils/auth-session"

export default defineEventHandler(async (event) => {
  const ctx = await createContext(event)

  if (!ctx.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "You must be signed in to deactivate your account.",
    })
  }

  const eligibility = await getDeactivationEligibility(ctx.prisma, ctx.user.id)

  if (!eligibility.allowed) {
    throw createError({
      statusCode: 409,
      statusMessage: "Account deactivation is blocked.",
      data: eligibility,
    })
  }

  await ctx.prisma.user.update({
    where: { id: ctx.user.id },
    data: { status: "DEACTIVATED" },
    select: { id: true },
  })

  deleteCookie(event, sessionCookieName, { path: "/" })

  return { ok: true }
})
