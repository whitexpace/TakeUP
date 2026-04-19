import { getOrCreateWallet } from "../../utils/wallet"

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  return await getOrCreateWallet(user.id)
})
