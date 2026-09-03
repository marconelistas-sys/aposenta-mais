export function createRateLimiter({ limit = 5, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const attempts = new Map()

  return {
    consume(key) {
      const timestamp = now()
      const existing = attempts.get(key)
      const entry = !existing || timestamp >= existing.resetAt
        ? { count: 0, resetAt: timestamp + windowMs }
        : existing
      entry.count += 1
      attempts.set(key, entry)

      return {
        allowed: entry.count <= limit,
        remaining: Math.max(0, limit - entry.count),
        retryAfter: Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000))
      }
    },
    clear() {
      attempts.clear()
    }
  }
}
