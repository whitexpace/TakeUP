import { describe, expect, it } from "vitest"
import { createInitialRequestForm, validateRequestForm } from "./request-form"

describe("request-form validation", () => {
  it("builds an empty initial form state", () => {
    expect(createInitialRequestForm()).toEqual({
      itemNeeded: "",
      description: "",
      requestedFrom: "",
      requestedTo: "",
      minTargetPrice: "",
      maxTargetPrice: "",
    })
  })

  it("validates a correct request form payload", () => {
    const result = validateRequestForm({
      itemNeeded: " Portable projector ",
      description: " Need this for a screening. ",
      requestedFrom: "2026-03-25",
      requestedTo: "2026-03-27",
      minTargetPrice: "200",
      maxTargetPrice: "450",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.payload.itemNeeded).toBe("Portable projector")
      expect(result.payload.description).toBe("Need this for a screening.")
    }
  })

  it("rejects invalid dates and price ranges", () => {
    const result = validateRequestForm({
      itemNeeded: "",
      description: "",
      requestedFrom: "2026-03-27",
      requestedTo: "2026-03-25",
      minTargetPrice: "500",
      maxTargetPrice: "200",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.itemNeeded).toBe("Item name is required.")
      expect(result.errors.description).toBe("Description is required.")
      expect(result.errors.requestedTo).toBe(
        "Required end date must be on or after the start date.",
      )
      expect(result.errors.maxTargetPrice).toBe(
        "Maximum target price must be greater than or equal to the minimum target price.",
      )
    }
  })
})
