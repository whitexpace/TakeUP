const pesoFormatter = new Intl.NumberFormat("en-PH")
const fullDateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
})
const partialDateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
})

const asDate = (value: string | Date) => (value instanceof Date ? value : new Date(value))

export const formatRequestPriceRange = (minTargetPrice: number, maxTargetPrice: number) => {
  if (minTargetPrice === maxTargetPrice) {
    return `₱${pesoFormatter.format(minTargetPrice)}`
  }

  return `₱${pesoFormatter.format(minTargetPrice)} - ₱${pesoFormatter.format(maxTargetPrice)}`
}

export const formatRequestDateRange = (
  requestedFrom: string | Date,
  requestedTo: string | Date,
) => {
  const fromDate = asDate(requestedFrom)
  const toDate = asDate(requestedTo)

  if (fromDate.toDateString() === toDate.toDateString()) {
    return fullDateFormatter.format(fromDate)
  }

  if (fromDate.getFullYear() === toDate.getFullYear()) {
    return `${partialDateFormatter.format(fromDate)} - ${fullDateFormatter.format(toDate)}`
  }

  return `${fullDateFormatter.format(fromDate)} - ${fullDateFormatter.format(toDate)}`
}

export const formatRequestRelativeTime = (createdAt: string | Date, now: Date = new Date()) => {
  const createdAtDate = asDate(createdAt)
  const diffMs = now.getTime() - createdAtDate.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000))

  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return fullDateFormatter.format(createdAtDate)
}
