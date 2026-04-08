import { describe, expect, it } from "vitest"
import { createItemRequestSchema } from "../item-request"

describe("createItemRequestSchema", () => {
  it("accepts an optional reference image url", () => {
    const result = createItemRequestSchema.safeParse({
      itemNeeded: "Portable projector",
      referenceImageUrl: "https://example.com/reference-image.jpg",
      requestedDates: ["2026-03-25T00:00:00.000Z", "2026-03-26T00:00:00.000Z"],
      priceRange: [200, 450],
      description: "Need this for a classroom screening.",
      status: "OPEN",
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.referenceImageUrl).toBe("https://example.com/reference-image.jpg")
  })

  it("rejects an invalid reference image url", () => {
    const result = createItemRequestSchema.safeParse({
      itemNeeded: "Portable projector",
      referenceImageUrl: "not-a-url",
      requestedDates: ["2026-03-25T00:00:00.000Z"],
      priceRange: [200, 450],
      description: "Need this for a classroom screening.",
      status: "OPEN",
    })

    expect(result.success).toBe(false)
  })
})
