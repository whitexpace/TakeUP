import type { H3Event } from "h3"
import { prisma } from "../utils/prisma"

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>
    signInWithPassword: (args: {
      email: string
      password: string
    }) => Promise<{ data: unknown; error: unknown }>
    signOut: () => Promise<{ error: unknown }>
  }
}

export type Context = {
  event: H3Event
  prisma: typeof prisma
  user: { id: string } | null
  supabase: SupabaseLike
}

export async function createContext(event: H3Event): Promise<Context> {
  // NOTE:
  // We intentionally avoid importing Nuxt's virtual `#supabase/server` module here.
  // `nuxi typecheck` runs in a TS-only context where that virtual module may not
  // be resolvable, which breaks type checking.
  //
  // If/when you need real Supabase access in tRPC, we can re-introduce it behind
  // a project-local wrapper module that has stable types.
  const supabase: SupabaseLike = {
    auth: {
      async getUser() {
        return { data: { user: null } }
      },
      async signInWithPassword() {
        return { data: null, error: new Error("Supabase not configured in tRPC context") }
      },
      async signOut() {
        return { error: null }
      },
    },
  }

  const user = null

  return { event, prisma, user, supabase }
}
