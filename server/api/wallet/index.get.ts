import { getOrCreateWallet, runWalletSelfHealing } from "../../utils/wallet"

export default defineEventHandler(async (event) => {
  const user = event.context.authUser

  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  // Run self-healing in background without blocking the response
  runWalletSelfHealing(user.id).catch((e: unknown) => {
    const err = e as { message?: string }
    console.error("[wallet:GET] self-healing failed (skipping):", err?.message ?? e)
  })

  try {
    const wallet = await getOrCreateWallet(user.id)
    return wallet
  } catch (err: unknown) {
    const error = err as {
      name?: string
      code?: string
      message?: string
      meta?: { message?: string }
    }
    console.error("[wallet:GET] getOrCreateWallet threw for userId=", user.id)
    console.error("[wallet:GET] error name:", error?.name, "code:", error?.code)
    console.error("[wallet:GET] error message:", error?.message)
    if (error?.meta) console.error("[wallet:GET] prisma meta:", error.meta)
    throw createError({
      statusCode: 500,
      message: `Wallet fetch failed: ${error?.meta?.message ?? error?.message ?? "unknown error"}`,
    })
  }
})
