import type { H3Event } from 'h3'
import { prisma } from '../utils/prisma'
// We avoid importing `#supabase/server` here because `nuxi typecheck` can fail to
// resolve Nuxt virtual modules depending on how TS config is generated.
// Instead we keep context creation independent from the module and type it loosely.

// NOTE: During `nuxi typecheck` (especially in CI), Nuxt's generated Database types may
// not be present, which can make the inferred SupabaseClient generic params disagree.
// For tRPC context, we don't need the generated DB type, so we use an opaque type.
type SupabaseServerClient = unknown

export type Context = {
  event: H3Event
  prisma: typeof prisma
  user: { id: string } | null
  supabase: SupabaseServerClient
}

export async function createContext(event: H3Event): Promise<Context> {
  return { event, prisma, user: null, supabase: null }
}
