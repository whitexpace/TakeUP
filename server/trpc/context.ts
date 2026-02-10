import type { H3Event } from 'h3'
import { prisma } from '../utils/prisma'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export type Context = {
  event: H3Event
  prisma: typeof prisma
  user: Awaited<ReturnType<typeof serverSupabaseUser>> | null
  supabase: Awaited<ReturnType<typeof serverSupabaseClient>>
}

export async function createContext(event: H3Event): Promise<Context> {
  const supabase = await serverSupabaseClient(event)
  const user = await serverSupabaseUser(event)

  return { event, prisma, user, supabase }
}
