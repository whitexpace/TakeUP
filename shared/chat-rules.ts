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

export type ChatClosureState = "OPEN" | "ENDED" | "IN_DISPUTE"

export const CHAT_ENDED_NOTICE = "Chat has ended because this transaction is complete."
export const CHAT_DISPUTE_NOTICE =
  "Chat is closed because this transaction is in dispute. Please wait for admin resolution."
export const CHAT_ENDED_PREVIEW = "Chat has ended"
export const CHAT_IN_DISPUTE_PREVIEW = "In dispute"
export const CHAT_CLOSED_NOTICE = CHAT_DISPUTE_NOTICE

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

export const getChatClosureState = (input: {
  transactionStatus: string | null | undefined
  hasActiveDispute: boolean
}): ChatClosureState => {
  const normalizedStatus = input.transactionStatus?.toUpperCase()

  if (
    input.hasActiveDispute ||
    normalizedStatus === "IN_DISPUTE" ||
    normalizedStatus === "APPEALED"
  ) {
    return "IN_DISPUTE"
  }

  if (normalizedStatus === "COMPLETED") {
    return "ENDED"
  }

  return "OPEN"
}

export const isChatClosed = (closureState: ChatClosureState) => closureState !== "OPEN"

export const getChatClosedNotice = (closureState: ChatClosureState) => {
  if (closureState === "ENDED") {
    return CHAT_ENDED_NOTICE
  }

  if (closureState === "IN_DISPUTE") {
    return CHAT_DISPUTE_NOTICE
  }

  return null
}

export const getChatClosedPreviewLabel = (closureState: ChatClosureState) => {
  if (closureState === "ENDED") {
    return CHAT_ENDED_PREVIEW
  }

  if (closureState === "IN_DISPUTE") {
    return CHAT_IN_DISPUTE_PREVIEW
  }

  return null
}

export const getChatClosureStateFromNotice = (
  notice: string | null | undefined,
): ChatClosureState | null => {
  if (notice === CHAT_ENDED_NOTICE) {
    return "ENDED"
  }

  if (notice === CHAT_DISPUTE_NOTICE) {
    return "IN_DISPUTE"
  }

  return null
}

export const isChatReadOnly = (input: {
  transactionStatus: string | null | undefined
  hasActiveDispute: boolean
}) => isChatClosed(getChatClosureState(input))
