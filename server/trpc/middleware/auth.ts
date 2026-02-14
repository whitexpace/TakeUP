import { TRPCError } from "@trpc/server"
import { middleware } from "../init"

export const requireUser = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }

  return next({
    ctx: { ...ctx, user: ctx.user },
  })
})
