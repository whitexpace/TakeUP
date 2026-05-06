export const scheduleIdleWarmup = (task: () => void, options: { timeout?: number } = {}) => {
  if (import.meta.server) {
    return
  }

  const timeout = options.timeout ?? 1200

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    ;(
      window as Window & {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number
      }
    ).requestIdleCallback?.(() => task(), { timeout })
    return
  }

  window.setTimeout(task, Math.min(timeout, 300))
}
