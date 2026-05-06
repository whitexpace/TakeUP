import { useState } from "#app"
import { watch, type Ref } from "vue"
import { recordPerfEvent } from "../utils/performance-telemetry"

type PersistedSessionStateOptions<T> = {
  storageKey?: string
  deep?: boolean
  serialize?: (value: T) => string
  deserialize?: (value: string) => T
}

const restoredSessionStateKeys = new Set<string>()
const watchedSessionStateKeys = new Set<string>()

const canUseSessionStorage = () => import.meta.client && typeof window !== "undefined"

export const clearPersistedSessionState = (key: string, options?: { storageKey?: string }) => {
  if (!canUseSessionStorage()) {
    return
  }

  const storageKey = options?.storageKey ?? `session-state:${key}`
  window.sessionStorage.removeItem(storageKey)
  recordPerfEvent("session-state", key, "persist-clear")
}

export const usePersistedSessionState = <T>(
  key: string,
  init: () => T,
  options: PersistedSessionStateOptions<T> = {},
): Ref<T> => {
  const state = useState<T>(key, init)
  const storageKey = options.storageKey ?? `session-state:${key}`
  const serialize = options.serialize ?? ((value: T) => JSON.stringify(value))
  const deserialize = options.deserialize ?? ((value: string) => JSON.parse(value) as T)

  if (canUseSessionStorage() && !restoredSessionStateKeys.has(storageKey)) {
    restoredSessionStateKeys.add(storageKey)

    try {
      const storedValue = window.sessionStorage.getItem(storageKey)
      if (storedValue !== null) {
        state.value = deserialize(storedValue)
        recordPerfEvent("session-state", key, "persist-restore-hit")
      } else {
        recordPerfEvent("session-state", key, "persist-restore-miss")
      }
    } catch {
      window.sessionStorage.removeItem(storageKey)
      recordPerfEvent("session-state", key, "persist-restore-error")
    }
  }

  if (canUseSessionStorage() && !watchedSessionStateKeys.has(storageKey)) {
    watchedSessionStateKeys.add(storageKey)

    watch(
      state,
      (value) => {
        try {
          window.sessionStorage.setItem(storageKey, serialize(value))
          recordPerfEvent("session-state", key, "persist-write")
        } catch {
          // Ignore storage quota and serialization failures.
        }
      },
      {
        deep: options.deep ?? true,
      },
    )
  }

  return state
}
