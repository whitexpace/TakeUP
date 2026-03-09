import { describe, expect, it } from "vitest"
import { buildItemDetailPath, buildItemDetailSlug, extractItemIdFromSlug, slugifyItemName } from "./item-detail-route"

describe("item-detail-route", () => {
  it("slugifies item names into stable URL segments", () => {
    expect(slugifyItemName("Sony A7 IV - Digital Camera")).toBe("sony-a7-iv-digital-camera")
  })

  it("builds item detail paths with slug and id", () => {
    expect(
      buildItemDetailPath({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Portable Speaker #089",
      }),
    ).toBe("/items/portable-speaker-089--11111111-1111-4111-8111-111111111111")
  })

  it("extracts the item id from slug routes and plain ids", () => {
    const id = "11111111-1111-4111-8111-111111111111"

    expect(extractItemIdFromSlug(buildItemDetailSlug({ id, name: "Projector" }))).toBe(id)
    expect(extractItemIdFromSlug(id)).toBe(id)
    expect(extractItemIdFromSlug("not-a-valid-item")).toBeNull()
  })
})
