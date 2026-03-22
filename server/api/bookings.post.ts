import { TRPCError } from "@trpc/server"
import { createError, readBody } from "h3"
import { createBookingSchema } from "../../shared/schemas/booking"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const result = createBookingSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid input.",
      data: result.error.flatten(),
    })
  }

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.booking.create(result.data)
  } catch (err) {
    if (err instanceof TRPCError) {
      if (err.code === "UNAUTHORIZED")
        throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
      if (err.code === "FORBIDDEN")
        throw createError({ statusCode: 403, statusMessage: "Forbidden." })
      if (err.code === "NOT_FOUND")
        throw createError({ statusCode: 404, statusMessage: "Item not found." })
      if (err.code === "BAD_REQUEST")
        throw createError({ statusCode: 400, statusMessage: err.message })
    }
    throw err
  }
})
