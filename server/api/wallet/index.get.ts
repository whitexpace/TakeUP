import { getOrCreateWallet, runWalletSelfHealing } from "../../utils/wallet"

export default defineEventHandler(async (event) => {
  const user = event.context.authUser
  console.log(
    "[wallet:GET] incoming request, authUser:",
    user ? { id: user.id, email: (user as any).email } : null,
  )

  if (!user) {
    console.warn("[wallet:GET] no authUser on event.context — rejecting 401")
    throw createError({ statusCode: 401, message: "Unauthorized" })
  }

  // Run self-healing in background without blocking the response
  runWalletSelfHealing(user.id).catch((e) => {
    console.error("[wallet:GET] self-healing failed (skipping):", e?.message ?? e)
  })

  try {
    const wallet = await getOrCreateWallet(user.id)
    console.log("[wallet:GET] success — returning wallet", {
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance?.toString?.() ?? wallet.balance,
      status: wallet.status,
    })
    return wallet
  } catch (err: any) {
    console.error("[wallet:GET] getOrCreateWallet threw for userId=", user.id)
    console.error("[wallet:GET] error name:", err?.name, "code:", err?.code)
    console.error("[wallet:GET] error message:", err?.message)
    if (err?.meta) console.error("[wallet:GET] prisma meta:", err.meta)
    throw createError({
      statusCode: 500,
      message: `Wallet fetch failed: ${err?.meta?.message ?? err?.message ?? "unknown error"}`,
    })
  }
})
