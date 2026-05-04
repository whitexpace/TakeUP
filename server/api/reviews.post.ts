import { createError, readBody } from "h3"
import { createReviewSchema } from "#shared/schemas/review"
import { createContext } from "../trpc/context"
import { appRouter } from "../trpc/routers"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = createReviewSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid review payload.",
      data: parsed.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  return caller.review.create(parsed.data)
})
