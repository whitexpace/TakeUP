type ExpiringEntry = {
  expiresAt: number
}

export const pruneExpiredEntries = <K, V extends ExpiringEntry>(
  cache: Map<K, V>,
  now = Date.now(),
) => {
  for (const [key, value] of cache) {
    if (value.expiresAt <= now) {
      cache.delete(key)
    }
  }
}

export const enforceMaxMapSize = <K, V>(cache: Map<K, V>, maxEntries: number) => {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    cache.delete(oldestKey)
  }
}

export const setBoundedMapEntry = <K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
  maxEntries: number,
) => {
  cache.delete(key)
  cache.set(key, value)
  enforceMaxMapSize(cache, maxEntries)
}

export const addBoundedSetEntry = <T>(entries: Set<T>, value: T, maxEntries: number) => {
  if (entries.has(value)) {
    return
  }

  while (entries.size >= maxEntries) {
    const oldestValue = entries.values().next().value
    if (oldestValue === undefined) {
      break
    }
    entries.delete(oldestValue)
  }

  entries.add(value)
}
