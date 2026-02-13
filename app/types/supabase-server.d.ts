// This file ensures `nuxi typecheck` can resolve `#supabase/server` even when Nuxt's
// generated type declarations aren't present/loaded yet.
//
// Runtime behavior comes from `@nuxtjs/supabase`.

declare module '#supabase/server' {
  export function serverSupabaseClient(event: unknown): Promise<unknown>
  export function serverSupabaseUser(event: unknown): Promise<unknown>
}
