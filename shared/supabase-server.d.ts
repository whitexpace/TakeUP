// This shim is picked up by Nuxt's generated TS configs (they include `../shared/**/*.d.ts`).
// It provides types for the Nuxt Supabase virtual module used on the server.

declare module '#supabase/server' {
  export function serverSupabaseClient(event: unknown): Promise<unknown>
  export function serverSupabaseUser(event: unknown): Promise<unknown>
}

export {}
