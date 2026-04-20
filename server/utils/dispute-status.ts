import { DisputeStatus } from "@prisma/client"
import type { DisputeStatus as ApiDisputeStatus } from "../../shared/schemas/dispute"

const runtimeDisputeStatuses = DisputeStatus as Record<string, string>
const APPEALED_RUNTIME_STATUS = (runtimeDisputeStatuses.APPEALED ?? "APPEALED") as DisputeStatus
const RESOLVED_RUNTIME_STATUS = (runtimeDisputeStatuses.RESOLVED ?? "RESOLVED") as DisputeStatus

export const SUBMITTED_DISPUTE_STATUS = (runtimeDisputeStatuses.SUBMITTED ??
  runtimeDisputeStatuses.UNDER_REVIEW ??
  "UNDER_REVIEW") as DisputeStatus

export const OPEN_DISPUTE_STATUS = (runtimeDisputeStatuses.OPEN ?? "OPEN") as DisputeStatus
export const REJECTED_DISPUTE_STATUS = (runtimeDisputeStatuses.REJECTED ??
  "REJECTED") as DisputeStatus

export const ACTIVE_DISPUTE_STATUSES = [
  SUBMITTED_DISPUTE_STATUS,
  OPEN_DISPUTE_STATUS,
  APPEALED_RUNTIME_STATUS,
] as const

// Temporary test switch: treat legacy submitted concerns as opened disputes so the
// counterparty rebuttal flow can be exercised without the admin approval step.
export const DISPUTE_ADMIN_REVIEW_BYPASS_ENABLED = true

export const REBUTTABLE_DISPUTE_STATUSES = DISPUTE_ADMIN_REVIEW_BYPASS_ENABLED
  ? [OPEN_DISPUTE_STATUS, SUBMITTED_DISPUTE_STATUS]
  : [OPEN_DISPUTE_STATUS]

export const isActiveDisputeStatus = (status: string) =>
  ACTIVE_DISPUTE_STATUSES.includes(status as (typeof ACTIVE_DISPUTE_STATUSES)[number])

export const fromApiDisputeStatus = (status: ApiDisputeStatus): DisputeStatus => {
  switch (status) {
    case "OPEN":
      return OPEN_DISPUTE_STATUS
    case "REJECTED":
      return REJECTED_DISPUTE_STATUS
    case "APPEALED":
      return APPEALED_RUNTIME_STATUS
    case "RESOLVED":
      return RESOLVED_RUNTIME_STATUS
    case "SUBMITTED":
    default:
      return SUBMITTED_DISPUTE_STATUS
  }
}

export const toApiDisputeStatus = (status: string): ApiDisputeStatus => {
  if (status === OPEN_DISPUTE_STATUS) {
    return "OPEN"
  }

  if (status === APPEALED_RUNTIME_STATUS) {
    return "APPEALED"
  }

  if (status === REJECTED_DISPUTE_STATUS) {
    return "REJECTED"
  }

  if (status === RESOLVED_RUNTIME_STATUS) {
    return "RESOLVED"
  }

  return "SUBMITTED"
}

export const toUserFacingDisputeStatus = (status: string): ApiDisputeStatus => {
  const apiStatus = toApiDisputeStatus(status)

  if (DISPUTE_ADMIN_REVIEW_BYPASS_ENABLED && apiStatus === "SUBMITTED") {
    return "OPEN"
  }

  return apiStatus
}

export const isCounterpartyVisibleDisputeStatus = (status: string) =>
  DISPUTE_ADMIN_REVIEW_BYPASS_ENABLED || toApiDisputeStatus(status) !== "SUBMITTED"

export const isRebuttalEnabledDisputeStatus = (status: string) =>
  REBUTTABLE_DISPUTE_STATUSES.includes(status as (typeof REBUTTABLE_DISPUTE_STATUSES)[number])
