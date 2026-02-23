import { deleteCookie } from "h3"
import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import { sessionCookieName } from "../../utils/auth-session"

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ({ user: ctx.user })),

  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    deleteCookie(ctx.event, sessionCookieName, {
      path: "/",
    })
    return { ok: true }
  }),
})
