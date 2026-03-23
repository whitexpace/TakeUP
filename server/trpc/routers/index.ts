import { router } from "../init"
import { authRouter } from "./auth"
import { cartRouter } from "./cart"
import { healthRouter } from "./health"
import { itemRouter } from "./item"
import { transactionRouter } from "./transaction"

export const appRouter = router({
  auth: authRouter,
  cart: cartRouter,
  health: healthRouter,
  item: itemRouter,
  transaction: transactionRouter,
})

export type AppRouter = typeof appRouter
