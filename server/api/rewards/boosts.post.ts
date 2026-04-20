import { createError, readBody } from "h3"
import { redeemBoostSchema } from "../../../shared/schemas/rewards"
import { createContext } from "../../trpc/context"
import { appRouter } from "../../trpc/routers"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = redeemBoostSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid boost redemption request.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  return caller.rewards.redeemBoost(parsed.data)
})
