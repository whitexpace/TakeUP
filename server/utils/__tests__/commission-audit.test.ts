import { describe, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import { mapSystemCommissionRecordRow, type SystemCommissionRecordRow } from "../wallet"

describe("commission audit mapping", () => {
  it("maps a system wallet commission row into an auditable commission record", () => {
    const collectedAt = new Date("2026-05-03T10:30:00.000Z")
    const row: SystemCommissionRecordRow = {
      id: "commission-record-1",
      walletId: "system-wallet-1",
      referenceCode: "WTX-CM-20260503-000001",
      bookingId: "booking-1",
      sourceTransactionId: "transaction-1",
      sourceStatus: "completed",
      itemName: "Camera Kit",
      grossAmount: new Prisma.Decimal(1000),
      commissionAmount: new Prisma.Decimal(50),
      netReleasedToLender: new Prisma.Decimal(950),
      walletStatus: "SUCCESS",
      collectedAt,
    }

    expect(mapSystemCommissionRecordRow(row)).toEqual({
      id: "commission-record-1",
      walletId: "system-wallet-1",
      referenceCode: "WTX-CM-20260503-000001",
      bookingId: "booking-1",
      sourceTransactionId: "transaction-1",
      transactionStatus: "COMPLETED",
      itemName: "Camera Kit",
      grossAmount: 1000,
      commissionAmount: 50,
      netReleasedToLender: 950,
      walletStatus: "SUCCESS",
      collectedAt,
    })
  })
})
