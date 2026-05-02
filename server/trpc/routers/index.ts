import { router } from "../init"
import { authRouter } from "./auth"
import { cartRouter } from "./cart"
import { bookingRouter } from "./booking"
import { chatRouter } from "./chat"
import { communityRouter } from "./community"
import { disputeRouter } from "./dispute"
import { healthRouter } from "./health"
import { itemRouter } from "./item"
import { listingAnalyticsRouter } from "./listing-analytics"
import { notificationRouter } from "./notification"
import { requestRouter } from "./request"
import { rewardsRouter } from "./rewards"
import { reviewRouter } from "./review"
import { transactionRouter } from "./transaction"
import { userRouter } from "./user"
import { walletRouter } from "./wallet"
import { adminRouter } from "./admin"

export const appRouter = router({
  auth: authRouter,
  cart: cartRouter,
  booking: bookingRouter,
  chat: chatRouter,
  community: communityRouter,
  dispute: disputeRouter,
  health: healthRouter,
  item: itemRouter,
  listingAnalytics: listingAnalyticsRouter,
  notification: notificationRouter,
  request: requestRouter,
  rewards: rewardsRouter,
  review: reviewRouter,
  transaction: transactionRouter,
  user: userRouter,
  wallet: walletRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
