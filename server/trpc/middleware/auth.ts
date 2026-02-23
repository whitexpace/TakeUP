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
