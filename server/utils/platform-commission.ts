const DEFAULT_PLATFORM_COMMISSION_RATE_PERCENT = 5

export function getPlatformCommissionRatePercent() {
  const runtimeConfig = typeof useRuntimeConfig === "function" ? useRuntimeConfig() : undefined
  const rawRate =
    runtimeConfig?.platformCommissionRatePercent ??
    process.env.PLATFORM_COMMISSION_RATE_PERCENT ??
    DEFAULT_PLATFORM_COMMISSION_RATE_PERCENT
  const parsedRate = Number(rawRate)

  if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100) {
    throw new Error(
      `Invalid PLATFORM_COMMISSION_RATE_PERCENT value "${rawRate}". Expected a number between 0 and 100.`,
    )
  }

  return parsedRate
}

export function calculatePlatformCommissionAmount(grossAmount: number) {
  if (grossAmount <= 0) {
    return 0
  }

  return Math.round((grossAmount * getPlatformCommissionRatePercent()) / 100)
}

export { DEFAULT_PLATFORM_COMMISSION_RATE_PERCENT }
