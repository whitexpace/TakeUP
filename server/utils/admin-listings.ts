import type { AdminListingViewStatus } from "../../shared/schemas/admin"

export const ADMIN_LISTING_TARGET_TYPE = "LISTING" as const

export const NON_TERMINAL_TRANSACTION_STATUSES = [
  "PENDING",
  "AWAITING_LENDER_APPROVAL",
  "CONFIRMED",
  "PAID",
  "ONGOING",
  "RETURNED",
  "IN_DISPUTE",
  "APPEALED",
] as const

export const NON_TERMINAL_TRANSACTION_STATUS_DB_VALUES = [
  "pending",
  "awaiting_lender_approval",
  "confirmed",
  "paid",
  "ongoing",
  "returned",
  "in_dispute",
  "appealed",
] as const

export const getAdminListingViewStatus = ({
  status,
  adminModerationState,
}: {
  status: string
  adminModerationState: "DEACTIVATED" | "REMOVED" | null
}): AdminListingViewStatus => {
  if (adminModerationState === "REMOVED") {
    return "REMOVED_BY_ADMIN"
  }

  if (adminModerationState === "DEACTIVATED") {
    return "DEACTIVATED_BY_ADMIN"
  }

  if (status === "DEACTIVATED") {
    return "INACTIVE"
  }

  return "ACTIVE"
}

export const getAdminListingStatusLabel = (status: AdminListingViewStatus) => {
  switch (status) {
    case "ACTIVE":
      return "Active"
    case "INACTIVE":
      return "Inactive"
    case "DEACTIVATED_BY_ADMIN":
      return "Deactivated by Admin"
    case "REMOVED_BY_ADMIN":
      return "Removed by Admin"
  }
}
