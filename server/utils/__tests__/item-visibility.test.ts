import { describe, expect, it } from "vitest"
import { isPublicVisibleItem } from "../item-visibility"

const NOW = new Date("2026-04-14T00:00:00.000Z")

const makeItem = (overrides: Partial<Parameters<typeof isPublicVisibleItem>[0]> = {}) => ({
  status: "AVAILABLE",
  lender: { user: { status: "ACTIVE" } },
  availability: [
    {
      startDate: new Date("2026-04-15T00:00:00.000Z"),
      endDate: new Date("2026-04-20T00:00:00.000Z"),
      status: "AVAILABLE",
    },
  ],
  bookings: [],
  ...overrides,
})

describe("item visibility", () => {
  it("shows active items with future available time", () => {
    expect(isPublicVisibleItem(makeItem(), NOW)).toBe(true)
  })

  it("hides inactive or missing-availability items", () => {
    expect(isPublicVisibleItem(makeItem({ status: "DEACTIVATED" }), NOW)).toBe(false)
    expect(isPublicVisibleItem(makeItem({ availability: [] }), NOW)).toBe(false)
  })

  it("ignores past-only availability", () => {
    expect(
      isPublicVisibleItem(
        makeItem({
          availability: [
            {
              startDate: new Date("2026-04-01T00:00:00.000Z"),
              endDate: new Date("2026-04-02T00:00:00.000Z"),
              status: "AVAILABLE",
            },
          ],
        }),
        NOW,
      ),
    ).toBe(false)
  })

  it("hides fully booked future availability", () => {
    expect(
      isPublicVisibleItem(
        makeItem({
          bookings: [
            {
              startDate: new Date("2026-04-15T00:00:00.000Z"),
              endDate: new Date("2026-04-20T00:00:00.000Z"),
              status: "CONFIRMED",
            },
          ],
        }),
        NOW,
      ),
    ).toBe(false)
  })

  it("shows partially booked future availability", () => {
    expect(
      isPublicVisibleItem(
        makeItem({
          bookings: [
            {
              startDate: new Date("2026-04-15T00:00:00.000Z"),
              endDate: new Date("2026-04-16T00:00:00.000Z"),
              status: "CONFIRMED",
            },
          ],
        }),
        NOW,
      ),
    ).toBe(true)
  })

  it("does not treat pending bookings as feed blockers", () => {
    expect(
      isPublicVisibleItem(
        makeItem({
          bookings: [
            {
              startDate: new Date("2026-04-15T00:00:00.000Z"),
              endDate: new Date("2026-04-20T00:00:00.000Z"),
              status: "PENDING",
            },
          ],
        }),
        NOW,
      ),
    ).toBe(true)
  })

  it("hides items when the requested window overlaps a blocking booking", () => {
    expect(
      isPublicVisibleItem(
        makeItem({
          bookings: [
            {
              startDate: new Date("2026-04-16T00:00:00.000Z"),
              endDate: new Date("2026-04-17T00:00:00.000Z"),
              status: "CONFIRMED",
            },
          ],
        }),
        NOW,
        {
          requiredWindow: {
            startDate: new Date("2026-04-16T12:00:00.000Z"),
            endDate: new Date("2026-04-16T18:00:00.000Z"),
          },
        },
      ),
    ).toBe(false)
  })
})
