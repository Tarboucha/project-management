interface RateLimitEntry {
  count: number
  resetAt: number
}

const globalForRateLimit = globalThis as unknown as {
  rateLimitStore?: Map<string, RateLimitEntry>
}

const store = globalForRateLimit.rateLimitStore ?? new Map<string, RateLimitEntry>()
globalForRateLimit.rateLimitStore = store

// Periodic cleanup of expired entries every 5 minutes
let cleanupInterval: ReturnType<typeof setInterval> | null = null
if (!cleanupInterval) {
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000)

  // Don't block process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  const entry = store.get(key)

  // No entry or window expired — start fresh
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  // Within window
  entry.count++

  if (entry.count > limit) {
    const retryAfterMs = entry.resetAt - now
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 }
}
