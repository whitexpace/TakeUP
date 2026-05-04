import { getQuery } from "h3"
import { appRouter } from "../trpc/routers"
import { createContext } from "../trpc/context"
import { listItemRequestsSchema } from "#shared/schemas/item-request"
import { handleItemRequestApiError } from "./item-requests/handle-item-request-api-error"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const input = listItemRequestsSchema.parse(query)

  const caller = appRouter.createCaller(await createContext(event))
  try {
    return await caller.community.listRequests(input)
  } catch (error) {
    handleItemRequestApiError(error, "fetch")
  }
})
