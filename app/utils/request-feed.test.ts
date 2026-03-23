import { describe, expect, it } from "vitest"
import {
  formatRequestDateRange,
  formatRequestPriceRange,
  formatRequestRelativeTime,
} from "./request-feed"

describe("request-feed utils", () => {
  it("formats a target price range in pesos", () => {
    expect(formatRequestPriceRange(300, 750)).toBe("₱300 - ₱750")
    expect(formatRequestPriceRange(500, 500)).toBe("₱500")
  })

  it("formats a request date range compactly", () => {
    expect(
      formatRequestDateRange("2026-03-25T00:00:00.000Z", "2026-03-27T00:00:00.000Z"),
    ).toBe("Mar 25 - Mar 27, 2026")
  })

  it("formats relative request recency", () => {
    expect(
      formatRequestRelativeTime("2026-03-20T10:00:00.000Z", new Date("2026-03-20T10:30:00.000Z")),
    ).toBe("30m ago")
    expect(
      formatRequestRelativeTime("2026-03-20T08:00:00.000Z", new Date("2026-03-20T10:00:00.000Z")),
    ).toBe("2h ago")
  })
})
