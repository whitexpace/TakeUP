import { createTRPCNuxtHandler } from 'trpc-nuxt/server'
import { appRouter } from '../../trpc/routers'
import { createContext } from '../../trpc/context'

export default createTRPCNuxtHandler({
  endpoint: '/api/trpc',
  router: appRouter,
  createContext,
})
