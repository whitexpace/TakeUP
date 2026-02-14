import { router } from "../init"
import { protectedProcedure, publicProcedure } from "../procedures"
import { signInSchema } from "../../../shared/schemas/auth"

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ({ user: ctx.user })),

  signIn: publicProcedure.input(signInSchema).mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (error) {
      throw error
    }

    return data
  }),

  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase.auth.signOut()
    if (error) {
      throw error
    }
    return { ok: true }
  }),
})
