import { getRouterParam } from "h3"
import { deleteItemSchema } from "#shared/schemas/item"
import { appRouter } from "../../trpc/routers"
import { createContext } from "../../trpc/context"
import { handleItemApiError } from "../items/handle-item-api-error"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  const result = deleteItemSchema.safeParse({ id })
  const input: { id: string } = result.success
    ? result.data
    : handleItemApiError(
        {
          statusCode: 400,
          statusMessage: "Invalid item id.",
          data: {
            error: {
              message: "Invalid item id.",
            },
          },
        },
        "delete",
      )

  const caller = appRouter.createCaller(await createContext(event))

  try {
    return await caller.item.delete(input)
  } catch (error) {
    handleItemApiError(error, "delete")
  }
})
