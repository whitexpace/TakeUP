import { router } from "../init"
import { authRouter } from "./auth"
import { cartRouter } from "./cart"
import { bookingRouter } from "./booking"
import { chatRouter } from "./chat"
import { communityRouter } from "./community"
import { healthRouter } from "./health"
import { itemRouter } from "./item"
import { notificationRouter } from "./notification"
import { requestRouter } from "./request"
import { transactionRouter } from "./transaction"

export const appRouter = router({
  auth: authRouter,
  cart: cartRouter,
  booking: bookingRouter,
  chat: chatRouter,
  community: communityRouter,
  health: healthRouter,
  item: itemRouter,
  notification: notificationRouter,
  request: requestRouter,
  transaction: transactionRouter,
})

export type AppRouter = typeof appRouter
