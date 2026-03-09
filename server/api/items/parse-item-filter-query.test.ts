import { describe, expect, it } from "vitest"
import { parseItemFilterQuery } from "./parse-item-filter-query"

describe("parseItemFilterQuery", () => {
  it("parses shared item filter params including rating", () => {
    expect(
      parseItemFilterQuery({
        search: " camera ",
        categories: "ELECTRONICS,OTHERS",
        conditions: "GOOD,FAIR",
        tags: "photo,audio",
        minPrice: "25",
        maxPrice: "300",
        freeToBorrow: "false",
        availableFrom: "2026-03-10T09:00:00",
        availableTo: "2026-03-12T18:00:00",
        minRating: "4",
      }),
    ).toEqual({
      search: " camera ",
      categories: ["ELECTRONICS", "OTHERS"],
      conditions: ["GOOD", "FAIR"],
      tags: ["photo", "audio"],
      minPrice: 25,
      maxPrice: 300,
      freeToBorrow: false,
      availableFrom: "2026-03-10T09:00:00",
      availableTo: "2026-03-12T18:00:00",
      minRating: 4,
    })
  })

  it("omits missing or unsupported params", () => {
    expect(
      parseItemFilterQuery({
        categories: "",
        freeToBorrow: "maybe",
        minRating: undefined,
      }),
    ).toEqual({})
  })
})
