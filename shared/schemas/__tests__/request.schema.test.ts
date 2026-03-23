import { describe, expect, it } from "vitest"
import { createRequestSchema } from "../request"

describe("createRequestSchema", () => {
  it("accepts a valid request payload", () => {
    const result = createRequestSchema.safeParse({
      itemNeeded: "Portable projector",
      description: "Need this for a classroom screening.",
      requestedFrom: "2026-03-25",
      requestedTo: "2026-03-27",
      minTargetPrice: 200,
      maxTargetPrice: 450,
    })

    expect(result.success).toBe(true)
  })

  it("rejects missing required fields", () => {
    const result = createRequestSchema.safeParse({
      itemNeeded: "  ",
      description: "",
      requestedFrom: "",
      requestedTo: "",
      minTargetPrice: -1,
      maxTargetPrice: -1,
    })

    expect(result.success).toBe(false)
  })

  it("rejects an end date before the start date", () => {
    const result = createRequestSchema.safeParse({
      itemNeeded: "Portable projector",
      description: "Need this for a classroom screening.",
      requestedFrom: "2026-03-27",
      requestedTo: "2026-03-25",
      minTargetPrice: 200,
      maxTargetPrice: 450,
    })

    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.requestedTo).toContain(
      "Requested end date must be on or after the start date.",
    )
  })

  it("rejects a max price below the min price", () => {
    const result = createRequestSchema.safeParse({
      itemNeeded: "Portable projector",
      description: "Need this for a classroom screening.",
      requestedFrom: "2026-03-25",
      requestedTo: "2026-03-27",
      minTargetPrice: 500,
      maxTargetPrice: 450,
    })

    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.maxTargetPrice).toContain(
      "Maximum target price must be greater than or equal to the minimum target price.",
    )
  })
})
