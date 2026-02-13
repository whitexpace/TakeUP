import { router } from '../init'
import { protectedProcedure, publicProcedure } from '../procedures'
import { signInSchema } from '../../../shared/schemas/auth'

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ({ user: ctx.user })),

  signIn: publicProcedure.input(signInSchema).mutation(async ({ ctx, input }) => {
    const supabase = ctx.supabase as unknown as { auth: any }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (error) {
      throw error
    }

    return data
  }),

  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    const supabase = ctx.supabase as unknown as { auth: any }
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
    return { ok: true }
  }),
})
