import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  extractStoragePathFromPublicUrl,
  removeItemImagesFromStorage,
} from "../item-image-storage"

describe("item-image-storage", () => {
  beforeEach(() => {
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({}))
  })

  it("extracts the storage path from a public item image URL", () => {
    expect(
      extractStoragePathFromPublicUrl(
        "https://example.supabase.co/storage/v1/object/public/item-images/items/user-1/2026-03-23/file-name.jpg",
        "item-images",
      ),
    ).toBe("items/user-1/2026-03-23/file-name.jpg")
  })

  it("returns null for URLs outside the configured bucket", () => {
    expect(
      extractStoragePathFromPublicUrl(
        "https://example.supabase.co/storage/v1/object/public/other-bucket/items/user-1/2026-03-23/file-name.jpg",
        "item-images",
      ),
    ).toBeNull()
  })

  it("deletes only valid item image URLs when a service role key is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({})
    vi.stubGlobal("$fetch", fetchMock)

    const result = await removeItemImagesFromStorage(
      [
        "https://example.supabase.co/storage/v1/object/public/item-images/items/user-1/2026-03-23/file-name.jpg",
        "https://example.supabase.co/storage/v1/object/public/item-images/not-items/file-name.jpg",
      ],
      {
        bucket: "item-images",
        supabaseUrl: "https://example.supabase.co",
        serviceRoleKey: "service-role-key",
      },
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/storage/v1/object/item-images/items/user-1/2026-03-23/file-name.jpg",
      expect.objectContaining({
        method: "DELETE",
      }),
    )
    expect(result.deleted).toEqual([
      "https://example.supabase.co/storage/v1/object/public/item-images/items/user-1/2026-03-23/file-name.jpg",
    ])
    expect(result.skipped).toEqual([
      "https://example.supabase.co/storage/v1/object/public/item-images/not-items/file-name.jpg",
    ])
  })
})
