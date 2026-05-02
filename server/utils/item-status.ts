import type { ItemStatus } from "@prisma/client"

type AvailabilityRange = {
  startDate: Date
  endDate: Date
  status?: string | null
}

const AVAILABILITY_CONTROLLED_ITEM_STATUSES = new Set<string>(["AVAILABLE", "UNAVAILABLE"])

export const itemHasFutureAvailableDate = (availability: AvailabilityRange[], now = new Date()) =>
  availability.some(
    (range) =>
      range.status === "AVAILABLE" &&
      range.endDate > range.startDate &&
      range.endDate.getTime() > now.getTime(),
  )

export const getAvailabilityDrivenItemStatus = (
  status: ItemStatus | string | null | undefined,
  availability: AvailabilityRange[],
  now = new Date(),
): ItemStatus => {
  const requestedStatus = status ?? "AVAILABLE"
  if (!AVAILABILITY_CONTROLLED_ITEM_STATUSES.has(requestedStatus)) {
    return requestedStatus as ItemStatus
  }

  return itemHasFutureAvailableDate(availability, now)
    ? ("AVAILABLE" as ItemStatus)
    : ("UNAVAILABLE" as ItemStatus)
}
