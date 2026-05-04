import { describe, expect, it } from "vitest"
import { collectDistinctUserIds, summarizeNonZeroAverage } from "../admin-overview"

describe("admin overview helpers", () => {
  it("collects distinct user ids across activity sources", () => {
    expect(
      collectDistinctUserIds(
        ["user-1", "user-2", null],
        ["user-2", undefined, "user-3"],
        ["", "user-1"],
      ),
    ).toEqual(["user-1", "user-2", "user-3"])
  })

  it("summarizes ratings while ignoring zero-default values", () => {
    expect(summarizeNonZeroAverage([0, null, 4.5, 3.5, undefined])).toEqual({
      average: 4,
      count: 2,
    })

    expect(summarizeNonZeroAverage([0, null, undefined])).toEqual({
      average: null,
      count: 0,
    })
  })
})
