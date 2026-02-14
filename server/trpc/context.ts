import type { H3Event } from 'h3'
import { prisma } from '../utils/prisma'

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>
  }
}

export type Context = {
  event: H3Event
  prisma: typeof prisma
  user: { id: string } | null
  supabase: SupabaseLike
}

export async function createContext(event: H3Event): Promise<Context> {
  const { serverSupabaseClient } = await import('#supabase/server').catch(() => ({
    serverSupabaseClient: undefined as unknown,
  }))

  if (typeof serverSupabaseClient !== 'function') {
    throw new Error(
      'Supabase server helpers are not available. Ensure @nuxtjs/supabase is installed and enabled in nuxt.config.ts.',
    )
  }

  const supabase = (await serverSupabaseClient(event)) as SupabaseLike
  const userResult = await supabase.auth.getUser()
  const user = userResult.data.user ? { id: userResult.data.user.id } : null

  return { event, prisma, user, supabase }
}
