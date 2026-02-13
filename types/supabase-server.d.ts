declare module '#supabase/server' {
  // Minimal typing shim for `nuxi typecheck` environments where Nuxt's virtual module
  // declarations aren't picked up. Runtime behavior is provided by @nuxtjs/supabase.
  //
  // If you generate DB types later, you can replace these `any` types with your Database.
  export function serverSupabaseClient(event: unknown): Promise<unknown>
  export function serverSupabaseUser(event: unknown): Promise<unknown>
}

// Ensure TypeScript actually *includes* this file during `nuxi typecheck`.
// Nuxt's generated tsconfigs include `../shared/**/*.d.ts` but not `../types/**/*.d.ts`.
export {}
