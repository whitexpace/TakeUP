export const CHAT_ACCEPTED_BOOKING_STATUSES = [
  "ACCEPTED",
  "CONFIRMED",
  "RETURNED",
  "COMPLETED",
  "IN_DISPUTE",
] as const

export const CHAT_ENABLED_TRANSACTION_STATUSES = [
  "CONFIRMED",
  "PAID",
  "ONGOING",
  "RETURNED",
  "COMPLETED",
  "IN_DISPUTE",
  "APPEALED",
] as const

const CHAT_ENABLED_TRANSACTION_STATUS_VALUES = [...CHAT_ENABLED_TRANSACTION_STATUSES, "ACTIVE"]

export const CHAT_CLOSED_NOTICE =
  "Chat is closed due to an active dispute. Please wait for admin resolution."

export const isChatAvailableForBookingStatus = (status: string | null | undefined) => {
  if (!status) return false
  const normalizedStatus = status.toUpperCase()
  return CHAT_ACCEPTED_BOOKING_STATUSES.some((candidate) => candidate === normalizedStatus)
}

export const isChatAvailableForTransactionStatus = (status: string | null | undefined) => {
  if (!status) return false
  const normalizedStatus = status.toUpperCase()
  return CHAT_ENABLED_TRANSACTION_STATUS_VALUES.some((candidate) => candidate === normalizedStatus)
}

export const isChatReadOnly = (input: {
  transactionStatus: string | null | undefined
  hasOpenDispute: boolean
}) => input.hasOpenDispute && input.transactionStatus?.toUpperCase() === "COMPLETED"
