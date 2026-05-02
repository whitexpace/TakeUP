import { createTRPCProxyClient, httpBatchLink } from "@trpc/client"
import superjson from "superjson"
import type { AppRouter } from "~~/server/trpc/routers"

export default defineNuxtPlugin(() => {
  const client = createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: "/api/trpc",
      }),
    ],
  })

  return {
    provide: { trpc: client },
  }
})
