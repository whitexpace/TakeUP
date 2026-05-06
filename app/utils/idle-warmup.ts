export const scheduleIdleWarmup = (task: () => void, options: { timeout?: number } = {}) => {
  if (import.meta.server) {
    return
  }

  if (typeof window === "undefined") {
    return
  }

  const timeout = options.timeout ?? 1200

  if (typeof (globalThis as any).requestIdleCallback !== "undefined") {
    ;(globalThis as any).requestIdleCallback?.(() => task(), { timeout })
    return
  }

  setTimeout(task, Math.min(timeout, 300))
}
