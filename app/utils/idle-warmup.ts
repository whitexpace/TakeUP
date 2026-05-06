export const scheduleIdleWarmup = (task: () => void, options: { timeout?: number } = {}) => {
  if (import.meta.server) {
    return
  }

  if (typeof window === "undefined") {
    return
  }

  const timeout = options.timeout ?? 1200

  const w = globalThis as unknown as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number
  }

  if (typeof w.requestIdleCallback !== "undefined") {
    w.requestIdleCallback?.(() => task(), { timeout })
    return
  }

  setTimeout(task, Math.min(timeout, 300))
}
