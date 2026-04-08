import { ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue")
  return {
    ...actual,
    onMounted: (callback: () => void) => callback(),
  }
})

const createStateMock = () => {
  const store = new Map<string, ReturnType<typeof ref>>()

  return (key: string, init: () => unknown) => {
    if (!store.has(key)) {
      store.set(key, ref(init()))
    }

    return store.get(key)!
  }
}

const makeBagItem = (overrides: Record<string, unknown> = {}) => ({
  id: "cart-entry-1",
  itemId: "item-1",
  name: "Camera",
  price: 250,
  priceUnit: "day",
  image: "https://example.com/camera.jpg",
  startAt: new Date("2026-04-01T09:00:00.000Z"),
  endAt: new Date("2026-04-03T09:00:00.000Z"),
  lenderId: "lender-1",
  lenderName: "lender1",
  listingType: "Rent" as const,
  createdAt: new Date("2026-03-23T09:00:00.000Z"),
  ...overrides,
})

describe("useBag", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal("useState", createStateMock())
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ items: [makeBagItem()] }))
    vi.stubGlobal("useSupabaseClient", () => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "token-123" } },
        }),
      },
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("loads persisted bag items from the backend", async () => {
    const { useBag } = await import("../use-bag")

    const { bagItems, loadBag } = useBag()
    await loadBag({ force: true })

    expect($fetch).toHaveBeenCalledWith("/api/cart", {
      headers: { Authorization: "Bearer token-123" },
    })
    expect(bagItems.value).toHaveLength(1)
  })

  it("adds a new bag item through the backend and updates local state", async () => {
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce(makeBagItem()),
    )
    const { useBag } = await import("../use-bag")

    const { bagItems, addToBag } = useBag()
    await addToBag({
      itemId: "item-1",
      startAt: new Date("2026-04-01T09:00:00.000Z"),
      endAt: new Date("2026-04-03T09:00:00.000Z"),
    })

    expect(($fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toBe("/api/cart")
    expect(bagItems.value).toHaveLength(1)
  })

  it("matches an existing bag entry by item and booking window", async () => {
    const { useBag } = await import("../use-bag")

    const { loadBag, hasItemWithWindow } = useBag()
    await loadBag({ force: true })

    expect(
      hasItemWithWindow(
        "item-1",
        new Date("2026-04-01T09:00:00.000Z"),
        new Date("2026-04-03T09:00:00.000Z"),
      ),
    ).toBe(true)
  })
})
