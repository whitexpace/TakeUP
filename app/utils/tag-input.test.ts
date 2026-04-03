import { describe, expect, it } from "vitest"
import { mergeParsedTags, parseTagInput } from "./tag-input"

describe("tag-input utils", () => {
  it("parses comma-separated tags", () => {
    expect(parseTagInput("aa, bb, ccc")).toEqual(["aa", "bb", "ccc"])
  })

  it("parses space-separated tags", () => {
    expect(parseTagInput("bbbb cccc ddd")).toEqual(["bbbb", "cccc", "ddd"])
  })

  it("parses mixed separators and ignores empty entries", () => {
    expect(parseTagInput(" alpha,   beta   gamma ,, ")).toEqual(["alpha", "beta", "gamma"])
  })

  it("filters invalid or empty tags", () => {
    expect(parseTagInput(" , ,, --- *** valid ")).toEqual(["valid"])
  })

  it("merges parsed tags without duplicates", () => {
    expect(mergeParsedTags(["camera"], "camera tripod, bag")).toEqual([
      "camera",
      "tripod",
      "bag",
    ])
  })
})
