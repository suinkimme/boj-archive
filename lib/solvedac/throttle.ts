// Token bucket for solved.ac requests. One bucket per Node instance
// (Vercel function); different instances share the same upstream IP
// pool so this is effectively per-instance pacing, which is enough
// to avoid tripping rate limits.

const CAPACITY = 10
const REFILL_PER_SEC = 5

class TokenBucket {
  private tokens = CAPACITY
  private lastRefill = Date.now()

  private refill() {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    if (elapsed > 0) {
      this.tokens = Math.min(CAPACITY, this.tokens + elapsed * REFILL_PER_SEC)
      this.lastRefill = now
    }
  }

  async acquire(): Promise<void> {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    const waitMs = ((1 - this.tokens) / REFILL_PER_SEC) * 1000
    await new Promise((r) => setTimeout(r, waitMs))
    return this.acquire()
  }
}

const bucket = new TokenBucket()

export function acquireSolvedAcToken(): Promise<void> {
  return bucket.acquire()
}
