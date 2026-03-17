import { TRPCError } from "@trpc/server"
import { createError, readBody } from "h3"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.item.create(body)
  } catch (err) {
    if (err instanceof TRPCError) {
      if (err.code === "UNAUTHORIZED")
        throw createError({ statusCode: 401, statusMessage: "Unauthorized." })
      if (err.code === "BAD_REQUEST")
        throw createError({ statusCode: 400, statusMessage: err.message })
    }
    throw err
  }
})
