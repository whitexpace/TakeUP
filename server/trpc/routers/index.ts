import { router } from "../init"
import { authRouter } from "./auth"
import { cartRouter } from "./cart"
import { bookingRouter } from "./booking"
import { healthRouter } from "./health"
import { itemRouter } from "./item"
import { requestRouter } from "./request"
import { transactionRouter } from "./transaction"

export const appRouter = router({
  auth: authRouter,
  cart: cartRouter,
  booking: bookingRouter,
  health: healthRouter,
  item: itemRouter,
  request: requestRouter,
  transaction: transactionRouter,
})

export type AppRouter = typeof appRouter
