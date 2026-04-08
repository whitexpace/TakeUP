import { describe, expect, it } from "vitest"
import { createBookingSchema, updateBookingSchema } from "../booking"

const VALID_ITEM_ID = "11111111-1111-1111-1111-111111111111"
const VALID_BOOKING_ID = "22222222-2222-2222-2222-222222222222"

describe("booking schema validations", () => {
  it("applies defaults for createBookingSchema", () => {
    const parsed = createBookingSchema.parse({
      itemId: VALID_ITEM_ID,
      startDate: "2026-04-01T09:00:00.000Z",
      endDate: "2026-04-02T18:00:00.000Z",
    })

    expect(parsed.platformCommission).toBe(0)
    expect(parsed.paymentMethod).toBe("GCASH")
    expect(parsed.startDate).toBeInstanceOf(Date)
    expect(parsed.endDate).toBeInstanceOf(Date)
  })

  it("rejects createBookingSchema when endDate is not later than startDate", () => {
    const result = createBookingSchema.safeParse({
      itemId: VALID_ITEM_ID,
      startDate: "2026-04-01T09:00:00.000Z",
      endDate: "2026-04-01T09:00:00.000Z",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "endDate")).toBe(true)
      expect(
        result.error.issues.some((issue) => issue.message.includes("later than startDate")),
      ).toBe(true)
    }
  })

  it("requires at least one mutable field for updateBookingSchema", () => {
    const result = updateBookingSchema.safeParse({ id: VALID_BOOKING_ID })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("At least one field is required for update"),
        ),
      ).toBe(true)
    }
  })
})
