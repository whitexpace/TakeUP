import { TransactionStatus as PrismaTransactionStatus } from "@prisma/client"
import type { TransactionStatus as UiTransactionStatus } from "../../shared/schemas/transaction"

const prismaTransactionStatuses = PrismaTransactionStatus as Record<string, PrismaTransactionStatus>

const getOptionalTransactionStatus = (name: string) => prismaTransactionStatuses[name]

const getTransactionStatusGroup = (
  names: string[],
  fallback: PrismaTransactionStatus[],
): PrismaTransactionStatus[] => {
  const resolved = names
    .map((name) => getOptionalTransactionStatus(name))
    .filter((status): status is PrismaTransactionStatus => Boolean(status))

  return resolved.length > 0 ? resolved : fallback
}

export const transactionStatusGroups: Record<UiTransactionStatus, PrismaTransactionStatus[]> = {
  PENDING: getTransactionStatusGroup(
    ["PENDING", "AWAITING_LENDER_APPROVAL"],
    [PrismaTransactionStatus.PENDING],
  ),
  ACTIVE: getTransactionStatusGroup(
    ["ACTIVE", "CONFIRMED", "PAID", "ONGOING", "IN_DISPUTE", "APPEALED"],
    [PrismaTransactionStatus.PENDING],
  ),
  RETURNED: getTransactionStatusGroup(["RETURNED"], [PrismaTransactionStatus.RETURNED]),
  COMPLETED: [PrismaTransactionStatus.COMPLETED],
  CANCELLED: getTransactionStatusGroup(
    ["CANCELLED", "REFUNDED", "FAILED"],
    [PrismaTransactionStatus.CANCELLED],
  ),
  IN_DISPUTE: [PrismaTransactionStatus.IN_DISPUTE, PrismaTransactionStatus.APPEALED],
}

export const transactionStatusDbValues = Object.fromEntries(
  Object.entries(transactionStatusGroups).map(([key, values]) => [
    key,
    values.map((value) => value.toLowerCase()),
  ]),
) as Record<UiTransactionStatus, string[]>

export const toNullableUiTransactionStatus = (
  status: PrismaTransactionStatus | string | null | undefined,
): UiTransactionStatus | null => {
  if (!status) return null

  const normalizedStatus = status.toString().replace(/-/g, "_").toUpperCase()
  if (transactionStatusGroups.PENDING.some((candidate) => candidate === normalizedStatus)) {
    return "PENDING"
  }
  if (transactionStatusGroups.ACTIVE.some((candidate) => candidate === normalizedStatus)) {
    return "ACTIVE"
  }
  if (transactionStatusGroups.RETURNED.some((candidate) => candidate === normalizedStatus)) {
    return "RETURNED"
  }
  if (transactionStatusGroups.COMPLETED.some((candidate) => candidate === normalizedStatus)) {
    return "COMPLETED"
  }
  if (transactionStatusGroups.CANCELLED.some((candidate) => candidate === normalizedStatus)) {
    return "CANCELLED"
  }
  if (transactionStatusGroups.IN_DISPUTE.some((candidate) => candidate === normalizedStatus)) {
    return "IN_DISPUTE"
  }

  return null
}

export const toUiTransactionStatus = (
  status: PrismaTransactionStatus | string | null | undefined,
): UiTransactionStatus => toNullableUiTransactionStatus(status) ?? "PENDING"
