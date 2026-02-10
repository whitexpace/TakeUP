import { router } from '../init'
import { publicProcedure } from '../procedures'

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ ok: true })),
})
