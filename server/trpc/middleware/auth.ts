import { TRPCError } from "@trpc/server"
import { middleware } from "../init"
import { getCachedUserAccess } from "./user-access"

export const requireUser = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "AUTH_UNAUTHORIZED: You must be authenticated to access this resource.",
    })
  }

  const isVerifiedHttpSession = ctx.event.context.authUser?.id === ctx.user.id
  if (!isVerifiedHttpSession) {
    return next({
      ctx: { ...ctx, user: ctx.user },
    })
  }

  const hasUserDelegate =
    typeof (ctx.prisma as { user?: { findUnique?: unknown } }).user?.findUnique === "function"
  const userRecord = hasUserDelegate ? await getCachedUserAccess(ctx.prisma, ctx.user.id) : null

  if (!hasUserDelegate) {
    return next({
      ctx: { ...ctx, user: ctx.user },
    })
  }

  if (!userRecord || userRecord.status !== "ACTIVE") {
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

  const isVerifiedHttpSession = ctx.event.context.authUser?.id === ctx.user.id
  if (!isVerifiedHttpSession) {
    if (ctx.user.accountType !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can access this resource.",
      })
    }

    return next({
      ctx: { ...ctx, user: ctx.user },
    })
  }

  const hasUserDelegate =
    typeof (ctx.prisma as { user?: { findUnique?: unknown } }).user?.findUnique === "function"
  const userRecord = hasUserDelegate ? await getCachedUserAccess(ctx.prisma, ctx.user.id) : null

  if (!hasUserDelegate) {
    if (ctx.user.accountType !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can access this resource.",
      })
    }

    return next({
      ctx: { ...ctx, user: ctx.user },
    })
  }

  if (!userRecord || userRecord.status !== "ACTIVE" || userRecord.accountType !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only admins can access this resource.",
    })
  }

  return next({
    ctx: { ...ctx, user: ctx.user },
  })
})
