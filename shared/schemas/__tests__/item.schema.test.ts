import { describe, expect, it } from "vitest"
import {
  createItemSchema,
  itemAvailabilityRangeSchema,
  listItemsSchema,
  paginatedItemsSchema,
  updateItemSchema,
} from "../item"

const VALID_UUID = "11111111-1111-1111-1111-111111111111"

describe("item schema validations", () => {
  it("applies defaults and transforms for createItemSchema", () => {
    const parsed = createItemSchema.parse({
      name: "Cordless Drill",
      condition: "GOOD",
      categories: ["TOOLS", "TOOLS"],
      tags: ["  LAB  ", "lab", "  "],
      rentalFee: 150,
      availability: [
        {
          startDate: "2026-03-10T00:00:00.000Z",
          endDate: "2026-03-12T00:00:00.000Z",
          status: "AVAILABLE",
        },
      ],
    })

    expect(parsed.status).toBe("AVAILABLE")
    expect(parsed.rateOption).toBe("PER_DAY")
    expect(parsed.freeToBorrow).toBe(false)
    expect(parsed.photos).toEqual([])
    expect(parsed.categories).toEqual(["TOOLS"])
    expect(parsed.tags).toEqual(["lab"])
    expect(parsed.availability[0]?.startDate).toBeInstanceOf(Date)
    expect(parsed.availability[0]?.endDate).toBeInstanceOf(Date)
  })

  it("rejects availability ranges where endDate is not later than startDate", () => {
    const result = itemAvailabilityRangeSchema.safeParse({
      startDate: "2026-03-12T00:00:00.000Z",
      endDate: "2026-03-12T00:00:00.000Z",
      status: "AVAILABLE",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "endDate")).toBe(true)
      expect(
        result.error.issues.some((issue) => issue.message.includes("later than startDate")),
      ).toBe(true)
    }
  })

  it("rejects overlapping availability ranges", () => {
    const result = createItemSchema.safeParse({
      name: "Camera",
      condition: "LIKE_NEW",
      categories: ["ELECTRONICS"],
      tags: ["photo"],
      rentalFee: 500,
      availability: [
        {
          startDate: "2026-03-10T00:00:00.000Z",
          endDate: "2026-03-12T00:00:00.000Z",
          status: "AVAILABLE",
        },
        {
          startDate: "2026-03-11T00:00:00.000Z",
          endDate: "2026-03-13T00:00:00.000Z",
          status: "AVAILABLE",
        },
      ],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("must not overlap"))).toBe(
        true,
      )
    }
  })

  it("requires at least one mutable field for updateItemSchema", () => {
    const result = updateItemSchema.safeParse({ id: VALID_UUID })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("At least one field is required for update"),
        ),
      ).toBe(true)
    }
  })

  it("normalizes list filters (trim + dedupe)", () => {
    const parsed = listItemsSchema.parse({
      search: "   camera   ",
      categories: ["ELECTRONICS", "ELECTRONICS"],
      tags: ["  Lens  ", "lens", "  "],
    })

    expect(parsed?.search).toBe("camera")
    expect(parsed?.categories).toEqual(["ELECTRONICS"])
    expect(parsed?.tags).toEqual(["lens"])
  })

  it("parses paginated items schema with defaults", () => {
    const parsed = paginatedItemsSchema.parse({
      search: "   camera   ",
      categories: ["ELECTRONICS", "ELECTRONICS"],
    })

    expect(parsed.search).toBe("camera")
    expect(parsed.limit).toBe(12)
    expect(parsed.categories).toEqual(["ELECTRONICS"])
  })
})
