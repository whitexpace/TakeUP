import { router } from '../init'
import { authRouter } from './auth'
import { healthRouter } from './health'
import { itemRouter } from './item'

export const appRouter = router({
  auth: authRouter,
  health: healthRouter,
  item: itemRouter,
})

export type AppRouter = typeof appRouter
