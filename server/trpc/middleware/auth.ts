import { TRPCError } from "@trpc/server"
import { middleware } from "../init"

export const requireUser = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "AUTH_UNAUTHORIZED: You must be authenticated to access this resource.",
    })
  }

  return next({
    ctx: { ...ctx, user: ctx.user },
  })
})

export const requireAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "AUTH_UNAUTHORIZED: You must be authenticated to access this resource.",
    })
  }

  const userRecord = await ctx.prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: { accountType: true },
  })

  if (!userRecord || userRecord.accountType !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only admins can access this resource.",
    })
  }

  return next({
    ctx: { ...ctx, user: ctx.user },
  })
})
