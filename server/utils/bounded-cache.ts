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
