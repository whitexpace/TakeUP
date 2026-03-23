import { router } from "../init"
import { authRouter } from "./auth"
import { bookingRouter } from "./booking"
import { communityRouter } from "./community"
import { healthRouter } from "./health"
import { itemRouter } from "./item"
import { requestRouter } from "./request"
import { transactionRouter } from "./transaction"

export const appRouter = router({
  auth: authRouter,
  booking: bookingRouter,
  community: communityRouter,
  health: healthRouter,
  item: itemRouter,
  request: requestRouter,
  transaction: transactionRouter,
})

export type AppRouter = typeof appRouter
