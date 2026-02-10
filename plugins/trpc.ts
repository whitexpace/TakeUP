import { createTRPCNuxtClient } from 'trpc-nuxt/client'
import superjson from 'superjson'
import type { AppRouter } from '~/server/trpc/routers'

export default defineNuxtPlugin(() => {
  const client = createTRPCNuxtClient<AppRouter>({
    transformer: superjson,
    url: '/api/trpc',
  })

  return {
    provide: { trpc: client },
  }
})
