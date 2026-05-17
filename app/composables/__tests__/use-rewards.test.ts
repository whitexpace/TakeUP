import { ref } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useRewards } from "../use-rewards"

vi.mock("#app", () => ({
  useState: (key: string, init: () => unknown) =>
    (
      globalThis as unknown as {
        useState: (stateKey: string, stateInit: () => unknown) => ReturnType<typeof ref>
      }
    ).useState(key, init),
}))

vi.mock("../use-account-prefetch", () => ({
  useAccountPrefetch: () => ({
    warmAccount: vi.fn().mockResolvedValue(undefined),
  }),
}))

const createStateMock = () => {
  const store = new Map<string, ReturnType<typeof ref>>()

  return (key: string, init: () => unknown) => {
    if (!store.has(key)) {
      store.set(key, ref(init()))
    }

    return store.get(key)!
  }
}

describe("useRewards", () => {
  beforeEach(() => {
    vi.stubGlobal("useState", createStateMock())
    vi.stubGlobal("navigateTo", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches and reuses the rewards summary cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      availablePoints: 120,
      totalPointsEarned: 200,
      borrowerPoints: 80,
      lenderPoints: 120,
      pendingPoints: 0,
      recentEvents: [],
      boosts: [],
    })
    vi.stubGlobal("$fetch", fetchMock)

    const { summary, fetchRewardsSummary } = useRewards()

    await fetchRewardsSummary()
    await fetchRewardsSummary()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/rewards", {
      credentials: "same-origin",
    })
    expect(summary.value?.availablePoints).toBe(120)
  })

  it("fetches active boosts separately from the summary cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue([
      {
        id: "boost-1",
        itemId: "item-1",
        itemName: "Camera",
        itemImage: null,
        boostStatus: "ACTIVE",
        boostStartedAt: new Date("2026-01-01T00:00:00.000Z"),
        boostExpiresAt: new Date("2026-01-02T00:00:00.000Z"),
        remainingTime: null,
      },
    ])
    vi.stubGlobal("$fetch", fetchMock)

    const { activeBoostsResponse, fetchActiveBoosts } = useRewards()

    await fetchActiveBoosts()

    expect(fetchMock).toHaveBeenCalledWith("/api/rewards/boosts/active", {
      credentials: "same-origin",
    })
    expect(activeBoostsResponse.value).toHaveLength(1)
  })
})
