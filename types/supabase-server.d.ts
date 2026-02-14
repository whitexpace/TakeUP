// Fallback type declarations so `nuxi typecheck` can resolve the virtual import.
// Nuxt normally generates this under `.nuxt/types/supabase.d.ts`, but the typecheck
// command can run before that file is considered during TS resolution.

declare module "#supabase/server" {
  // Keep these permissive: runtime comes from @nuxtjs/supabase, types are just for TS.
  export const serverSupabaseClient: (event: unknown) => Promise<unknown>
  export const serverSupabaseUser: (event: unknown) => Promise<unknown>
}
