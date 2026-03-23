import { describe, expect, it } from "vitest"
import { addToCartSchema, cartEntryIdSchema } from "../cart"

describe("cart schema", () => {
  it("accepts valid add-to-cart input", () => {
    const result = addToCartSchema.safeParse({
      itemId: "11111111-1111-1111-1111-111111111111",
      startAt: "2026-04-01T09:00:00.000Z",
      endAt: "2026-04-03T09:00:00.000Z",
    })

    expect(result.success).toBe(true)
  })

  it("rejects an endAt value that is not later than startAt", () => {
    const result = addToCartSchema.safeParse({
      itemId: "11111111-1111-1111-1111-111111111111",
      startAt: "2026-04-03T09:00:00.000Z",
      endAt: "2026-04-03T09:00:00.000Z",
    })

    expect(result.success).toBe(false)
  })

  it("requires a valid cart entry id", () => {
    const result = cartEntryIdSchema.safeParse({ id: "not-a-uuid" })

    expect(result.success).toBe(false)
  })
})
