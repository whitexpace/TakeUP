import { describe, expect, it } from "vitest"
import { formatBoostDateTime, getRemainingBoostTime } from "./rewards"

describe("rewards utils", () => {
  it("formats sub-day boost timers in hours and minutes", () => {
    const now = new Date("2026-04-18T10:00:00.000Z")
    const expiresAt = new Date("2026-04-18T23:24:00.000Z")

    expect(getRemainingBoostTime(expiresAt, now)).toMatchObject({
      expired: false,
      label: "13h 24m left",
    })
  })

  it("formats multi-day boost timers in days and hours", () => {
    const now = new Date("2026-04-18T10:00:00.000Z")
    const expiresAt = new Date("2026-04-20T14:15:00.000Z")

    expect(getRemainingBoostTime(expiresAt, now)).toMatchObject({
      expired: false,
      label: "2d 4h left",
    })
  })

  it("returns expired for past boost windows", () => {
    const now = new Date("2026-04-18T10:00:00.000Z")
    const expiresAt = new Date("2026-04-18T09:59:00.000Z")

    expect(getRemainingBoostTime(expiresAt, now)).toMatchObject({
      expired: true,
      label: "Expired",
      remainingMs: 0,
    })
  })

  it("formats boost timestamps for display", () => {
    expect(formatBoostDateTime("2026-04-18T10:30:00.000Z")).toContain("Apr")
  })
})
