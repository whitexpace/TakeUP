const boostDateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const asDate = (value: string | Date) => (value instanceof Date ? value : new Date(value))

export const formatBoostDateTime = (value: string | Date) => boostDateFormatter.format(asDate(value))

export const getRemainingBoostTime = (expiresAt: string | Date, now: Date = new Date()) => {
  const expiresAtDate = asDate(expiresAt)
  const diffMs = expiresAtDate.getTime() - now.getTime()

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return { expired: true, label: "Expired", remainingMs: 0 }
  }

  const totalMinutes = Math.ceil(diffMs / 60_000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return {
      expired: false,
      label: `${days}d ${hours}h left`,
      remainingMs: diffMs,
    }
  }

  return {
    expired: false,
    label: `${hours}h ${minutes}m left`,
    remainingMs: diffMs,
  }
}
