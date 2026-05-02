import { gt, lt, sql } from 'drizzle-orm'

import { db } from '@/db'
import { solvedAcRequestLog } from '@/db/schema'
import { logEvent } from '@/lib/log'

// Cross-instance rate limit. solvedAcRequestLog rows in the last
// WINDOW_MS define our "current rate"; we proceed when count < MAX.
// Slight overshoot is possible under contention but acceptable —
// solved.ac tolerates short bursts and our outer per-instance throttle
// already smooths within an instance.

const MAX_PER_WINDOW = 5
const WINDOW_MS = 1000
const POLL_MS = 100
const CLEANUP_OLDER_THAN_MS = 10_000
const SLOW_WAIT_MS = 1_000

export async function acquireGlobalSolvedAcSlot(): Promise<void> {
  const startedAt = Date.now()
  for (;;) {
    const since = new Date(Date.now() - WINDOW_MS)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(solvedAcRequestLog)
      .where(gt(solvedAcRequestLog.requestedAt, since))

    if (count < MAX_PER_WINDOW) {
      await db.insert(solvedAcRequestLog).values({})
      // Opportunistic cleanup; ignore errors.
      const cutoff = new Date(Date.now() - CLEANUP_OLDER_THAN_MS)
      void db
        .delete(solvedAcRequestLog)
        .where(lt(solvedAcRequestLog.requestedAt, cutoff))
        .catch(() => {})

      const waitedMs = Date.now() - startedAt
      if (waitedMs >= SLOW_WAIT_MS) {
        logEvent('slot_wait_slow', { waitedMs, observedCount: count })
      }
      return
    }

    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}
