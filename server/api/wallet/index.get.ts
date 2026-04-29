import { getOrCreateWallet, runWalletSelfHealing } from "../../utils/wallet"

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  // Run a quick check (non-blocking if possible, but for test we'll wait)
  try {
    await runWalletSelfHealing(user.id)
  } catch (e) {
    console.error("Self-healing failed (skipping):", e)
  }

  return await getOrCreateWallet(user.id)
})
