import { withdrawPseudo } from "../../utils/wallet"
import { topUpSchema } from "#shared/schemas/wallet"

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  const body = await readBody(event)
  // Reusing topUpSchema as it's just { amount: number }
  const result = topUpSchema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, message: "Invalid withdrawal amount" })
  }

  return await withdrawPseudo(user.id, result.data.amount)
})
